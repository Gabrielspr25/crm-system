# 🤖 Arquitectura de Agentes IA Especializados
## Sistema Inteligente de Ofertas Claro PYMES

---

## 📊 Modelo de Negocio Detectado

### Estructura de Productos y Servicios

```
CLARO PYMES
├── SERVICIOS FIJOS
│   ├── Internet Fijo (COBRE, VRAD, GPON)
│   ├── Telefonía Fija (PRUS)
│   ├── Claro TV
│   └── Combos (2Play, 3Play)
│
├── SERVICIOS MÓVILES
│   ├── Planes Postpago
│   │   ├── Individuales ($35+)
│   │   ├── Multilíneas (Business Red Plus/Extreme/Supreme)
│   │   └── Claro Sin Fronteras
│   ├── Planes Prepago
│   ├── Internet On-The-Go (IOTG)
│   └── Claro Oficina / FWA
│
├── EQUIPOS
│   ├── Smartphones (Samsung, iPhone, Motorola)
│   ├── Accesorios (Watches, Buds, Covers)
│   ├── Tablets
│   └── Computadoras
│
└── CONVERGENCIA (Claro Full)
    └── Beneficios especiales para clientes con Fijo + Móvil
```

### Tipos de Clientes
1. **PYMES** (Pequeñas y Medianas Empresas)
2. **CORPORATIVO** (Empresas grandes)
3. **PERSONAS** (Usuarios individuales)

### Concepto de Convergencia (Claro Full)
**Definición**: Cliente con servicio FIJO (Telefonía, Internet, TV o Claro Oficina) + servicio MÓVIL (Pospago/Financiamiento o IOTG) bajo el mismo SSN o Tax ID.

**Beneficios Convergencia**:
- 3 meses gratis en planes móviles $60+
- Pago de penalidad hasta $200 (Fijo) / $150 (Móvil)
- Bono de portabilidad hasta $150
- Doble velocidad internet fijo
- Doble data en Claro Oficina / IOTG
- $0 cargo activación
- 10% descuento accesorios/tablets
- Bono streaming $10/mes x 12 meses
- Acceso exclusivo ofertas especiales

---

## 🎯 Agentes IA Especializados

### **AGENTE 1: Extractor de Boletines PDF (Core)**

#### Responsabilidad
Procesar boletines PDF y extraer ofertas estructuradas con precisión del 95%+

#### Tecnología
- **Motor Principal**: GPT-4 Vision API
- **Backup**: Claude 3.5 Sonnet
- **OCR**: Tesseract.js (fallback)

#### Prompt Especializado

