import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'
import { validateData, loginSchema } from '@/lib/validations'
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
    const validation = validateData(loginSchema, body)
    if (!validation.success) {
      return validationErrorResponse(validation.errors!)
    }

    const { email, password } = validation.data!

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        permissions: true
      }
    })

    if (!user || !user.isActive) {
      return errorResponse('Credenciales inválidas', 401)
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return errorResponse('Credenciales inválidas', 401)
    }

    // Generar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // Respuesta exitosa
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
    }, 'Login exitoso')

  } catch (error: any) {
    if (error.code) {
      return handlePrismaError(error)
    }
    
    console.error('Login error:', error)
    return errorResponse('Error interno del servidor', 500)
  }
}
