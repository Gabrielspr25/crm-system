import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seeding de la base de datos...')

  try {
    // Crear usuario administrador por defecto
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@crm.com' },
      update: {},
      create: {
        email: 'admin@crm.com',
        name: 'Administrador',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    })

    console.log('✅ Usuario administrador creado:', admin.email)

    // Crear permisos para el administrador (todos los permisos)
    const permissions = [
      { area: 'CONTACTS', type: 'READ' },
      { area: 'CONTACTS', type: 'CREATE' },
      { area: 'CONTACTS', type: 'UPDATE' },
      { area: 'CONTACTS', type: 'DELETE' },
      { area: 'CONTACTS', type: 'EXPORT' },
      
      { area: 'LEADS', type: 'READ' },
      { area: 'LEADS', type: 'CREATE' },
      { area: 'LEADS', type: 'UPDATE' },
      { area: 'LEADS', type: 'DELETE' },
      { area: 'LEADS', type: 'EXPORT' },
      
      { area: 'OPPORTUNITIES', type: 'READ' },
      { area: 'OPPORTUNITIES', type: 'CREATE' },
      { area: 'OPPORTUNITIES', type: 'UPDATE' },
      { area: 'OPPORTUNITIES', type: 'DELETE' },
      { area: 'OPPORTUNITIES', type: 'EXPORT' },
      
      { area: 'ACTIVITIES', type: 'READ' },
      { area: 'ACTIVITIES', type: 'CREATE' },
      { area: 'ACTIVITIES', type: 'UPDATE' },
      { area: 'ACTIVITIES', type: 'DELETE' },
      { area: 'ACTIVITIES', type: 'EXPORT' },
      
      { area: 'PRODUCTS', type: 'READ' },
      { area: 'PRODUCTS', type: 'CREATE' },
      { area: 'PRODUCTS', type: 'UPDATE' },
      { area: 'PRODUCTS', type: 'DELETE' },
      { area: 'PRODUCTS', type: 'EXPORT' },
      
      { area: 'REPORTS', type: 'READ' },
      { area: 'REPORTS', type: 'EXPORT' },
      
      { area: 'SETTINGS', type: 'READ' },
      { area: 'SETTINGS', type: 'CREATE' },
      { area: 'SETTINGS', type: 'UPDATE' },
      { area: 'SETTINGS', type: 'DELETE' },
      
      { area: 'USERS', type: 'READ' },
      { area: 'USERS', type: 'CREATE' },
      { area: 'USERS', type: 'UPDATE' },
      { area: 'USERS', type: 'DELETE' },
    ]

    for (const permission of permissions) {
      await prisma.userPermission.upsert({
        where: {
          userId_area_type: {
            userId: admin.id,
            area: permission.area as any,
            type: permission.type as any
          }
        },
        update: {},
        create: {
          userId: admin.id,
          area: permission.area as any,
          type: permission.type as any
        }
      })
    }

    console.log('✅ Permisos del administrador configurados')

    // Crear usuario de prueba para ventas
    const salesPassword = await bcrypt.hash('sales123', 12)
    const salesUser = await prisma.user.upsert({
      where: { email: 'ventas@crm.com' },
      update: {},
      create: {
        email: 'ventas@crm.com',
        name: 'Usuario de Ventas',
        password: salesPassword,
        role: 'SALES',
        isActive: true,
      },
    })

    console.log('✅ Usuario de ventas creado:', salesUser.email)

    // Permisos básicos para el usuario de ventas
    const salesPermissions = [
      { area: 'CONTACTS', type: 'READ' },
      { area: 'CONTACTS', type: 'CREATE' },
      { area: 'CONTACTS', type: 'UPDATE' },
      
      { area: 'LEADS', type: 'READ' },
      { area: 'LEADS', type: 'CREATE' },
      { area: 'LEADS', type: 'UPDATE' },
      
      { area: 'OPPORTUNITIES', type: 'READ' },
      { area: 'OPPORTUNITIES', type: 'CREATE' },
      { area: 'OPPORTUNITIES', type: 'UPDATE' },
      
      { area: 'ACTIVITIES', type: 'READ' },
      { area: 'ACTIVITIES', type: 'CREATE' },
      { area: 'ACTIVITIES', type: 'UPDATE' },
    ]

    for (const permission of salesPermissions) {
      await prisma.userPermission.upsert({
        where: {
          userId_area_type: {
            userId: salesUser.id,
            area: permission.area as any,
            type: permission.type as any
          }
        },
        update: {},
        create: {
          userId: salesUser.id,
          area: permission.area as any,
          type: permission.type as any
        }
      })
    }

    console.log('✅ Permisos del usuario de ventas configurados')

    // Crear algunos contactos de ejemplo
    const contacts = [
      {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@ejemplo.com',
        phone: '+1234567890',
        company: 'Empresa ABC',
        position: 'Gerente General',
        status: 'PROSPECT',
        createdById: admin.id,
      },
      {
        firstName: 'María',
        lastName: 'González',
        email: 'maria.gonzalez@ejemplo.com',
        phone: '+1234567891',
        company: 'Tech Solutions',
        position: 'Directora de IT',
        status: 'ACTIVE',
        createdById: admin.id,
      }
    ]

    for (const contact of contacts) {
      await prisma.contact.create({
        data: contact as any
      })
    }

    console.log('✅ Contactos de ejemplo creados')

    // Crear categorías de productos primero
    const serviceCategory = await prisma.productCategory.create({
      data: {
        nombre: 'Servicios',
        descripcion: 'Servicios de consultoría y soporte',
        tipo: 'EXTERNO',
        orden: 1
      }
    })

    const softwareCategory = await prisma.productCategory.create({
      data: {
        nombre: 'Software',
        descripcion: 'Licencias y software',
        tipo: 'EXTERNO',
        orden: 2
      }
    })

    console.log('✅ Categorías de productos creadas')

    // Crear productos de ejemplo
    const products = [
      {
        name: 'Servicio de Consultoría',
        description: 'Consultoría especializada en CRM',
        price: 1500.00,
        categoryId: serviceCategory.id,
        isActive: true
      },
      {
        name: 'Software Premium',
        description: 'Licencia anual de software CRM',
        price: 5000.00,
        categoryId: softwareCategory.id,
        isActive: true
      }
    ]

    for (const product of products) {
      await prisma.product.create({
        data: product
      })
    }

    console.log('✅ Productos de ejemplo creados')

    console.log('🎉 Seeding completado exitosamente!')
    console.log('')
    console.log('📋 Credenciales de acceso:')
    console.log('👨‍💼 Admin: admin@crm.com / admin123')
    console.log('👩‍💼 Ventas: ventas@crm.com / sales123')

  } catch (error) {
    console.error('❌ Error durante el seeding:', error)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
