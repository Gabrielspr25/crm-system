import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/auth'
import { validateData, opportunitySchema } from '@/lib/validations'
import { 
  successResponse, 
  paginatedResponse,
  validationErrorResponse,
  handlePrismaError,
  getPaginationParams,
  getSortParams,
  buildSearchFilter,
  calculatePagination
} from '@/lib/api-response'

// GET /api/opportunities - Listar oportunidades con filtros y paginación
export const GET = withPermission('OPPORTUNITIES', 'READ', async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(searchParams)
    const { sortBy, sortOrder } = getSortParams(searchParams)
    
    // Filtros de búsqueda
    const query = searchParams.get('q') || ''
    const stage = searchParams.get('stage')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')
    const minValue = searchParams.get('minValue')
    const maxValue = searchParams.get('maxValue')

    // Construir filtros
    const where: any = {}

    // Filtro de búsqueda por texto
    if (query) {
      const searchFilter = buildSearchFilter(query, [
        'title', 'description'
      ])
      Object.assign(where, searchFilter)
    }

    // Filtros específicos
    if (stage) where.stage = stage
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedTo) where.assignedToId = assignedTo
    
    // Filtros de valor
    if (minValue || maxValue) {
      where.value = {}
      if (minValue) where.value.gte = parseFloat(minValue)
      if (maxValue) where.value.lte = parseFloat(maxValue)
    }

    // Si no es admin, solo ver oportunidades asignadas o creadas por el usuario
    if (user.role !== 'ADMIN') {
      where.OR = [
        { createdById: user.id },
        { assignedToId: user.id }
      ]
    }

    // Obtener oportunidades
    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          contact: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true, 
              company: true 
            }
          },
          lead: {
            select: { 
              id: true, 
              title: true, 
              status: true 
            }
          },
          _count: {
            select: {
              activities: true
            }
          }
        }
      }),
      prisma.opportunity.count({ where })
    ])

    const pagination = calculatePagination(total, page, limit)

    return paginatedResponse(opportunities, pagination)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Get opportunities error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})

// POST /api/opportunities - Crear nueva oportunidad
export const POST = withPermission('OPPORTUNITIES', 'CREATE', async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    
    // Validar datos
    const validation = validateData(opportunitySchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const data = validation.data!

    // Crear oportunidad
    const opportunity = await prisma.opportunity.create({
      data: {
        ...data,
        createdById: user.id,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        contact: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            company: true 
          }
        },
        lead: {
          select: { 
            id: true, 
            title: true, 
            status: true 
          }
        }
      }
    })

    return successResponse(opportunity, 'Oportunidad creada exitosamente', 201)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Create opportunity error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})
