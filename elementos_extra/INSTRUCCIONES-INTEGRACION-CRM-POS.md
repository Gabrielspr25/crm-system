# INSTRUCCIONES TÉCNICAS: Integración CRM → POS

**Proyecto:** Sincronización de Clientes desde CRM VentasPro hacia Sistema POS  
**Fecha:** 2026-01-19  
**Versión:** 1.0

---

## 🎯 OBJETIVO

Implementar un botón en el formulario "Nuevo Cliente" del CRM que permita enviar los datos del cliente directamente a la base de datos del sistema POS (tabla `clientecredito`).

---

## 🔐 CREDENCIALES Y CONEXIÓN

### **Base de Datos PostgreSQL:**

```
Host:     167.99.12.125
Puerto:   5432 (por defecto PostgreSQL)
Usuario:  postgres
Password: fF00JIRFXc
Database: claropr
SSL:      Requerido (TLSv1.2)
```

### **Conexión de Ejemplo (Node.js con pg):**

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: '167.99.12.125',
  port: 5432,
  user: 'postgres',
  password: 'fF00JIRFXc',
  database: 'claropr',
  ssl: {
    rejectUnauthorized: false
  }
});
```

---

## 📊 MAPEO DE CAMPOS: CRM → Base de Datos

### **Tabla Destino:** `clientecredito`

| # | **Campo CRM** | **Campo BD** | **Tipo BD** | **Obligatorio** | **Notas** |
|---|---------------|--------------|-------------|-----------------|-----------|
| **IDENTIFICACIÓN Y DATOS PERSONALES** |
| 1 | TaxID | `segurosocial` | bigint | ❌ | SSN o EIN de la empresa |
| 2 | Nombre (Dueño) | `nombre` | varchar | ❌ | Si es empresa, usar "Empresa/Razón Social" |
| 3 | Apellido (Dueño) | `apellido` | varchar | ❌ | NULL si es empresa |
| 4 | - | `licenciaconducir` | varchar | ❌ | No disponible en CRM, enviar NULL |
| 5 | - | `vencimientolicenciaconducir` | date | ❌ | No disponible en CRM, enviar NULL |
| 6 | - | `fechanacimiento` | date | ❌ | No disponible en CRM, enviar NULL |
| 7 | - | `ocupacion` | varchar | ❌ | No disponible en CRM, enviar NULL |
| 8 | Empresa / Razón Social | `nombre` | varchar | ❌ | Si existe, usar este en lugar de "Nombre" |
| 9 | Persona de Contacto | `nombrecontacto` | varchar | ❌ | Contacto de referencia |
| **INFORMACIÓN DE CONTACTO** |
| 10 | - | `telefonoresidencia` | bigint | ❌ | Mapear "Teléfono Adicional" aquí |
| 11 | Teléfono | `telefonocontacto` | bigint | ❌ | Teléfono principal |
| 12 | Celular | `telefonotrabajo` | bigint | ❌ | Mapear celular a teléfono trabajo |
| 13 | Teléfono Adicional | `telefonoresidencia` | bigint | ❌ | Teléfono secundario |
| 14 | Email | `email` | varchar | ❌ | Correo electrónico |
| 15 | - | `sinemail` | boolean | ❌ | `true` si email está vacío, `false` si tiene email |
| **DIRECCIONES** |
| 16 | Dirección (completa) | `direccionfisica` | varchar | ❌ | Dirección completa |
| 17 | Dirección (completa) | `direccionpostal` | varchar | ❌ | Misma que física |
| 18 | Ciudad | `pueblofisica` | varchar | ❌ | Ciudad/Pueblo |
| 19 | Código Postal | `zipcodefisica` | varchar | ❌ | Código postal |
| 20 | Código Postal | `zipcodepostal` | varchar | ❌ | Mismo que físico |
| 21 | - | `numerofisica` | varchar | ❌ | NULL (no disponible) |
| 22 | - | `barriofisica` | varchar | ❌ | NULL (no disponible) |
| 23 | - | `numeropostal` | varchar | ❌ | NULL (no disponible) |
| 24 | - | `barriopostal` | varchar | ❌ | NULL (no disponible) |
| 25 | - | `mismadireccion` | boolean | ❌ | Siempre `true` (CRM solo tiene una dirección) |
| **CRÉDITO Y VENTA** |
| 26 | - | `clasificacioncredito` | varchar | ❌ | NULL (no disponible en CRM) |
| 27 | - | `depositorequerido` | numeric(20,2) | ❌ | `0.00` por defecto |
| 28 | - | `lineasaprobadas` | bigint | ❌ | NULL (no disponible) |
| 29 | - | `lineacredito` | varchar | ❌ | NULL (no disponible) |
| 30 | - | `limitefinanciamiento` | numeric(20,2) | ❌ | `0` por defecto |
| 31 | - | `fechallamado` | date | ❌ | Fecha actual al momento del INSERT |
| 32 | - | `fechacontratoinicial` | date | ❌ | Fecha actual al momento del INSERT |
| 33 | - | `numeroagente` | varchar | ❌ | NULL (no disponible) |
| **ASIGNACIÓN Y CONFIGURACIÓN** |
| 34 | Vendedor Asignado | `seller` | integer | ❌ | ID del vendedor seleccionado |
| 35 | Vendedor Asignado | `usuarioseguimientoid` | bigint | ❌ | Mismo ID que seller |
| 36 | ☑ Este cliente incluye BANs | `ban` | varchar | ❌ | 'PENDIENTE' si está marcado, NULL si no |
| **CAMPOS CON VALORES POR DEFECTO** |
| 37 | - | `activo` | boolean | ❌ | `true` (siempre) |
| 38 | - | `sindatos` | boolean | ❌ | `false` (siempre) |
| 39 | - | `crmclientestatusid` | bigint | ❌ | NULL |
| 40 | - | `crmclientestatusfecha` | date | ❌ | NULL |
| 41 | - | `id_negocio` | integer | ❌ | `5` (valor fijo) |
| 42 | - | `status` | integer | ❌ | `19` (valor fijo) |
| 43 | - | `clarofijo` | text | ❌ | `'NO'` (valor fijo) |
| 44 | - | `tv` | text | ❌ | `'NO'` (valor fijo) |
| 45 | Empresa / Razón Social | `pyme` | boolean | ❌ | `true` si tiene "Empresa", `false` si no |
| **OTROS** |
| 46 | - | `nota` | varchar | ❌ | NULL (no disponible en CRM) |

---

## 📝 QUERY SQL DE INSERCIÓN

### **Query Completo:**

```sql
INSERT INTO clientecredito (
    segurosocial,
    nombre,
    apellido,
    direccionpostal,
    direccionfisica,
    nombrecontacto,
    numeroagente,
    licenciaconducir,
    vencimientolicenciaconducir,
    fechanacimiento,
    ocupacion,
    ban,
    clasificacioncredito,
    lineacredito,
    depositorequerido,
    lineasaprobadas,
    telefonotrabajo,
    telefonoresidencia,
    telefonocontacto,
    numerofisica,
    barriofisica,
    zipcodefisica,
    numeropostal,
    barriopostal,
    zipcodepostal,
    email,
    activo,
    pueblofisica,
    nota,
    fechallamado,
    fechacontratoinicial,
    sindatos,
    usuarioseguimientoid,
    crmclientestatusid,
    crmclientestatusfecha,
    sinemail,
    mismadireccion,
    id_negocio,
    limitefinanciamiento,
    status,
    seller,
    clarofijo,
    tv,
    pyme
) VALUES (
    $1,   -- segurosocial (TaxID del CRM)
    $2,   -- nombre (Empresa/Razón Social o Nombre)
    $3,   -- apellido (NULL si es empresa)
    $4,   -- direccionpostal (Dirección del CRM)
    $5,   -- direccionfisica (Dirección del CRM)
    $6,   -- nombrecontacto (Persona de Contacto)
    $7,   -- numeroagente (NULL)
    $8,   -- licenciaconducir (NULL)
    $9,   -- vencimientolicenciaconducir (NULL)
    $10,  -- fechanacimiento (NULL)
    $11,  -- ocupacion (NULL)
    $12,  -- ban ('PENDIENTE' si incluye BANs, NULL si no)
    $13,  -- clasificacioncredito (NULL)
    $14,  -- lineacredito (NULL)
    $15,  -- depositorequerido (0.00)
    $16,  -- lineasaprobadas (NULL)
    $17,  -- telefonotrabajo (Celular del CRM)
    $18,  -- telefonoresidencia (Teléfono Adicional del CRM)
    $19,  -- telefonocontacto (Teléfono del CRM)
    $20,  -- numerofisica (NULL)
    $21,  -- barriofisica (NULL)
    $22,  -- zipcodefisica (Código Postal del CRM)
    $23,  -- numeropostal (NULL)
    $24,  -- barriopostal (NULL)
    $25,  -- zipcodepostal (Código Postal del CRM)
    $26,  -- email (Email del CRM)
    $27,  -- activo (true)
    $28,  -- pueblofisica (Ciudad del CRM)
    $29,  -- nota (NULL)
    $30,  -- fechallamado (CURRENT_DATE)
    $31,  -- fechacontratoinicial (CURRENT_DATE)
    $32,  -- sindatos (false)
    $33,  -- usuarioseguimientoid (Vendedor Asignado)
    $34,  -- crmclientestatusid (NULL)
    $35,  -- crmclientestatusfecha (NULL)
    $36,  -- sinemail (true si email vacío, false si tiene)
    $37,  -- mismadireccion (true)
    $38,  -- id_negocio (5)
    $39,  -- limitefinanciamiento (0)
    $40,  -- status (19)
    $41,  -- seller (Vendedor Asignado)
    $42,  -- clarofijo ('NO')
    $43,  -- tv ('NO')
    $44   -- pyme (true si tiene Empresa, false si no)
)
RETURNING clientecreditoid;
```

---

## 💻 CÓDIGO DE IMPLEMENTACIÓN

### **Función de Mapeo (JavaScript/Node.js):**

```javascript
/**
 * Mapea los datos del formulario CRM a los campos de la tabla clientecredito
 * @param {Object} clienteCRM - Datos del formulario del CRM
 * @returns {Array} - Array de valores para el query parametrizado
 */
