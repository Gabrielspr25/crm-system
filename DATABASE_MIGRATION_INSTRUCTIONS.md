# Instrucciones para Migración de Base de Datos - CRM System

## Problema Resuelto

Se han corregido los errores de validación del esquema Prisma relacionados con las relaciones de campos dinámicos en los modelos `BAN` y `Suscriptor`. El problema se originaba por intentar crear relaciones específicas que generaban conflictos en las claves foráneas.

## Cambios Realizados

### 1. Modelo CustomFieldValue Simplificado
- Se eliminaron las relaciones específicas con BAN y Suscriptor que causaban conflictos
- Se mantiene el diseño flexible usando `entityId` y `entityType` para soportar cualquier entidad
- El sistema de campos dinámicos funciona mediante consultas programáticas en lugar de relaciones de base de datos

### 2. Modelos BAN y Suscriptor
- Se removieron las referencias a `customFieldValues` con relaciones específicas
- Los campos dinámicos se manejan a través de consultas usando `entityId` y `entityType`

## Archivos Generados

1. **`database_migration_fix_custom_fields.sql`**: Script completo de migración
2. **`prisma/schema.prisma`**: Esquema corregido y validado

## Pasos para Aplicar la Migración

### Cuando el servidor de base de datos esté disponible:

1. **Verificar conectividad**:
   ```bash
   npx prisma db pull
   ```

2. **Aplicar la migración**:
   ```bash
   npx prisma migrate dev --name fix-custom-fields-relations
   ```
   
   O alternativamente, ejecutar el script SQL directamente:
   ```bash
   psql -h 138.197.66.85 -p 5432 -U tu_usuario -d bs_postgres -f database_migration_fix_custom_fields.sql
   ```

3. **Regenerar el cliente Prisma** (ya realizado):
   ```bash
   npx prisma generate
   ```

4. **Ejecutar el seeding** (opcional):
   ```bash
   npx prisma db seed
   ```

## Estado Actual del Proyecto

✅ **Completado:**
- Esquema Prisma corregido y validado
- Cliente Prisma regenerado exitosamente
- Script de migración SQL generado
- Documentación actualizada

⏳ **Pendiente (requiere servidor DB activo):**
- Aplicación de migración a la base de datos
- Seeding de datos iniciales
- Verificación de integridad de datos

## Uso de Campos Dinámicos

Con el diseño corregido, los campos dinámicos se utilizan de la siguiente manera:

```typescript
// Crear un campo personalizado para BANs
const banField = await prisma.customField.create({
  data: {
    name: 'tipo_plan',
    label: 'Tipo de Plan',
    fieldType: 'SELECT',
    entity: 'ban',
    options: JSON.stringify(['Básico', 'Premium', 'Empresarial'])
  }
});

// Asignar valor a un BAN específico
const banFieldValue = await prisma.customFieldValue.create({
  data: {
    customFieldId: banField.id,
    entityId: banId,
    entityType: 'ban',
    value: 'Premium'
  }
});

// Consultar campos dinámicos de un BAN
const banWithCustomFields = await prisma.customFieldValue.findMany({
  where: {
    entityId: banId,
    entityType: 'ban'
  },
  include: {
    customField: true
  }
});
```

## Próximos Pasos

1. Activar el servidor de base de datos
2. Aplicar la migración
3. Continuar con el desarrollo de funcionalidades específicas del CRM
4. Implementar las páginas frontend restantes
5. Configurar notificaciones en tiempo real
6. Desarrollar reportes avanzados

## Notas Técnicas

- El diseño actual es más flexible y escalable
- No hay límites en el tipo de entidades que pueden tener campos dinámicos
- Las consultas de campos dinámicos se optimizan a través de índices compuestos
- La validación de integridad se mantiene a través de restricciones de base de datos
