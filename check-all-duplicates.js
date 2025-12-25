
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicates in follow_up_prospects...');

  // 1. Get all completed prospects
  const { data: prospects, error } = await supabase
    .from('follow_up_prospects')
    .select('id, company_name, client_id, created_at, total_amount')
    .eq('is_completed', true);

  if (error) {
    console.error('❌ Error fetching prospects:', error);
    return;
  }

  console.log(`📊 Total completed prospects: ${prospects.length}`);

  // 2. Find duplicates by company_name
  const nameMap = {};
  const duplicates = [];

  prospects.forEach(p => {
    const name = p.company_name?.trim().toLowerCase();
    if (!name) return;

    if (nameMap[name]) {
      duplicates.push({
        original: nameMap[name],
        duplicate: p
      });
    } else {
      nameMap[name] = p;
    }
  });

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found by company_name.');
  } else {
    console.log(`⚠️ Found ${duplicates.length} duplicates!`);
    duplicates.forEach((d, index) => {
      console.log(`\nDuplicate #${index + 1}: "${d.original.company_name}"`);
      console.log(`   Original (ID: ${d.original.id}): Created ${d.original.created_at}, Amount: ${d.original.total_amount}`);
      console.log(`   Duplicate (ID: ${d.duplicate.id}): Created ${d.duplicate.created_at}, Amount: ${d.duplicate.total_amount}`);
    });
  }
}

checkDuplicates();
