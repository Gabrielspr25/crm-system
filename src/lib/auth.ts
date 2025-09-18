import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

// Interfaces
export interface UserTokenPayload {
  id: string
  email: string
  role: string
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  permissions: Array<{
    area: string
    type: string
  }>
}

// Constantes
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const SALT_ROUNDS = 12

// Funciones de hash de contraseñas
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash)
}

// Funciones JWT
export const generateToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export const verifyToken = (token: string): UserTokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload
  } catch {
    return null
  }
}

// Función para obtener usuario del token
export const getUserFromToken = async (token: string): Promise<AuthUser | null> => {
  const payload = verifyToken(token)
  if (!payload) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        permissions: true
      }
    })

    if (!user || !user.isActive) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions.map(p => ({
        area: p.area,
        type: p.type
      }))
    }
  } catch {
    return null
  }
}

// Función para obtener usuario de la request
export const getUserFromRequest = async (request: NextRequest): Promise<AuthUser | null> => {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  return await getUserFromToken(token)
}

// Función para verificar permisos
export const hasPermission = (
  user: AuthUser,
  area: string,
  permission: string
): boolean => {
  // Los administradores tienen todos los permisos
  if (user.role === 'ADMIN') return true

  // Verificar permisos específicos
  return user.permissions.some(p => 
    p.area === area && p.type === permission
  )
}

// Middleware de autenticación
export const withAuth = (handler: (req: NextRequest, user: AuthUser) => Promise<Response>) => {
  return async (req: NextRequest): Promise<Response> => {
    const user = await getUserFromRequest(req)
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }), 
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    return handler(req, user)
  }
}

// Middleware de permisos
export const withPermission = (
  area: string, 
  permission: string,
  handler: (req: NextRequest, user: AuthUser) => Promise<Response>
) => {
  return withAuth(async (req: NextRequest, user: AuthUser) => {
    if (!hasPermission(user, area, permission)) {
      return new Response(
        JSON.stringify({ error: 'Sin permisos suficientes' }), 
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    return handler(req, user)
  })
}
