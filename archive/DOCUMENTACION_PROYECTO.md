# VentasProui CRM — Documentación del Proyecto
**Agencia:** SS Group | **Dueño:** Gabriel Sánchez | **Fecha:** Marzo 2026

---

## ¿Qué es este sistema?

CRM especializado para agentes de ventas de Claro Puerto Rico.
Permite gestionar clientes, ventas, comisiones y sincronización con el sistema oficial de Claro (Tango).
Usado por 5 vendedores.

---

## Lo que ya está construido y funciona

### Clientes
- Crear, editar y buscar clientes empresariales
- Registrar múltiples contactos por empresa
- Asignar vendedor responsable por cliente
- Ver historial completo de cada cliente

### Servicios y Suscriptores
- Gestión de líneas telefónicas (BANs) de Claro
- Ver qué servicios tiene cada cliente (móvil, fijo, internet, TV)
- Activar, cancelar y reactivar servicios
- Sincronización automática con Tango (sistema oficial de Claro)

### Ventas y Comisiones
- Registro de ventas por vendedor
- Cálculo automático de comisiones según producto y volumen
- Metas de venta por vendedor y período
- Seguimiento de cumplimiento de metas en tiempo real

### Pipeline de Ventas (Seguimiento)
- Registro de prospectos y referidos
- Etapas del proceso de venta (customizables)
- Agenda de seguimientos y llamadas
- Tareas asignadas a clientes

### Importación de Datos
- Carga masiva de clientes y servicios desde Excel
- Previsualización antes de confirmar la importación
- Detección de duplicados

### Sincronización con Tango
- Comparación entre datos del CRM y Tango
- Detección de discrepancias (lo que no coincide)
- Alertas cuando hay inconsistencias
- Auditoría completa de cambios

### Campañas de Email
- Creación de campañas de email a clientes
- Seguimiento de aperturas y clics
- Envío masivo con plantillas

### Reportes
- Reporte de comisiones por vendedor y período
- Comparativa CRM vs Tango
- Historial de todas las acciones del sistema (quién hizo qué y cuándo)

### Sistema de Tareas
- Tareas personales y vinculadas a clientes
- Estados: pendiente, en proceso, completado, seguimiento
- Asignación a vendedores
- Fechas límite y alertas
- Exportación a Excel ✅ (agregado Marzo 2026)

### Integraciones activas
| Sistema | Para qué |
|---|---|
| **Tango (Claro ERP)** | Sincronización de ventas y suscriptores |
| **OCR** | Leer documentos e imágenes automáticamente |
| **Email (SMTP)** | Campañas y notificaciones |
| **Excel** | Importación y exportación masiva |

---

## Stack tecnológico
- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT
- **Servidor:** 143.244.191.139 | **URL:** https://crmp.ss-group.cloud
- **Versión actual:** 2026-398

---

## Equipo asignado
| Agente | Rol |
|---|---|
| Sebastián F. | Frontend React |
| Marcus L. | Backend y base de datos |
| Viper A. | Scripts, automatizaciones, OCR |
| Camila R. | Diseño UI/UX |

---

## Pendiente — a definir con el dueño
*(Se completa en la próxima sesión)*

- [ ] Qué falta para el flujo de ventas de Claro
- [ ] Cómo integrar la oferta de la agencia digital a los mismos clientes
- [ ] Qué automatizaciones faltan
- [ ] Qué reportes necesita el dueño para tomar decisiones

---

*Documento generado por el Director — Control 360ui*
