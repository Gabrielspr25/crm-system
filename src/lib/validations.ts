import { z } from 'zod'

// Esquemas base
export const userSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'MANAGER', 'SALES', 'SUPPORT', 'USER']).optional(),
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

export const contactSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  position: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'CUSTOMER', 'BLOCKED']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  birthday: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
})

export const leadSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  value: z.number().min(0).optional(),
  source: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  stage: z.string().optional(),
  contactId: z.string().optional(),
  expectedCloseDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
})

export const opportunitySchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  value: z.number().min(0, 'El valor debe ser positivo'),
  probability: z.number().min(0).max(100).optional(),
  stage: z.enum(['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'DECISION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
  status: z.enum(['OPEN', 'WON', 'LOST', 'ON_HOLD']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  expectedCloseDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
})

export const activitySchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  type: z.enum(['TASK', 'CALL', 'EMAIL', 'MEETING', 'DEMO', 'FOLLOW_UP', 'NOTE']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
})

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  inventory: z.number().min(0).optional(),
})

export const customFieldSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  label: z.string().min(1, 'La etiqueta es requerida'),
  fieldType: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'EMAIL', 'PHONE', 'DATE', 'SELECT', 'MULTISELECT', 'CHECKBOX', 'RADIO', 'FILE']),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  options: z.string().optional(), // JSON string
  validation: z.string().optional(), // JSON string
  entity: z.string().min(1, 'La entidad es requerida'),
  order: z.number().optional(),
})

// Esquemas para actualización (campos opcionales)
export const updateUserSchema = userSchema.partial().omit({ password: true })
export const updateContactSchema = contactSchema.partial()
export const updateLeadSchema = leadSchema.partial()
export const updateOpportunitySchema = opportunitySchema.partial()
export const updateActivitySchema = activitySchema.partial()
export const updateProductSchema = productSchema.partial()
export const updateCustomFieldSchema = customFieldSchema.partial()

// Esquema para cambio de contraseña
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
})

// Esquemas para filtros y búsqueda
export const searchSchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const contactFilterSchema = searchSchema.extend({
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(),
})

export const leadFilterSchema = searchSchema.extend({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  source: z.string().optional(),
})

export const opportunityFilterSchema = searchSchema.extend({
  stage: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
})

export const activityFilterSchema = searchSchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
})

// Función helper para validar datos
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
      }
    }
    return { success: false, errors: ['Error de validación desconocido'] }
  }
}
