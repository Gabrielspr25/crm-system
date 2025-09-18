import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/auth'
import { validateData, contactSchema } from '@/lib/validations'
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

// GET /api/contacts - Listar contactos con filtros y paginación
export const GET = withPermission('CONTACTS', 'READ', async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, skip } = getPaginationParams(searchParams)
    const { sortBy, sortOrder } = getSortParams(searchParams)
    
    // Filtros de búsqueda
    const query = searchParams.get('q') || ''
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assignedTo')
    const source = searchParams.get('source')
    const tags = searchParams.get('tags')?.split(',')

    // Construir filtros
    const where: any = {}

    // Filtro de búsqueda por texto
    if (query) {
      const searchFilter = buildSearchFilter(query, [
        'firstName', 'lastName', 'email', 'company', 'phone'
      ])
      Object.assign(where, searchFilter)
    }

    // Filtros específicos
    if (status) where.status = status
    if (assignedTo) where.assignedToId = assignedTo
    if (source) where.source = source
    if (tags?.length) {
      where.tags = {
        hasSome: tags
      }
    }

    // Si no es admin, solo ver contactos asignados o creados por el usuario
    if (user.role !== 'ADMIN') {
      where.OR = [
        { createdById: user.id },
        { assignedToId: user.id }
      ]
    }

    // Obtener contactos
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
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
          _count: {
            select: {
              leads: true,
              opportunities: true,
              activities: true
            }
          }
        }
      }),
      prisma.contact.count({ where })
    ])

    const pagination = calculatePagination(total, page, limit)

    return paginatedResponse(contacts, pagination)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Get contacts error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})

// POST /api/contacts - Crear nuevo contacto
export const POST = withPermission('CONTACTS', 'CREATE', async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    
    // Validar datos
    const validation = validateData(contactSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const data = validation.data!

    // Crear contacto
    const contact = await prisma.contact.create({
      data: {
        ...data,
        createdById: user.id,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return successResponse(contact, 'Contacto creado exitosamente', 201)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Create contact error:', error)
    return handlePrismaError({ code: 'UNKNOWN' })
  }
})
