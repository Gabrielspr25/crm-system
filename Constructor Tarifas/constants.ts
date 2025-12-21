
import { BusinessPlan, Device, FinancingOffer, Benefit } from './types';

export const BENEFITS: Benefit[] = [
  {
    id: 'bono-portabilidad-150',
    title: 'Bono Portabilidad PYMES',
    value: '$150 / $50',
    type: 'CASH',
    requiredClientType: 'AMBOS',
    category: 'MOVIL',
    description: 'Bono por portabilidad para clientes nuevos o existentes.',
    requirements: 'Planes desde $45. Portabilidad numérica.',
    legalTerm: 'Convergentes: $150. No Convergentes: $150 (2+ líneas) o $50 (1 línea).'
  }
];

export const DEVICES: Device[] = [
  { id: 'ip17pro', name: 'iPhone 17 Pro', brand: 'Apple', storage: '256GB', basePrice: 1099, category: 'High' }
];

export const FINANCING_OFFERS: FinancingOffer[] = [];

export const INITIAL_BUSINESS_PLANS: BusinessPlan[] = [
  // --- MOVIL: PLANES NACIONALES INDIVIDUALES ---
  {
    id: 'movil-nacional-individual',
    title: 'Planes Nacionales Individuales',
    category: 'MOVIL',
    tables: [
      {
        technology: 'MOVIL',
        headerColor: 'red',
        customHeaders: ['Codigo', 'Renta Mensual', 'PLANES NACIONALES INDIVIDUALES'],
        rows: [
          { code: 'VOLT412', description: 'VOLTE - 1000 MIN EN PR Y USA, 100 LD A USA, 900 SMS, 100 MMS, DATA PR Y USA PUJ 4.5GB', price: '$12.00', alphaCode: 'IND' },
          { code: 'VOLT820', description: 'VOLTE - Voz local ilimitada, SMS/MMS en PR, a US y a ciertos destinos INT, SMS/MMS roaming en USA, LD ilimitado a USA, 100 minutos para Larga distancia a destinos internacionales, Roaming ilimitado en USA y data ilimitada en PR & USA con PUJ de 8GB', price: '$20.00', alphaCode: 'IND' },
          { code: 'REDBAS', description: 'VOLTE- Voz local ilimitada, SMS/MMS en PR, a US, Méjico, Canadá y a ciertos destinos INT, SMS/MMS roaming en USA, Méjico y Canadá, LD ilimitado a USA, Méjico y Canadá, Roaming ilimitado en USA, Méjico y Canadá y Data ilimitada en PR, USA, Méjico y Canadá (sin reducción) HOTSPOT 10GB', price: '$50.00', alphaCode: 'IND' },
          { code: 'BREDSF', description: 'VOLTE- Voz local, LD, RM, SMS/MMS y Data ilimitada en PR, en USA, México, Canadá, República Dominicana, Argentina, Uruguay, Paraguay, Panamá, Guatemala, Nicaragua, Honduras, Costa Rica, Perú, Chile, Colombia, El Salvador, Brasil y Ecuador con Data Ilimitada Sin reduccion de Velocidad con 100GB de Hotspot', price: '$100.00', alphaCode: 'IND' }
        ]
      }
    ]
  },

  // --- MOVIL: BUSINESS RED PLUS (MULTILÍNEA) ---
  {
    id: 'movil-red-plus',
    title: 'Business RED PLUS - Multilínea',
    category: 'MOVIL',
    tables: [
      {
        technology: 'MOVIL',
        headerColor: 'red',
        rows: [
          { code: 'BREDP1', description: '1 línea', price: '$65', alphaCode: 'BREDP1', customData: ['BREDP1', '$65', '$65/$55', '$65/$55'] },
          { code: 'BREDP1', description: '2 líneas', price: '$65', alphaCode: 'BREDP2', customData: ['BREDP2', '$45', '$55/$45', '$110/$90'] },
          { code: 'BREDP1', description: '3 líneas', price: '$65', alphaCode: 'BREDP3', customData: ['BREDP3', '$20', '$43.33/$33.33', '$130/$100'] },
          { code: 'BREDP1', description: '4 líneas', price: '$65', alphaCode: 'BREDP4', customData: ['BREDP4', '$30', '$40/$30', '$160/$120'] }
        ]
      }
    ]
  },

  // --- 1 PLAY: VOZ FIJA ---
  {
    id: '1play-voz-bus',
    title: '1PLAY - Voz Empresarial (Cobre/Fiber)',
    category: '1PLAY',
    tables: [
      {
        technology: 'COBRE/VRAD',
        headerColor: 'blue',
        rows: [
          { code: 'A862', description: 'BUS 500 MED BMS LP', price: '$19.99', alphaCode: 'B500BMSLP', installation: { m0: '$120.00', m12: '$60.00', m24: '$0.00' }, penalty: '$200.00' },
          { code: 'A863', description: 'BUS ILIMITADO BMS LP', price: '$34.99', alphaCode: 'BILIMBMSLP', installation: { m0: '$120.00', m12: '$60.00', m24: '$0.00' }, penalty: '$200.00' }
        ]
      }
    ]
  },

  // --- 2 PLAY: INTERNET + VOZ ---
  {
    id: '2play-internet-voz',
    title: '2PLAY - Internet + Voz (GPON)',
    category: '2PLAY',
    tables: [
      {
        technology: 'GPON',
        headerColor: 'blue',
        rows: [
          { code: 'I100V', description: 'BUS INT 100MB + VOZ ILIMITADA', price: '$54.99', alphaCode: 'GPON100V', installation: { m0: '$200.00', m12: '$100.00', m24: '$0.00' }, penalty: '$300.00' },
          { code: 'I300V', description: 'BUS INT 300MB + VOZ ILIMITADA', price: '$79.99', alphaCode: 'GPON300V', installation: { m0: '$200.00', m12: '$100.00', m24: '$0.00' }, penalty: '$300.00' },
          { code: 'I500V', description: 'BUS INT 500MB + VOZ ILIMITADA', price: '$99.99', alphaCode: 'GPON500V', installation: { m0: '$200.00', m12: '$100.00', m24: '$0.00' }, penalty: '$300.00' }
        ]
      }
    ]
  },

  // --- 3 PLAY: TRIPLE PLAY ---
  {
    id: '3play-triple-play',
    title: '3PLAY - Internet + Voz + TV',
    category: '3PLAY',
    tables: [
      {
        technology: 'GPON',
        headerColor: 'blue',
        rows: [
          { code: 'T100TV', description: '3PLAY 100MB + VOZ + TV ESENCIAL', price: '$89.99', alphaCode: '3P100E', installation: { m0: '$250.00', m12: '$125.00', m24: '$0.00' }, penalty: '$450.00' },
          { code: 'T300TV', description: '3PLAY 300MB + VOZ + TV SUPER', price: '$114.99', alphaCode: '3P300S', installation: { m0: '$250.00', m12: '$125.00', m24: '$0.00' }, penalty: '$450.00' }
        ]
      }
    ]
  }
];
