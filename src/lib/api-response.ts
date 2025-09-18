import { NextResponse } from 'next/server'

// Interfaces para respuestas API
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Respuestas de éxito
export const successResponse = <T>(
  data?: T, 
  message?: string, 
  status: number = 200
): NextResponse<ApiResponse<T>> => {
  return NextResponse.json({
    success: true,
    data,
    message
  }, { status })
}

// Respuestas de éxito con paginación
export const paginatedResponse = <T>(
  data: T,
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  },
  message?: string,
  status: number = 200
): NextResponse<ApiResponse<T>> => {
  return NextResponse.json({
    success: true,
    data,
    message,
    pagination
  }, { status })
}

// Respuestas de error
export const errorResponse = (
  message: string,
  status: number = 400,
  errors?: string[]
): NextResponse<ApiResponse> => {
  return NextResponse.json({
    success: false,
    message,
    errors
  }, { status })
}

// Respuestas de error de validación
export const validationErrorResponse = (
  errors: string[]
): NextResponse<ApiResponse> => {
  return errorResponse('Errores de validación', 400, errors)
}

// Respuestas de error no encontrado
export const notFoundResponse = (
  message: string = 'Recurso no encontrado'
): NextResponse<ApiResponse> => {
  return errorResponse(message, 404)
}

// Respuestas de error no autorizado
export const unauthorizedResponse = (
  message: string = 'No autorizado'
): NextResponse<ApiResponse> => {
  return errorResponse(message, 401)
}

// Respuestas de error sin permisos
export const forbiddenResponse = (
  message: string = 'Sin permisos suficientes'
): NextResponse<ApiResponse> => {
  return errorResponse(message, 403)
}

// Respuestas de error interno del servidor
export const serverErrorResponse = (
  message: string = 'Error interno del servidor'
): NextResponse<ApiResponse> => {
  return errorResponse(message, 500)
}

// Helper para manejar errores de Prisma
export const handlePrismaError = (error: any): NextResponse<ApiResponse> => {
  console.error('Prisma error:', error)

  switch (error.code) {
    case 'P2002':
      // Violación de restricción única
      const field = error.meta?.target?.[0] || 'campo'
      return errorResponse(`El ${field} ya existe`, 409)
    
    case 'P2025':
      // Registro no encontrado
      return notFoundResponse('Registro no encontrado')
    
    case 'P2003':
      // Violación de clave foránea
      return errorResponse('No se puede eliminar debido a registros relacionados', 409)
    
    default:
      return serverErrorResponse()
  }
}

// Helper para extraer parámetros de paginación de la URL
export const getPaginationParams = (searchParams: URLSearchParams) => {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

// Helper para extraer parámetros de ordenamiento
export const getSortParams = (searchParams: URLSearchParams) => {
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'

  return { sortBy, sortOrder }
}

// Helper para construir filtros de búsqueda
export const buildSearchFilter = (
  query: string,
  fields: string[]
) => {
  if (!query) return {}

  return {
    OR: fields.map(field => ({
      [field]: {
        contains: query,
        mode: 'insensitive'
      }
    }))
  }
}

// Helper para calcular paginación
export const calculatePagination = (total: number, page: number, limit: number) => {
  const totalPages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}
