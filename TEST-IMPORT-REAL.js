busca ese archivo y es e que vas a probar hasta dejaro en BedDouble
import pg from 'pg';
import fs from 'fs';
import { BedDouble } from 'lucide-react'

const { Pool } = pg;

// Configuración BD
const pool = new Pool({
    host: '143.244.191.139',
    port: 5432,
    database: 'crm_pro',
    user: 'crm_user',
    password: 'CRM_Seguro_2025!',
});

// Mapeo de alias de columnas
const COLUMN_ALIASES = {
    // Clientes
    'owner_name': ['PROPIETARIO', 'DUEÑO', 'OWNER', 'PROPIETARIO EMPRESA'],
    'name': ['NOMBRE EMPRESA', 'EMPRESA', 'RAZON SOCIAL', 'CLIENTE', 'NOMBRE CLIENTE', 'COMPANY'],
    'contact_person': ['CONTACTO', 'PERSONA CONTACTO', 'CONTACT PERSON', 'NOMBRE CONTACTO', 'NOMBRE', 'APELLIDO'],
    'email': ['EMAIL', 'CORREO', 'E-MAIL', 'MAIL'],
    'phone': ['TELEFONO', 'TEL', 'PHONE', 'TELEFONO EMPRESA'],
    'additional_phone': ['TELEFONO ADICIONAL', 'TEL2', 'TELEFONO 2', 'PHONE 2'],
    'cellular': ['CELULAR', 'MOVIL', 'CEL', 'CELLULAR', 'MOBILE'],
    'address': ['DIRECCION', 'ADDRESS', 'DIR'],
    'city': ['CIUDAD', 'CITY', 'MUNICIPIO'],
    'zip_code': ['CODIGO POSTAL', 'CP', 'ZIP', 'POSTAL CODE'],
    
    // BANs
    'ban_number': ['BAN', 'NUMERO BAN', 'BAN NUMBER', 'NUM BAN', 'CUENTA'],
    'account_type': ['TIPO CUENTA', 'ACCOUNT TYPE', 'TIPO', 'CATEGORY'],
    'status': ['ESTADO', 'STATUS', 'ESTATUS', 'ACTIVO'],
    
    // Suscriptores
    'subscriber_phone': ['SUB', 'TELEFONO SUSCRIPTOR', 'NUMERO', 'PHONE NUMBER', 'LINE', 'LINEA'],
    'plan': ['PLAN', 'SERVICIO', 'SERVICE'],
    'monthly_value': ['VALOR MENSUAL', 'MONTHLY VALUE', 'PRECIO', 'PRICE', 'VALOR'],
    'remaining_payments': ['PAGOS RESTANTES', 'REMAINING PAYMENTS', 'MESES RESTANTES'],
    'contract_term': ['PLAZO CONTRATO', 'CONTRACT TERM', 'MESES CONTRATO', 'TERM'],
    'contract_end_date': ['FECHA FIN CONTRATO', 'CONTRACT END DATE', 'VENCIMIENTO', 'FIN CONTRATO']
};

function findColumnMatch(headers, aliases) {
    const normalizedHeaders = headers.map(h => String(h || '').toUpperCase().trim());
    
    for (const [targetField, aliasList] of Object.entries(aliases)) {
        for (const alias of aliasList) {
            const idx = normalizedHeaders.findIndex(h => h.includes(alias.toUpperCase()));
            if (idx !== -1) {
                return { field: targetField, index: idx, originalName: headers[idx] };
            }
        }
    }
    return null;
}

function detectColumns(headers) {
    const mapping = {
        headers: headers, // Guardar headers para usarlos en parseRow
        clients: {},
        bans: {},
        subscribers: {}
    };
    
    // Mapear clientes
    for (const field of ['owner_name', 'name', 'contact_person', 'email', 'phone', 'additional_phone', 'cellular', 'address', 'city', 'zip_code']) {
        const match = findColumnMatch(headers, { [field]: COLUMN_ALIASES[field] });
        if (match) {
            mapping.clients[field] = match;
        }
    }
    
    // Mapear BANs
    for (const field of ['ban_number', 'account_type', 'status']) {
        const match = findColumnMatch(headers, { [field]: COLUMN_ALIASES[field] });
        if (match) {
            mapping.bans[field] = match;
        }
    }
    
    // Mapear suscriptores
    for (const field of ['subscriber_phone', 'plan', 'monthly_value', 'remaining_payments', 'contract_term', 'contract_end_date']) {
        const match = findColumnMatch(headers, { [field]: COLUMN_ALIASES[field] });
        if (match) {
            mapping.subscribers[field] = match;
        }
    }
    
    return mapping;
}

