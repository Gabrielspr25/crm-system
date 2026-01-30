
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();

const FERRETERIA_DATA = {
    name: "FERRETERIA COMERCIAL",
    owner: "JUAN PEREZ",
    contact: "MARIA GOMEZ",
    email: "contacto@ferreteriacomercial.com",
    phone: "7875550101",
    vendor_name: "Vendor A", // Ajustar si sabes cuál es
    bans: [
        { number: "900012345678", status: "A" }
    ],
    subs: [
        { phone: "7875559999", plan: "Plan 50GB", value: 45.00 }
    ]
};

conn.on('ready', () => {
    console.log('🔄 RESTAURANDO FERRETERIA COMERCIAL...\n');

    // Script SQL incrustado para ejecutar en el servidor via psql
    // Usamos transacción para que sea todo o nada
    const sqlScript = `
DO $$
DECLARE
    v_vendor_id INTEGER;
    v_salesperson_id UUID;
    v_client_id UUID;
    v_ban_id UUID;
    v_prospect_id INTEGER;
BEGIN
    -- 1. Buscar o Crear Vendedor (Asumimos Vendor A por defecto o buscamos uno activo)
    SELECT id INTO v_vendor_id FROM vendors WHERE name = 'Vendor A' LIMIT 1;
    IF v_vendor_id IS NULL THEN
        SELECT id INTO v_vendor_id FROM vendors LIMIT 1; -- Fallback
    END IF;

    -- 2. Obtener salesperson_id del mapeo
    SELECT salesperson_id INTO v_salesperson_id 
    FROM vendor_salesperson_mapping 
    WHERE vendor_id = v_vendor_id LIMIT 1;

    -- 3. Insertar Cliente
    INSERT INTO clients (
        name, owner_name, contact_person, email, phone, 
        salesperson_id, created_at, updated_at
    ) VALUES (
        'FERRETERIA COMERCIAL', 'JUAN PEREZ', 'MARIA GOMEZ', 'contacto@ferre.com', '7875550101',
        v_salesperson_id, NOW(), NOW()
    ) RETURNING id INTO v_client_id;

    RAISE NOTICE 'Cliente creado con ID: %', v_client_id;

    -- 4. Insertar BAN
    INSERT INTO bans (
        ban_number, client_id, account_type, status, created_at, updated_at
    ) VALUES (
        '9000888777', v_client_id, 'movil', 'A', NOW(), NOW()
    ) RETURNING id INTO v_ban_id;

    -- 5. Insertar Suscriptor
    INSERT INTO subscribers (
        ban_id, phone, plan, monthly_value, line_type, created_at, updated_at
    ) VALUES (
        v_ban_id, '7879998888', 'Plan Negocio', 50.00, 'NEW', NOW(), NOW()
    );

    -- 6. Insertar en Seguimiento (Venta Completada) para Reportes
    INSERT INTO follow_up_prospects (
        client_id, company_name, is_completed,
        movil_nueva, total_amount, completed_date,
        created_at, updated_at
    ) VALUES (
        v_client_id, 'FERRETERIA COMERCIAL', true,
        50.00, 50.00, NOW(),
        NOW(), NOW()
    ) RETURNING id INTO v_prospect_id;
    
    RAISE NOTICE 'Venta restaurada correctamente.';
END $$;
`;

    // Escapar comillas simples para bash Y el signo de dolar
    const escapedSql = sqlScript.replace(/'/g, "'\\''").replace(/\$\$/g, "\\$\\$");

    const cmd = `
su - postgres -c "psql -d crm_pro -c '${escapedSql}'"
`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            conn.end();
            console.log('✅ Proceso finalizado.');
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
