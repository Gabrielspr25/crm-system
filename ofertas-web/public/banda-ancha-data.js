// ============================================================
// CLARO BUSINESS — BANDA ANCHA / INTERNET PYMES
// Planes 2Play (Internet + Voz), Bundles, 3Play
// Datos del boletín de estructura de negocios
// ============================================================

const CATEGORIES = [
  {
    id: 'gpon-internet',
    name: 'Internet GPON — Fibra Óptica (30MB a 1GB)',
    icon: '🌐',
    cssClass: 'cat-ba-gpon',
    description: 'Fibra óptica GPON. Todos incluyen Voz Ilimitada PR/US (2Play). Velocidades simétricas.',
  },
  {
    id: 'cobre-internet',
    name: 'Internet Cobre/VRAD (5M a 100M)',
    icon: '🔌',
    cssClass: 'cat-ba-cobre',
    description: 'Tecnología DSL. Todos incluyen Voz Ilimitada PR/US (2Play). Velocidades asimétricas (bajada/subida).',
  },
  {
    id: 'bundles-2l',
    name: 'Bundles 2 Líneas — Internet + Voz',
    icon: '📦',
    cssClass: 'cat-ba-bundle2',
    description: '2 líneas de voz ilimitada + Internet en un solo paquete. Precio total del bundle.',
  },
  {
    id: 'bundles-3l',
    name: 'Bundles 3 Líneas — Internet + Voz',
    icon: '📦',
    cssClass: 'cat-ba-bundle3',
    description: '3 líneas de voz ilimitada + Internet. Ahorro significativo por volumen.',
  },
  {
    id: 'bundles-4l',
    name: 'Bundles 4 Líneas — Internet + Voz',
    icon: '📦',
    cssClass: 'cat-ba-bundle4',
    description: '4 líneas de voz ilimitada + Internet. Máximo ahorro para oficinas.',
  },
  {
    id: '3play',
    name: '3Play — Internet + Voz + TV',
    icon: '📺',
    cssClass: 'cat-ba-3play',
    description: 'Triple Play: Internet GPON + Voz Ilimitada + ClaroTV. Todo en uno.',
  },
  {
    id: 'lineas-add',
    name: 'Líneas Adicionales 2Play',
    icon: '➕',
    cssClass: 'cat-ba-add',
    description: 'Líneas de voz adicionales bajo un plan 2Play existente. Requiere plan base.',
  },
];

