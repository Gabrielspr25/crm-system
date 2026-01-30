import pkg from 'pg';
const { Pool } = pkg;

// Pool de conexión a la BD del POS
let posPool = null;

/**
 * Inicializa el pool de conexión al POS
 */
function initializePOSPool() {
  if (!posPool) {
    posPool = new Pool({
      host: process.env.POS_DB_HOST || '167.99.12.125',
      port: parseInt(process.env.POS_DB_PORT || '5432'),
      user: process.env.POS_DB_USER || 'postgres',
      password: process.env.POS_DB_PASSWORD,
      database: process.env.POS_DB_NAME || 'claropr',
      ssl: {
        rejectUnauthorized: false
      },
      max: 5, // Máximo 5 conexiones en el pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    posPool.on('error', (err) => {
      console.error('❌ Error inesperado en pool POS:', err);
    });
  }
  return posPool;
}

/**
 * Mapea los datos del CRM a los campos de la tabla clientecredito del POS
 */
function mapearClienteCRMaPOS(clienteCRM) {
  const esEmpresa = !!(clienteCRM.name && clienteCRM.name.trim());
  const tieneEmail = !!(clienteCRM.email && clienteCRM.email.trim());
  
  // Extraer nombre y apellido si no es empresa
  let nombre = esEmpresa ? clienteCRM.name : (clienteCRM.owner_name || '').split(' ')[0] || null;
  let apellido = esEmpresa ? null : (clienteCRM.owner_name || '').split(' ').slice(1).join(' ') || null;
  
  return [
    clienteCRM.tax_id || null,                           // $1 - segurosocial
    nombre,                                              // $2 - nombre
    apellido,                                            // $3 - apellido
    clienteCRM.address || null,                          // $4 - direccionpostal
    clienteCRM.address || null,                          // $5 - direccionfisica
    clienteCRM.contact_person || null,                   // $6 - nombrecontacto
    null,                                                // $7 - numeroagente
    null,                                                // $8 - licenciaconducir
    null,                                                // $9 - vencimientolicenciaconducir
    null,                                                // $10 - fechanacimiento
    null,                                                // $11 - ocupacion
    clienteCRM.includes_ban ? 'PENDIENTE' : null,        // $12 - ban
    null,                                                // $13 - clasificacioncredito
    null,                                                // $14 - lineacredito
    0.00,                                                // $15 - depositorequerido
    null,                                                // $16 - lineasaprobadas
    clienteCRM.cellular || null,                         // $17 - telefonotrabajo
    clienteCRM.additional_phone || null,                 // $18 - telefonoresidencia
    clienteCRM.phone || null,                            // $19 - telefonocontacto
    null,                                                // $20 - numerofisica
    null,                                                // $21 - barriofisica
    clienteCRM.zip_code || null,                         // $22 - zipcodefisica
    null,                                                // $23 - numeropostal
    null,                                                // $24 - barriopostal
    clienteCRM.zip_code || null,                         // $25 - zipcodepostal
    clienteCRM.email || null,                            // $26 - email
    true,                                                // $27 - activo
    clienteCRM.city || null,                             // $28 - pueblofisica
    null,                                                // $29 - nota
    new Date(),                                          // $30 - fechallamado
    new Date(),                                          // $31 - fechacontratoinicial
    false,                                               // $32 - sindatos
    clienteCRM.salesperson_id || null,                   // $33 - usuarioseguimientoid
    null,                                                // $34 - crmclientestatusid
    null,                                                // $35 - crmclientestatusfecha
    !tieneEmail,                                         // $36 - sinemail
    true,                                                // $37 - mismadireccion
    5,                                                   // $38 - id_negocio
    0,                                                   // $39 - limitefinanciamiento
    19,                                                  // $40 - status
    clienteCRM.salesperson_id || null,                   // $41 - seller
    'NO',                                                // $42 - clarofijo
    'NO',                                                // $43 - tv
    esEmpresa                                            // $44 - pyme
  ];
}

/**
 * Verifica si un cliente ya existe en el POS
 */
