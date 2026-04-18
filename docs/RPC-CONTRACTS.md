# Contratos RPC — Legacy ClaroPR (GWT)

Este documento lista los servicios RPC del WAR `ClaroPR` (paquete `com.conosur.claroPR`) y sus endpoints, extraídos de:

- `temp_claropr_extract/ROOT/WEB-INF/web.xml` (mapeo servlet → URL)
- `temp_claropr_extract/ROOT/WEB-INF/classes/com/conosur/claroPR/` (clases compiladas)

> **Importante.** No hay fuentes `.java` en el repo. Las firmas de cada método están ofuscadas dentro de los `.class` y no pueden deducirse con certeza sin un decompilador (JD-GUI, CFR, Procyon, Fernflower). Este archivo documenta **qué servicios existen y en qué URL viven** — suficiente para integrarlos, reemplazarlos o envolverlos desde el backend Node.
>
> Para obtener las firmas reales, decompilar los `.class` con, p.ej., [CFR](https://www.benf.org/other/cfr/):
>
> ```
> java -jar cfr.jar --outputdir decompiled \
>     temp_claropr_extract/ROOT/WEB-INF/classes/com/conosur/claroPR/server/*.class
> ```

---

## 1. Servicios RPC (GWT-RPC)

Cada servicio tiene su interfaz `*Service` (sincrónica, consumida por GWT en compilación) y `*ServiceAsync` (callback-based, invocada desde el cliente). El `*ServiceImpl` del paquete `server/` extiende `RemoteServiceServlet` y está mapeado en `web.xml`.

### Autenticación y usuarios

| Servicio | Endpoint | Implementación |
|---|---|---|
| `LoginService` | `/claropr/session` | `server.common.LoginServiceImpl` |
| `UserService` | `/claropr/usercono` | `server.common.UserServiceImpl` |
| `PermisosService` | `/claropr/permisos` | `server.PermisosServiceImpl` |

### Clientes y ventas

| Servicio | Endpoint | Implementación |
|---|---|---|
| `ClienteCreditoService` | `/claropr/clienteCredito` | `server.ClienteCreditoServiceImpl` |
| `VentaService` | `/claropr/venta` | `server.VentaServiceImpl` |
| `ObjetivoVentaService` | `/claropr/objetivoventa` | `server.ObjetivoVentaServiceImpl` |
| `CRMProductoService` | `/claropr/crmProducto` | `server.CRMProductoServiceImpl` |
| `RazonNoContactoService` | `/claropr/razonNoContacto` | `server.RazonNoContactoServiceImpl` |
| `RazonNoVentaService` | `/claropr/razonNoVenta` | `server.RazonNoVentaServiceImpl` |
| `StatusService` | `/claropr/status` | `server.StatusServiceImpl` |

### Productos e inventario

| Servicio | Endpoint | Implementación |
|---|---|---|
| `ProductoService` | `/claropr/producto` | `server.ProductoServiceImpl` |
| `InventarioService` | `/claropr/inventario` | `server.InventarioServiceImpl` |
| `EquipoService` | `/claropr/equipo` | `server.EquipoServiceImpl` |
| `MacService` | `/claropr/mac` | `server.MacServiceImpl` |
| `SocEquipoService` | `/claropr/socEquipo` | `server.SocEquipoServiceImpl` |
| `FeatureService` | `/claropr/feature` | `server.FeatureServiceImpl` |
| `TipoPlanService` | `/claropr/tipoPlan` | `server.TipoPlanServiceImpl` |

### Tiendas, vendedores, caja y pagos

| Servicio | Endpoint | Implementación |
|---|---|---|
| `TiendaService` | `/claropr/tienda` | `server.TiendaServiceImpl` |
| `VendedorService` | `/claropr/vendedor` | `server.VendedorServiceImpl` |
| `DepartamentoService` | `/claropr/…` (verificar en web.xml) | `server.DepartamentoServiceImpl` |
| `CajaService` | `/claropr/caja` | `server.CajaServiceImpl` |
| `PagoFacturaService` | `/claropr/pagofactura` | `server.PagoFacturaServiceImpl` |
| `PuntosPremioService` | `/claropr/puntosPremio` | `server.PuntosPremioServiceImpl` |

### Integraciones / infra

| Servicio | Endpoint | Implementación |
|---|---|---|
| `SMSService` | `/claropr/sms` | `server.SMSServiceImpl` |
| `MessengerRemoteService` (push) | (mapeo específico, ver web.xml) | `server.push.MessengerRemoteServiceImpl` |

---

## 2. Servlets de upload / download de archivos

| Servlet | URL | Propósito |
|---|---|---|
| `FileUploadServlet` | `/claropr/fileUpload` | Upload genérico |
| `FileUploadAdminServlet` | `/claropr/fileUploadAdmin` | Upload admin |
| `FileUploadAdminMasivoServlet` | `/claropr/fileUploadAdminMasivo` | Upload masivo |
| `FileUploadAdminMasivoPymesServlet` | `/claropr/fileUploadAdminMasivoPymes` | Upload masivo Pymes |
| `FileUploadPromocionServlet` | `/claropr/fileUploadPromocion` | Upload de promociones |
| `FileDownloadServlet` | `/claropr/fileDownload` | Download genérico |
| `FileDownloadAdminServlet` | `/claropr/fileDownloadAdmin` | Download admin |
| `FileDownloadControlStockServlet` | `/claropr/fileDownloadcs` | Control de stock |
| `FileDownloadMasivoServlet` | `/claropr/fileDownloadMasivo` | Download masivo |
| `FileDownloadPromocionServlet` | `/claropr/fileDownloadPromocion` | Download de promociones |

Rutas físicas (configuradas en `Configuration.properties`):

- `imageuploadpath=/opt/apache-tomcat-9.0.102/webapps/publicupload/`
- `uploadpath=/opt/apache-tomcat-9.0.102/webapps/fileupload/`
- `uploadpathmasivo=/opt/apache-tomcat-9.0.102/webapps/fileupload/masivo/`
- `reportpath=/opt/apache-tomcat-9.0.102/webapps/publicreport/`

---

## 3. Reportes Jasper

| Servlet | URL | Reporte |
|---|---|---|
| `ClienteCreditoJasperServlet` | `/claropr/rprtclntdcrdtc` | Cliente con crédito |
| `ClienteCuentaIngresoJasperServlet` | `/claropr/rcc` | Cuenta / ingresos cliente |
| `MovimientoInventarioJasperServlet` | `/claropr/rprtmvinv` | Movimientos de inventario |
| `MovimientoProductoJasperServlet` | `/claropr/rprtmvpr` | Movimientos de producto |
| `IngresoInventarioJasperServlet` | `/claropr/inginv` | Ingreso a inventario |
| `InventarioJasperServlet` | (ver web.xml) | Inventario |
| `TicketZadikaseJasperServlet` | `/claropr/rprttic` | Ticket Zadikase |
| `ContratoVentaJasperServlet` | `/claropr/rprtcntrtvnt` | Contrato de venta |
| `ContratoTipoVentaJasperServlet` | `/claropr/cbyt` | Contrato por tipo |
| `ContratoPymesTipoVentaJasperServlet` | `/claropr/cpbyt` | Contrato Pymes por tipo |
| `ReportesJasperServlet` | `/claropr/rprs` | Reportes generales |
| `ReportesJasperGrillaServlet` | `/claropr/rprsg` | Reportes en grilla |
| `TradeInJasperServlet` | `/claropr/rprtdn` | Trade-in |
| `CuadreCajaJasperServlet` | (ver web.xml) | Cuadre de caja |
| `CodigoBarraJasperServlet` | (ver web.xml) | Código de barras |
| `TicketJasperServlet` | (ver web.xml) | Ticket impreso |

---

## 4. Servlets de export / import (XLS, CSV, batch)

Hay ~40 servlets bajo `server/servlet/` que exportan o importan datos. Los más relevantes:

### Exports

- Equipos → `/claropr/expeq`
- Gastos → `/claropr/expgts`
- Tipo plan → `/claropr/exptp`
- Comisiones → `/claropr/expcom`
- Clientes → `/claropr/expcli`, `/claropr/expclif`, `/claropr/expclifp`
- Ventas eliminadas → `/claropr/expcliel`, `/claropr/expclielp`
- Ventas del día → `/claropr/expvendi`, `/claropr/expvendip`
- Equipos fin de contrato → `/claropr/expefc`
- Inventario → `/claropr/expinv`
- Reporte de comisiones → `/claropr/exprc`
- Productos → `/claropr/expprod`, `/claropr/expprodzk`, `/claropr/expprodstck`, `/claropr/expprodhtcstck`, `/claropr/expproddtlmvt`
- Órdenes facturadas → `/claropr/expof`, `/claropr/expofx`, `/claropr/expofxnew`
- Activaciones carga masiva → `/claropr/expecma`
- Ponche horarios → `/claropr/expponc`
- Tienda control → `/claropr/exptc`
- Discrepancias (subsidio / prepago 2da / comisión / cognis / control final / retención) → `/claropr/expds`, `/claropr/exp2dp`, `/claropr/expdc`, `/claropr/expdcg`, `/claropr/expdcf`, `/claropr/expdr`
- Retención imputada → `/claropr/expri`
- Ticket Zadikase errores → `/claropr/expotze`

### Imports

- Equipos → `/claropr/importEquipos`
- Gastos → `/claropr/importGastos`
- Tipo plan → `/claropr/importTipoPlan`
- Comisión → `/claropr/importComision`
- Clientes → `/claropr/importCliente`
- Inventario → `/claropr/importInventario`
- Activaciones carga masiva → `/claropr/importActivacionesCargaMasiva`
- Auditar pago factura → `/claropr/importAuditarPagoFactura`
- Zadikase → `/claropr/importZadikase`
- Suscriptores cancelados → `/claropr/importSuscriptoresCancelados`
- Carga masiva genérica → `/claropr/cargaMasiva`

---

## 5. DTOs compartidos (paquete `shared/`)

Son `Serializable` y viajan por GWT-RPC. Listado de los archivos en `shared/`:

`ArchivoDTO`, `ClienteCreditoDTO`, `ContratoVentaDTO`, `CRMAccionDTO`, `CRMClienteCategoriaDTO`, `CRMClienteDTO`, `CRMProductoDTO`, `DepartamentoDTO`, `EmpresaTelefonicaDTO`, `EquipoDTO`, `FeatureDTO`, `FeatureTipoDTO`, `GastoTiendaDTO`, `ImagenDTO`, `InventarioDTO`, `IvuNacionalDTO`, `MacDTO`, `MesDTO`, `MotivoPagoFacturaDTO`, `NotaDTO`, `NotificacionAdjuntoDTO`, `ObjetivoVentaTiendaVentaTipoDTO`, `ObjetivoVentaVendedorDTO`, `PagoFacturaDTO`, `PagoFacturaEstadoDTO`, `PermisoCheckDTO`, `PermisoDTO`, `ProductoBlackstoneDTO`, `ProductoDTO`, `ProductoTiendaDTO`, `PuntosPremioDTO`, `RazonNoContactoDTO`, `RazonNoVentaDTO`, `RazonVisitaDTO`, `RecargaBlackstoneCono`, `ReporteClaroDTO`, `SMSDTO`, `SMSRespuestaDTO`, `SocEquipoDTO`, `StatusDTO`, `TicketPrintDTO`, `TicketZadikaseDTO`, `TicketZadikaseEstadoDTO`, `TicketZadikaseItemDTO`, `TicketZadikaseTipoDTO`, `TiendaDTO`, `TiendaTipoDTO`, `TipoPlanDTO`, `TradeInDTO`, `TradeInEstadoDTO`, `TradeInProveedorDTO`, `VendedorDTO`, `VendedorTipoDTO`, `VentaCondicionDTO`, `VentaDTO`, `VentaFijoDTO`, `VentaProductoDTO`, `VentaProductoItemDTO`, `VentaPymeDTO`, `VentaPymeFijoDTO`, `VentaTipoDTO`, `VentaTipoUpdateDTO`, `VisitaDTO`.

En `shared/common/`: `UserConoDTO`, `UsuarioTipoDTO`.
En `shared/push/`: `MessageEvent`, `MvpDepartmentUpdate`.

---

## 6. Convención de llamada GWT-RPC (cómo se invoca un endpoint)

GWT-RPC serializa la llamada como un `POST` al servlet con `Content-Type: text/x-gwt-rpc; charset=utf-8` y un cuerpo con un formato propietario de GWT. No es JSON ni SOAP. Si se quiere llamar desde el backend Node sin re-usar GWT:

1. **Opción A (recomendada):** escribir un servlet REST en Java que exponga el mismo `ServiceImpl` como JSON, o reemplazar el `*ServiceImpl` por un endpoint REST en el backend Node que hable directo a PostgreSQL.
2. **Opción B:** implementar un cliente GWT-RPC en JavaScript (existen libs como `gwt-rpc-proxy`) — poco común y frágil.
3. **Opción C:** migrar módulo por módulo al backend Node, dejando el WAR para lo que aún no se reescribió.

---

## 7. Base de datos

- **Conexión única del WAR**: `com.conosur.claroPR.server.common.postgres.ConnectionCono`. Lee los parámetros de `WEB-INF/classes/Configuration.properties`:
    - `databaseip`, `databasename`, `databaseuser`, `databasepassword`
- **Motor**: PostgreSQL (driver JDBC).
- **Mismo `claropr` que usa el backend Node como POS externo** (ver `src/backend/database/externalPools.js` + `.env` → `POS_DB_*`).

---

## 8. Próximos pasos sugeridos

1. **Decompilar** los `.class` (CFR / JD-GUI) y commitear los `.java` resultantes en `legacy-src/` para poder leer las firmas reales de los RPC y las queries SQL.
2. **Definir un contrato "oficial" por módulo** (OpenAPI o TypeScript types) una vez decompilado.
3. **Estrangular** el legacy por módulo: empezar por uno aislado (p. ej. `RazonNoContacto` o `Status`) y reemplazar su `*ServiceImpl` por un endpoint REST en el backend Node.
4. **Documentar** el esquema de la BD `claropr` (ejecutar `pg_dump --schema-only`) y mantenerlo junto a este archivo.