function parseRow(row, mapping) {
    const client = {};
    const ban = {};
    const subscriber = {};
    
    // Parsear clientes
    for (const [field, info] of Object.entries(mapping.clients)) {
        const value = row[info.index];
        client[field] = value ? String(value).trim() : null;
    }
    
    // Construir nombre del cliente desde Nombre/Apellido si EMPRESA está vacío
    if (!client.name || client.name === 'NULL') {
        // Buscar columnas Nombre y Apellido
        const nombreCol = mapping.headers.findIndex(h => h && h.toUpperCase() === 'NOMBRE');
        const apellidoCol = mapping.headers.findIndex(h => h && h.toUpperCase() === 'APELLIDO');
        
        const nombre = nombreCol >= 0 && row[nombreCol] ? String(row[nombreCol]).trim() : '';
        const apellido = apellidoCol >= 0 && row[apellidoCol] ? String(row[apellidoCol]).trim() : '';
        
        if (nombre || apellido) {
            client.name = [nombre, apellido].filter(x => x).join(' ');
        }
    }
    
    // Parsear BANs
    for (const [field, info] of Object.entries(mapping.bans)) {
        const value = row[info.index];
        ban[field] = value ? String(value).trim() : null;
    }
    
    // Parsear suscriptores
    for (const [field, info] of Object.entries(mapping.subscribers)) {
        const value = row[info.index];
        subscriber[field] = value ? String(value).trim() : null;
    }
    
    return { client, ban, subscriber };
}

