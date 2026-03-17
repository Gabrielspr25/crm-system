// ============================================================
// CLARO BUSINESS — INTERNET INALÁMBRICO, CLARO OFICINA & IoT
// Boletín INT Go, Claro Oficina y IoT — ene 2026 CORP
// ============================================================

const CATEGORIES = [
  {
    id: 'int-go',
    name: 'Internet On The Go — MiFi Portátil (LTE)',
    icon: '📡',
    cssClass: 'cat-ba-gpon',
    description: 'MiFi portátil con SIM Card regular. Solo datos, velocidades LTE. Cobertura PR y USA. Pospago con contrato 2 años, BYOP o Financiamiento 12/24m.',
  },
  {
    id: 'int-go-backup',
    name: 'INT Go Backup — Planes Especiales Convergentes',
    icon: '🔄',
    cssClass: 'cat-ba-bundle2',
    description: 'Planes de respaldo para clientes existentes de Internet Fijo o Cloud. Requiere al menos 1 servicio activo. Ya son convergentes (no tienen doble de datos).',
  },
  {
    id: 'claro-oficina',
    name: 'Claro Oficina — Internet Fijo Inalámbrico + Voz',
    icon: '🏢',
    cssClass: 'cat-ba-3play',
    description: 'Internet fijo inalámbrico vía LTE con Voz VoLTE. Plug & play, sin instalación técnica. Para uso fijo en dirección registrada. Solo PR. Velocidades hasta 30Mbps.',
  },
  {
    id: 'hogar-voz',
    name: 'Hogar Voz — Solo Voz (Sin Internet)',
    icon: '📞',
    cssClass: 'cat-ba-add',
    description: 'Plan de voz inalámbrica solamente. Puede usar datos a granel hasta tope de $50. Para clientes que necesitan línea fija sin internet dedicado.',
  },
  {
    id: 'iot',
    name: 'IoT / Telemetría — Machine-to-Machine',
    icon: '⚙️',
    cssClass: 'cat-ba-bundle3',
    description: 'Planes de datos para equipos M2M y telemetría. Solo PR. Contrato mínimo 1 año. Al consumir datos, servicio se bloquea hasta próximo ciclo. SIM card $4.99.',
  },
  {
    id: 'apn',
    name: 'APN Privado — Conexión Dedicada',
    icon: '🔒',
    cssClass: 'cat-ba-bundle4',
    description: 'APN privado para conexiones dedicadas con IP estático. Requiere formulario del Dpto. de Ingeniería. Implementación toma ~2 semanas.',
  },
  {
    id: 'equipos-intgo',
    name: 'Equipos MiFi — Internet On The Go',
    icon: '📶',
    cssClass: 'cat-ba-cobre',
    description: 'Módems MiFi portátiles disponibles para Internet On The Go. Precios varían por nivel de plan. Financiamiento 12/24/30/36 meses.',
  },
  {
    id: 'equipos-oficina',
    name: 'Equipos Router — Claro Oficina',
    icon: '🖧',
    cssClass: 'cat-ba-gpon',
    description: 'Módems/Routers para Claro Oficina. Incluyen puerto RJ11 para voz analógica. SIM IMEI Lock (casada al equipo). Financiamiento disponible.',
  },
  {
    id: 'tablets',
    name: 'Tablets — Disponibles con Planes',
    icon: '📱',
    cssClass: 'cat-ba-bundle2',
    description: 'Tablets disponibles para activar con planes INT Go o Claro Oficina. Precios con financiamiento y por nivel de plan.',
  },
];

