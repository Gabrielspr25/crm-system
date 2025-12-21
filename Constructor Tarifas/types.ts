
export type BusinessCategory = 'MOVIL' | '1PLAY' | '2PLAY' | '3PLAY' | 'TV' | 'BENEFICIOS';

export interface PlanCostMatrix {
  m0: string;  // 0 Meses
  m12: string; // 12 Meses
  m24: string; // 24 Meses
}

export interface PlanTableRow {
  code: string;       
  description: string; 
  price: string;      
  alphaCode: string;  
  installation?: PlanCostMatrix;
  activation?: PlanCostMatrix;
  penalty?: string;
  customData?: string[]; 
}

export interface TechnicalTable {
  technology: 'COBRE/VRAD' | 'GPON' | 'GENERAL' | 'GPON (Simétrico)' | 'MOVIL' | 'ROAMING';
  headerColor: 'red' | 'blue' | 'gray' | 'black';
  customHeaders?: string[]; 
  rows: PlanTableRow[];
}

export interface BusinessPlan {
  id: string;
  title: string; 
  category: BusinessCategory;
  description?: string;
  tables: TechnicalTable[];
  notes?: string[]; 
  features?: string[];
  specs?: Record<string, any>;
  billingFrequency?: string;
  tags?: string[]; 
  validity?: string; 
  expirationDate?: string; 
  isSpecialOffer?: boolean; 
}

export interface Device {
  id: string;
  name: string;
  brand: 'Apple' | 'Samsung' | 'Motorola' | 'OnePlus' | 'Google' | 'Honor' | 'Other';
  storage?: string;
  basePrice: number; 
  category?: 'Ultra High' | 'High' | 'Mid' | 'Entry';
}

export interface FinancingOffer {
  id: string;
  title: string; 
  description: string;
  condition: 'TRADE_IN' | 'NO_TRADE_IN' | 'DESCUENTO';
  minPlanPrice: number;
  devices: string[]; 
  color: string; 
  priceCode: string; 
  termMonths: 24 | 30;
  streamingBonus: boolean;
  applicablePlans: string[]; 
  terms: string[]; 
}

export interface Benefit {
  id: string;
  title: string;
  value: string; 
  type: 'CASH' | 'SERVICE' | 'DISCOUNT';
  requiredClientType: 'REGULAR' | 'CONVERGENTE' | 'AMBOS';
  category: 'MOVIL' | 'FIJO' | 'AMBOS' | 'TV';
  description: string;
  requirements: string; 
  legalTerm: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ViewState = 'catalog' | 'import' | 'chat' | 'devices' | 'admin';
