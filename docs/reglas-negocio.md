# 📕 Libro de reglas de negocio — VentasPro (sistema nuevo)

> Este documento se actualiza **automáticamente** cada vez que Gabriel define o
> confirma una regla, sin que tenga que pedirlo. Lenguaje simple a propósito.

Última actualización: 2026-06-26

---

## Clientes, BANs y suscriptores

1. **Un BAN muere con el cliente.** Si se elimina el cliente, sus BANs se
   eliminan también (en cascada). *(Regla nueva de Gabriel — no estaba escrita en
   los documentos viejos, pero es la correcta.)*

2. **Un BAN tiene como mínimo 1 suscriptor**, y puede tener infinitos. Un BAN
   puede estar **activo** o **cancelado**. *(Confirmado por Gabriel — OJO: el
   sistema actual permitía BANs con 0 suscriptores; esto cambia en el sistema
   nuevo.)*

3. **Un suscriptor (línea) tiene 3 estados:** **Activa**, **No renueva ahora** y
   **Cancelada**.
   - Solo las **Activas** cuentan en los totales de líneas (ver regla #7).
   - "No renueva ahora" y "Cancelada" no suman como activas.
   *(Corregido por Gabriel — 2026-06-23. Antes decía solo activo/cancelado.)*

4. **Un suscriptor puede reasignarse a otro BAN, pero primero debe cancelarse en
   el BAN donde está.** No puede estar activo en dos BANs a la vez.
   - Llave operacional inviolable: **teléfono + BAN**.
   - Los documentos dicen textual: *"No permitir que una línea se mueva
     silenciosamente a otro BAN"*. El sistema bloquea si el teléfono ya existe en
     otro BAN.
   - El paso exacto "cancelar primero y después reasignar" lo definió Gabriel
     como el camino seguro.

---

5. **Un BAN marcado como PYMES se trata como CONVERGENTE cuando tiene los dos
   servicios.**
   - Regla de Gabriel, 2026-06-26: si la data trae `account_type = PYMES`, pero
     el cliente/BAN tiene servicio movil y servicio fijo, el CRM nuevo debe
     guardarlo/tratarlo como **CONVERGENTE**.
   - Para Asana/SOV2, una linea con `line_kind` explicito manda para clasificar:
     `movil` -> `movil_ren`; `fijo` -> `fijo_ren`.
   - Las lineas sin `line_kind` ni otra evidencia confiable no se inventan; se
     quedan sin clasificar hasta que el dato venga completo o Gabriel confirme la
     clasificacion.

6. **Reglas de clasificacion por numero/servicio para Asana/SOV2.**
   - Si Gabriel confirma una linea como movil, se clasifica como `movil_ren`.
   - Los numeros que empiezan con `989` son **Cloud** y se clasifican como
     `cloud`.
   - Los numeros que empiezan con `130` son **MPLS** y se clasifican como
     `mpls`.
   - Los codigos/numeros cortos de servicio son **Fijo** aunque vengan con una
     inicial al principio. Ejemplos: `C4742` y `1700324897` se clasifican como
     `fijo_ren`.
   - Si Tango V2 `/api/external/planes` devuelve `tipo = movil` para el codigo
     de plan, la linea se clasifica como `movil_ren`.
   - Ejemplos confirmados por Tango V2 `/planes`: `BAIC017`, `BREDP1`,
     `BREDP2`, `BREDP3` y `BREDP4` son **movil**.
   - Si una linea no tiene plan ni tipo de venta, se marca para revision:
     `REQUIERE_REVISION_TANGO`.
   - Las lineas marcadas `REQUIERE_REVISION_TANGO` se deben consultar contra
     Tango V2 usando el endpoint `/ventas`, buscando por telefono/BAN para traer
     el tipo correcto. Si Tango tampoco trae un tipo claro, se mantiene sin
     clasificar hasta revision manual.

## Visualización

5. **En la fila/línea del cliente se muestra un resumen compacto por producto.**
   - **Letra** = tipo de producto (M = Móvil, F = Fijo, etc.).
   - **Número** = cantidad de líneas.
   - En productos de **dinero** (Fijo, MPLS) se muestra además el **monto**.
   - Ejemplos: `M2` = Móvil con 2 líneas; `F 2/84.99` = Fijo con 2 líneas por $84.99.
   *(Definido por Gabriel — 2026-06-23.)*

6. **Arriba de la lista de Clientes hay una fila de BOTONES** (no tarjetas) que
   muestran el total y a la vez **filtran** la lista al hacer clic:
   - **Móvil** → cantidad de líneas móviles activas.
   - **Fijo** → cantidad de líneas fijas activas **y** total **$**.
   - **En seguimiento** → cantidad.
   - **Cancelados** → cantidad.
   - **Incompletos** → cantidad.
   *(Definido por Gabriel — 2026-06-23. Corrección: son botones-filtro, no
   tarjetas. Pendiente: hablar en detalle cada uno.)*

7. **El estado del cliente y el estado de cada línea son independientes.**
   - Un cliente **activo** puede tener, al mismo tiempo, **líneas activas y líneas
     canceladas**.
   - Los conteos de líneas (ej: botón "Móvil activos", "Fijo activos") cuentan
     **solo las líneas activas**; las canceladas del mismo cliente **no** suman.
   - Ejemplo: cliente activo con 4 móviles, 1 cancelada → cuenta **3**.
   *(Definido por Gabriel — 2026-06-23.)*

## Seguimiento (oportunidades)

8. **Botón "Enviar a Seguimiento".** Al apretarlo:
   - El cliente entra al módulo **Asana Seg.** (ventas).
   - Se le **asigna el vendedor** y se crea una **oportunidad activa** para
     trabajarla con sus pasos (interacciones).
   - El estado del cliente pasa a **"En seguimiento"**.
   - Al **cerrar** el seguimiento, el cliente **vuelve al pool** (queda sin
     vendedor) y la oportunidad se archiva.
   - El seguimiento de un cliente lleva **3 cosas**: **llamadas**, **notas** y
     **pasos**.
   - Los **pasos** se configuran en el módulo **"Asana pasos"**.
   - **Regla clave:** un cliente puede tener **una sola oportunidad activa a la
     vez** (si ya está en seguimiento, no se puede enviar de nuevo).
   *(Confirmado por Gabriel — 2026-06-23.)*

9. **Asana (Asana Seg.) — objetivo.** Es el tablero del **día a día**: ver todos
   los clientes en seguimiento y sus gestiones (qué hay que hacer hoy).
   - El diseño actual **no conforma a Gabriel** → se va a rediseñar.
   *(Definido por Gabriel — 2026-06-23.)*

10. **Diseño del seguimiento de un cliente (tab Interacciones) = "Idea 1".**
    - Arriba: **caminito de pasos** (progreso del 1 al último, con el paso actual
      resaltado y botón "completar y avanzar").
    - Abajo: **bitácora** donde se cargan **llamadas** y **notas**, y los
      **avances de paso se registran solos** (automáticos).
    *(Elegido por Gabriel — 2026-06-23.)*

11. **Diseño del Asana del día a día (aprobado por Gabriel — le encantó).**
    - Clientes en seguimiento **agrupados por urgencia**: 🔴 Atrasados, 🟠 Para
      hoy, ⚪ Próximos (+ botones-filtro arriba y filtro por vendedor).
    - Cada fila muestra: cliente + tipo de venta, **mini caminito** (en qué paso
      va), **próxima acción** y su vencimiento, y botón **"Abrir"**.
    - "Abrir" lleva al seguimiento del cliente (caminito + bitácora, regla #10).
    - Objetivo: ver de un vistazo **a quién seguir hoy** (reemplaza la tabla densa
      actual que no le gustaba).
    *(Aprobado por Gabriel — 2026-06-23.)*

12. **Los pasos se configuran POR PRODUCTO** (no por tipo de oportunidad).
    - Son **7 productos**, cada uno con su propia lista de pasos: **Fijo Ren,
      Fijo New, Movil Ren, Movil New, Claro TV, Cloud, MPLS**.
    - Cada paso tiene: **nombre**, **Activo** (sí/no) y **orden** (reordenable
      con ↑↓). Se puede **crear** y **borrar**.
    - Ejemplo real de Fijo Ren: LLAMAR · HOJA DE ACEPTACIÓN · COGNITO ·
      SEGUIMIENTO ADA · CARGAR A TANGO.
    - Fuente: `crm_product_task_templates`. **Cambiar la config no modifica los
      avances ya existentes** de las oportunidades.
    *(Corrección de Gabriel — 2026-06-23: antes yo había usado 3 tipos
    renovación/línea nueva/internet; lo correcto son los 7 productos.)*

## Comparativa de Planes (tab del cliente)

13. **La Comparativa compara el plan actual del cliente con una oferta nueva.**
    - **Plan actual** (arriba): líneas **activas** del cliente con BAN, teléfono,
      plan, costo, vencimiento, **notas** (campo que faltaba y se agrega) y
      estado. Tabs Activas / Canceladas. Muestra **Total actual**.
    - **Nueva oferta** (abajo): BANs y líneas pre-llenados; se completa plan
      nuevo, costo y notas. Botón "+ Agregar línea". Muestra **Total oferta**.
    - Se **guarda** cada comparativa con un nombre → queda un **historial de
      comparativas guardadas** (abrir / exportar).
    - Export a **Excel** y **PDF**. Botón "Marcar actualizado".
    *(Explicado por Gabriel — 2026-06-23.)*

14. **Formato del PDF/Excel de la Comparativa (le gusta a Gabriel).**
    - **Header rojo de Claro** (`#DA291C`, ajustable), **sin logo**, con
      "Comparativa de Planes" y nombre del cliente; fecha y BAN a la derecha.
    - Línea con Contacto y Email.
    - Tabla **Plan actual** (BAN, teléfono, plan, costo, vencimiento, **notas**)
      con TOTAL.
    - Tabla **Oferta propuesta** (BAN, teléfono, plan nuevo, costo, notas) con
      TOTAL.
    - Resumen: **Total actual · Total oferta · Ahorro**.
    - **Bloque de firma del vendedor** abajo (nombre, cargo, tel, CLARO, email);
      se pre-llena con el vendedor logueado y es editable.
    - El **Excel** usa el mismo formato y color.
    *(Referencia: PDF "Comparativa_LIGHT_GAS_2026-06-19". Definido por Gabriel —
    2026-06-23.)*

15. **Cierre del cliente (fin del seguimiento).** Cuando se termina con el
    cliente:
    1. Se **actualizan las ventas** en el tab **BAN y Suscriptores**.
    2. El **cómo** se actualiza viene del módulo de **Comisiones** → ⏳ pendiente:
       Gabriel lo explica más adelante.
    3. Se **cierra** el seguimiento y el cliente **vuelve al pool**.
    *(Definido por Gabriel — 2026-06-23. Relacionado con regla #8.)*

## Ventas (tab del cliente)

16. **El tab "Ventas" del cliente solo registra las ventas cerradas que vienen
    del módulo de Comisiones** (Tango).
    - Es un **reflejo / registro**: su única fuente es el módulo de Comisiones.
    - No calcula ni inventa nada por su cuenta; muestra lo que Comisiones ya tiene
      como venta cerrada.
    *(Aclarado por Gabriel — 2026-06-23.)*

## Comisiones (módulo)

17. **El módulo Comisiones se alimenta del API de Tango V2** (`/api/external/ventas`
    y `/api/external/comisiones`; Tango es la fuente oficial).
    - Campos que trae Tango por venta/línea: `ban`, `telefono` (línea),
      `ventatipoid` + `ventatipo_nombre` (tipo de línea), `mensualidad`,
      `com_empresa` (**Empresa$**), `com_vendedor` (**Comisión$**),
      `bonoportabilidad` (**Bono port.**), `cliente`, `vendedor`.
    - **12 tipos PyMES oficiales** (por nombre): ba corp new/ren, cloud negocios,
      corp update new/ren, office 365 negocios, pymes fijo new/ren, pymes update
      new/ren, telemetria new/ren. Se clasifican en familias: fijo, móvil, tv,
      cloud, mpls.
    - Vista: tabla por empresa (con cantidades por producto + montos), expandible
      a las **líneas**; por línea: **Pagar · Auditar · Retiene** y comisión
      editable. Filtros: Todos / Confirmadas / En revisión / Esperando sync.
    - La comisión es **solo un número para metas**; no inventar atribución.
    *(Replicado y API revisado por pedido de Gabriel — 2026-06-23.)*

18. **Comisiones es la fuente que alimenta dos lugares** (todo viene de Tango):
    1. El tab **Ventas** del perfil del cliente → refleja las ventas cerradas que
       están en Comisiones (ver regla #16).
    2. La **actualización de las líneas** en el tab **BAN y Suscriptores** → los
       datos de las líneas del cliente se actualizan con lo que llega de
       Comisiones/Tango (ver regla #15).
    *(Explicado por Gabriel — 2026-06-23.)*

19. **Qué pasa si el cliente/BAN no existe en la BD al sincronizar de Tango**
    (comportamiento actual verificado en `server-FINAL.js` sync PYMES):
    - **Si Tango trae el nombre del cliente → AUTO-CREA** cliente + BAN, y le
      asigna el vendedor si existe en el CRM (búsqueda por nombre). Marca la venta
      como `auto_created`.
    - **Si Tango NO trae el nombre → NO crea cliente placeholder**; va a
      `needs_review` (módulo Pendientes Tango) para revisión manual.
    - **No reasigna el vendedor de un cliente que ya existe** (solo asigna al
      crear uno nuevo).
    - Al re-sincronizar, **borra solo los reportes vacíos** (preserva las
      comisiones cargadas a mano).
    *(Verificado por pedido de Gabriel — 2026-06-23. **Decisión: se mantiene
    igual en el sistema nuevo.**)*

20. **En las líneas del módulo Comisiones no hay botones de acción.** Se eliminan
    **Auditar** y **Retiene**.
    - **El ÚNICO campo editable es Comisión$ (comisión del vendedor)** — se
      completa a mano. **Empresa$ NO se edita** (es el dato/cálculo).
    - **Empresa($) = comisión de la empresa.** **Comisión($) = comisión del
      vendedor (editable).**
    - **Origen de cada columna (verificado 2026-06-26):**
      - **Empresa$ = "Comisión Claro"** → la calcula y la trae **Claro/Tango**
        (es lo que Claro le paga a la empresa). NO se edita.
      - **Comisión Vendedor NO la trae Claro ni Tango** (en la pantalla de Claro
        viene vacía: "—"). Es la parte que **la empresa decide darle al
        vendedor**. **Por ahora se carga MANUAL** (Gabriel, 2026-06-26).
    - Las líneas expandidas se **alinean con las columnas** de la tabla
      (Mensualidad, Empresa$, Comisión$ caen bajo su columna).
    *(Regla definida por Gabriel — 2026-06-23. Origen aclarado 2026-06-26.)*

21. **Tarjetas (KPI) arriba del módulo Comisiones — "Comisiones y Ventas".**
    - **Total ventas** = cantidad de ventas (+ cantidad de clientes). Muestra
      además, visible, el desglose: **líneas Móvil** y **líneas Fijo con su $**.
    - **Ganancia empresa** = suma de **Empresa$** (comisión empresa).
    - **Comisión vendedores** = suma de **Comisión$** (comisión vendedor).
    - **Pagado** = suma de lo registrado como pagado.
    - **Balance pendiente** = **Ganancia empresa − Pagado**.
    - Header con toggle **Empresa / Vendedor** y botones **Informe Tango vs CRM**
      y **Sync Tango V2**. Debajo, barra "Informe de ventas" → filtros + tabla.
    *(Replicado con misma lógica por pedido de Gabriel — 2026-06-23.)*

22. **Por cada línea en Comisiones, al final:**
    - **Confirmación "Sincronizada"** → automática, aparece sola cuando la venta ya
      se sincronizó con Tango (no se marca a mano).
    - Botón **"Pagar al vendedor"** → marca que se le pagó la comisión al vendedor
      (pasa a "Pagado al vendedor").
    - Una vez pagado, **eso va al reporte de ventas del perfil del vendedor**.
    - **Solo admin/supervisor** puede apretar "Pagar al vendedor". El vendedor NO
      puede marcarse su propio pago.
    *(Definido por Gabriel — 2026-06-23. Confirmado: por línea + sincronizada
    automática + pago solo admin/supervisor.)*

## Permisos de vista (vendedor vs admin)

23. **El vendedor tiene una vista limitada:**
    - Ve su propio **Asana** (solo sus clientes en seguimiento).
    - Ve **sus ingresos** (su **comisión de vendedor**, el Comisión$).
    - **NO ve la ganancia de la empresa** (Empresa$) ni los datos de la compañía.
    - **Admin/supervisor** ve **todo** en Comisiones (ganancia empresa + comisión
      vendedor + pagos).
    - El toggle **Empresa / Vendedor** refleja esto: la vista "Vendedor" oculta lo
      de la empresa.
    *(Definido por Gabriel — 2026-06-23.)*

24. **Columna de estado con dos checks** (al final de cada línea en Comisiones):
    - ✓ **Sinc** = sincronizada con Tango (verde cuando está hecho).
    - ✓ **Pago** = pagada al vendedor (verde cuando se pagó, gris si pendiente).
    - Da el estado de cada línea de un vistazo.
    - **El check "Pago" del vendedor se pone verde SOLO cuando el admin marca
      "Pagar al vendedor" desde su perfil admin** (regla #22). El vendedor no puede
      marcarlo; solo lo ve reflejado.
    *(Definido por Gabriel — 2026-06-23.)*

25. **Resumen de comisión en la pantalla del vendedor** (leyenda):
    - **Total cobrado** = comisión bruta del vendedor.
    - **Retención de Hacienda (10%)** = se descuenta el 10%.
    - **Total** = Total cobrado − retención (10%).
    - **Pagado a la fecha** = lo ya pagado.
    - **Balance** = Total − Pagado a la fecha.
    *(Definido por Gabriel — 2026-06-23.)*

## OCR de suscriptores

26. **El OCR de BAN y Suscriptores lee SOLO la lista de líneas/suscriptores**
    (formato: **Teléfono · Estado · Plan**, ej: `787-279-2961 · Active · BREDP2`).
    - La imagen de **lista de BANs por Tax ID NO se usa** para OCR (descartada).
    - El **costo no viene en la imagen**; el sistema lo resuelve del **código de
      plan** (BREDP2 → su precio).
    - Es una tabla pareja, así que funciona con la lista más larga o más corta.
    - Flujo: subir imagen → OCR lee → vista previa (insertar/actualizar/cancelar/
      sin cambios/conflicto) → confirmar (nada se escribe hasta confirmar).
    *(Definido por Gabriel — 2026-06-23.)*

## Metas

27. **Pantalla de Metas — carga de metas por producto.**
    - Se elige el **mes**.
    - **Meta del negocio:** una meta (número) por cada producto (Fijo Ren, Fijo
      New, Móvil New, Móvil Ren, Claro TV, Cloud, MPLS).
    - **Meta por vendedor:** lo mismo, una fila por vendedor.
    - **Alcance** al guardar: **Solo este mes / Hasta diciembre / Todo el año**.
    *(Replicado por pedido de Gabriel — 2026-06-23.)*

28. **Reestructuración de Metas — la meta genera ingreso.**
    - Cada **producto tiene un valor de ingreso** ($ por venta). Meta en $ =
      cantidad meta × valor del producto.
    - **Cumplimiento** = lo vendido (de Comisiones/Tango) vs la meta, en
      **cantidad** y en **$**.
    - En el **Panel General** el negocio ve: cumplimiento **global** (% y $),
      **por producto** (barras vendido vs meta) y **por vendedor** (semáforo
      🟢/🟡/🔴), con **filtro por vendedor**.
    *(Definido por Gabriel — 2026-06-23.)*

## API nuevo (Tango V2 Externa)

29. **El sistema nuevo se alimenta del API Tango V2 Externa (v1.2)** — 6 endpoints
    GET/POST con Bearer token (la API Key vive en `newcrm/.env`, **confidencial,
    no se copia acá**). Base: `https://tango-pr.com`.
    - `/api/external/clientes` → clientes (BAN, empresa, teléfonos, dirección…).
    - `/api/external/ventas` → ventas (cliente, plan, **rate**, tienda, vendedor;
      campos: ventaid, codigovoz, plan{nombre,rate}, pagomensual…).
    - `/api/external/comisiones` → comisiones desglosadas (comisionclaro, bonos,
      features, comisionvendedor, total + array `desglose`).
    - `/api/external/planes` → catálogo con **rate por `codigovoz`** (ej: A882 →
      $64.99). **Este es el costo de las líneas en el OCR** (regla #26).
    - `/api/external/usuarios` → **directorio de usuarios/empleados** (usuarioid,
      nombre, apellido, email, nick, **rol**, activo, vencido, tienda). **De acá
      salen los vendedores** (responde la duda de Gabriel).
    - `/api/external/auth/verify` (POST) → **login con Tango**: el usuario entra
      con su nick+clave de Tango; el CRM no maneja contraseñas propias.
    - `pagomensual`: usar para `subscribers.monthly_value`; si es null/0 NO pisar
      el valor existente.
    *(Doc: `newcrm/Tango_V2_API_Externa_Documentacion (2).docx`, 2026-06-24.)*

30. **Para el sistema nuevo, Gabriel usa SOLO 2 endpoints** (de los 6):
    - **`/auth/verify`** → login con Tango.
    - **`/ventas`** → alimenta el **módulo de Comisiones** (ya trae cliente, plan,
      rate, vendedor).
    - Las comisiones (**Empresa$** y **Comisión$**) se **cargan a mano** (regla
      #20); por eso NO se usa el endpoint `/comisiones`.
    - Los **vendedores salen del campo `vendedor`** de cada venta (no de
      `/usuarios`).
    - No se usan (por ahora): `/clientes`, `/comisiones`, `/planes`, `/usuarios`.
    *(Definido por Gabriel — 2026-06-23.)*

## Pendientes Tango

31. **Pendientes Tango es una lista de SOLO LECTURA.**
    - Muestra las ventas de Tango que **no cuadran / no se pudieron clasificar**,
      con su **motivo**.
    - **NO se resuelven a mano en el CRM.** Se **corrigen en Tango** (el sistema de
      origen).
    - Quedan visibles en el CRM **hasta que sincronices**; cuando **cuadran**,
      desaparecen solas de la lista.
    *(Corregido por Gabriel — 2026-06-23. Aclara la regla #19: no hay resolución
    manual en el CRM.)*

## Correos y Ofertas Web

32. **Correos puede vincular una oferta armada en Ofertas Web.**
    - En el módulo **Ofertas Web** (pendiente de trabajar) se **arma una oferta**.
    - Desde **Correos** se puede **vincular esa oferta** (como link/adjunto) y
      enviarla al cliente, junto con los adjuntos normales (comparativa/propuesta).
    *(Definido por Gabriel — 2026-06-23. Ofertas Web se diseña más adelante.)*

## Categorías

33. **Las Categorías son de PRODUCTOS, no de clientes.**
    - Son las **familias de producto**: **Móvil · Fijo · TV · Cloud · MPLS**.
    - Cada categoría tiene **nombre + descripción**; cada producto pertenece a una.
    - Fuente: tabla `categories` (`/api/categories`).
    *(Confirmado por Gabriel — 2026-06-23. Corrección: antes se habían inventado
    categorías de cliente; son de producto.)*

## Importador (Import New)

34. **El importador (Import New) es una herramienta de ACTUALIZACIÓN MASIVA desde
    Excel. El archivo que se sube MANDA** (sobreescribe la BD).
    - Actualiza **cualquier campo** de los registros existentes: **términos de
      contrato, estados de suscriptores, dirección, plan, etc.**
    - El **archivo es la fuente de verdad** para esa carga (lo que diga, pisa).
    - También puede **crear** el registro si no existe (cliente/BAN/línea), pero el
      foco es **actualizar** lo que ya está.
    - Tiene **simulación (dry-run)** que muestra qué va a cambiar antes de guardar.
    - Flujo en **4 pasos**: **Subir archivo → Mapear columnas → Vista previa →
      Resultado**.
    - En **Mapear columnas** el usuario empareja **manualmente** cada columna del
      Excel con su **campo de la BD**, mediante **drag and drop** (arrastra el chip
      de la columna del Excel al campo del CRM). Las columnas que no se mapean no
      se tocan.
    *(Aclarado por Gabriel — 2026-06-23. Se queda en el sistema nuevo.)*

## Ofertas (y Lista de Precios)

35. **La Lista de Precios / Equipos es parte de OFERTAS, no un módulo aparte del
    CRM.**
    - En el CRM (este portal) lo que hay es **Admin de Ofertas** → subir los
      **boletines**.
    - La **tienda de ofertas** (y la lista de precios real) corre **aparte** (otro
      portal). Hay solapamiento histórico entre el módulo `/lista-precios` del CRM
      y Ofertas → unificar en Ofertas.
    - Todo esto se diseña junto, al final (módulo #6 Ofertas Web).
    *(Aclarado por Gabriel — 2026-06-23.)*

36. **Historial = la bitácora del sistema.** Registra **logins, cambios de paso**
    y todas las acciones (quién, qué y cuándo): notas, ediciones, pagos, syncs.
    - Con filtros por **usuario, tipo y fecha**, y buscador.
    *(Definido por Gabriel — 2026-06-23.)*

## Seguridad

37. **Seguridad es un hub con 2 accesos: Diagnóstico del sistema + Usuarios y
    Permisos.**
    - ✅ El hub y el **Diagnóstico** (`/api/system/diagnostics`) son **funcionales**.
    - ⚠️ **Usuarios y Permisos está roto**: la página pide
      `/api/permissions/presets`, pero ese **endpoint no existe** y la **tabla
      `permission_presets` tampoco** (ninguna migración la crea).
    - **Decisión:** los permisos se **arman bien de cero en el sistema nuevo**
      (tabla + endpoint); por ahora Permisos queda **pendiente**.
    *(Diagnóstico verificado por Claude + decisión de Gabriel — 2026-06-23.)*

## Perfil

38. **El Perfil del usuario viene de Tango V2** (login con Tango, `/auth/verify`).
    - Datos de Tango: nombre, email, **nick**, **rol**, tienda. Se muestran pero
      **no se editan en el CRM** (se cambian en Tango). El CRM **no maneja
      contraseñas**.
    - El CRM solo guarda **preferencias propias** (tema día/noche, idioma,
      notificaciones), que sí se editan acá.
    *(Definido por Gabriel — 2026-06-23.)*

## Regla confirmada: Comisiones, Clientes y Asana

39. **Comisiones carga la venta desde Tango, pero Asana se cierra aparte.**
    - **Tango V2** es la fuente oficial de la venta cerrada.
    - **Comisiones** sincroniza/carga esa venta desde Tango.
    - Al entrar la venta por Comisiones, el CRM debe actualizar el cliente:
      **Ventas**, **BAN** y **Suscriptores**.
    - La actualizacion de BAN y Suscriptores se hace por la llave operativa
      **BAN + telefono**.
    - Si el BAN o suscriptor ya existe, se actualiza con los datos de Tango:
      plan, mensualidad, tipo de linea/producto, fecha de venta/activacion y
      datos de comision.
    - Si falta cliente/BAN/suscriptor y Tango trae datos minimos confiables, se
      crea la relacion operativa:
      **Cliente -> BAN -> Suscriptor -> subscriber_reports**.
    - Si Tango no trae datos minimos, no se inventa. Queda en Pendientes Tango o
      revision.
    - Esta carga **NO cierra Asana automaticamente**.
    - El cierre de seguimiento se hace manualmente en **Asana Seg.** cuando la
      gestion termino: se archiva la oportunidad y el cliente vuelve al pool.
    *(Regla aclarada por Gabriel - 2026-06-26.)*

## Pendientes / ideas

40. **Entrada de cliente nuevo por VOZ o por IMAGEN de un documento** (idea de
    Gabriel — pendiente de diseñar). Reemplazaría/ampliaría el módulo "Voz Cliente"
    (que queda pendiente). *(2026-06-23.)*

41. **Comisión del vendedor = MANUAL, arranca en 0, editable.** Tango trae **Empresa$
    (Comisión Claro)**, NO la comisión del vendedor (en el portal Claro/Tango ese campo
    viene vacío). Por eso en el módulo Comisiones la **Comisión$** del vendedor empieza en
    **0** y se carga/edita a mano por línea; **Empresa$ es solo lectura**. *(Gabriel — 2026-06-27.)*

42. **Los vendedores vienen de Tango — también para Metas.** La grilla "Meta por vendedor"
    lista los vendedores que trae Tango (el campo vendedor de las ventas/comisiones), no una
    tabla local. *(Confirmado por Gabriel — 2026-06-27. Ver [[feedback_tango_manda]].)*

43. **Metas: del negocio y por vendedor, por producto, con alcance.** Grilla editable con
    columnas por producto (Fijo Ren, Fijo New, Móvil Ren, Móvil New, Claro TV, Cloud, MPLS),
    una fila Negocio + una por vendedor. Cada fila tiene **alcance**: Solo este mes / Hasta
    diciembre / Todo el año (al guardar replica la meta a esos meses). Muestra **Meta $**
    (cantidad × valor de ingreso del producto). *(Gabriel — 2026-06-27.)*

44. **El caminito de pasos de una oportunidad usa los pasos CONFIGURADOS** (los de
    "Configurar pasos" por producto), NO plantillas genéricas viejas. Configurar pasos vive
    por producto; los pasos reales se copiaron de crmproui: Fijo Ren (5), Fijo New (8),
    Móvil Ren (8), Móvil New (9); Claro TV / Cloud / MPLS en blanco. **Se copian, no se
    conecta nada al sistema viejo.** *(Gabriel — 2026-06-27.)*

45. **Cliente Voz (en Asana Seg.):** se dicta por voz (navegador), un **parser sin IA**
    entiende empresa/teléfono/producto/cantidad/$ (Gabriel corrige), y crea **cliente
    provisional + oportunidad + línea + nota inicial**. Sin clave de IA por ahora; queda la
    puerta a Claude más adelante. *(Gabriel — 2026-06-27.)*

46. **Modal de cliente = réplica de la ClientModal real (7 tabs).** Al abrir un cliente
    (fila, flecha o botón Cliente) se abre una **modal** con tabs: Información del Cliente ·
    BANs y Suscriptores · Historial de Gestiones · Comparativas · Ventas · Pendientes · Notas.
    En BANs y Suscriptores: tarjeta por BAN (con Subir/Pegar OCR y Editar), sub-tabs
    Activas / No renueva ahora / Canceladas, filas de suscriptor con acciones Editar / No
    renueva ahora / Cancelar, + Nuevo BAN y + Agregar Suscriptor; header con Enviar a
    Seguimiento. *(Pedido por Gabriel — 2026-06-27. Detalle final lo define él.)*

---

*(Las próximas reglas se irán agregando acá automáticamente.)*