function mapearClienteCRMaPOS(clienteCRM) {
    const esEmpresa = !!clienteCRM.empresaRazonSocial;
    const tieneEmail = !!clienteCRM.email && clienteCRM.email.trim() !== '';
    
    return [
        clienteCRM.taxId || null,                                    // $1 - segurosocial
        esEmpresa ? clienteCRM.empresaRazonSocial : clienteCRM.nombre, // $2 - nombre
        esEmpresa ? null : clienteCRM.apellido,                      // $3 - apellido
        clienteCRM.direccion || null,                                // $4 - direccionpostal
        clienteCRM.direccion || null,                                // $5 - direccionfisica
        clienteCRM.personaContacto || null,                          // $6 - nombrecontacto
        null,                                                        // $7 - numeroagente
        null,                                                        // $8 - licenciaconducir
        null,                                                        // $9 - vencimientolicenciaconducir
        null,                                                        // $10 - fechanacimiento
        null,                                                        // $11 - ocupacion
        clienteCRM.incluyeBans ? 'PENDIENTE' : null,                // $12 - ban
        null,                                                        // $13 - clasificacioncredito
        null,                                                        // $14 - lineacredito
        0.00,                                                        // $15 - depositorequerido
        null,                                                        // $16 - lineasaprobadas
        clienteCRM.celular || null,                                  // $17 - telefonotrabajo
        clienteCRM.telefonoAdicional || null,                        // $18 - telefonoresidencia
        clienteCRM.telefono || null,                                 // $19 - telefonocontacto
        null,                                                        // $20 - numerofisica
        null,                                                        // $21 - barriofisica
        clienteCRM.codigoPostal || null,                             // $22 - zipcodefisica
        null,                                                        // $23 - numeropostal
        null,                                                        // $24 - barriopostal
        clienteCRM.codigoPostal || null,                             // $25 - zipcodepostal
        clienteCRM.email || null,                                    // $26 - email
        true,                                                        // $27 - activo
        clienteCRM.ciudad || null,                                   // $28 - pueblofisica
        null,                                                        // $29 - nota
        new Date(),                                                  // $30 - fechallamado
        new Date(),                                                  // $31 - fechacontratoinicial
        false,                                                       // $32 - sindatos
        clienteCRM.vendedorAsignado || null,                         // $33 - usuarioseguimientoid
        null,                                                        // $34 - crmclientestatusid
        null,                                                        // $35 - crmclientestatusfecha
        !tieneEmail,                                                 // $36 - sinemail
        true,                                                        // $37 - mismadireccion
        5,                                                           // $38 - id_negocio
        0,                                                           // $39 - limitefinanciamiento
        19,                                                          // $40 - status
        clienteCRM.vendedorAsignado || null,                         // $41 - seller
        'NO',                                                        // $42 - clarofijo
        'NO',                                                        // $43 - tv
        esEmpresa                                                    // $44 - pyme
    ];
}
```

### **Función de Inserción:**

```javascript
/**
 * Inserta un cliente del CRM en la base de datos del POS
 * @param {Object} clienteCRM - Datos del cliente del CRM
 * @returns {Promise<Object>} - Resultado con el ID del cliente creado
 */