const PLANS = [
  // ========== INTERNET ON THE GO — MiFi Portátil ==========
  {
    cat: 'int-go',
    code: 'BAIC009',
    name: 'INT Go 25GB — Regular',
    data: '25GB',
    dataConv: '50GB',
    codeConv: 'BAIL009D',
    speed: 'LTE',
    tech: 'LTE',
    price: '$30.00',
    tipo: 'Solo Datos',
    puj: '128Kbps',
    cobertura: 'PR y USA',
    contrato: '2 años / BYOP / Financ. 12-24m',
    nota: 'Plan básico INT Go · 50GB si convergente',
  },
  {
    cat: 'int-go',
    code: 'BAIC010',
    name: 'INT Go 75GB — Regular',
    data: '75GB',
    dataConv: '150GB',
    codeConv: 'BAIC012',
    speed: 'LTE',
    tech: 'LTE',
    price: '$40.00',
    tipo: 'Solo Datos',
    puj: '128Kbps',
    cobertura: 'PR y USA',
    contrato: '2 años / BYOP / Financ. 12-24m',
    nota: '🔥 Popular · 150GB si convergente · 50% desc. RG1000 en 24m',
    destacado: true,
  },
  {
    cat: 'int-go',
    code: 'BAIC011',
    name: 'INT Go 125GB — Regular',
    data: '125GB',
    dataConv: '250GB',
    codeConv: 'BAIL011D',
    speed: 'LTE',
    tech: 'LTE',
    price: '$50.00',
    tipo: 'Solo Datos',
    puj: '128Kbps',
    cobertura: 'PR y USA',
    contrato: '2 años / BYOP / Financ. 12-24m',
    nota: '⭐ Mejor plan · 250GB si convergente · RG1000 GRATIS en 24m',
    destacado: true,
  },

  // ========== INT GO BACKUP — Convergentes/Fijo/Cloud ==========
  {
    cat: 'int-go-backup',
    code: 'BAIC017',
    name: 'INT Go Backup 5GB',
    data: '5GB',
    speed: 'LTE',
    tech: 'LTE',
    price: '$9.99',
    tipo: 'Solo Datos',
    puj: '128Kbps',
    cobertura: 'PR y USA',
    contrato: '2 años / BYOP / Financ. 12-24m',
    nota: 'Plan backup · Requiere Internet Fijo o Cloud activo · Ya es convergente',
  },
  {
    cat: 'int-go-backup',
    code: 'BAIC018',
    name: 'INT Go Backup 10GB',
    data: '10GB',
    speed: 'LTE',
    tech: 'LTE',
    price: '$15.00',
    tipo: 'Solo Datos',
    puj: '128Kbps',
    cobertura: 'PR y USA',
    contrato: '2 años / BYOP / Financ. 12-24m',
    nota: 'Plan backup · Requiere Internet Fijo o Cloud activo · Ya es convergente',
  },

  // ========== CLARO OFICINA — Fijo Inalámbrico + Voz ==========
  {
    cat: 'claro-oficina',
    code: 'HOCV003V',
    name: 'Claro Oficina — Voz + Internet 30Mbps (Regular)',
    data: '150GB',
    speed: '30 Mbps',
    tech: 'LTE',
    price: '$50.00',
    tipo: 'Voz + Datos',
    voz: 'Ilimitada PR/US + LD a EE.UU.',
    puj: '2Mbps',
    cobertura: 'Solo PR',
    contrato: '2 años / BYOP / Financ. 12-36m',
    nota: 'Cliente que solo tiene Claro Oficina · PCD R402X GRATIS desde $30 · CG890 GRATIS en $50',
    destacado: true,
  },
  {
    cat: 'claro-oficina',
    code: 'HOCV003DV',
    name: 'Claro Oficina — Voz + Internet 30Mbps (Convergente)',
    data: '300GB',
    speed: '30 Mbps',
    tech: 'LTE',
    price: '$50.00',
    tipo: 'Voz + Datos',
    voz: 'Ilimitada PR/US + LD a EE.UU.',
    puj: '2Mbps',
    cobertura: 'Solo PR',
    contrato: '2 años / BYOP / Financ. 12-36m',
    nota: '⭐ DOBLE DATA · Cliente tiene otro servicio de Claro · 300GB vs 150GB',
    destacado: true,
  },

  // ========== HOGAR VOZ — Solo Voz ==========
  {
    cat: 'hogar-voz',
    code: 'VOZVLHOG',
    name: 'Hogar Voz — Voz Ilimitada PR y USA',
    speed: '—',
    tech: 'LTE',
    price: '$19.99',
    tipo: 'Solo Voz',
    voz: 'Ilimitada PR/US + LD a EE.UU.',
    cobertura: 'Solo PR',
    contrato: 'Pospago',
    nota: 'Incluye Correo de Voz, ID, Esp., Conferencia, Transferencia. Datos a granel hasta $50',
  },

  // ========== IoT / TELEMETRÍA ==========
  {
    cat: 'iot',
    code: 'BAC100',
    name: 'IoT 100MB',
    data: '100MB',
    speed: 'LTE',
    tech: 'IoT',
    price: '$2.99',
    tipo: 'Solo Datos M2M',
    cobertura: 'Solo PR',
    contrato: 'Mínimo 1 año',
    nota: 'Plan básico telemetría · Se bloquea al agotar datos (no throttle)',
  },
  {
    cat: 'iot',
    code: 'BAC250',
    name: 'IoT 250MB',
    data: '250MB',
    speed: 'LTE',
    tech: 'IoT',
    price: '$3.99',
    tipo: 'Solo Datos M2M',
    cobertura: 'Solo PR',
    contrato: 'Mínimo 1 año',
    nota: 'Telemetría · Se bloquea al agotar datos',
  },
  {
    cat: 'iot',
    code: 'BAC500',
    name: 'IoT 500MB',
    data: '500MB',
    speed: 'LTE',
    tech: 'IoT',
    price: '$5.99',
    tipo: 'Solo Datos M2M',
    cobertura: 'Solo PR',
    contrato: 'Mínimo 1 año',
    nota: 'Telemetría · Se bloquea al agotar datos',
  },
  {
    cat: 'iot',
    code: 'BAC1GB',
    name: 'IoT 1GB',
    data: '1GB',
    speed: 'LTE',
    tech: 'IoT',
    price: '$9.99',
    tipo: 'Solo Datos M2M',
    cobertura: 'Solo PR',
    contrato: 'Mínimo 1 año',
    nota: '🔥 Plan máximo IoT estándar · Se bloquea al agotar datos · Para uso adicional hasta $30 extra (por matriz)',
    destacado: true,
  },

  // ========== APN PRIVADO ==========
  {
    cat: 'apn',
    code: 'APN-PRIV',
    name: 'APN Privado — Conexión Dedicada',
    speed: '—',
    tech: 'IoT',
    price: '$499.99',
    priceNote: 'pago único',
    tipo: 'Servicio',
    cobertura: 'Solo PR',
    contrato: 'Requiere propuesta formal',
    nota: 'IP estático · Rango de IPs · URLs específicos · Tramitar con Ing. Rosa Nazario · Implementación ~2 semanas',
  },

  // ========== EQUIPOS MiFi — INTERNET ON THE GO ==========
  {
    cat: 'equipos-intgo',
    code: '32788H',
    name: 'Franklin RT410 MiFi',
    speed: '4G LTE Cat 4',
    tech: 'LTE',
    price: '$99.99',
    priceNote: 'regular',
    tipo: 'MiFi Portátil',
    specs: 'DL 150Mbps · WiFi 2.4/5GHz · 15 dispositivos · Batería 9hrs (3000mAh) · 27hrs standby',
    materialSAP: '7010844',
    financ: { m12: '$8.33', m24: '$4.17', m30: '$3.33', m36: '$2.78' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$99.99' },
      { plan: '$14', code: 'CLE14A', precio: '$99.99' },
      { plan: '$19', code: 'CLE19A', precio: '$41.99' },
      { plan: '$29', code: 'CLE29A', precio: '$0.00' },
      { plan: '$30+', code: 'CLE39A+', precio: '$0.00' },
    ],
    ofertas: 'GRATIS en financ. 24m en plan desde $30 (convergente, code FIOF24). $41.99 en planes < $30 convergente (FIGU24/36).',
    nota: '🔥 MiFi económico · GRATIS para convergentes desde $30',
    destacado: true,
  },
  {
    cat: 'equipos-intgo',
    code: '32328H',
    name: 'Franklin RG1000 5G MiFi',
    speed: '5G/4G',
    tech: '5G',
    price: '$399.99',
    priceNote: 'regular',
    tipo: 'MiFi 5G Portátil',
    specs: 'WiFi 6 · Batería 5000mAh · Conexión 5G + 4G dual',
    materialSAP: '7009571',
    financ: { m12: '$33.33', m24: '$16.67', m30: '$13.33', m36: '$11.11' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$399.99' },
      { plan: '$14', code: 'CLE14A', precio: '$399.99' },
      { plan: '$19', code: 'CLE19A', precio: '$399.99' },
      { plan: '$29', code: 'CLE29A', precio: '$299.99' },
      { plan: '$39', code: 'CLE39A', precio: '$249.99' },
      { plan: '$49', code: 'CLE49A', precio: '$199.99' },
      { plan: '$59', code: 'CLE59A', precio: '$199.99' },
      { plan: '$69', code: 'CLE69A', precio: '$199.99' },
    ],
    ofertas: 'GRATIS en financ. 24m en plan desde $50. 50% descuento en plan $40.',
    nota: '⭐ MiFi 5G · GRATIS en planes $50+',
    destacado: true,
  },
  {
    cat: 'equipos-intgo',
    code: '33638H',
    name: 'Franklin JEXstream RG2100 5G MiFi',
    speed: '5G Cat 20',
    tech: '5G',
    price: '$299.99',
    priceNote: 'regular',
    tipo: 'MiFi 5G Portátil',
    specs: '5G NR Sub-6 · LTE Cat 20 · WiFi 6 · 30 dispositivos · Batería 5000mAh · USB-C · Pantalla 2.4" color',
    materialSAP: '7013126',
    financ: { m12: '$25.00', m24: '$12.50', m30: '$10.00', m36: '$8.33' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$299.99' },
      { plan: '$14', code: 'CLE14A', precio: '$299.99' },
      { plan: '$19', code: 'CLE19A', precio: '$299.99' },
      { plan: '$29', code: 'CLE29A', precio: '$299.99' },
      { plan: '$39', code: 'CLE39A', precio: '$139.99' },
      { plan: '$49', code: 'CLE49A', precio: '$99.99' },
      { plan: '$59', code: 'CLE59A', precio: '$99.99' },
      { plan: '$69', code: 'CLE69A', precio: '$0.00' },
    ],
    nota: 'MiFi 5G alternativo · Pantalla a color · GRATIS en plan $69+',
  },
  {
    cat: 'equipos-intgo',
    code: '33556H',
    name: 'Netgear M6 Pro MiFi',
    speed: '5G',
    tech: '5G',
    price: '$599.99',
    priceNote: 'regular',
    tipo: 'MiFi 5G Premium',
    materialSAP: '7006669',
    financ: { m12: '$50.00', m24: '$25.00', m30: '$20.00', m36: '$16.67' },
    nota: 'MiFi premium · Sin subsidios por plan · Financiamiento disponible',
  },
  {
    cat: 'equipos-intgo',
    code: '31642H-FIOF',
    name: 'Franklin R910 MiFi (Convergente)',
    speed: '4G LTE',
    tech: 'LTE',
    price: '$54.99',
    priceNote: 'solo convergente (FIOF)',
    tipo: 'MiFi Portátil',
    materialSAP: '7008216',
    financ: { m12: '$4.58', m24: '$2.29', m30: '$1.83', m36: '$1.53' },
    nota: 'Solo para clientes convergentes · Precio especial FIOF',
  },

  // ========== EQUIPOS ROUTER — CLARO OFICINA ==========
  {
    cat: 'equipos-oficina',
    code: '33578H',
    name: 'PCD R402X Black Router',
    speed: '4.5G Cat 12',
    tech: 'LTE',
    price: '$99.99',
    priceNote: 'regular',
    tipo: 'Router Fijo (Voz + Datos)',
    specs: 'DL 400Mbps · WiFi 2.4/5GHz MIMO 2×2 · 2× RJ45 · 1× RJ11 (voz) · 2 antenas externas · 32 dispositivos',
    materialSAP: '7012893',
    financ: { m12: '$8.33', m24: '$4.17', m30: '$3.33', m36: '$2.78' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$99.99' },
      { plan: '$14', code: 'CLE14A', precio: '$99.99' },
      { plan: '$19', code: 'CLE19A', precio: '$0.00' },
      { plan: '$29+', code: 'CLE29A+', precio: '$0.00' },
    ],
    ofertas: 'GRATIS en Claro Oficina con financ. 24m en plan desde $30.',
    nota: '🔥 Router principal Claro Oficina · GRATIS desde $30 · Puerto RJ11 para teléfono',
    destacado: true,
  },
  {
    cat: 'equipos-oficina',
    code: '33348H',
    name: 'Franklin JEXstream CG890 5G Router',
    speed: '5G Cat 20',
    tech: '5G',
    price: '$249.99',
    priceNote: 'regular ($299.99 en prepago)',
    tipo: 'Router Fijo 5G (Voz + Datos)',
    specs: '5G/4G dual · Qualcomm X62 · WiFi 6 · 1× RJ45 · 1× RJ11 (voz) · 32 dispositivos · Batería backup 4000mAh',
    materialSAP: '7012279',
    financ: { m12: '$20.83', m24: '$10.42', m30: '$8.33', m36: '$6.94' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$299.99' },
      { plan: '$14', code: 'CLE14A', precio: '$299.99' },
      { plan: '$19', code: 'CLE19A', precio: '$299.99' },
      { plan: '$29', code: 'CLE29A', precio: '$299.99' },
      { plan: '$39', code: 'CLE39A', precio: '$199.99' },
      { plan: '$49', code: 'CLE49A', precio: '$99.99' },
      { plan: '$59', code: 'CLE59A', precio: '$0.00' },
      { plan: '$69', code: 'CLE69A', precio: '$0.00' },
    ],
    ofertas: 'GRATIS en Claro Oficina plan $50 con financ. 24m. Subsidios: Plan $35-39.99 → $130, Plan $40-49.99 → $250.',
    nota: '⭐ Router 5G premium · GRATIS en plan $50 · Batería backup · Puerto RJ11 voz',
    destacado: true,
  },
  {
    cat: 'equipos-oficina',
    code: '32042H',
    name: 'Netgear MR1100 Router/MiFi',
    speed: '4G LTE',
    tech: 'LTE',
    price: '$309.99',
    priceNote: 'regular',
    tipo: 'Router/MiFi',
    materialSAP: '7009082',
    financ: { m12: '$25.83', m24: '$12.92', m30: '$10.33', m36: '$8.61' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$309.99' },
      { plan: '$14', code: 'CLE14A', precio: '$249.99' },
      { plan: '$19', code: 'CLE19A', precio: '$229.99' },
      { plan: '$29', code: 'CLE29A', precio: '$189.99' },
      { plan: '$39', code: 'CLE39A', precio: '$149.99' },
      { plan: '$49', code: 'CLE49A', precio: '$149.99' },
      { plan: '$59', code: 'CLE59A', precio: '$69.99' },
      { plan: '$69', code: 'CLE69A', precio: '$29.99' },
    ],
    nota: 'Router LTE alta gama · Precios decrecientes por plan',
  },

  // ========== TABLETS ==========
  {
    cat: 'tablets',
    code: '31985H',
    name: 'Samsung Galaxy S6 Lite Gray',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$359.99',
    priceNote: 'regular',
    tipo: 'Tablet',
    materialSAP: '7008978',
    financ: { m12: '$30.00', m24: '$15.00', m30: '$12.00', m36: '$10.00' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$359.99' },
      { plan: '$14', code: 'CLE14A', precio: '$299.99' },
      { plan: '$19', code: 'CLE19A', precio: '$279.99' },
      { plan: '$29', code: 'CLE29A', precio: '$239.99' },
      { plan: '$39', code: 'CLE39A', precio: '$199.99' },
      { plan: '$49', code: 'CLE49A', precio: '$119.99' },
      { plan: '$59', code: 'CLE59A', precio: '$89.99' },
      { plan: '$69', code: 'CLE69A', precio: '$79.99' },
    ],
    nota: 'También disponible en Blue (31986H)',
  },
  {
    cat: 'tablets',
    code: '32527H',
    name: 'Apple iPad Air 5th Gen WiFi+Cell (Space Gray)',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$809.99',
    priceNote: 'regular',
    tipo: 'Tablet',
    materialSAP: '7010250',
    financ: { m12: '$67.50', m24: '$33.75', m30: '$27.00', m36: '$22.50' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$849.99' },
      { plan: '$14', code: 'CLE14A', precio: '$779.99' },
      { plan: '$19', code: 'CLE19A', precio: '$759.99' },
      { plan: '$29', code: 'CLE29A', precio: '$719.99' },
      { plan: '$39', code: 'CLE39A', precio: '$679.99' },
      { plan: '$49', code: 'CLE49A', precio: '$649.99' },
      { plan: '$59', code: 'CLE59A', precio: '$599.99' },
      { plan: '$69', code: 'CLE69A', precio: '$559.99' },
    ],
    nota: 'También disponible en Starlight (32528H) y Blue (32530H)',
  },
  {
    cat: 'tablets',
    code: '33676H',
    name: 'Samsung Galaxy Tab S10 FE 128GB',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$574.99',
    priceNote: 'regular',
    tipo: 'Tablet',
    materialSAP: '7013109',
    financ: { m12: '$47.92', m24: '$23.96', m30: '$19.17', m36: '$15.97' },
    nota: 'Tablet Samsung nueva generación',
  },
  {
    cat: 'tablets',
    code: '32739H',
    name: 'Apple iPad 10th Gen WiFi+Cell 256GB (Silver)',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$579.99',
    priceNote: 'regular',
    tipo: 'Tablet',
    materialSAP: '7010743',
    financ: { m12: '$48.33', m24: '$24.17', m30: '$19.33', m36: '$16.11' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$699.99' },
      { plan: '$14', code: 'CLE14A', precio: '$649.99' },
      { plan: '$19', code: 'CLE19A', precio: '$639.99' },
      { plan: '$29', code: 'CLE29A', precio: '$609.99' },
      { plan: '$39', code: 'CLE39A', precio: '$579.99' },
      { plan: '$49', code: 'CLE49A', precio: '$519.99' },
      { plan: '$59', code: 'CLE59A', precio: '$489.99' },
    ],
    nota: 'También disponible en Blue (32740H)',
  },
  {
    cat: 'tablets',
    code: '32741H',
    name: 'Apple iPad Pro 11" WiFi+Cell 256GB (Gray)',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$1,099.99',
    priceNote: 'regular',
    tipo: 'Tablet Premium',
    materialSAP: '7010742',
    financ: { m12: '$91.67', m24: '$45.83', m30: '$36.67', m36: '$30.56' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$699.99' },
      { plan: '$14', code: 'CLE14A', precio: '$649.99' },
      { plan: '$19', code: 'CLE19A', precio: '$639.99' },
      { plan: '$29', code: 'CLE29A', precio: '$609.99' },
      { plan: '$39', code: 'CLE39A', precio: '$579.99' },
      { plan: '$49', code: 'CLE49A', precio: '$549.99' },
      { plan: '$59', code: 'CLE59A', precio: '$519.99' },
      { plan: '$69', code: 'CLE69A', precio: '$489.99' },
    ],
    nota: 'iPad Pro premium · Grandes descuentos por plan',
  },
  {
    cat: 'tablets',
    code: '32747H',
    name: 'Samsung Galaxy Tab A8 64GB',
    speed: 'WiFi + Cell',
    tech: 'LTE',
    price: '$369.99',
    priceNote: 'regular',
    tipo: 'Tablet',
    materialSAP: '7010779',
    financ: { m12: '$30.83', m24: '$15.42', m30: '$12.33', m36: '$10.28' },
    preciosPlan: [
      { plan: '$9', code: 'CLE09A', precio: '$369.99' },
      { plan: '$14', code: 'CLE14A', precio: '$299.99' },
      { plan: '$19', code: 'CLE19A', precio: '$279.99' },
      { plan: '$29', code: 'CLE29A', precio: '$239.99' },
      { plan: '$39', code: 'CLE39A', precio: '$199.99' },
      { plan: '$49', code: 'CLE49A', precio: '$149.99' },
      { plan: '$59', code: 'CLE59A', precio: '$119.99' },
      { plan: '$69', code: 'CLE69A', precio: '$79.99' },
    ],
    nota: 'Tablet económica Samsung · Buenos descuentos',
  },
];