async function importData(filePath, saveToDb = false) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 IMPORTACIÓN ${saveToDb ? 'REAL' : 'SIMULADA'}`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`📁 Archivo: ${filePath}`);
    
    // Leer Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    console.log(`📄 Hoja: ${sheetName}`);
    console.log(`📋 Total filas: ${data.length}`);
    
    if (data.length === 0) {
        console.log('❌ Archivo vacío');
        return;
    }
    
    // Detectar columnas
    const headers = data[0];
    console.log(`\n🔍 Encabezados detectados: ${headers.length} columnas`);
    
    const mapping = detectColumns(headers);
    
    console.log('\n📌 MAPEO DE COLUMNAS:');
    console.log('\n  CLIENTES:');
    for (const [field, info] of Object.entries(mapping.clients)) {
        console.log(`    ✓ ${field.padEnd(20)} <- [Col ${info.index}] ${info.originalName}`);
    }
    
    console.log('\n  BANS:');
    for (const [field, info] of Object.entries(mapping.bans)) {
        console.log(`    ✓ ${field.padEnd(20)} <- [Col ${info.index}] ${info.originalName}`);
    }
    
    console.log('\n  SUSCRIPTORES:');
    for (const [field, info] of Object.entries(mapping.subscribers)) {
        console.log(`    ✓ ${field.padEnd(20)} <- [Col ${info.index}] ${info.originalName}`);
    }
    
    // Validar campos requeridos
    if (!mapping.bans.ban_number) {
        console.log('\n❌ ERROR: No se encontró columna BAN (requerida)');
        return;
    }
    
    if (!mapping.subscribers.subscriber_phone) {
        console.log('\n❌ ERROR: No se encontró columna TELÉFONO SUSCRIPTOR (requerida)');
        return;
    }
    
    console.log('\n✅ Validación de campos requeridos: OK\n');
    
    // Procesar datos
    const stats = {
        processed: 0,
        created: 0,
        updated: 0,
        errors: [],
        omitted: 0,
        clientsCreated: 0,
        bansCreated: 0,
        subscribersCreated: 0
    };
    
    const client = saveToDb ? await pool.connect() : null;
    
    try {
        if (saveToDb) {
            await client.query('BEGIN');
            console.log('🔒 Transacción iniciada\n');
        }
        
        console.log('🔄 Procesando filas...\n');
        
        // Procesar TODAS las filas
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            stats.processed++;
            
            if (stats.processed % 100 === 0) {
                process.stdout.write(`\r   Procesadas: ${stats.processed}/${data.length - 1}`);
            }
            
            try {
                const parsed = parseRow(row, mapping);
                
                const banNumber = parsed.ban.ban_number;
                const phone = parsed.subscriber.subscriber_phone;
                
                if (!banNumber) {
                    stats.omitted++;
                    continue;
                }
                
                if (!phone) {
                    stats.omitted++;
                    continue;
                }
                
                let clientId = null;
                let banId = null;
                
                if (saveToDb) {
                    // Buscar BAN existente
                    const existingBan = await client.query(
                        'SELECT id, client_id FROM bans WHERE ban_number = $1',
                        [banNumber]
                    );
                    
                    if (existingBan.rows.length > 0) {
                        banId = existingBan.rows[0].id;
                        clientId = existingBan.rows[0].client_id;
                        stats.updated++;
                    } else {
                        // Crear cliente
                        const clientResult = await client.query(
                            `INSERT INTO clients (owner_name, name, contact_person, email, phone, additional_phone, cellular, address, city, zip_code)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                             RETURNING id`,
                            [
                                parsed.client.owner_name,
                                parsed.client.name || `Cliente BAN ${banNumber}`,
                                parsed.client.contact_person,
                                parsed.client.email,
                                parsed.client.phone,
                                parsed.client.additional_phone,
                                parsed.client.cellular,
                                parsed.client.address,
                                parsed.client.city,
                                parsed.client.zip_code
                            ]
                        );
                        clientId = clientResult.rows[0].id;
                        stats.clientsCreated++;
                        
                        // Crear BAN
                        const statusRaw = String(parsed.ban.status || 'A').toUpperCase().trim();
                        // Solo acepta 'C' o 'A', si viene otra cosa poner 'A'
                        const statusValue = (statusRaw === 'C' || statusRaw === 'A') ? statusRaw : 'A';
                        
                        const banResult = await client.query(
                            `INSERT INTO bans (ban_number, client_id, account_type, status)
                             VALUES ($1, $2, $3, $4)
                             RETURNING id`,
                            [banNumber, clientId, parsed.ban.account_type || null, statusValue]
                        );
                        banId = banResult.rows[0].id;
                        stats.bansCreated++;
                        stats.created++;
                    }
                    
                    // Crear suscriptor
                    const existingSub = await client.query(
                        'SELECT id FROM subscribers WHERE phone = $1 AND ban_id = $2',
                        [phone, banId]
                    );
                    
                    if (existingSub.rows.length === 0) {
                        await client.query(
                            `INSERT INTO subscribers (phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date, ban_id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                            [
                                phone,
                                parsed.subscriber.plan,
                                parsed.subscriber.monthly_value || 0,
                                parsed.subscriber.remaining_payments || 0,
                                parsed.subscriber.contract_term || 0,
                                parsed.subscriber.contract_end_date,
                                banId
                            ]
                        );
                        stats.subscribersCreated++;
                    }
                } else {
                    stats.created++;
                }
                
            } catch (err) {
                stats.errors.push(`Fila ${i + 1}: ${err.message}`);
            }
        }
        
        console.log('\r' + ' '.repeat(50) + '\r');
        
        if (saveToDb) {
            await client.query('COMMIT');
            console.log('✅ COMMIT: Cambios guardados en BD\n');
        } else {
            console.log('ℹ️  MODO SIMULACIÓN: No se guardó nada\n');
        }
        
    } catch (err) {
        if (saveToDb && client) {
            await client.query('ROLLBACK');
            console.log(`\n❌ ROLLBACK: Error durante importación\n${err.message}\n`);
        }
        throw err;
    } finally {
        if (client) {
            client.release();
        }
    }
    
    // Reporte final
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 REPORTE FINAL`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`  Filas procesadas:      ${stats.processed}`);
    console.log(`  Filas omitidas:        ${stats.omitted}`);
    console.log(`  Registros creados:     ${stats.created}`);
    console.log(`  Registros actualizados: ${stats.updated}`);
    
    if (saveToDb) {
        console.log(`\n  Clientes creados:      ${stats.clientsCreated}`);
        console.log(`  BANs creados:          ${stats.bansCreated}`);
        console.log(`  Suscriptores creados:  ${stats.subscribersCreated}`);
    }
    
    if (stats.errors.length > 0) {
        console.log(`\n  ⚠️  Errores: ${stats.errors.length}`);
        stats.errors.slice(0, 10).forEach(err => console.log(`    - ${err}`));
        if (stats.errors.length > 10) {
            console.log(`    ... y ${stats.errors.length - 10} más`);
        }
    }
    
    console.log(`\n${'='.repeat(80)}\n`);
}

// EJECUTAR
const filePath = 'elementos_extra/excels/final UNIFICADO_CLIENTES_HERNAN.xlsx';

console.log('Verificando archivo...');
if (!fs.existsSync(filePath)) {
    console.log(`❌ Archivo no existe: ${filePath}`);
    process.exit(1);
}

importData(filePath, true)
    .then(() => {
        console.log('✅ Importación completada');
        process.exit(0);
    })
    .catch(err => {
        console.error(`❌ Error fatal: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    })
    .finally(() => {
        pool.end();
    });
