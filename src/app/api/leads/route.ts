import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/auth'
import { validateData, leadSchema } from '@/lib/validations'
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

// GET /api/leads - Listar leads con filtros y paginación
export const GET = withPermission('LEADS', 'READ', async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(searchParams)
    const { sortBy, sortOrder } = getSortParams(searchParams)
    
    // Filtros de búsqueda
    const query = searchParams.get('q') || ''
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')
    const source = searchParams.get('source')

    // Construir filtros
    const where: any = {}

    // Filtro de búsqueda por texto
    if (query) {
      const searchFilter = buildSearchFilter(query, [
        'title', 'description', 'stage', 'source'
      ])
      Object.assign(where, searchFilter)
    }

    // Filtros específicos
    if (status) where.status = status
    if (priority) where.priority = priority
    if (assignedTo) where.assignedToId = assignedTo
    if (source) where.source = source

    // Si no es admin, solo ver leads asignados o creados por el usuario
    if (user.role !== 'ADMIN') {
      where.OR = [
        { createdById: user.id },
        { assignedToId: user.id }
      ]
    }

    // Obtener leads
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
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
          _count: {
            select: {
              opportunities: true,
              activities: true
            }
          }
        }
      }),
      prisma.lead.count({ where })
    ])

    const pagination = calculatePagination(total, page, limit)

    return paginatedResponse(leads, pagination)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Get leads error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})

// POST /api/leads - Crear nuevo lead
export const POST = withPermission('LEADS', 'CREATE', async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    
    // Validar datos
    const validation = validateData(leadSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const data = validation.data!

    // Crear lead
    const lead = await prisma.lead.create({
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
        }
      }
    })

    return successResponse(lead, 'Lead creado exitosamente', 201)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Create lead error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})
