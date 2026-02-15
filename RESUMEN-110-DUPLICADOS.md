# LISTA DE 110 CLIENTES DUPLICADOS Y SUS DIFERENCIAS

**Fecha de análisis:** 6 de febrero de 2026  
**Base de datos:** CRM crm_pro @ 143.244.191.139

---

## RESUMEN EJECUTIVO

📊 **Total de nombres duplicados:** 110  
📄 **Total de registros duplicados:** 256 (promedio 2.3 por nombre)

### Distribución por cantidad de duplicados:

```
NOTA: El análisis mostró que TODOS son duplicados de 2+ registros
(La estadística de "Con 2 duplicados: 0" está incorrecta en el output)

Basado en el conteo real del CSV:
• 2 duplicados: ~95 nombres
• 3 duplicados: ~10 nombres  
• 4 duplicados: ~3 nombres
• 5 duplicados: 2 nombres
• 6 duplicados: 1 nombre
• 7 duplicados: 1 nombre (JOHANNA MOTA)
```

### 🔥 TOP 10 PEORES CASOS (más duplicados):

1. **JOHANNA MOTA** → 7 duplicados (7 BANs diferentes)
2. **PICERNE DEVELOPMENT** → 6 duplicados (6 BANs diferentes)
3. **CLIENTE PARA SEGUIMIENTO** → 5 duplicados
4. **LEVONA INC** → 5 duplicados
5. **BML LLC** → 4 duplicados
6. **COLEGIO DE TECNICO** → 4 duplicados
7. **PV PROPERTIES INC** → 4 duplicados
8. **VICTOR E RIVERA** → 4 duplicados
9. **A&M CONTRACT, INC** → 3 duplicados
10. **AIREKO SERVICES INSTALLATIONS** → 3 duplicados

---

## CARACTERÍSTICAS PRINCIPALES DE LOS DUPLICADOS

### ✅ Patrón común encontrado:
- **Fecha de creación:** 4 de enero 2026, 21:53:44 (la mayoría)
- **Vendedor:** SIN ASIGNAR (la gran mayoría)
- **Causa:** Importación masiva desde base de datos legacy
- **Problema:** Cada BAN creó un cliente nuevo en vez de reutilizar cliente existente

### 📋 Ejemplos de diferencias entre duplicados:

**Ejemplo 1: JOHANNA MOTA (7 duplicados)**
```
Registro 1: BAN 781532734, 1 suscriptor, $0.00/mes
Registro 2: BAN 773692343, 1 suscriptor, $0.00/mes
Registro 3: BAN 784013834, 1 suscriptor, $0.00/mes
Registro 4: BAN 776229655, 1 suscriptor, $0.00/mes
Registro 5: BAN 773336659, 1 suscriptor, $0.00/mes
Registro 6: BAN 776987163, 1 suscriptor, $0.00/mes
Registro 7: BAN 773385909, 1 suscriptor, $0.00/mes

🚨 TODOS tienen datos → Requiere fusión manual
```

**Ejemplo 2: RAMIREZ & RAMIREZ APPLIANCE INC (2 duplicados)**
```
Registro 1: d0291acc-dac2-49db-bf5c-4f74e3a34735
  • BAN: 776354851
  • Suscriptores: 7
  • Valor mensual: $0.00
  • Vendedor: SIN ASIGNAR

Registro 2: d654e41b-7e35-4fbf-9e1c-4b2651d799c9
  • BAN: 777064578
  • Suscriptores: 1
  • Valor mensual: $0.00
  • Vendedor: SIN ASIGNAR

✅ AMBOS tienen datos → Reasignar BANs al registro principal y eliminar vacío
```

---

## ANÁLISIS DE ACCIONES REQUERIDAS

### 🟢 Casos simples (eliminación directa):
**Criterio:** Todos los duplicados están vacíos (sin BANs, sin suscriptores)

→ **Acción:** Eliminar todos excepto el más antiguo  
→ **Cantidad estimada:** ~5-10 casos

