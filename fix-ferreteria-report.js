
import { Client } from 'ssh2';

const config = {
    host: '143.244.191.139',
    port: 22,
    username: 'root',
    password: 'CL@70049ro'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('🔧 CORRIGIENDO REPORTE FERRETERIA...\n');

    // Asignar el primer vendor activo a la venta de Ferreteria Comercial
    const script = `
DO $$
DECLARE
    v_vendor_id INTEGER;
BEGIN
    -- 1. Buscar vendor id
    SELECT id INTO v_vendor_id FROM vendors LIMIT 1;
    
    -- 2. Actualizar follow_up
    UPDATE follow_up_prospects 
    SET vendor_id = v_vendor_id,
        movil_nueva = 1,
        total_amount = 1,
        step_id = 5 -- Asegurar que esté en paso 'Venta' o 'Completado'
    WHERE company_name = 'FERRETERIA COMERCIAL' 
    AND vendor_id IS NULL;
    
    RAISE NOTICE 'Actualizado vendor_id: % y montos a 1', v_vendor_id;
END $$;
`;

    // Escapar para bash
    const escaped = script.replace(/'/g, "'\\''").replace(/\$\$/g, "\\$\\$");

    const cmd = `su - postgres -c "psql -d crm_pro -c '${escaped}'"`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Corrección aplicada.');
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect(config);