```markdown
Eres un experto en análisis de boletines de telecomunicaciones de Claro Puerto Rico.

CONTEXTO DEL NEGOCIO:
- Claro ofrece servicios FIJOS (Internet, Telefonía, TV) y MÓVILES (Postpago, Prepago, IOTG)
- Existen ofertas para PYMES, CORPORATIVO y PERSONAS
- "Convergencia" = Cliente con Fijo + Móvil (recibe beneficios adicionales)
- Equipos se venden con financiamiento en plazos (12, 24, 30 meses)

ANALIZA este boletín y extrae información en formato JSON:

{
  "vigencia": {
    "fechaInicio": "YYYY-MM-DD",
    "fechaFin": "YYYY-MM-DD"
  },
  "ofertas": [
    {
      "titulo": "Título descriptivo de la oferta",
      "categoria": "INTERNET_HOGAR_FIJO | INTERNET_MOVIL | PLANES_POSTPAGO_NEGOCIOS | PLANES_POSTPAGO_PERSONAS | PLANES_PREPAGO | EQUIPOS | CLARO_TV | CLARO_OFICINA | CONVERGENCIA",
      "subcategoria": "2Play | 3Play | Multilíneas | Individual | etc",
      "tipoCliente": "PYMES | CORPORATIVO | PERSONAS",
      "precio": 35.00,
      "precioOriginal": null,
      "descripcionMarketing": "Descripción atractiva para marketing (máx 200 caracteres)",
      "caracteristicas": [
        "Internet de alta velocidad 100Mbps",
        "Llamadas ilimitadas en PR",
        "Equipo incluido: Huawei B315s"
      ],
      "requiereConvergencia": false,
      "beneficiosConvergencia": {
        "precioConvergente": 45.00,
        "caracteristicasAdicionales": ["Doble velocidad", "3 meses gratis"]
      },
      "equipoIncluido": "Huawei B315s12l",
      "terminosFinanciamiento": {
        "plazos": [12, 24, 30],
        "mensualidadEquipo": 5.00,
        "precioRegularEquipo": 119.99
      },
      "tecnologia": "GPON | VRAD | COBRE | LTE | 4G | 5G",
      "velocidadInternet": {
        "bajada": "100Mbps",
        "subida": "100Mbps"
      },
      "limitesData": "100GB con reducción a 1Mbps",
      "terminosCondiciones": "Términos importantes extraídos",
      "cargosAdicionales": {
        "instalacion": 120.00,
        "activacion": 40.00,
        "descuentos": "100% descuento con contrato 24 meses"
      }
    }
  ],
  "promocionesEspeciales": [
    {
      "nombre": "Ciber Week 2025",
      "descripcion": "Oferta especial con WiFi extenders gratis",
      "vigencia": "1-7 diciembre 2025"
    }
  ]
}

INSTRUCCIONES CRÍTICAS:
1. Extrae TODAS las ofertas del documento (no omitas ninguna)
2. Identifica fechas de vigencia con precisión ABSOLUTA
3. Distingue entre precio regular y precio con convergencia
4. Captura términos de financiamiento para equipos
5. Identifica tecnología (GPON, VRAD, COBRE, LTE)
6. Extrae velocidades de internet (bajada/subida)
7. Detecta límites de data y políticas de reducción
8. Captura beneficios de convergencia si aplican
9. Extrae cargos de instalación/activación y descuentos
10. Identifica tipo de cliente (PYMES, CORPORATIVO, PERSONAS)

REGLAS DE EXTRACCIÓN:
- Precios SIN símbolos (solo números decimales)
- Fechas en formato ISO (YYYY-MM-DD)
- Velocidades en formato: "100Mbps", "1Gbps"
- Data en formato: "100GB", "Ilimitada"
- Si un campo no existe, usa null (no inventes)
- Mantén descripciones concisas pero informativas
```

#### Output Esperado
JSON estructurado con todas las ofertas del boletín + validación automática

#### Métricas de Éxito
- **Accuracy**: > 95%
- **Tiempo de procesamiento**: < 30 segundos por PDF
- **Tasa de error**: < 5%

---

### **AGENTE 2: Clasificador de Ofertas**

#### Responsabilidad
Validar, normalizar y clasificar ofertas extraídas antes de publicación

#### Funciones
1. **Validación de datos**:
   - Verifica campos obligatorios
   - Valida rangos de precios (ej: $0-$10,000)
   - Confirma fechas de vigencia válidas
   - Detecta duplicados

2. **Normalización**:
   - Estandariza formatos de precios
   - Normaliza nombres de equipos
   - Unifica velocidades de internet
   - Corrige errores de OCR

3. **Enriquecimiento**:
   - Genera slug SEO-friendly
   - Asigna tags para búsqueda
   - Calcula "score de popularidad" basado en tendencias
   - Sugiere ofertas relacionadas

#### Reglas de Negocio
```typescript
// Validación de Convergencia
if (oferta.categoria === "CONVERGENCIA") {
  requiere: [servicio_fijo, servicio_movil]
  beneficios: aplicar_segun_combinacion()
}

// Validación de Financiamiento
if (oferta.equipoIncluido) {
  plazos_permitidos: [3, 6, 12, 24, 30]
  mensualidad: precio_equipo / plazo
}

// Validación de Internet
if (oferta.categoria.includes("INTERNET")) {
  tecnologias_validas: ["GPON", "VRAD", "COBRE", "LTE", "FWA"]
  velocidades_validas: [10, 20, 30, 50, 100, 150, 200, 300, 500, 1000] Mbps
}
```