const PLANS = [
  // ========== GPON FIBRA ÓPTICA ==========
  {
    cat: 'gpon-internet',
    code: 'A879',
    name: 'GPON Internet 30MB + Voz Ilimitada',
    speed: '30 MB',
    alfa: 'G-BPRU30M',
    tech: 'GPON',
    price: '$47.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Plan básico GPON',
  },
  {
    cat: 'gpon-internet',
    code: 'A880',
    name: 'GPON Internet 50MB + Voz Ilimitada',
    speed: '50 MB',
    alfa: 'G-BPRU50M',
    tech: 'GPON',
    price: '$49.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Solo $2 más que 30MB',
  },
  {
    cat: 'gpon-internet',
    code: 'A881',
    name: 'GPON Internet 100MB + Voz Ilimitada',
    speed: '100 MB',
    alfa: 'G-BPRU100M',
    tech: 'GPON',
    price: '$54.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Ideal para oficinas pequeñas',
    destacado: true,
  },
  {
    cat: 'gpon-internet',
    code: 'A882',
    name: 'GPON Internet 150MB + Voz Ilimitada',
    speed: '150 MB',
    alfa: 'G-BPRU150M',
    tech: 'GPON',
    price: '$64.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Buena velocidad para 5-10 usuarios',
  },
  {
    cat: 'gpon-internet',
    code: 'A883',
    name: 'GPON Internet 200MB + Voz Ilimitada',
    speed: '200 MB',
    alfa: 'G-BPRU200M',
    tech: 'GPON',
    price: '$67.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Solo $3 más que 150MB',
  },
  {
    cat: 'gpon-internet',
    code: 'A884',
    name: 'GPON Internet 300MB + Voz Ilimitada',
    speed: '300 MB',
    alfa: 'G-BPRU300M',
    tech: 'GPON',
    price: '$74.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 40],
    activation: [40, 0, 0],
    penalty: 260,
    nota: '🔥 Popular para PYMES medianas',
    destacado: true,
  },
  {
    cat: 'gpon-internet',
    code: 'A885',
    name: 'GPON Internet 350MB + Voz Ilimitada',
    speed: '350 MB',
    alfa: 'G-BPRU350M',
    tech: 'GPON',
    price: '$99.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 40],
    activation: [40, 0, 0],
    penalty: 260,
    nota: 'Alta velocidad',
  },
  {
    cat: 'gpon-internet',
    code: 'A886',
    name: 'GPON Internet 450MB + Voz Ilimitada',
    speed: '450 MB',
    alfa: 'G-BPRU450M',
    tech: 'GPON',
    price: '$104.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Solo $5 más que 350MB',
  },
  {
    cat: 'gpon-internet',
    code: 'C474',
    name: 'GPON Internet 500MB + Voz Ilimitada',
    speed: '500 MB',
    alfa: 'G-B500MPRU',
    tech: 'GPON',
    price: '$134.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '🔥 Medio Gigabit',
    destacado: true,
  },
  {
    cat: 'gpon-internet',
    code: 'A887',
    name: 'GPON Internet 500MB + Voz Ilimitada (Alt)',
    speed: '500 MB',
    alfa: 'G-BPRU500M',
    tech: 'GPON',
    price: '$174.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Código alterno para 500MB',
  },
  {
    cat: 'gpon-internet',
    code: 'C475',
    name: 'GPON Internet 650MB + Voz Ilimitada',
    speed: '650 MB',
    alfa: 'G-BPRU650M',
    tech: 'GPON',
    price: '$159.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Alta capacidad empresarial',
  },
  {
    cat: 'gpon-internet',
    code: 'A888',
    name: 'GPON Internet 650MB + Voz Ilimitada (Alt)',
    speed: '650 MB',
    alfa: 'G-BPRU650M',
    tech: 'GPON',
    price: '$184.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Código alterno para 650MB',
  },
  {
    cat: 'gpon-internet',
    code: 'C476',
    name: 'GPON Internet 1GB + Voz Ilimitada',
    speed: '1 GB',
    alfa: 'G-B1GBPRU',
    tech: 'GPON',
    price: '$174.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '⭐ MÁXIMA VELOCIDAD · 1 Gigabit',
    premium: true,
  },
  {
    cat: 'gpon-internet',
    code: 'A889',
    name: 'GPON Internet 1GB + Voz Ilimitada (Alt)',
    speed: '1 GB',
    alfa: 'G-BPRU1GB',
    tech: 'GPON',
    price: '$199.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '⭐ Código alterno 1 Gigabit',
    premium: true,
  },

  // ========== COBRE / VRAD ==========
  {
    cat: 'cobre-internet',
    code: 'A870',
    name: 'Internet 5M/1M + Voz Ilimitada',
    speed: '5M / 1M',
    alfa: 'BPRU5M',
    tech: 'COBRE/VRAD',
    price: '$29.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Plan básico cobre — uso ligero',
  },
  {
    cat: 'cobre-internet',
    code: 'A871',
    name: 'Internet 8M/1M + Voz Ilimitada',
    speed: '8M / 1M',
    alfa: 'BPRU8M',
    tech: 'COBRE/VRAD',
    price: '$32.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Navegación y correo electrónico',
  },
  {
    cat: 'cobre-internet',
    code: 'A872',
    name: 'Internet 10M/1M + Voz Ilimitada',
    speed: '10M / 1M',
    alfa: 'BPRU10M',
    tech: 'COBRE/VRAD',
    price: '$35.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Buen balance para 1-3 usuarios',
  },
  {
    cat: 'cobre-internet',
    code: 'A873',
    name: 'Internet 16M/1M + Voz Ilimitada',
    speed: '16M / 1M',
    alfa: 'BPRU16M',
    tech: 'COBRE/VRAD',
    price: '$38.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Suficiente para video conferencias',
  },
  {
    cat: 'cobre-internet',
    code: 'A874',
    name: 'Internet 20M/1M + Voz Ilimitada — COBRE',
    speed: '20M / 1M',
    alfa: 'BPRU20M1',
    tech: 'COBRE/VRAD',
    price: '$44.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Subida 1M (tecnología cobre puro)',
  },
  {
    cat: 'cobre-internet',
    code: 'A875',
    name: 'Internet 20M/3M + Voz Ilimitada — VRAD',
    speed: '20M / 3M',
    alfa: 'BPRU20M3',
    tech: 'COBRE/VRAD',
    price: '$44.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '🔥 VRAD: mejor subida (3M) que cobre',
    destacado: true,
  },
  {
    cat: 'cobre-internet',
    code: 'A876',
    name: 'Internet 30M/3M + Voz Ilimitada',
    speed: '30M / 3M',
    alfa: 'BPRU30M',
    tech: 'COBRE/VRAD',
    price: '$47.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: 'Buena velocidad para oficinas',
  },
  {
    cat: 'cobre-internet',
    code: 'A877',
    name: 'Internet 50M/5M + Voz Ilimitada',
    speed: '50M / 5M',
    alfa: 'BPRU50M',
    tech: 'COBRE/VRAD',
    price: '$49.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '🔥 Mejor relación precio/velocidad Cobre',
    destacado: true,
  },
  {
    cat: 'cobre-internet',
    code: 'A878',
    name: 'Internet 100M/15M + Voz Ilimitada',
    speed: '100M / 15M',
    alfa: 'BPRU100M',
    tech: 'COBRE/VRAD',
    price: '$54.99',
    voz: 'Ilimitada PR/US',
    install: [120, 60, 0],
    activation: [40, 20, 0],
    penalty: 260,
    nota: '⭐ Máxima velocidad Cobre/VRAD',
    premium: true,
  },

  // ========== BUNDLES 2 LÍNEAS ==========
  {
    cat: 'bundles-2l',
    code: 'A878',
    name: '100M/15M + 2 Líneas Voz (COBRE)',
    speed: '100M / 15M',
    alfa: '—',
    tech: 'COBRE/VRAD',
    price: '$79.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas Cobre',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'A881',
    name: 'GPON 100MB + 2 Líneas Voz',
    speed: '100 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$79.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas GPON',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'A882',
    name: 'GPON 150MB + 2 Líneas Voz',
    speed: '150 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$89.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas 150MB',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'A883',
    name: 'GPON 200MB + 2 Líneas Voz',
    speed: '200 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$92.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas 200MB',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'A884',
    name: 'GPON 300MB + 2 Líneas Voz',
    speed: '300 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$99.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '🔥 300MB + 2 líneas por $100',
    isBundle: true,
    lines: 2,
    destacado: true,
  },
  {
    cat: 'bundles-2l',
    code: 'A885',
    name: 'GPON 350MB + 2 Líneas Voz',
    speed: '350 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$124.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas 350MB',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'A886',
    name: 'GPON 450MB + 2 Líneas Voz',
    speed: '450 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$129.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas 450MB',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'C474',
    name: 'GPON 500MB + 2 Líneas Voz',
    speed: '500 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$159.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '🔥 Medio gigabit + 2 líneas',
    isBundle: true,
    lines: 2,
    destacado: true,
  },
  {
    cat: 'bundles-2l',
    code: 'C475',
    name: 'GPON 650MB + 2 Líneas Voz',
    speed: '650 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$184.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 2 líneas 650MB',
    isBundle: true,
    lines: 2,
  },
  {
    cat: 'bundles-2l',
    code: 'C476',
    name: 'GPON 1GB + 2 Líneas Voz',
    speed: '1 GB',
    alfa: '—',
    tech: 'GPON',
    price: '$199.99',
    voz: 'Ilimitada PR/US × 2 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '⭐ Máxima velocidad + 2 líneas',
    isBundle: true,
    lines: 2,
    premium: true,
  },

  // ========== BUNDLES 3 LÍNEAS ==========
  {
    cat: 'bundles-3l',
    code: 'A883',
    name: 'GPON 200MB + 3 Líneas Voz',
    speed: '200 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$117.99',
    voz: 'Ilimitada PR/US × 3 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 3 líneas 200MB',
    isBundle: true,
    lines: 3,
  },
  {
    cat: 'bundles-3l',
    code: 'A884',
    name: 'GPON 300MB + 3 Líneas Voz',
    speed: '300 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$124.99',
    voz: 'Ilimitada PR/US × 3 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '🔥 Buena relación precio-beneficio',
    isBundle: true,
    lines: 3,
    destacado: true,
  },
  {
    cat: 'bundles-3l',
    code: 'A885',
    name: 'GPON 350MB + 3 Líneas Voz',
    speed: '350 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$149.99',
    voz: 'Ilimitada PR/US × 3 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 3 líneas 350MB',
    isBundle: true,
    lines: 3,
  },

  // ========== BUNDLES 4 LÍNEAS ==========
  {
    cat: 'bundles-4l',
    code: 'A886',
    name: 'GPON 450MB + 4 Líneas Voz',
    speed: '450 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$179.99',
    voz: 'Ilimitada PR/US × 4 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 4 líneas 450MB',
    isBundle: true,
    lines: 4,
  },
  {
    cat: 'bundles-4l',
    code: 'A887',
    name: 'GPON 500MB + 4 Líneas Voz',
    speed: '500 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$249.99',
    voz: 'Ilimitada PR/US × 4 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '🔥 500MB + 4 líneas completas',
    isBundle: true,
    lines: 4,
    destacado: true,
  },
  {
    cat: 'bundles-4l',
    code: 'A888',
    name: 'GPON 650MB + 4 Líneas Voz',
    speed: '650 MB',
    alfa: '—',
    tech: 'GPON',
    price: '$259.99',
    voz: 'Ilimitada PR/US × 4 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: 'Bundle 4 líneas 650MB',
    isBundle: true,
    lines: 4,
  },
  {
    cat: 'bundles-4l',
    code: 'A889',
    name: 'GPON 1GB + 4 Líneas Voz',
    speed: '1 GB',
    alfa: '—',
    tech: 'GPON',
    price: '$274.99',
    voz: 'Ilimitada PR/US × 4 líneas',
    install: ['$120 p/l', '$60 p/l', '$0'],
    activation: ['$40 p/l', '$20 p/l', '$0'],
    penalty: '$260+$200 p/l',
    nota: '⭐ MÁXIMO · 1 Gigabit + 4 líneas',
    isBundle: true,
    lines: 4,
    premium: true,
  },

  // ========== 3PLAY — INTERNET + VOZ + TV ==========
  {
    cat: '3play',
    code: 'I100V',
    name: 'Internet 100MB + Voz Ilimitada + TV',
    speed: '100 MB',
    alfa: 'GPON100V',
    tech: 'GPON',
    price: '$54.99',
    voz: 'Ilimitada PR/US',
    tv: 'Combinable con ClaroTV+',
    install: [200, 100, 0],
    activation: [null, null, null],
    penalty: 300,
    nota: 'Base 3Play — agregar plan TV por separado',
  },
  {
    cat: '3play',
    code: 'I300V',
    name: 'Internet 300MB + Voz Ilimitada + TV',
    speed: '300 MB',
    alfa: 'GPON300V',
    tech: 'GPON',
    price: '$79.99',
    voz: 'Ilimitada PR/US',
    tv: 'Combinable con ClaroTV+',
    install: [200, 100, 0],
    activation: [null, null, null],
    penalty: 300,
    nota: '🔥 300MB Triple Play',
    destacado: true,
  },
  {
    cat: '3play',
    code: 'I500V',
    name: 'Internet 500MB + Voz Ilimitada + TV',
    speed: '500 MB',
    alfa: 'GPON500V',
    tech: 'GPON',
    price: '$99.99',
    voz: 'Ilimitada PR/US',
    tv: 'Combinable con ClaroTV+',
    install: [200, 100, 0],
    activation: [null, null, null],
    penalty: 300,
    nota: '⭐ PREMIUM Triple Play · Medio Gigabit',
    premium: true,
  },
  {
    cat: '3play',
    code: 'T100TV',
    name: '3Play 100MB + Voz + TV Esencial',
    speed: '100 MB',
    alfa: '3P100E',
    tech: 'GPON',
    price: '$89.99',
    voz: 'Ilimitada PR/US',
    tv: 'ClaroTV+ Esencial incluido',
    install: [250, 125, 0],
    activation: [null, null, null],
    penalty: 450,
    nota: 'Todo incluido: Internet + Voz + TV Esencial',
    destacado: true,
  },
  {
    cat: '3play',
    code: 'T300TV',
    name: '3Play 300MB + Voz + TV Super',
    speed: '300 MB',
    alfa: '3P300S',
    tech: 'GPON',
    price: '$114.99',
    voz: 'Ilimitada PR/US',
    tv: 'ClaroTV+ Super incluido',
    install: [250, 125, 0],
    activation: [null, null, null],
    penalty: 450,
    nota: '⭐ PREMIUM · Todo incluido con TV Super',
    premium: true,
  },

  // ========== LÍNEAS ADICIONALES 2PLAY ==========
  {
    cat: 'lineas-add',
    code: '7107',
    name: 'Línea ADD BMS — Cobre/VRAD',
    speed: '—',
    alfa: 'B2PBMSAD',
    tech: 'COBRE/VRAD',
    price: '$25.00',
    voz: 'Ilimitada PR/US',
    install: [60, 30, 0],
    activation: [40, 20, 0],
    penalty: 200,
    nota: 'Línea adicional Mono Speaker · Requiere plan 2Play base',
  },
  {
    cat: 'lineas-add',
    code: '7108',
    name: 'Línea ADD BML — Cobre/VRAD',
    speed: '—',
    alfa: 'B2PBMLAD',
    tech: 'COBRE/VRAD',
    price: '$25.00',
    voz: 'Ilimitada PR/US',
    install: [65, 32.50, 0],
    activation: [null, null, null],
    penalty: 200,
    nota: 'Línea adicional Multi Line · Requiere plan 2Play base',
  },
  {
    cat: 'lineas-add',
    code: 'A169',
    name: 'Línea ADD BMS — GPON',
    speed: '—',
    alfa: 'G-BMSADD2P',
    tech: 'GPON',
    price: '$25.00',
    voz: 'Ilimitada PR/US',
    install: [60, 30, 0],
    activation: [40, 20, 0],
    penalty: 200,
    nota: 'Línea adicional Mono Speaker GPON · Requiere plan 2Play base',
  },
  {
    cat: 'lineas-add',
    code: 'A170',
    name: 'Línea ADD BML — GPON',
    speed: '—',
    alfa: 'G-BMLADD2P',
    tech: 'GPON',
    price: '$25.00',
    voz: 'Ilimitada PR/US',
    install: [65, 32.50, 0],
    activation: [null, null, null],
    penalty: 200,
    nota: 'Línea adicional Multi Line GPON · Requiere plan 2Play base',
  },
];