async function enviarClienteAPOS(clienteCRM) {
    const client = await pool.connect();
    
    try {
        const query = `
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
            RETURNING clientecreditoid
        `;
        
        const values = mapearClienteCRMaPOS(clienteCRM);
        const result = await client.query(query, values);
        
        return {
            success: true,
            clientecreditoid: result.rows[0].clientecreditoid,
            message: 'Cliente enviado al POS exitosamente'
        };
        
    } catch (error) {
        console.error('Error al insertar cliente en POS:', error);
        return {
            success: false,
            error: error.message,
            detail: error.detail || null
        };
    } finally {
        client.release();
    }
}
```

### **Endpoint API (Express.js):**

```javascript
const express = require('express');
const router = express.Router();

/**
 * POST /api/crm/enviar-a-pos
 * Envía un cliente del CRM al sistema POS
 */
router.post('/enviar-a-pos', async (req, res) => {
    try {
        // Validar datos requeridos
        const { empresaRazonSocial, nombre, vendedorAsignado } = req.body;
        
        if (!vendedorAsignado) {
            return res.status(400).json({
                success: false,
                error: 'El campo "Vendedor Asignado" es obligatorio'
            });
        }
        
        if (!empresaRazonSocial && !nombre) {
            return res.status(400).json({
                success: false,
                error: 'Debe proporcionar "Empresa/Razón Social" o "Nombre"'
            });
        }
        
        // Enviar al POS
        const resultado = await enviarClienteAPOS(req.body);
        
        if (resultado.success) {
            res.status(201).json(resultado);
        } else {
            res.status(500).json(resultado);
        }
        
    } catch (error) {
        console.error('Error en endpoint enviar-a-pos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            detail: error.message
        });
    }
});

