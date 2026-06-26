---
name: ventaspro-diseno
description: Sistema de diseño de VentasPro (sistema-nuevo). USAR SIEMPRE antes de crear o modificar cualquier pantalla, tarjeta, tabla, botón, filtro o formulario del frontend en sistema-nuevo/frontend/app.html. Define la paleta dark-first y los componentes ya existentes (.kpi, .btn, .pill, .card, .inp, .av, .panel). La regla principal: reusar las clases existentes, NUNCA inventar estilos inline. Cada pantalla nueva debe verse idéntica en estilo a Asana y Comisiones. Invocar aunque el usuario solo diga "arregla el diseño", "se ve feo", "no respetaste la paleta" o pida una pantalla/tarjeta/buscador nuevo.
---

# Sistema de diseño VentasPro

Fuente única de verdad: el bloque `<style>` de
`sistema-nuevo/frontend/app.html`. Las pantallas modelo (ya aprobadas por
Gabriel) son **Asana** (`viewAsana`) y **Comisiones** (`viewComisiones`).

## Reglas innegociables (Gabriel, 2026-06-26)

1. **Traer la funcionalidad COMPLETA del sistema viejo — nunca a mitad.**
   Si el módulo viejo permitía **editar** (productos, categorías, pasos, metas),
   crear y borrar, o tenía **filtros** (mes, Todos/Confirmadas/En revisión), el
   módulo nuevo debe tener **lo mismo**. Prohibido entregar versiones "solo
   lectura" o simplificadas de algo que el viejo ya hacía. "Si la porquería del
   sistema viejo lo tenía, ¿por qué no lo traés?" — porque sí hay que traerlo.
2. **Estructura = traer la información tal cual está** en el viejo (mismas
   columnas, mismos campos, misma lógica). No resumir ni recortar.
3. **Estilo = la marca de Gabriel.** Las pantallas YA aprobadas son la referencia
   visual: **Panel General, Tango vs CRM, Metas, Comisiones, Asana**. Celdas y
   filas con buen aire (padding cómodo), tarjetas `.kpi`, selector de mes arriba a
   la derecha, valores con color (verde = dinero/ok, rojo = falta, ámbar = avisar).
   Cada módulo nuevo debe poder ponerse al lado de esos y verse igual de marca.

## Regla de oro

**Reusar SIEMPRE las clases ya definidas. Nunca inventar estilos inline.**

Por qué: Gabriel ya estableció una paleta y un set de componentes. Cuando se
improvisa con `style="..."` ad-hoc, cada pantalla queda distinta y "sucia" —
exactamente lo que estamos huyendo. Una pantalla nueva tiene que poder ponerse
al lado de Asana o Comisiones y verse de la misma familia.

Antes de escribir una vista nueva: mirar cómo `viewAsana`/`viewComisiones`
resuelven lo mismo (tarjetas, tabla, badges) y copiar ESE patrón.

## Paleta (variables CSS — dark-first)

El sistema arranca en **modo noche** (`<body data-theme="dark">`). Hay tema día
opcional. **Nunca** usar colores hardcodeados (`#fff`, `#333`...). Usar siempre
las variables, así el día/noche funciona solo:

| Variable | Uso |
|---|---|
| `--bg` | fondo de la app |
| `--card` | fondo de tarjetas/paneles/tablas |
| `--card2` | fondo secundario (inputs, header de tabla, filas hover) |
| `--line` | bordes y separadores |
| `--txt` / `--txt2` / `--txt3` | texto fuerte / medio / tenue |
| `--primary` (+ `--primary-soft`) | acción principal, azul |
| `--green` (+ `-soft`/`-border`) | éxito, activo, dinero |
| `--amber` (+ `-soft`/`-border`) | advertencia, incompletos |
| `--red` (+ `-soft`) | error, cancelado, vencido |
| `--violet` (+ `-soft`) | acento secundario, avatares, notas |
| `--teal` (+ `-soft`) | acento alternativo |

## Componentes existentes (usar estos, no crear nuevos)

- **Encabezado de pantalla:** `<div class="head"><div><h1>Título</h1><div class="s">subtítulo</div></div> <botones a la derecha> </div>`
- **Tarjetas KPI:** `<div class="kpis"> <div class="kpi"><div class="l">ETIQUETA</div><div class="v">VALOR</div></div> ... </div>`
  Es el componente oficial para las tarjetas de resumen (las de Clientes,
  Comisiones, etc.). No armar tarjetas a mano con divs + inline.
- **Botones:** `.btn` (azul/principal), `.btn.green`, `.btn.ghost` (secundario).
- **Badges/estados:** `.pill` + `.pill.green` / `.amber` / `.red` / `.violet`.
- **Tabla:** `.card` envolviendo `<table>` con `<thead>` (usa `th`) y filas
  `<tr class="click">` para filas que abren detalle. Centrar con `td.c`/`th.c`,
  alinear derecha con `td.r`/`th.r`.
- **Avatar + nombre:** `<div class="cli"><span class="av">IN</span><b>Nombre</b></div>`.
- **Input/Buscador:** `.inp`. Un buscador es UN `.inp` limpio, no una pila de
  selects gigantes a todo el ancho.
- **Panel/sección:** `.panel` con `<h3>` para títulos de sección.
- **Cantidad destacada (líneas):** `.qty`.
- **Tarjeta expandible (acordeón):** `.ccard` + `.chead` + `.clines` (ver
  Comisiones, donde la fila de empresa expande a sus líneas).

## Cómo agregar estilo nuevo (si de verdad falta)

Si un componente realmente no existe, agregarlo como **clase nueva en el
`<style>`** (siguiendo el patrón de las que ya están, con variables), y reusarla.
No resolverlo con `style="..."` repetido en cada fila.

## Checklist antes de dar una pantalla por lista

1. ¿Usa `.kpi` para las tarjetas (no divs inline)?
2. ¿Botones con `.btn`/`.ghost`/`.green`?
3. ¿Estados con `.pill`?
4. ¿Tabla dentro de `.card`, con `th`/`td` estándar?
5. ¿Colores solo por variables (anda bien en día y noche)?
6. ¿Se ve de la misma familia que Asana/Comisiones?