---

### **AGENTE 3: Gestor de Vigencias**

#### Responsabilidad
Monitorear fechas de vigencia y gestionar ciclo de vida de ofertas

#### Funciones
1. **Monitoreo Diario** (Cron: 12:00 AM AST):
   ```javascript
   - Marca ofertas vencidas (validUntil < hoy) → status: EXPIRED
   - Identifica ofertas por vencer (validUntil - 7 días) → alerta
   - Archiva ofertas antiguas (vencidas hace 30+ días)
   ```

2. **Alertas Automáticas**:
   - **7 días antes**: Email a admin + notificación dashboard
   - **24 horas antes**: Alerta urgente
   - **Al vencer**: Marca como EXPIRED + notifica agentes

3. **Reportes**:
   - Reporte semanal: ofertas activas vs vencidas
   - Análisis de duración promedio de ofertas
   - Predicción de nuevas ofertas necesarias

#### Tecnología
- Vercel Cron Jobs (diario a las 00:00)
- Prisma queries con índices en `validUntil`
- Email con Resend API

---

### **AGENTE 4: Detector de Convergencia**

#### Responsabilidad
Identificar y aplicar beneficios de Claro Full automáticamente

#### Lógica de Detección
```python
def es_cliente_convergente(cliente):
    servicios_fijo = obtener_servicios_fijo(cliente.ban)
    servicios_movil = obtener_servicios_movil(cliente.ban)
    
    tiene_fijo = any([
        servicio in ["2PLAY", "3PLAY", "INTERNET_FIJO", "TELEFONIA", "CLARO_TV", "CLARO_OFICINA"]
        for servicio in servicios_fijo
    ])
    
    tiene_movil = any([
        servicio in ["POSPAGO", "FINANCIAMIENTO", "IOTG"]
        for servicio in servicios_movil
    ])
    
    mismo_ssn = verificar_mismo_ssn(servicios_fijo, servicios_movil)
    
    return tiene_fijo and tiene_movil and mismo_ssn
```

#### Beneficios a Aplicar
```javascript
const BENEFICIOS_CONVERGENCIA = {
  "3_meses_gratis": {
    condicion: "plan_movil >= $60",
    credito: "renta_mensual * 3",
    aplicacion: "meses 2, 4, 6"
  },
  "doble_velocidad_internet": {
    condicion: "internet_fijo >= 10Mbps && tecnologia = GPON",
    aplicacion: "inmediata"
  },
  "doble_data_iotg": {
    condicion: "tiene_iotg",
    aplicacion: "inmediata"
  },
  "descuento_accesorios": {
    porcentaje: 10,
    aplicacion: "en_compra",
    codigo: "LEAL10%"
  },
  "bono_streaming": {
    monto: 10,
    duracion: "12 meses",
    condicion: "requiere_solicitud"
  }
}
```

---

### **AGENTE 5: Recomendador Inteligente**

#### Responsabilidad
Sugerir ofertas personalizadas basadas en perfil del usuario

#### Motor de Recomendación
```typescript
interface PerfilUsuario {
  tipo: "PYMES" | "CORPORATIVO" | "PERSONA";
  servicios_actuales: string[];
  es_convergente: boolean;
  presupuesto_estimado: number;
  historial_vistas: Oferta[];
  necesidades: {
    internet_velocidad_min: number;
    necesita_telefonia: boolean;
    necesita_tv: boolean;
    cantidad_lineas_moviles: number;
  };
}

function recomendar_ofertas(perfil: PerfilUsuario): Oferta[] {
  let ofertas = obtener_ofertas_activas();
  
  // Filtro 1: Tipo de cliente
  ofertas = ofertas.filter(o => o.tipoCliente === perfil.tipo);
  
  // Filtro 2: Presupuesto
  ofertas = ofertas.filter(o => o.precio <= perfil.presupuesto_estimado * 1.2);
  
  // Filtro 3: Convergencia
  if (perfil.es_convergente) {
    ofertas = ofertas.map(o => aplicar_beneficios_convergencia(o));
  }
  
  // Scoring
  ofertas = ofertas.map(o => ({
    ...o,
    score: calcular_score(o, perfil)
  }));
  
  // Ordenar y retornar top 5
  return ofertas.sort((a, b) => b.score - a.score).slice(0, 5);
}
```