export async function verificarClienteExistente(req, res) {
  const client = initializePOSPool();
  
  try {
    const { tax_id, email } = req.body;
    
    if (!tax_id && !email) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar tax_id o email para verificar'
      });
    }
    
    const query = `
      SELECT clientecreditoid, nombre, email, segurosocial
      FROM clientecredito
      WHERE segurosocial = $1
         OR (email IS NOT NULL AND email = $2)
      LIMIT 1
    `;
    
    const result = await client.query(query, [tax_id, email]);
    
    if (result.rows.length > 0) {
      return res.json({
        existe: true,
        cliente: result.rows[0]
      });
    }
    
    return res.json({ existe: false });
    
  } catch (error) {
    console.error('❌ Error verificando cliente en POS:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al verificar cliente en POS',
      detail: error.message
    });
  }
}

/**
 * Envía un cliente del CRM al sistema POS
 */
export async function enviarClienteAPOS(req, res) {
  const client = initializePOSPool();
  
  try {
    const clienteCRM = req.body;
    
    // Validaciones
    if (!clienteCRM.salesperson_id) {
      return res.status(400).json({
        success: false,
        error: 'El campo "Vendedor Asignado" es obligatorio'
      });
    }
    
    if (!clienteCRM.name && !clienteCRM.owner_name) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar "Empresa/Razón Social" o "Nombre"'
      });
    }
    
    // Verificar si ya existe
    if (clienteCRM.tax_id || clienteCRM.email) {
      const checkQuery = `
        SELECT clientecreditoid, nombre
        FROM clientecredito
        WHERE segurosocial = $1
           OR (email IS NOT NULL AND email = $2)
        LIMIT 1
      `;
      
      const checkResult = await client.query(checkQuery, [
        clienteCRM.tax_id,
        clienteCRM.email
      ]);
      
      if (checkResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un cliente en el POS con ese RNC/Cédula o Email',
          clientePOS: checkResult.rows[0]
        });
      }
    }
    
    // Insertar en el POS
    const insertQuery = `
      INSERT INTO clientecredito (
        segurosocial, nombre, apellido, direccionpostal, direccionfisica,
        nombrecontacto, numeroagente, licenciaconducir, vencimientolicenciaconducir,
        fechanacimiento, ocupacion, ban, clasificacioncredito, lineacredito,
        depositorequerido, lineasaprobadas, telefonotrabajo, telefonoresidencia,
        telefonocontacto, numerofisica, barriofisica, zipcodefisica, numeropostal,
        barriopostal, zipcodepostal, email, activo, pueblofisica, nota,
        fechallamado, fechacontratoinicial, sindatos, usuarioseguimientoid,
        crmclientestatusid, crmclientestatusfecha, sinemail, mismadireccion,
        id_negocio, limitefinanciamiento, status, seller, clarofijo, tv, pyme
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44
      )
      RETURNING clientecreditoid, nombre, email
    `;
    
    const values = mapearClienteCRMaPOS(clienteCRM);
    const result = await client.query(insertQuery, values);
    
    console.log('✅ Cliente enviado al POS exitosamente:', result.rows[0]);
    
    return res.status(201).json({
      success: true,
      clientecreditoid: result.rows[0].clientecreditoid,
      nombre: result.rows[0].nombre,
      email: result.rows[0].email,
      message: 'Cliente enviado al POS exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error al insertar cliente en POS:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al enviar cliente al POS',
      detail: error.message,
      hint: error.hint || null
    });
  }
}

/**
 * Test de conexión al POS
 */
export async function testConexionPOS(req, res) {
  const client = initializePOSPool();
  
  try {
    const result = await client.query('SELECT NOW() as tiempo_servidor, version() as version_pg');
    
    return res.json({
      success: true,
      message: 'Conexión exitosa al POS',
      servidor: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error de conexión al POS:', error);
    return res.status(500).json({
      success: false,
      error: 'No se pudo conectar al POS',
      detail: error.message
    });
  }
}