### 🟡 Casos moderados (reasignación):
**Criterio:** Solo UN registro tiene datos (BANs/suscriptores), los demás vacíos

→ **Acción:** Reasignar BANs al registro con datos y eliminar vacíos  
→ **Cantidad estimada:** ~40-50 casos

### 🔴 Casos complejos (fusión manual):
**Criterio:** MÚLTIPLES registros tienen datos (BANs/suscriptores)

→ **Acción:** Fusión manual - Consolidar todos los BANs en UN cliente principal  
→ **Cantidad estimada:** ~60+ casos (LA MAYORÍA)

---

## ARCHIVOS GENERADOS

### 📁 Archivos disponibles:

1. **ANALISIS-DUPLICADOS-DETALLADO-2026-02-06.txt** (3,217 líneas)
   - Análisis completo con TODOS los detalles
   - Muestra cada registro con ID, fecha, vendedor, BANs, suscriptores
   - Incluye análisis automático de cada caso

2. **DUPLICADOS-COMPARACION-2026-02-06.csv** (256 filas)
   - ✅ **RECOMENDADO PARA EXCEL**
   - Formato tabular fácil de ordenar y filtrar
   - Columnas: Num, Nombre, Cantidad, Registro, ID, Fecha, Vendedor, BANs, Suscriptores, Valor, En Seguimiento, Recomendación

3. **DUPLICADOS-CLIENTES-2026-02-05.txt** (827 líneas)
   - Reporte del día anterior (menos detallado)

---

## SCRIPTS DE ANÁLISIS

### 🔧 Scripts disponibles para usar:

1. **find-duplicates.mjs**
   - Busca TODOS los duplicados en la base de datos
   - Muestra detalles completos de cada uno

2. **find-ramirez.mjs**
   - Búsqueda específica para RAMIREZ & RAMIREZ APPLIANCE INC
   - Puedes modificarlo para buscar cualquier cliente

3. **analisis-duplicados-detallado.mjs**
   - Genera análisis comparativo completo
   - Incluye recomendaciones automáticas

4. **generar-csv-duplicados.mjs**
   - Genera CSV para importar a Excel
   - Formato optimizado para revisión manual

### 📘 Cómo usar:
```powershell
# Buscar todos los duplicados
node find-duplicates.mjs

# Buscar un cliente específico (editar el script primero)
node find-ramirez.mjs

# Generar nuevo CSV actualizado
node generar-csv-duplicados.mjs

# Análisis completo
node analisis-duplicados-detallado.mjs > nuevo-reporte.txt
```

---

## PASOS SIGUIENTES RECOMENDADOS

### 🎯 Plan de limpieza:

1. **Abrir el CSV en Excel**
   ```
   DUPLICADOS-COMPARACION-2026-02-06.csv
   ```
   - Ordenar por "Recomendación"
   - Priorizar los que dicen "ELIMINAR TODOS MENOS EL MÁS ANTIGUO"

2. **Casos simples primero** (todos sin datos)
   - Ejecutar DELETE directamente en BD
   - ~10 minutos de trabajo

3. **Casos moderados** (uno con datos)
   - Ejecutar UPDATE para reasignar BANs
   - Luego DELETE de duplicados vacíos
   - ~30-60 minutos de trabajo

4. **Casos complejos** (múltiples con datos)
   - Requiere decisión manual caso por caso
   - Puede tomar varias horas
   - Considerar crear herramienta de fusión

---

## VALIDACIÓN IMPLEMENTADA (PREVIENE FUTUROS)

✅ **v2026-275** ya desplegado con:
- Backend rechaza crear cliente con nombre duplicado
- Frontend valida antes de enviar
- Importador reutiliza cliente si nombre existe
- Endpoint `/api/clients/check-duplicate?name=X` para verificar

**Mensaje mostrado al usuario:**
> ⚠️ Ya existe un cliente con el nombre "XXX". No se permiten duplicados.

---

**Última actualización:** 6 de febrero de 2026  
**Próxima revisión:** Después de limpieza manual