#### Factores de Scoring
- **Relevancia**: 40% (match con necesidades)
- **Precio**: 25% (valor por dinero)
- **Convergencia**: 15% (beneficios adicionales)
- **Popularidad**: 10% (otros usuarios similares)
- **Vigencia**: 10% (tiempo restante de oferta)

---

### **AGENTE 6: Comparador de Planes**

#### Responsabilidad
Generar comparaciones inteligentes entre planes/ofertas

#### Funcionalidad
```javascript
function comparar_planes(ofertaA, ofertaB, ofertaC) {
  return {
    comparacion_precios: {
      mas_economico: encontrar_mas_economico([ofertaA, ofertaB, ofertaC]),
      diferencia_porcentual: calcular_diferencias()
    },
    comparacion_caracteristicas: {
      velocidad_internet: [ofertaA.velocidad, ofertaB.velocidad, ofertaC.velocidad],
      data_incluida: [ofertaA.data, ofertaB.data, ofertaC.data],
      equipos: [ofertaA.equipo, ofertaB.equipo, ofertaC.equipo]
    },
    mejor_para: {
      "uso_ligero": ofertaA,
      "uso_moderado": ofertaB,
      "uso_intensivo": ofertaC
    },
    recomendacion_ia: generar_recomendacion_contextual()
  };
}
```

#### Ejemplo de Recomendación
```
"Si eres cliente convergente y necesitas alta velocidad, 
el Plan B te ofrece 300Mbps por solo $89.99 (con doble velocidad de convergencia). 
Ahorras $30/mes comparado con el Plan C."
```

---

### **AGENTE 7: Notificador Multi-Canal**

#### Responsabilidad
Enviar notificaciones personalizadas a agentes y clientes

#### Canales
1. **WhatsApp Business API**
2. **Email** (Resend/SendGrid)
3. **SMS** (Twilio)
4. **Notificaciones In-App**

#### Tipos de Notificaciones

```typescript
enum TipoNotificacion {
  NUEVA_OFERTA = "nueva_oferta",
  OFERTA_POR_VENCER = "oferta_por_vencer",
  OFERTA_VENCIDA = "oferta_vencida",
  CAMBIO_PRECIO = "cambio_precio",
  RECOMENDACION_PERSONALIZADA = "recomendacion",
  ALERTA_CONVERGENCIA = "alerta_convergencia"
}

interface Notificacion {
  tipo: TipoNotificacion;
  destinatarios: string[]; // emails o números
  canal: "whatsapp" | "email" | "sms" | "in-app";
  prioridad: "alta" | "media" | "baja";
  contenido: {
    titulo: string;
    mensaje: string;
    cta_url?: string;
    cta_text?: string;
  };
  programacion?: Date; // para notificaciones futuras
}
```

#### Templates de WhatsApp
```
🚀 *Nueva Oferta Disponible*

📱 {{titulo_oferta}}
💰 Desde ${{precio}}/mes
⏰ Válida hasta {{fecha_vencimiento}}

{{#es_convergente}}
🎁 *Beneficio Claro Full*: {{beneficio}}
{{/es_convergente}}

🔗 Ver detalles: {{url}}

_Claro PYMES - Siempre contigo_
```

---

### **AGENTE 8: Analista de Tendencias**

#### Responsabilidad
Generar insights sobre comportamiento y tendencias

