import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { validateData, userSchema } from '@/lib/validations'
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse,
  handlePrismaError 
} from '@/lib/api-response'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar datos de entrada
    const validation = validateData(userSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const { email, name, password, role } = validation.data!

    // Hash de la contraseña
    const hashedPassword = await hashPassword(password)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || 'USER'
      },
      include: {
        permissions: true
      }
    })

    // Generar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // Respuesta exitosa (sin incluir password)
    return successResponse({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions.map(p => ({
          area: p.area,
          type: p.type
        }))
      }
    }, 'Usuario creado exitosamente', 201)

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Register error:', error)
    return errorResponse('Error interno del servidor', 500)
  }
}
