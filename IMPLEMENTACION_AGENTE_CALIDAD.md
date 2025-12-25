# 🛡️ Plan de Implementación: Agente de Control de Calidad (QA Agent)

## 🚨 El Problema
Actualmente, al arreglar una funcionalidad (ej. "Guardar BAN"), a veces rompemos otra o deshacemos cambios previos. Necesitamos un "Guardián" que verifique que **todo** siga funcionando antes de dar por buena una versión.

## 🤖 La Solución: Agente de Verificación Integrado

Implementaremos un sistema de **Autodiagnóstico** accesible desde el inicio del sistema.

### 1. Botón de "Diagnóstico de Sistema" (Frontend)
En la pantalla de Login o en el Dashboard principal, agregaremos un botón visible (ej. "🏥 Estado del Sistema") que ejecutará una batería de pruebas en tiempo real.

### 2. Pruebas Automatizadas (Lo que verificará)

#### A. Verificación de Integridad (Backend)
- **Conexión BD**: ¿La base de datos responde?
- **Estructura de Tablas**: ¿Existen las columnas críticas? (ej. `is_completed` en `follow_up_prospects`, `client_id` en `bans`).
- **Permisos**: ¿El usuario de la BD tiene permisos de escritura?

#### B. Verificación de Funcionalidad (Simulaciones)
El agente intentará realizar estas acciones en modo "Simulacro" (y luego revertirá los cambios):
1.  **Crear Cliente**: Intentar insertar un cliente `TEST_AGENT`.
2.  **Crear BAN**: Asignar un BAN al cliente `TEST_AGENT`.
3.  **Editar BAN**: Cambiar el estado del BAN (lo que fallaba antes).
4.  **Crear Suscriptor**: Asignar una línea.
5.  **Limpieza**: Borrar los datos de prueba.

Si alguno de estos pasos falla, el sistema mostrará una **ALERTA ROJA** indicando exactamente qué archivo o función falló.

### 3. Flujo de Trabajo Obligatorio
1.  **Antes de editar**: Ejecutar Diagnóstico.
2.  **Realizar cambios**: Editar código.
3.  **Después de editar**: Ejecutar Diagnóstico nuevamente.
4.  **Solo si pasa**: Desplegar.

## 🛠️ Pasos Técnicos para Implementar AHORA

1.  **Backend**: Crear endpoint `/api/health-check/full` que ejecute la lógica de prueba (Crear/Editar/Borrar).
2.  **Frontend**: Crear componente `SystemHealthButton` y el modal de resultados.
3.  **Script Local**: Crear `verify-integrity.js` para correrlo desde la terminal antes de deployar.

---
**¿Procedemos a instalar este Agente de Calidad ahora mismo?**