#### Análisis Generados
1. **Ofertas más populares**:
   - Por vistas
   - Por clicks a "Ver detalles"
   - Por conversiones (contactos)

2. **Análisis de precios**:
   - Precio promedio por categoría
   - Tendencias de precios en el tiempo
   - Ofertas con mejor relación precio/valor

3. **Análisis de vigencia**:
   - Duración promedio de ofertas
   - Categorías con ofertas más frecuentes
   - Patrones de actualización de boletines

4. **Análisis de convergencia**:
   - % de ofertas que requieren convergencia
   - Beneficios más populares
   - Tasa de conversión a Claro Full

#### Reportes Automáticos
- **Semanal**: Email a admin con métricas clave
- **Mensual**: PDF con análisis detallado
- **Trimestral**: Presentación ejecutiva con recomendaciones

---

### **AGENTE 9: Validador de Consistencia**

#### Responsabilidad
Verificar consistencia de datos entre boletines y ofertas publicadas

#### Validaciones
```python
def validar_consistencia(boletin_nuevo, ofertas_existentes):
    inconsistencias = []
    
    # 1. Verificar que precios de equipos no cambien drásticamente
    for oferta_nueva in boletin_nuevo.ofertas:
        if oferta_nueva.equipoIncluido:
            oferta_anterior = buscar_equipo(oferta_nueva.equipoIncluido)
            if oferta_anterior:
                cambio_precio = abs(oferta_nueva.precio - oferta_anterior.precio)
                if cambio_precio > oferta_anterior.precio * 0.20:  # 20% cambio
                    inconsistencias.append({
                        "tipo": "CAMBIO_PRECIO_DRASTICO",
                        "equipo": oferta_nueva.equipoIncluido,
                        "precio_anterior": oferta_anterior.precio,
                        "precio_nuevo": oferta_nueva.precio
                    })
    
    # 2. Verificar solapamiento de vigencias
    for oferta in ofertas_existentes:
        if (oferta.validUntil > boletin_nuevo.vigencia.fechaInicio and 
            oferta.categoria == oferta_nueva.categoria):
            inconsistencias.append({
                "tipo": "SOLAPAMIENTO_VIGENCIA",
                "oferta_existente": oferta.id,
                "oferta_nueva": oferta_nueva.titulo
            })
    
    # 3. Verificar lógica de convergencia
    if oferta_nueva.requiereConvergencia:
        if not oferta_nueva.convergenceBenefits:
            inconsistencias.append({
                "tipo": "CONVERGENCIA_SIN_BENEFICIOS",
                "oferta": oferta_nueva.titulo
            })
    
    return inconsistencias
```

---

## 🔄 Flujo de Trabajo Completo

```mermaid
Usuario Admin
    ↓
[1] Sube PDF de boletín
    ↓
[AGENTE 1] Extrae ofertas → JSON
    ↓
[AGENTE 2] Clasifica y normaliza
    ↓
[AGENTE 9] Valida consistencia
    ↓
¿Inconsistencias? → Sí → Alerta a admin → Revisión manual
    ↓ No
[AGENTE 4] Detecta requisitos de convergencia
    ↓
Publica ofertas (status: ACTIVE)
    ↓
[AGENTE 7] Notifica a agentes/distribuidores
    ↓
Cliente visita sitio
    ↓
[AGENTE 5] Recomienda ofertas personalizadas
    ↓
[AGENTE 6] Compara planes si usuario solicita
    ↓
[AGENTE 3] Monitoreo diario de vigencias (background)
    ↓
[AGENTE 8] Analiza tendencias (semanal)
```

---

## 💻 Implementación Técnica