// ============================================================
// BOOSTERS INFO (for reference in cards)
// ============================================================
const BOOSTERS = [
  { data: '500MB', price: '$4.99' },
  { data: '1GB', price: '$9.99' },
  { data: '3GB', price: '$19.99' },
  { data: '5GB', price: '$24.99' },
];


// ============================================================
// RENDERING — Card layout for wireless plans
// ============================================================

let currentCategory = 'all';
let currentTipo = 'all';
let currentSearch = '';

function matchesSearch(plan, search) {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    plan.code.toLowerCase().includes(s) ||
    plan.name.toLowerCase().includes(s) ||
    plan.price.toLowerCase().includes(s) ||
    (plan.speed && plan.speed.toLowerCase().includes(s)) ||
    (plan.data && plan.data.toLowerCase().includes(s)) ||
    (plan.tipo && plan.tipo.toLowerCase().includes(s)) ||
    (plan.nota && plan.nota.toLowerCase().includes(s)) ||
    (plan.tech && plan.tech.toLowerCase().includes(s)) ||
    (plan.specs && plan.specs.toLowerCase().includes(s)) ||
    (plan.ofertas && plan.ofertas.toLowerCase().includes(s))
  );
}

function matchesTipo(plan) {
  if (currentTipo === 'all') return true;
  if (currentTipo === 'IoT') return plan.tech === 'IoT';
  return plan.tech === currentTipo;
}

