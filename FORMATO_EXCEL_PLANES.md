# Formato del Excel para Importar Planes

## Columnas Requeridas (en este orden):

1. **Codigo** - Código del plan (ej: A962, 7200, AB69)
2. **Descripcion** - Descripción del plan (ej: BUS 500 MED BMS LP)
3. **Precio** - Precio mensual (ej: 19.99)
4. **AlfaCode** - Código alfa (ej: B500BMSLP, GB500BMSLP)
5. **Categoria** - Categoría: MOVIL, BANDA_ANCHA, 1PLAY, 2PLAY, 3PLAY, TV
6. **Tecnologia** - Tecnología: GPON, COBRE, VRAD
7. **Instalacion0m** - Costo instalación 0 meses
8. **Instalacion12m** - Costo instalación 12 meses
9. **Instalacion24m** - Costo instalación 24 meses
10. **Activacion0m** - Costo activación 0 meses
11. **Activacion12m** - Costo activación 12 meses
12. **Activacion24m** - Costo activación 24 meses
13. **Penalidad** - Penalidad por cancelación

## Ejemplo de Fila:

| Codigo | Descripcion | Precio | AlfaCode | Categoria | Tecnologia | Instalacion0m | Instalacion12m | Instalacion24m | Activacion0m | Activacion12m | Activacion24m | Penalidad |
|--------|-------------|--------|----------|-----------|------------|---------------|----------------|----------------|--------------|---------------|---------------|-----------|
| A962 | BUS 500 MED BMS LP | 19.99 | B500BMSLP | BANDA_ANCHA | COBRE | 120.00 | 60.00 | 0.00 | 40.00 | 20.00 | 0.00 | 200.00 |
| A866 | GPON BUS 500 MED BMS LP | 19.99 | GB500BMSLP | BANDA_ANCHA | GPON | 120.00 | 60.00 | 0.00 | 40.00 | 20.00 | 0.00 | 200.00 |

## Notas:
- La primera fila DEBE ser el encabezado con estos nombres exactos
- Los precios deben ser números (sin símbolo $)
- Las categorías deben ser exactamente: MOVIL, BANDA_ANCHA, 1PLAY, 2PLAY, 3PLAY, TV
- Las tecnologías deben ser: GPON, COBRE, o VRAD
