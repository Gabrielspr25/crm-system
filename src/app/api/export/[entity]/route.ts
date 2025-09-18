import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, hasPermission } from '@/lib/auth'
import { stringify } from 'csv-stringify/sync'
import * as XLSX from 'xlsx'

// GET /api/export/[entity] - Exportar datos a CSV/XLSX
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entity: string }> }
) {
  const params = await context.params
  
  // Verificar autenticación
  const user = await getUserFromRequest(request)
  if (!user) {
    return new Response('No autorizado', { status: 401 })
  }

  // Verificar permisos
  if (!hasPermission(user, 'REPORTS', 'EXPORT') && !hasPermission(user, 'CONTACTS', 'EXPORT')) {
    return new Response('Sin permisos suficientes', { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv' // csv o xlsx
    const entity = params.entity
    
    // Validar entidad
    const validEntities = ['contacts', 'leads', 'opportunities', 'activities', 'products']
    if (!validEntities.includes(entity)) {
      return new Response('Entidad no válida', { status: 400 })
    }

    let data: any[] = []
    let filename = ''

    // Obtener datos según la entidad
    switch (entity) {
      case 'contacts':
        data = await prisma.contact.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            assignedTo: { select: { name: true, email: true } }
          }
        })
        filename = 'contactos'
        break

      case 'leads':
        data = await prisma.lead.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            assignedTo: { select: { name: true, email: true } },
            contact: { select: { firstName: true, lastName: true, email: true } }
          }
        })
        filename = 'leads'
        break

      case 'opportunities':
        data = await prisma.opportunity.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            assignedTo: { select: { name: true, email: true } },
            contact: { select: { firstName: true, lastName: true, email: true } },
            lead: { select: { title: true } }
          }
        })
        filename = 'oportunidades'
        break

      case 'activities':
        data = await prisma.activity.findMany({
          include: {
            createdBy: { select: { name: true, email: true } },
            assignedTo: { select: { name: true, email: true } },
            contact: { select: { firstName: true, lastName: true } },
            lead: { select: { title: true } },
            opportunity: { select: { title: true } }
          }
        })
        filename = 'actividades'
        break

      case 'products':
        data = await prisma.product.findMany()
        filename = 'productos'
        break
    }

    // Aplicar filtros si no es admin
    if (user.role !== 'ADMIN') {
      data = data.filter((item: any) => 
        item.createdById === user.id || item.assignedToId === user.id
      )
    }

    // Procesar datos para exportación
    const processedData = data.map(item => {
      const processed: any = {}
      
      Object.keys(item).forEach(key => {
        if (key === 'createdBy' && item[key]) {
          processed['Creado Por'] = item[key].name || item[key].email
        } else if (key === 'assignedTo' && item[key]) {
          processed['Asignado A'] = item[key].name || item[key].email
        } else if (key === 'contact' && item[key]) {
          processed['Contacto'] = `${item[key].firstName} ${item[key].lastName || ''}`.trim()
        } else if (key === 'lead' && item[key]) {
          processed['Lead'] = item[key].title
        } else if (key === 'opportunity' && item[key]) {
          processed['Oportunidad'] = item[key].title
        } else if (typeof item[key] === 'string' || typeof item[key] === 'number') {
          // Traducir nombres de campos comunes
          const fieldNames: { [key: string]: string } = {
            id: 'ID',
            firstName: 'Nombre',
            lastName: 'Apellido',
            email: 'Email',
            phone: 'Teléfono',
            company: 'Empresa',
            position: 'Cargo',
            title: 'Título',
            description: 'Descripción',
            status: 'Estado',
            priority: 'Prioridad',
            value: 'Valor',
            stage: 'Etapa',
            probability: 'Probabilidad',
            createdAt: 'Fecha de Creación',
            updatedAt: 'Fecha de Actualización'
          }
          
          const fieldName = fieldNames[key] || key
          processed[fieldName] = item[key]
        }
      })
      
      return processed
    })

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    
    if (format === 'xlsx') {
      // Exportar como XLSX
      const worksheet = XLSX.utils.json_to_sheet(processedData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, entity)
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}_${timestamp}.xlsx"`
        }
      })
    } else {
      // Exportar como CSV
      const csv = stringify(processedData, { 
        header: true,
        quoted: true
      })
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}_${timestamp}.csv"`
        }
      })
    }

  } catch (error: any) {
    console.error('Export error:', error)
    return new Response('Error al exportar datos', { status: 500 })
  }
}