function highlightText(text, search) {
  if (!search || !text) return text || '';
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function renderPlans() {
  const container = document.getElementById('plansContainer');
  const noResults = document.getElementById('noResults');
  let html = '';
  let totalVisible = 0;

  CATEGORIES.forEach(cat => {
    if (currentCategory !== 'all' && currentCategory !== cat.id) return;

    const catPlans = PLANS.filter(p =>
      p.cat === cat.id && matchesSearch(p, currentSearch) && matchesTipo(p)
    );
    if (catPlans.length === 0) return;
    totalVisible += catPlans.length;

    html += `<div class="category-section ${cat.cssClass}">`;
    html += `<div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">`;
    html += `<h2><span class="category-icon">${cat.icon}</span> ${cat.name} <span class="category-count">${catPlans.length}</span></h2>`;
    html += `<span class="category-toggle">▼</span>`;
    html += `</div>`;
    html += `<div class="category-body">`;

    if (cat.description) {
      html += `<p class="cat-description">${cat.description}</p>`;
    }

    html += `<div class="plan-cards">`;
    catPlans.forEach(plan => {
      const isEquipo = plan.cat.startsWith('equipos') || plan.cat === 'tablets';
      const isDestacado = plan.destacado;
      const cardClass = isDestacado ? 'plan-card destacado' : 'plan-card';

      html += `<div class="${cardClass}">`;

      // Card Header
      html += `<div class="card-header">`;
      html += `<span class="card-code">${highlightText(plan.code, currentSearch)}</span>`;
      const techClass = plan.tech === '5G' ? 'tech-gpon' : (plan.tech === 'IoT' ? 'tech-cobre' : 'tech-lte');
      html += `<span class="tech-badge ${techClass}">${plan.tech}</span>`;
      if (isDestacado) html += `<span class="card-badge dest-badge">🔥 TOP</span>`;
      html += `</div>`;

      // Speed/data highlight
      if (plan.data && !isEquipo) {
        html += `<div class="speed-badge">${plan.data}`;
        if (plan.dataConv) html += ` <span style="font-size:12px;opacity:.7;">/ ${plan.dataConv} conv.</span>`;
        html += `</div>`;
      } else if (plan.speed && plan.speed !== '—') {
        html += `<div class="speed-badge">${plan.speed}</div>`;
      }

      // Card Name & Price
      html += `<div class="card-title">${highlightText(plan.name, currentSearch)}</div>`;
      html += `<div class="card-price-row">`;
      html += `<span class="card-price">${plan.price}</span>`;
      html += `<span class="card-period">/${plan.priceNote || 'mes'}</span>`;
      html += `</div>`;

      // Card Features
      html += `<div class="card-features">`;
      html += `<div class="feat"><span class="feat-icon">📋</span><span class="feat-label">Tipo</span><span class="feat-val">${plan.tipo}</span></div>`;

      if (plan.voz) {
        html += `<div class="feat"><span class="feat-icon">📞</span><span class="feat-label">Voz</span><span class="feat-val">${plan.voz}</span></div>`;
      }
      if (plan.cobertura) {
        html += `<div class="feat"><span class="feat-icon">🌎</span><span class="feat-label">Cobertura</span><span class="feat-val">${plan.cobertura}</span></div>`;
      }
      if (plan.puj) {
        html += `<div class="feat"><span class="feat-icon">⚠️</span><span class="feat-label">PUJ</span><span class="feat-val">Reduce a ${plan.puj}</span></div>`;
      }
      if (plan.contrato) {
        html += `<div class="feat"><span class="feat-icon">📝</span><span class="feat-label">Contrato</span><span class="feat-val">${plan.contrato}</span></div>`;
      }
      if (plan.codeConv) {
        html += `<div class="feat"><span class="feat-icon">🔗</span><span class="feat-label">Code Conv.</span><span class="feat-val" style="font-family:monospace;font-size:11px;">${plan.codeConv}</span></div>`;
      }
      if (plan.specs) {
        html += `<div class="feat"><span class="feat-icon">⚙️</span><span class="feat-label">Specs</span><span class="feat-val" style="font-size:11px;">${plan.specs}</span></div>`;
      }
      if (plan.materialSAP) {
        html += `<div class="feat"><span class="feat-icon">🏷️</span><span class="feat-label">SAP</span><span class="feat-val" style="font-family:monospace;">${plan.materialSAP}</span></div>`;
      }
      html += `</div>`;

      // Financing table for equipment
      if (plan.financ) {
        html += `<div class="install-grid">`;
        html += `<div class="install-header" style="grid-template-columns:80px repeat(4, 1fr);">`;
        html += `<span style="display:block;">Financ.</span><span>12m</span><span>24m</span><span>30m</span><span>36m</span>`;
        html += `</div>`;
        html += `<div class="install-row" style="grid-template-columns:80px repeat(4, 1fr);">`;
        html += `<span class="install-label">Plazo/mes</span>`;
        html += `<span class="install-val">${plan.financ.m12}</span>`;
        html += `<span class="install-val">${plan.financ.m24}</span>`;
        html += `<span class="install-val">${plan.financ.m30}</span>`;
        html += `<span class="install-val">${plan.financ.m36}</span>`;
        html += `</div>`;
        html += `</div>`;
      }

      // Price by plan tier table
      if (plan.preciosPlan && plan.preciosPlan.length > 0) {
        html += `<div class="install-grid" style="margin-top:8px;">`;
        html += `<div class="install-header" style="grid-template-columns:1fr 1fr;">`;
        html += `<span>Plan</span><span>Precio Equipo</span>`;
        html += `</div>`;
        plan.preciosPlan.forEach(pp => {
          const isFree = pp.precio === '$0.00';
          html += `<div class="install-row" style="grid-template-columns:1fr 1fr;">`;
          html += `<span class="install-val" style="font-size:11px;font-family:monospace;">${pp.plan} (${pp.code})</span>`;
          html += `<span class="install-val ${isFree ? 'cost-free' : ''}">${isFree ? 'GRATIS' : pp.precio}</span>`;
          html += `</div>`;
        });
        html += `</div>`;
      }

      // Equipment offers
      if (plan.ofertas) {
        html += `<div class="card-note" style="background:#f0fdf4;border-left:3px solid #16a34a;padding:8px 10px;margin-top:8px;font-size:12px;">`;
        html += `<strong>💰 Oferta:</strong> ${plan.ofertas}`;
        html += `</div>`;
      }

      // Note
      if (plan.nota) {
        html += `<div class="card-note">${highlightText(plan.nota, currentSearch)}</div>`;
      }

      html += `</div>`;
    });
    html += `</div>`;
    html += `</div></div>`;
  });

  // Add boosters info after INT Go categories
  if (currentCategory === 'all' || currentCategory === 'int-go') {
    html += `<div class="category-section cat-ba-add">`;
    html += `<div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">`;
    html += `<h2><span class="category-icon">🚀</span> Boosters — Paquetes Adicionales de Datos <span class="category-count">${BOOSTERS.length}</span></h2>`;
    html += `<span class="category-toggle">▼</span>`;
    html += `</div>`;
    html += `<div class="category-body">`;
    html += `<p class="cat-description">Paquetes booster disponibles para INT Go y Claro Oficina. Comprar a través del coordinador de servicio vía MiClaro en SIF. También: Roaming diario $10.00/día (DIARIO10).</p>`;
    html += `<div class="plan-cards">`;
    BOOSTERS.forEach(b => {
      html += `<div class="plan-card">`;
      html += `<div class="speed-badge">${b.data}</div>`;
      html += `<div class="card-price-row"><span class="card-price">${b.price}</span><span class="card-period">/paquete</span></div>`;
      html += `</div>`;
    });
    html += `</div></div></div>`;
  }

  container.innerHTML = html;
  noResults.style.display = totalVisible === 0 ? 'block' : 'none';

  document.getElementById('stats').textContent =
    totalVisible === PLANS.length
      ? `Mostrando ${totalVisible} planes/equipos`
      : `Mostrando ${totalVisible} de ${PLANS.length} planes/equipos`;
}


// ============================================================
// INIT
// ============================================================
function init() {
  // Category filter
  const catSelect = document.getElementById('categoryFilter');
  CATEGORIES.forEach(cat => {
    const count = PLANS.filter(p => p.cat === cat.id).length;
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name} (${count})`;
    catSelect.appendChild(opt);
  });

  catSelect.addEventListener('change', () => {
    currentCategory = catSelect.value;
    renderPlans();
  });

  // Tipo filter buttons
  document.querySelectorAll('.filter-btn[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-tipo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTipo = btn.dataset.tipo;
      renderPlans();
    });
  });

  // Search
  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderPlans();
    }, 200);
  });

  renderPlans();
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// DARK MODE
// ============================================================
(function() {
  const btn = document.getElementById('darkToggle');
  const icon = document.getElementById('darkIcon');
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') {
    document.body.classList.add('dark');
    icon.textContent = '☀️';
  }
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    icon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDark);
  });
})();