// ============================================================
// RENDERING — Card layout for internet plans
// ============================================================

let currentCategory = 'all';
let currentTech = 'all';
let currentSearch = '';

function matchesSearch(plan, search) {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    plan.code.toLowerCase().includes(s) ||
    plan.name.toLowerCase().includes(s) ||
    plan.price.toLowerCase().includes(s) ||
    (plan.speed && plan.speed.toLowerCase().includes(s)) ||
    (plan.alfa && plan.alfa.toLowerCase().includes(s)) ||
    (plan.nota && plan.nota.toLowerCase().includes(s)) ||
    (plan.tech && plan.tech.toLowerCase().includes(s))
  );
}

function matchesTech(plan) {
  if (currentTech === 'all') return true;
  return plan.tech === currentTech;
}

function highlightText(text, search) {
  if (!search || !text) return text || '';
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function formatCost(val) {
  if (val === null || val === undefined) return '<span class="cost-na">—</span>';
  if (typeof val === 'string') return val;
  if (val === 0) return '<span class="cost-free">GRATIS</span>';
  return '$' + val.toFixed(2);
}

function renderPlans() {
  const container = document.getElementById('plansContainer');
  const noResults = document.getElementById('noResults');
  let html = '';
  let totalVisible = 0;

  CATEGORIES.forEach(cat => {
    if (currentCategory !== 'all' && currentCategory !== cat.id) return;

    const catPlans = PLANS.filter(p =>
      p.cat === cat.id && matchesSearch(p, currentSearch) && matchesTech(p)
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
      const isPremium = plan.premium;
      const isDestacado = plan.destacado;
      const cardClass = isPremium ? 'plan-card premium' : (isDestacado ? 'plan-card destacado' : 'plan-card');

      html += `<div class="${cardClass}">`;

      // Card Header
      html += `<div class="card-header">`;
      html += `<span class="card-code">${highlightText(plan.code, currentSearch)}</span>`;
      const techClass = plan.tech === 'GPON' ? 'tech-gpon' : 'tech-cobre';
      html += `<span class="tech-badge ${techClass}">${plan.tech}</span>`;
      if (isPremium) html += `<span class="card-badge premium-badge">⭐ PREMIUM</span>`;
      else if (isDestacado) html += `<span class="card-badge dest-badge">🔥 TOP</span>`;
      html += `</div>`;

      // Speed highlight
      if (plan.speed && plan.speed !== '—') {
        html += `<div class="speed-badge">${plan.speed}</div>`;
      }

      // Card Name & Price
      html += `<div class="card-title">${highlightText(plan.name, currentSearch)}</div>`;
      html += `<div class="card-price-row">`;
      html += `<span class="card-price">${plan.price}</span>`;
      html += `<span class="card-period">/mes</span>`;
      if (plan.isBundle) html += `<span class="card-ppl">(${plan.lines} líneas)</span>`;
      html += `</div>`;

      // Card Features
      html += `<div class="card-features">`;
      html += `<div class="feat"><span class="feat-icon">📞</span><span class="feat-label">Voz</span><span class="feat-val">${plan.voz}</span></div>`;
      if (plan.alfa && plan.alfa !== '—') {
        html += `<div class="feat"><span class="feat-icon">🏷️</span><span class="feat-label">Alfa</span><span class="feat-val" style="font-family:monospace;font-size:11px;">${highlightText(plan.alfa, currentSearch)}</span></div>`;
      }
      if (plan.tv) {
        html += `<div class="feat"><span class="feat-icon">📺</span><span class="feat-label">TV</span><span class="feat-val">${plan.tv}</span></div>`;
      }
      html += `</div>`;

      // Installation costs table
      html += `<div class="install-grid">`;
      html += `<div class="install-header">`;
      html += `<span>0 meses</span><span>12 meses</span><span>24 meses</span>`;
      html += `</div>`;

      html += `<div class="install-row">`;
      html += `<span class="install-label">Instalación</span>`;
      if (Array.isArray(plan.install)) {
        plan.install.forEach(v => {
          html += `<span class="install-val">${formatCost(v)}</span>`;
        });
      }
      html += `</div>`;

      if (plan.activation && plan.activation.some(v => v !== null)) {
        html += `<div class="install-row">`;
        html += `<span class="install-label">Activación</span>`;
        plan.activation.forEach(v => {
          html += `<span class="install-val">${formatCost(v)}</span>`;
        });
        html += `</div>`;
      }

      html += `<div class="install-row penalty-row">`;
      html += `<span class="install-label">Penalidad</span>`;
      const penStr = typeof plan.penalty === 'number' ? '$' + plan.penalty.toFixed(2) : plan.penalty;
      html += `<span class="install-val penalty-val" style="grid-column:span 3;">${penStr}</span>`;
      html += `</div>`;
      html += `</div>`;

      // Note
      if (plan.nota) {
        html += `<div class="card-note">${highlightText(plan.nota, currentSearch)}</div>`;
      }

      html += `</div>`;
    });
    html += `</div>`;
    html += `</div></div>`;
  });

  container.innerHTML = html;
  noResults.style.display = totalVisible === 0 ? 'block' : 'none';

  document.getElementById('stats').textContent =
    totalVisible === PLANS.length
      ? `Mostrando ${totalVisible} planes`
      : `Mostrando ${totalVisible} de ${PLANS.length} planes`;
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

  // Tech filter buttons
  document.querySelectorAll('.filter-btn[data-tech]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-tech]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTech = btn.dataset.tech;
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
