import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/auth'
import { validateData, customFieldSchema } from '@/lib/validations'
import { 
  successResponse, 
  paginatedResponse,
  validationErrorResponse,
  handlePrismaError,
  getPaginationParams,
  calculatePagination
} from '@/lib/api-response'

// GET /api/custom-fields - Obtener campos personalizados por entidad
export const GET = withPermission('SETTINGS', 'READ', async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const { page, limit, skip } = getPaginationParams(searchParams)

    const where: any = { isActive: true }
    if (entity) where.entity = entity

    const [customFields, total] = await Promise.all([
      prisma.customField.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ],
        include: {
          values: entity ? {
            where: {
              customField: {
                entity: entity
              }
            }
          } : false
        }
      }),
      prisma.customField.count({ where })
    ])

    const pagination = calculatePagination(total, page, limit)

    return paginatedResponse(customFields, pagination)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Get custom fields error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})

// POST /api/custom-fields - Crear nuevo campo personalizado
export const POST = withPermission('SETTINGS', 'CREATE', async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    
    // Validar datos
    const validation = validateData(customFieldSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const data = validation.data!

    // Validar opciones JSON si existen
    if (data.options) {
      try {
        JSON.parse(data.options)
      } catch {
        return validationErrorResponse(['Las opciones deben ser un JSON válido'])
      }
    }

    // Validar reglas de validación JSON si existen
    if (data.validation) {
      try {
        JSON.parse(data.validation)
      } catch {
        return validationErrorResponse(['Las reglas de validación deben ser un JSON válido'])
      }
    }

    // Obtener el próximo orden si no se proporciona
    if (!data.order) {
      const maxOrder = await prisma.customField.aggregate({
        where: { entity: data.entity },
        _max: { order: true }
      })
      data.order = (maxOrder._max.order || 0) + 1
    }

    // Crear campo personalizado
    const customField = await prisma.customField.create({
      data: data
    })

    return successResponse(customField, 'Campo personalizado creado exitosamente', 201)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Create custom field error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})
