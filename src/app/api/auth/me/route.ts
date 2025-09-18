import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export const GET = withAuth(async (request: NextRequest, user) => {
  return successResponse(user, 'Usuario obtenido exitosamente')
})