module.exports = router;
```

---

## 🎨 INTERFAZ DE USUARIO

### **Ubicación del Botón:**

En el modal "Nuevo Cliente" del CRM, agregar un botón adicional:

```
[Cancelar]  [Crear Cliente]  [Crear y Enviar a POS]
```

O después de crear el cliente:

```
✅ Cliente creado exitosamente en el CRM

[Enviar a POS]
```

### **Código Frontend (Ejemplo con React):**

```javascript
const handleEnviarAPOS = async () => {
    try {
        setLoading(true);
        
        const response = await fetch('/api/crm/enviar-a-pos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Si usan autenticación
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            toast.success(`Cliente enviado al POS exitosamente. ID: ${result.clientecreditoid}`);
            // Opcional: cerrar modal o resetear formulario
        } else {
            toast.error(`Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
        toast.error('Error al enviar cliente al POS');
    } finally {
        setLoading(false);
    }
};
```

---

## ⚠️ VALIDACIONES REQUERIDAS

### **1. Validaciones en el Backend:**

```javascript
function validarDatosCliente(clienteCRM) {
    const errores = [];
    
    // Vendedor asignado es obligatorio
    if (!clienteCRM.vendedorAsignado) {
        errores.push('Vendedor Asignado es obligatorio');
    }
    
    // Debe tener nombre o empresa
    if (!clienteCRM.empresaRazonSocial && !clienteCRM.nombre) {
        errores.push('Debe proporcionar Empresa/Razón Social o Nombre');
    }
    
    // Validar formato de email si existe
    if (clienteCRM.email && !validarEmail(clienteCRM.email)) {
        errores.push('Formato de email inválido');
    }
    
    // Validar formato de teléfonos (solo números)
    if (clienteCRM.telefono && !/^\d+$/.test(clienteCRM.telefono)) {
        errores.push('Teléfono debe contener solo números');
    }
    
    // Validar TaxID (9 dígitos para SSN, puede ser más para EIN)
    if (clienteCRM.taxId && clienteCRM.taxId.toString().length < 9) {
        errores.push('TaxID debe tener al menos 9 dígitos');
    }
    
    return errores;
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}
```

### **2. Manejo de Duplicados:**

```javascript
async function verificarClienteExistente(clienteCRM) {
    const query = `
        SELECT clientecreditoid, nombre, email
        FROM clientecredito
        WHERE segurosocial = $1
           OR (email IS NOT NULL AND email = $2)
        LIMIT 1
    `;
    
    const result = await pool.query(query, [
        clienteCRM.taxId,
        clienteCRM.email
    ]);
    
    if (result.rows.length > 0) {
        return {
            existe: true,
            cliente: result.rows[0]
        };
    }
    
    return { existe: false };
}
```

---

## 📊 ESTRUCTURA DE DATOS

### **Objeto Cliente CRM (Entrada):**

```javascript
{
    "taxId": 123456789,                    // Número (SSN o EIN)
    "nombre": "Juan",                      // String
    "apellido": "Pérez",                   // String
    "empresaRazonSocial": "Tech Corp PR",  // String (opcional)
    "personaContacto": "María González",   // String
    "email": "contacto@techcorp.com",      // String
    "telefono": 7871234567,                // Número
    "telefonoAdicional": 7879876543,       // Número
    "celular": 9391234567,                 // Número
    "direccion": "Calle Principal #123",   // String
    "ciudad": "San Juan",                  // String
    "codigoPostal": "00926",               // String
    "vendedorAsignado": 5,                 // Número (ID del vendedor)
    "incluyeBans": true                    // Boolean
}
```

### **Respuesta Exitosa:**

```javascript
{
    "success": true,
    "clientecreditoid": 66123,
    "message": "Cliente enviado al POS exitosamente"
}
```

### **Respuesta de Error:**

```javascript
{
    "success": false,
    "error": "Vendedor Asignado es obligatorio",
    "detail": null
}
```

---

## 🔍 TESTING

### **1. Test de Conexión:**

```javascript
async function testConexion() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conexión exitosa:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
}
```

### **2. Test de Inserción:**

```javascript
const clientePrueba = {
    taxId: 999888777,
    nombre: "Cliente",
    apellido: "Prueba",
    empresaRazonSocial: null,
    personaContacto: "Contacto Test",
    email: "test@ejemplo.com",
    telefono: 7871111111,
    telefonoAdicional: null,
    celular: 9392222222,
    direccion: "Dirección de Prueba #123",
    ciudad: "San Juan",
    codigoPostal: "00926",
    vendedorAsignado: 1,
    incluyeBans: false
};

// Ejecutar test
const resultado = await enviarClienteAPOS(clientePrueba);
console.log('Resultado:', resultado);
```

---

## 📝 LOGS Y AUDITORÍA

### **Registrar Cada Sincronización:**

```javascript
async function registrarSincronizacion(clienteCRMId, clientePOSId, resultado) {
    const query = `
        INSERT INTO log_sincronizacion_crm_pos (
            cliente_crm_id,
            cliente_pos_id,
            fecha_sincronizacion,
            exitoso,
            error_mensaje
        ) VALUES ($1, $2, NOW(), $3, $4)
    `;
    
    await pool.query(query, [
        clienteCRMId,
        clientePOSId,
        resultado.success,
        resultado.error || null
    ]);
}
```

---

## 🚨 MANEJO DE ERRORES

### **Errores Comunes y Soluciones:**

| Error | Causa | Solución |
|-------|-------|----------|
| `connection refused` | BD no accesible | Verificar IP, puerto, firewall |
| `authentication failed` | Credenciales incorrectas | Verificar usuario/password |
| `duplicate key value` | Cliente ya existe | Implementar verificación previa |
| `foreign key violation` | Vendedor no existe | Validar que el vendedor exista en BD |
| `invalid input syntax` | Tipo de dato incorrecto | Validar tipos antes de enviar |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Instalar dependencia `pg` (PostgreSQL client)
- [ ] Configurar conexión a la base de datos
- [ ] Implementar función `mapearClienteCRMaPOS()`
- [ ] Implementar función `enviarClienteAPOS()`
- [ ] Crear endpoint `/api/crm/enviar-a-pos`
- [ ] Agregar validaciones de datos
- [ ] Implementar verificación de duplicados
- [ ] Agregar botón en el frontend del CRM
- [ ] Implementar llamada al API desde el frontend
- [ ] Agregar manejo de errores y mensajes al usuario
- [ ] Implementar sistema de logs
- [ ] Realizar pruebas con datos de ejemplo
- [ ] Documentar el proceso para el equipo

---

## 📞 CONTACTO Y SOPORTE

**En caso de dudas o problemas:**
- Revisar logs de la aplicación
- Verificar conectividad a la base de datos
- Consultar este documento
- Contactar al equipo de desarrollo

---

## 📌 NOTAS IMPORTANTES

1. **Seguridad:** Las credenciales de la base de datos deben estar en variables de entorno, NO en el código
2. **Transacciones:** Considerar usar transacciones si se insertan datos en múltiples tablas
3. **Performance:** La conexión usa un pool para mejor rendimiento
4. **SSL:** La conexión requiere SSL (TLSv1.2)
5. **Sincronización:** Esta es una sincronización unidireccional (CRM → POS)
6. **Campos NULL:** Muchos campos pueden ser NULL, el sistema POS los completará después

---

**Versión del Documento:** 1.0  
**Última Actualización:** 2026-01-19  
**Autor:** Antigravity AI