### Stack de Agentes
```typescript
// /lib/agents/index.ts

export class AgenteExtractorPDF {
  async procesar(pdf: File): Promise<OfertaExtraida[]> {
    const imagenes = await convertirPDFaImagenes(pdf);
    const resultado = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: PROMPT_EXTRACTOR
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza este boletín" },
            ...imagenes.map(img => ({ 
              type: "image_url", 
              image_url: { url: img } 
            }))
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1 // Baja temperatura para consistencia
    });
    
    return JSON.parse(resultado.choices[0].message.content);
  }
}

export class AgenteClasificador {
  async validar(ofertas: OfertaExtraida[]): Promise<OfertaValidada[]> {
    return await Promise.all(
      ofertas.map(oferta => this.validarOferta(oferta))
    );
  }
  
  private async validarOferta(oferta: OfertaExtraida): Promise<OfertaValidada> {
    // Aplicar reglas de validación
    // Normalizar datos
    // Enriquecer con metadatos
    // Generar slug SEO
    return ofertaValidada;
  }
}

// Usar en API route
// /app/api/boletines/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const pdf = formData.get('pdf') as File;
  
  // Paso 1: Extraer
  const extractor = new AgenteExtractorPDF();
  const ofertas_raw = await extractor.procesar(pdf);
  
  // Paso 2: Clasificar
  const clasificador = new AgenteClasificador();
  const ofertas_validadas = await clasificador.validar(ofertas_raw);
  
  // Paso 3: Guardar en DB
  await prisma.offer.createMany({
    data: ofertas_validadas
  });
  
  // Paso 4: Notificar
  const notificador = new AgenteNotificador();
  await notificador.enviar({
    tipo: TipoNotificacion.NUEVA_OFERTA,
    ofertas: ofertas_validadas
  });
  
  return Response.json({ success: true, ofertas: ofertas_validadas.length });
}
```

---

## 📈 Métricas de Agentes

### Dashboard de Monitoreo
```
┌──────────────────────────────────────────────┐
│  📊 ESTADO DE AGENTES IA                    │
├──────────────────────────────────────────────┤
│                                              │
│  🤖 Agente Extractor PDF                    │
│     Status: ✅ Activo                        │
│     Procesados hoy: 12 boletines            │
│     Accuracy promedio: 97.3%                │
│     Tiempo promedio: 24s                    │
│                                              │
│  🔍 Agente Clasificador                     │
│     Status: ✅ Activo                        │
│     Ofertas procesadas: 156                 │
│     Duplicados detectados: 3                │
│     Errores de validación: 0                │
│                                              │
│  ⏰ Agente Gestor Vigencias                 │
│     Status: ✅ Activo                        │
│     Última ejecución: Hoy 00:00            │
│     Ofertas por vencer (7 días): 8          │
│     Ofertas vencidas hoy: 2                 │
│                                              │
│  🎯 Agente Recomendador                     │
│     Status: ✅ Activo                        │
│     Recomendaciones generadas: 1,234        │
│     Tasa de click: 34.5%                    │
│     Conversiones: 23                        │
│                                              │
│  📱 Agente Notificador                      │
│     Status: ✅ Activo                        │
│     WhatsApp enviados: 45                   │
│     Emails enviados: 123                    │
│     Tasa de apertura: 68%                   │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🚀 Ventajas de esta Arquitectura

1. **Especialización**: Cada agente hace UNA cosa muy bien
2. **Escalabilidad**: Agentes independientes que se pueden escalar por separado
3. **Mantenibilidad**: Fácil actualizar un agente sin afectar otros
4. **Resiliencia**: Si un agente falla, los demás siguen funcionando
5. **Observabilidad**: Métricas independientes por agente
6. **Testability**: Cada agente se puede testear aisladamente

---

## ✅ Siguientes Pasos

1. ✅ **Aprobar arquitectura de agentes**
2. ⏳ **Desarrollar Agente 1 (Extractor) como MVP**
3. ⏳ **Entrenar y validar con boletines reales**
4. ⏳ **Implementar Agentes 2-3 (Clasificador + Vigencias)**
5. ⏳ **Desplegar en producción progresivamente**
6. ⏳ **Iterar basado en métricas reales**

**¿Comenzamos con el desarrollo?** 🎯
