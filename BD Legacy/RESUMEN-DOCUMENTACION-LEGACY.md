# Resumen de Documentación Técnica - Sistema Legacy Claro PR

Basado en el historial de análisis del sistema **Claro PR** (sistema legacy extraído del archivo `claropr-root.tar.gz`), existen tres documentos principales que detallan la lógica de las tablas y el funcionamiento del sistema.

## 1. Diccionario de Datos Técnico
**Archivo:** `BD-LEGACY-CLAROPR.md`
**Ubicación:** `docs/`
**Ruta Completa:** `C:\Users\Gabriel\Dropbox\PROGRAMAS\2025 IA\Tango UI\sistema-claro\docs\BD-LEGACY-CLAROPR.md`

**Descripción:**
Este es el documento más exhaustivo. Contiene el **diccionario de datos completo** de las 328 tablas identificadas, incluyendo:
- Cantidad de registros y tamaño en disco.
- Definición de columnas.
- Todas las relaciones de llaves foráneas (**Foreign Keys**).

> **Uso:** Es la referencia técnica principal para entender cómo se conectan las tablas a nivel de base de datos.

---

## 2. Reglas de Negocio y Lógica
**Archivo:** `TANGO-OLD-LEGACY.md`
**Ubicación:** `docs/`
**Ruta Completa:** `C:\Users\Gabriel\Dropbox\PROGRAMAS\2025 IA\Tango UI\sistema-claro\docs\TANGO-OLD-LEGACY.md`

**Descripción:**
Este documento detalla la **lógica de negocio y las reglas de procesamiento** extraídas tanto de la base de datos como del código fuente del sistema legacy. Incluye:
- Fórmulas para el cálculo de comisiones (Voz + Data).
- Lógica de conciliación de discrepancias.
- Definición de roles de usuario.

> **Uso:** Utilice este archivo para entender *cómo* el sistema utiliza los datos y las reglas que gobiernan las operaciones.

---

## 3. Resumen Funcional por Módulos
**Archivo:** `analisis-funcional-tablas.md`
**Ubicación:** `BD/`
**Ruta Completa:** `C:\Users\Gabriel\Dropbox\PROGRAMAS\2025 IA\Tango UI\sistema-claro\BD\analisis-funcional-tablas.md`

**Descripción:**
Es un resumen que organiza las tablas por **módulos funcionales** (Equipos e Inventario, Ciclo de Ventas, Comisiones, Activaciones, etc.).

> **Uso:** Es ideal para entender qué tablas corresponden a cada "Agente IA" del sistema actual (Tango UI).

---

## Resumen de Navegación

| Si buscas... | Ve al documento... |
|--------------|--------------------|
| **Lógica técnica y relaciones SQL** | `BD-LEGACY-CLAROPR.md` |
| **Reglas de negocio y fórmulas** | `TANGO-OLD-LEGACY.md` |
| **Mapeo funcional por agentes** | `analisis-funcional-tablas.md` |
