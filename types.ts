export interface Theme {
  mode: 'dark' | 'light';
  primaryColor: string;
  bgColor: string;
  textColor: string;
  sidebarColor: string;
}

export interface Salesperson {
  id: string;
  name: string;
  email: string;
  avatar: string;
  monthlySalesGoal?: number;
  role: 'admin' | 'vendedor';
  theme?: Theme;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  monthlyGoal?: number;
}

export interface Subscriber {
  id: string;
  banId: string;
  phoneNumber: string;
  status: 'activo' | 'suspendido' | 'cancelado';
  productId: string | null; // plan
  categoryId: string | null; // categoria
  contractEndDate: string; // venc contrato
  equipment: string; // equipo
  city: string; // pueblo
  monthsSold?: number;
  paymentsMade?: number;
}

export interface Ban {
  id: string;
  clientId: string;
  number: string;
  status: 'activo' | 'cancelado';
  lastUpdated: string;
}

export interface PipelineStatus {
  id: string;
  name: string;
  color: string;
}

export interface PipelineNote {
  id: string;
  clientId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Client {
  id:string;
  name: string;
  company: string;
  email: string;
  phone: string;
  mobile?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  taxId?: string;
  notes?: string;
  salespersonId: string | null;
  productIds: string[];
  banIds: string[];
  // New fields for pipeline
  pipelineStatusId: string | null;
  comments: number;
  isCompleted: boolean;
  priority: number | null;
  group: string;
  pipelineValues: {
    fijoNew: number;
    fijoRen: number;
    movilNew: number;
    movilRen: number;
    claroTv: number;
  };
  dateCalled?: string;
  dateToCall?: string;
}

export interface Income {
    id: string;
    date: string;
    description: string;
    amount: number;
    productId: string | null;
    productName?: string | null;  // Nombre del producto desde backend
    salespersonId: string | null;
    salespersonName?: string | null;  // Nombre del vendedor desde backend
    clientId?: string | null;  // Cliente relacionado
    clientName?: string | null;  // Nombre del cliente
}

export interface Expense {
    id: string;
    date: string;
    description: string;
    amount: number;
    category?: 'oficina' | 'transporte' | 'marketing' | 'personal' | 'equipamiento' | 'otros';
    categoryName?: string;  // Nombre legible de la categoría
}

export interface Meta {
  id: string;
  vendedorId: string | null;  // null para metas del negocio
  metaValor: number;
  periodo: string;  // formato 'YYYY-MM' o 'mensual', 'trimestral', 'anual'
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
  createdAt: string;
  tipoMeta: string;
  tipoObjetivo?: 'vendedor' | 'negocio';  // nuevo campo
  categoria?: string;
  descripcion?: string;
  year?: number;  // campos calculados/opcionales
  month?: number;
}

export interface MetaNegocio {
  id: string;
  categoria: string;
  metaValor: number;
  year: number;
  month: number;
  activa: boolean;
  createdAt: string;
  descripcion?: string;
}

export type Page = 'Dashboard' | 'Clients' | 'Products' | 'Vendedores' | 'Bans' | 'Pipeline' | 'Finances' | 'Metas' | 'ImportData' | 'Subscribers';

export interface CrmStats {
  totalClients: number;
  totalProducts: number;
  totalSalespeople: number;
  activeBans: number;
}