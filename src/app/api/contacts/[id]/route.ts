import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, hasPermission } from '@/lib/auth'
import { validateData, updateContactSchema } from '@/lib/validations'
import { 
  successResponse, 
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  unauthorizedResponse,
  forbiddenResponse
} from '@/lib/api-response'

// GET /api/contacts/[id] - Obtener contacto específico
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Verificar permisos
    if (!hasPermission(user, 'CONTACTS', 'READ')) {
      return forbiddenResponse()
    }

    const contactId = params.id

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!contact) {
      return notFoundResponse('Contacto no encontrado')
    }

    // Verificar permisos (si no es admin, debe ser creado o asignado por el usuario)
    if (user.role !== 'ADMIN' && 
        contact.createdById !== user.id && 
        contact.assignedToId !== user.id) {
      return notFoundResponse('Contacto no encontrado')
    }

    return successResponse(contact)

  } catch (error) {
    console.error('Get contact error:', error)
    return serverErrorResponse()
  }
}

// PUT /api/contacts/[id] - Actualizar contacto
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Verificar permisos
    if (!hasPermission(user, 'CONTACTS', 'UPDATE')) {
      return forbiddenResponse()
    }

    const contactId = params.id
    const body = await request.json()
    
    // Validar datos
    const validation = validateData(updateContactSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const data = validation.data!

    // Verificar que el contacto existe
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!existingContact) {
      return notFoundResponse('Contacto no encontrado')
    }

    // Verificar permisos
    if (user.role !== 'ADMIN' && 
        existingContact.createdById !== user.id && 
        existingContact.assignedToId !== user.id) {
      return notFoundResponse('Contacto no encontrado')
    }

    // Actualizar contacto
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...data,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        updatedAt: new Date()
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

    return successResponse(contact, 'Contacto actualizado exitosamente')

  } catch (error) {
    console.error('Update contact error:', error)
    return serverErrorResponse()
  }
}

// DELETE /api/contacts/[id] - Eliminar contacto
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Verificar permisos
    if (!hasPermission(user, 'CONTACTS', 'DELETE')) {
      return forbiddenResponse()
    }

    const contactId = params.id

    // Verificar que el contacto existe
    const existingContact = await prisma.contact.findUnique({
      where: { id: contactId }
    })

    if (!existingContact) {
      return notFoundResponse('Contacto no encontrado')
    }

    // Verificar permisos
    if (user.role !== 'ADMIN' && existingContact.createdById !== user.id) {
      return notFoundResponse('Contacto no encontrado')
    }

    // Eliminar contacto
    await prisma.contact.delete({
      where: { id: contactId }
    })

    return successResponse(null, 'Contacto eliminado exitosamente')

  } catch (error) {
    console.error('Delete contact error:', error)
    return serverErrorResponse()
  }
}
