import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from './src/backend/database/db.js';

async function debugLogin(username, password) {
    console.log(`\n🔍 Debugging Login for user: '${username}' with password: '${password}'`);

    try {
        // 1. Check DB Connection
        const time = await query('SELECT NOW()');
        console.log('✅ DB Connected. Server Time:', time[0].now);

        // 2. Find User
        console.log(`Looking for user '${username}' in users_auth...`);
        const users = await query('SELECT * FROM users_auth WHERE username = $1', [username]);

        if (users.length === 0) {
            console.error('❌ User NOT FOUND in database.');
            const allUsers = await query('SELECT username FROM users_auth');
            console.log('   Available users:', allUsers.map(u => u.username).join(', '));
            return;
        }

        const user = users[0];
        console.log(`✅ User found. ID: ${user.id}, Hash in DB: ${user.password.substring(0, 20)}...`);

        // 3. Compare Password
        console.log('Comparing passwords with bcrypt...');
        const match = await bcrypt.compare(password, user.password);

        if (match) {
            console.log('✅ PASSWORD MATCH! Login should work.');
        } else {
            console.error('❌ PASSWORD MISMATCH.');

            // Debug: Hash the input password to see what it looks like
            const newHash = await bcrypt.hash(password, 10);
            console.log(`   Input password '${password}' hashes to: ${newHash.substring(0, 20)}...`);
            console.log(`   Stored hash is: ${user.password.substring(0, 20)}...`);
        }

    } catch (e) {
        console.error('❌ EXCEPTION:', e);
    }
}

// Run for both users
async function run() {
    await debugLogin('admin', '1234');
    await debugLogin('admin2', '1234');
    process.exit(0);
}

run();
