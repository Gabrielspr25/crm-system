// ============================================================
// CLARO BUSINESS — CATÁLOGO DE PLANES PYMES
// Datos completos del boletín REV. 02.26.2024
// ============================================================

const CATEGORIES = [
  {
    id: 'telefonia-medida',
    name: 'Telefonía Medida (500 min)',
    icon: '📞',
    cssClass: 'cat-telefonia-medida',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: true,
  },
  {
    id: 'telefonia-ilimitada',
    name: 'Telefonía Ilimitada PR',
    icon: '📱',
    cssClass: 'cat-telefonia-ilimitada',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: true,
  },
  {
    id: 'pqt-ilimitado',
    name: 'PQT 5 Líneas — PR/US Ilimitado',
    icon: '📦',
    cssClass: 'cat-pqt-ilimitado',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: 'tele-entry',
    name: 'Tele Entry Service — Ilimitado',
    icon: '🏢',
    cssClass: 'cat-tele-entry',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: 'call-fwd-pr',
    name: 'Remote Call Forward PR — Ilimitado',
    icon: '↪️',
    cssClass: 'cat-call-fwd-pr',
    hasInstall: true,
    hasActivation: false,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: 'call-fwd-us',
    name: 'Remote Call Forward US — Ilimitado',
    icon: '🇺🇸',
    cssClass: 'cat-call-fwd-us',
    hasInstall: true,
    hasActivation: false,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: '2play',
    name: '2Play — Internet + Voz Ilimitada PR/US',
    icon: '🌐',
    cssClass: 'cat-2play',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: '2play-add',
    name: '2Play — Líneas Adicionales (bajo planes 2Play)',
    icon: '➕',
    cssClass: 'cat-2play-add',
    hasInstall: true,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: 'tv-planes',
    name: 'Clarotv+ Negocios — Planes de Televisión',
    icon: '📺',
    cssClass: 'cat-tv-planes',
    hasInstall: false,
    hasActivation: true,
    hasPenalty: true,
    hasMinExtra: false,
  },
  {
    id: 'tv-premium',
    name: 'TV Premium — Canales Adicionales',
    icon: '🎬',
    cssClass: 'cat-tv-premium',
    hasInstall: false,
    hasActivation: false,
    hasPenalty: false,
    hasMinExtra: false,
  },
  {
    id: 'tv-equipos',
    name: 'Decodificadores & Equipos — Clarotv+',
    icon: '📡',
    cssClass: 'cat-tv-equipos',
    hasInstall: false,
    hasActivation: false,
    hasPenalty: true,
    hasMinExtra: false,
    customCols: ['Código', 'Descripción', 'Precio Equipo', 'Tecnología', 'Mensual Financiado', 'Penalidad'],
  },
  {
    id: 'valores-agregados',
    name: 'Valores Agregados — Telefonía',
    icon: '⚙️',
    cssClass: 'cat-valores-agregados',
    hasInstall: false,
    hasActivation: false,
    hasPenalty: false,
    hasMinExtra: false,
  },
  {
    id: 'bonos',
    name: 'Bonos, Descuentos y Penalidades',
    icon: '🎁',
    cssClass: 'cat-bonos',
    hasInstall: false,
    hasActivation: false,
    hasPenalty: false,
    hasMinExtra: false,
  },
];

// ============================================================
// PLAN DATA — Every plan from the PDF boletín
// install/activation: [0 meses, 12 meses, 24 meses]
// null = N/A, "p/l" suffix = per line
// ============================================================

const PLANS = [
  // ========== TELEFONÍA MEDIDA ==========
  { cat: 'telefonia-medida', code: 'A862', name: 'BUS 500 MED BMS LP', alfa: 'B500BMSLP', tech: 'COBRE/VRAD', price: '$19.99', minExtra: '$0.03', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A863', name: 'BUS 500 MED BMS LADD', alfa: 'B500BMSAD', tech: 'COBRE/VRAD', price: '$19.99', minExtra: '$0.03', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A864', name: 'BUS 500 MED BML LP', alfa: 'B500BMLLP', tech: 'COBRE/VRAD', price: '$19.99', minExtra: '$0.03', install: [130, 65, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A865', name: 'BUS 500 MED BML LADD', alfa: 'B500BMLAD', tech: 'COBRE/VRAD', price: '$19.99', minExtra: '$0.03', install: [65, 32.50, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A866', name: 'GPON BUS 500 MED BMS LP', alfa: 'GB500BMSLP', tech: 'GPON', price: '$19.99', minExtra: '$0.03', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A867', name: 'GPON BUS 500 MED BMS LADD', alfa: 'GB500BMSAD', tech: 'GPON', price: '$19.99', minExtra: '$0.03', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A868', name: 'GPON BUS 500 MED BML LP', alfa: 'GB500BMLLP', tech: 'GPON', price: '$19.99', minExtra: '$0.03', install: [130, 65, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'telefonia-medida', code: 'A869', name: 'GPON BUS 500 MED BML LADD', alfa: 'GB500BMLAD', tech: 'GPON', price: '$19.99', minExtra: '$0.03', install: [65, 32.50, 0], activation: [null, null, null], penalty: 200 },

  // ========== TELEFONÍA ILIMITADA PR ==========
  { cat: 'telefonia-ilimitada', code: '7200', name: 'BUS PR ILIM BMS LP', alfa: 'BPRBMSLP', tech: 'COBRE/VRAD', price: '$29.99', minExtra: 'PR: ILIM / US: $0.03', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: '7203', name: 'BUS PR ILIM BML LP', alfa: 'BPRBMLLP', tech: 'COBRE/VRAD', price: '$29.99', minExtra: 'PR: ILIM / US: $0.03', install: [130, 65, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: '6991', name: 'PR ILIMITADO L. ADD BMS', alfa: 'PRBMSADD', tech: 'COBRE/VRAD', price: '$24.99', minExtra: 'PR: ILIM / US: $0.03', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: '6992', name: 'PR ILIMITADO L. ADD BML', alfa: 'PRBMLADD', tech: 'COBRE/VRAD', price: '$24.99', minExtra: 'PR: ILIM / US: $0.03', install: [65, 32.50, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: '6644', name: 'BUS LD US ILIMITADO (POR LÍNEA)', alfa: 'USAUNLBUS', tech: 'COBRE/VRAD', price: '$5.00', minExtra: 'ILIM', install: [null, null, null], activation: [null, null, null], penalty: null },
  { cat: 'telefonia-ilimitada', code: 'A147', name: 'GPON BUS PR ILIM LP BMS', alfa: 'G-BPRBMSLP', tech: 'GPON', price: '$29.99', minExtra: 'PR: ILIM / US: $0.03', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: 'A148', name: 'GPON BUS PR ILIM LP BML', alfa: 'G-BPRBMLLP', tech: 'GPON', price: '$29.99', minExtra: 'PR: ILIM / US: $0.03', install: [130, 65, 0], activation: [0, 0, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: 'A149', name: 'GPON BUS PR ILIM ADD BMS', alfa: 'G-BPRADBMS', tech: 'GPON', price: '$24.99', minExtra: 'PR: ILIM / US: $0.03', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: 'A150', name: 'GPON BUS PR ILIM ADD BML', alfa: 'G-BPRADBML', tech: 'GPON', price: '$24.99', minExtra: 'PR: ILIM / US: $0.03', install: [65, 32.50, 0], activation: [0, 0, 0], penalty: 200 },
  { cat: 'telefonia-ilimitada', code: 'A151', name: 'GPON BUS LD US ILIMITADO (POR LÍNEA)', alfa: 'G-BLDUSUNL', tech: 'GPON', price: '$5.00', minExtra: 'ILIM', install: [null, null, null], activation: [null, null, null], penalty: null },

  // ========== PQT 5 LÍNEAS PR/US ILIMITADO ==========
  { cat: 'pqt-ilimitado', code: '6995', name: 'PQT 5 PR/US ILIMITADO LP BMS', alfa: '5PRUSBMS', tech: 'COBRE/VRAD', price: '$149.99', install: [360, 180, 0], activation: [200, 100, 0], penalty: 200 },
  { cat: 'pqt-ilimitado', code: '6996', name: 'PQT 5 PR/US ILIMITADO LP BML', alfa: '5PRUSBML', tech: 'COBRE/VRAD', price: '$149.99', install: [390, 195, 0], activation: [null, null, null], penalty: 200 },
  { cat: 'pqt-ilimitado', code: '6999', name: 'PR/US ILIMITADO L. ADIC PQT BMS', alfa: 'ADPRUSBMS', tech: 'COBRE/VRAD', price: '$0.00', install: [0, 0, 0], activation: [null, null, null], penalty: 200, notes: 'Línea adicional gratis bajo PQT' },
  { cat: 'pqt-ilimitado', code: '7033', name: 'PR/US ILIMITADO L. ADIC PQT BML', alfa: 'ADPRUSBML', tech: 'COBRE/VRAD', price: '$0.00', install: [0, 0, 0], activation: [null, null, null], penalty: 200, notes: 'Línea adicional gratis bajo PQT' },
  { cat: 'pqt-ilimitado', code: 'A152', name: 'GPON BUS PR/US ILIM PQT 5 BMS', alfa: 'G-BMS5PRUS', tech: 'GPON', price: '$149.99', install: [360, 180, 0], activation: [200, 100, 0], penalty: 200 },
  { cat: 'pqt-ilimitado', code: 'A153', name: 'GPON BUS PR/US ILIM PQT 5 BML', alfa: 'G-BML5PRUS', tech: 'GPON', price: '$149.99', install: [390, 195, 0], activation: [0, 0, 0], penalty: 200 },
  { cat: 'pqt-ilimitado', code: 'A154', name: 'GPON BUS PR/US ILIM PQT ADD BMS', alfa: 'G-BMSADPQT', tech: 'GPON', price: '$0.00', install: [0, 0, 0], activation: [0, 0, 0], penalty: 200, notes: 'Línea adicional gratis bajo PQT' },
  { cat: 'pqt-ilimitado', code: 'A155', name: 'GPON BUS PR/US ILIM PQT ADD BML', alfa: 'G-BMLADPQT', tech: 'GPON', price: '$0.00', install: [0, 0, 0], activation: [0, 0, 0], penalty: 200, notes: 'Línea adicional gratis bajo PQT' },

  // ========== TELE ENTRY SERVICE ==========
  { cat: 'tele-entry', code: 'A801', name: 'BUS TELE ENTRY SERV (BMS ONLY)', alfa: 'BTENTRY', tech: 'COBRE/VRAD', price: '$19.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200, notes: 'Ilimitado local / Bloqueo US' },
  { cat: 'tele-entry', code: 'A802', name: 'GPON BUS TELE ENTRY SERV (BMS ONLY)', alfa: 'G-BTENTRY', tech: 'GPON', price: '$19.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 200, notes: 'Ilimitado local / Bloqueo US' },

  // ========== REMOTE CALL FORWARD PR ==========
  { cat: 'call-fwd-pr', code: 'A734', name: 'BUS REMOTE CALL FWD PR NUM 6M (6 MESES)', alfa: 'BRCFPR6', tech: 'COBRE/VRAD', price: '$24.99', install: [null, null, 0], activation: [null, null, null], penalty: 50, notes: 'Contrato 6 meses, ILIM/BLQ US' },
  { cat: 'call-fwd-pr', code: 'A735', name: 'BUS REMOTE CALL FWD PR NUM 3M (3 MESES)', alfa: 'BRCFPR3', tech: 'COBRE/VRAD', price: '$24.99', install: [null, 25, null], activation: [null, null, null], penalty: 50, notes: 'Contrato 3 meses, ILIM/BLQ US' },
  { cat: 'call-fwd-pr', code: 'A736', name: 'BUS REMOTE CALL FWD PR NUM NC (0 MESES)', alfa: 'BRCFPR0', tech: 'COBRE/VRAD', price: '$24.99', install: [50, null, null], activation: [null, null, null], penalty: 50, notes: 'Sin contrato, ILIM/BLQ US' },
  { cat: 'call-fwd-pr', code: 'A761', name: 'GPON BUS REMOTE CALL FWD PR NUM 6M', alfa: 'G-BRCFPR6', tech: 'GPON', price: '$24.99', install: [null, null, 0], activation: [null, null, null], penalty: 50, notes: 'Contrato 6 meses, ILIM/BLQ US' },
  { cat: 'call-fwd-pr', code: 'A762', name: 'GPON BUS REMOTE CALL FWD PR NUM 3M', alfa: 'G-BRCFPR3', tech: 'GPON', price: '$24.99', install: [null, 25, null], activation: [null, null, null], penalty: 50, notes: 'Contrato 3 meses, ILIM/BLQ US' },
  { cat: 'call-fwd-pr', code: 'A763', name: 'GPON BUS REMOTE CALL FWD PR NUM NC', alfa: 'G-BRCFPR0', tech: 'GPON', price: '$24.99', install: [50, null, null], activation: [null, null, null], penalty: 50, notes: 'Sin contrato, ILIM/BLQ US' },

  // ========== REMOTE CALL FORWARD US ==========
  { cat: 'call-fwd-us', code: 'A737', name: 'BUS REMOTE CALL FWD US NUM 6M (6 MESES)', alfa: 'BRCFUS6', tech: 'COBRE/VRAD', price: '$29.99', install: [null, null, 0], activation: [null, null, null], penalty: 50, notes: 'Contrato 6 meses, ILIM' },
  { cat: 'call-fwd-us', code: 'A738', name: 'BUS REMOTE CALL FWD US NUM 3M (3 MESES)', alfa: 'BRCFUS3', tech: 'COBRE/VRAD', price: '$29.99', install: [null, 25, null], activation: [null, null, null], penalty: 50, notes: 'Contrato 3 meses, ILIM' },
  { cat: 'call-fwd-us', code: 'A739', name: 'BUS REMOTE CALL FWD US NUM NC (0 MESES)', alfa: 'BRCFUS0', tech: 'COBRE/VRAD', price: '$29.99', install: [50, null, null], activation: [null, null, null], penalty: 50, notes: 'Sin contrato, ILIM' },
  { cat: 'call-fwd-us', code: 'A798', name: 'GPON BUS REMOTE CALL FWD US NUM 6M', alfa: 'G-BRCFUS6', tech: 'GPON', price: '$29.99', install: [null, null, 0], activation: [null, null, null], penalty: 50, notes: 'Contrato 6 meses, ILIM' },
  { cat: 'call-fwd-us', code: 'A799', name: 'GPON BUS REMOTE CALL FWD US NUM 3M', alfa: 'G-BRCFUS3', tech: 'GPON', price: '$29.99', install: [null, 25, null], activation: [null, null, null], penalty: 50, notes: 'Contrato 3 meses, ILIM' },
  { cat: 'call-fwd-us', code: 'A800', name: 'GPON BUS REMOTE CALL FWD US NUM NC', alfa: 'G-BRCFUS0', tech: 'GPON', price: '$29.99', install: [50, null, null], activation: [null, null, null], penalty: 50, notes: 'Sin contrato, ILIM' },

  // ========== 2PLAY INTERNET + VOZ ==========
  // COBRE/VRAD
  { cat: '2play', code: 'A870', name: 'BUS PRUS ILIM + 5M/1M', alfa: 'BPRU5M', tech: 'COBRE/VRAD', price: '$29.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A871', name: 'BUS PRUS ILIM + 8M/1M', alfa: 'BPRU8M', tech: 'COBRE/VRAD', price: '$32.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A872', name: 'BUS PRUS ILIM + 10M/1M', alfa: 'BPRU10M', tech: 'COBRE/VRAD', price: '$35.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A873', name: 'BUS PRUS ILIM + 16M/1M', alfa: 'BPRU16M', tech: 'COBRE/VRAD', price: '$38.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A874', name: 'BUS PRUS ILIM + 20M/1M — COBRE', alfa: 'BPRU20M1', tech: 'COBRE/VRAD', price: '$44.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A875', name: 'BUS PRUS ILIM + 20M/3M — VRAD', alfa: 'BPRU20M3', tech: 'COBRE/VRAD', price: '$44.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A876', name: 'BUS PRUS ILIM + 30M/3M', alfa: 'BPRU30M', tech: 'COBRE/VRAD', price: '$47.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A877', name: 'BUS PRUS ILIM + 50M/5M', alfa: 'BPRU50M', tech: 'COBRE/VRAD', price: '$49.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A878', name: 'BUS PRUS ILIM + 100M/15M (2L) BUNDLE', alfa: '—', tech: 'COBRE/VRAD', price: '$79.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 2 líneas' },
  { cat: '2play', code: 'A878', name: 'BUS PRUS ILIM + 100M/15M', alfa: 'BPRU100M', tech: 'COBRE/VRAD', price: '$54.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  // GPON
  { cat: '2play', code: 'A879', name: 'GPON BUS PRUS ILIM + 30MB', alfa: 'G-BPRU30M', tech: 'GPON', price: '$47.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A880', name: 'GPON BUS PRUS ILIM + 50MB', alfa: 'G-BPRU50M', tech: 'GPON', price: '$49.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A881', name: 'GPON BUS PRUS ILIM + 100MB (2L) BUNDLE', alfa: '—', tech: 'GPON', price: '$79.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 2 líneas' },
  { cat: '2play', code: 'A881', name: 'GPON BUS PRUS ILIM + 100MB', alfa: 'G-BPRU100M', tech: 'GPON', price: '$54.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A882', name: 'GPON BUS PRUS ILIM + 150MB (2L) BUNDLE', alfa: '—', tech: 'GPON', price: '$89.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 2 líneas' },
  { cat: '2play', code: 'A882', name: 'GPON BUS PRUS ILIM + 150MB', alfa: 'G-BPRU150M', tech: 'GPON', price: '$64.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A883', name: 'GPON BUS PRUS ILIM + 200MB (3L) BUNDLE', alfa: '—', tech: 'GPON', price: '$117.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 3 líneas' },
  { cat: '2play', code: 'A883', name: 'GPON BUS PRUS ILIM + 200MB', alfa: 'G-BPRU200M', tech: 'GPON', price: '$67.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A884', name: 'GPON BUS PRUS ILIM + 300MB (3L) BUNDLE', alfa: '—', tech: 'GPON', price: '$124.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 3 líneas' },
  { cat: '2play', code: 'A884', name: 'GPON BUS PRUS ILIM + 300MB', alfa: 'G-BPRU300M', tech: 'GPON', price: '$74.99', install: [120, 60, 40], activation: [40, 0, 0], penalty: 260 },
  { cat: '2play', code: 'A885', name: 'GPON BUS PRUS ILIM + 350MB (3L) BUNDLE', alfa: '—', tech: 'GPON', price: '$149.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 3 líneas' },
  { cat: '2play', code: 'A885', name: 'GPON BUS PRUS ILIM + 350MB', alfa: 'G-BPRU350M', tech: 'GPON', price: '$99.99', install: [120, 60, 40], activation: [40, 0, 0], penalty: 260 },
  { cat: '2play', code: 'A886', name: 'GPON BUS PRUS ILIM + 450MB (4L) BUNDLE', alfa: '—', tech: 'GPON', price: '$179.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 4 líneas' },
  { cat: '2play', code: 'A886', name: 'GPON BUS PRUS ILIM + 450MB', alfa: 'G-BPRU450M', tech: 'GPON', price: '$104.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A887', name: 'GPON BUS PRUS ILIM + 500MB (4L) BUNDLE', alfa: '—', tech: 'GPON', price: '$249.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 4 líneas' },
  { cat: '2play', code: 'A887', name: 'GPON BUS PRUS ILIM + 500MB', alfa: 'G-BPRU500M', tech: 'GPON', price: '$174.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A888', name: 'GPON BUS PRUS ILIM + 650MB (4L) BUNDLE', alfa: '—', tech: 'GPON', price: '$259.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 4 líneas' },
  { cat: '2play', code: 'A888', name: 'GPON BUS PRUS ILIM + 650MB', alfa: 'G-BPRU650M', tech: 'GPON', price: '$184.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },
  { cat: '2play', code: 'A889', name: 'GPON BUS PRUS ILIM + 1GB (4L) BUNDLE', alfa: '—', tech: 'GPON', price: '$274.99', install: ['120 p/l', '60 p/l', 0], activation: ['40 p/l', '20 p/l', 0], penalty: '$260+$200 p/l', bundle: true, notes: 'Bundle 4 líneas' },
  { cat: '2play', code: 'A889', name: 'GPON BUS PRUS ILIM + 1GB', alfa: 'G-BPRU1GB', tech: 'GPON', price: '$199.99', install: [120, 60, 0], activation: [40, 20, 0], penalty: 260 },

  // ========== 2PLAY LÍNEAS ADICIONALES ==========
  { cat: '2play-add', code: '7107', name: 'BUS 2PLAY PR/US ILIM ADD BMS', alfa: 'B2PBMSAD', tech: 'COBRE/VRAD', price: '$25.00', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: '2play-add', code: '7108', name: 'BUS 2PLAY PR/US ILIM ADD BML', alfa: 'B2PBMLAD', tech: 'COBRE/VRAD', price: '$25.00', install: [65, 32.50, 0], activation: [null, null, null], penalty: 200 },
  { cat: '2play-add', code: 'A169', name: 'GPON BUS 2PLAY PR/US ILIM ADD BMS', alfa: 'G-BMSADD2P', tech: 'GPON', price: '$25.00', install: [60, 30, 0], activation: [40, 20, 0], penalty: 200 },
  { cat: '2play-add', code: 'A170', name: 'GPON BUS 2PLAY PR/US ILIM ADD BML', alfa: 'G-BMLADD2P', tech: 'GPON', price: '$25.00', install: [65, 32.50, 0], activation: [null, null, null], penalty: 200 },

  // ========== CLAROTV+ PLANES ==========
  { cat: 'tv-planes', code: 'PY2ULE', name: 'Clarotv+ ULTRA ESENCIAL (21 canales)', alfa: '—', tech: 'TODAS', price: '$15.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },
  { cat: 'tv-planes', code: 'PY2ESE', name: 'Clarotv+ ESENCIAL (29 canales)', alfa: '—', tech: 'TODAS', price: '$19.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },
  { cat: 'tv-planes', code: 'IP2ESTE', name: 'Clarotv+ ESENCIAL + TODO ESPAÑOL (68 canales)', alfa: '—', tech: 'TODAS', price: '$26.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },
  { cat: 'tv-planes', code: 'IP2BASC2', name: 'Clarotv+ BASIC (76 canales)', alfa: '—', tech: 'TODAS', price: '$55.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },
  { cat: 'tv-planes', code: 'IP2BASC3', name: 'Clarotv+ BASIC+ (98 canales)', alfa: '—', tech: 'TODAS', price: '$60.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },
  { cat: 'tv-planes', code: 'PY2SIG', name: 'Clarotv+ SIGNATURE (147 canales)', alfa: '—', tech: 'TODAS', price: '$70.99', install: [null, null, null], activation: [null, 40, 0], penalty: '$200 PRORRATEADO' },

  // ========== TV PREMIUM ==========
  { cat: 'tv-premium', code: 'REAKNG', name: 'REALITY KING', alfa: '—', tech: 'VRAD/GPON', price: '$24.99' },
  { cat: 'tv-premium', code: 'IPLYB', name: 'PLAYBOY TV', alfa: '—', tech: 'VRAD/GPON', price: '$19.99' },

  // ========== DECODIFICADORES & EQUIPOS ==========
  { cat: 'tv-equipos', code: '40942H', name: '1er STB GRATIS — Contrato 24 meses', alfa: '2YROFF', tech: 'TODAS', price: '$0.00', penalty: 40, notes: 'SAP: 7008557' },
  { cat: 'tv-equipos', code: '40942H', name: '1er STB GRATIS — Contrato 12 meses', alfa: '1YROFF', tech: 'TODAS', price: '$0.00', penalty: 40, notes: 'SAP: 7008557' },
  { cat: 'tv-equipos', code: '40942H', name: '1er STB GRATIS — Sin contrato CON penalidad', alfa: 'STBOFF', tech: 'TODAS', price: '$40.00', penalty: 40, notes: 'SAP: 7008557' },
  { cat: 'tv-equipos', code: '40942H', name: 'STB Full Price — Cliente CON contrato', alfa: 'CASH', tech: 'TODAS', price: '$40.00', penalty: null, notes: 'SAP: 7008557' },
  { cat: 'tv-equipos', code: '40942H', name: 'STB Full Price — Cliente SIN contrato', alfa: 'NOCONT', tech: 'TODAS', price: '$40.00', penalty: null, notes: 'SAP: 7008557' },
  { cat: 'tv-equipos', code: '40942H', name: 'STB Financiado 24M — CON contrato', alfa: 'FINA24', tech: 'TODAS', price: '$40.00', monthlyFee: '$1.67/mes', penalty: null, notes: 'SAP: 7008557 · Restante de $40' },
  { cat: 'tv-equipos', code: '40942H', name: 'STB Financiado 12M — CON contrato', alfa: 'FINA12', tech: 'TODAS', price: '$40.00', monthlyFee: '$3.33/mes', penalty: null, notes: 'SAP: 7008557 · Restante de $40' },
  { cat: 'tv-equipos', code: '80105H', name: 'DONGLE 4K — Full Price', alfa: 'CASH', tech: 'TODAS', price: '$30.00', penalty: null, notes: 'SAP: 7009940' },
  { cat: 'tv-equipos', code: '80105H', name: 'DONGLE 4K — Financiado 24M', alfa: 'FINA24', tech: 'TODAS', price: '$30.00', monthlyFee: '$1.25/mes', penalty: null, notes: 'SAP: 7009940 · Restante de $30' },
  { cat: 'tv-equipos', code: '80105H', name: 'DONGLE 4K — Financiado 12M', alfa: 'FINA12', tech: 'TODAS', price: '$30.00', monthlyFee: '$2.50/mes', penalty: null, notes: 'SAP: 7009940 · Restante de $30' },
  { cat: 'tv-equipos', code: '40941H', name: '1er CONTROL REMOTO — GRATIS', alfa: 'CERO', tech: 'TODAS', price: '$0.00', penalty: 6, notes: 'SAP: 7008624' },
  { cat: 'tv-equipos', code: '40941H', name: '2do CONTROL REMOTO (reemplazo)', alfa: 'CASH', tech: 'TODAS', price: '$6.00', penalty: null, notes: 'SAP: 7008624' },
  { cat: 'tv-equipos', code: 'NPVR250', name: 'Cloud DVR (250GB) — 1 por cuenta, no por TV', alfa: 'NPVR250', tech: 'TODAS', price: '$5.00', penalty: null },

  // ========== VALORES AGREGADOS ==========
  // COBRE/VRAD
  { cat: 'valores-agregados', code: '7448', name: 'INCREMENTO UPLOAD 1 Mb', alfa: 'INTUP1M', tech: 'COBRE/VRAD', price: '$5.00' },
  { cat: 'valores-agregados', code: '3241', name: '3 VERTICAL PACK: CID, 3WCALL, TRANSF', alfa: '3VERTPACK', tech: 'COBRE/VRAD', price: '$5.00' },
  { cat: 'valores-agregados', code: '2266', name: 'CONTRATO DE MANTENIMIENTO', alfa: 'BIWMCFTJK', tech: 'COBRE/VRAD', price: '$5.00' },
  { cat: 'valores-agregados', code: '3256', name: 'CONTRATO DE MANTENIMIENTO GRATIS', alfa: 'CONTMANOFF', tech: 'COBRE/VRAD', price: '$0.00' },
  { cat: 'valores-agregados', code: '3229', name: '200 MINUTOS LARGA DISTANCIA A US', alfa: 'LDUS200PCK', tech: 'COBRE/VRAD', price: '$4.99' },
  { cat: 'valores-agregados', code: '3228', name: 'HUNTING FEE (AL PILOTO)', alfa: 'HUNTINFEE', tech: 'COBRE/VRAD', price: '$9.99', notes: 'Instalación: $30 (cualquier término)' },
  { cat: 'valores-agregados', code: '6955', name: 'BUS VOICE MAIL', alfa: 'BVMAIL', tech: 'COBRE/VRAD', price: '$4.99' },
  { cat: 'valores-agregados', code: '9924', name: 'VOICE MAIL MAX DSL PLUS COMBO', alfa: 'VMBUNDLE', tech: 'COBRE/VRAD', price: '$0.00', notes: 'Gratis con DSL Combo' },
  { cat: 'valores-agregados', code: '3240', name: 'LLAMADAS GRATIS DE FIJO A MÓVIL CLARO', alfa: 'FIX2CEL', tech: 'COBRE/VRAD', price: '$5.00' },
  { cat: 'valores-agregados', code: '1186', name: 'PLAN MUNDIAL — LDI (con/sin contrato)', alfa: 'MUNDIAL', tech: 'TODAS', price: '$0.00', notes: 'Nuevas tarifas internacionales' },
  { cat: 'valores-agregados', code: '1187', name: 'PLAN WORLDWIDE — LDI (sin contrato)', alfa: 'WORLDWIDE', tech: 'COBRE/VRAD', price: '$0.99' },
  // GPON
  { cat: 'valores-agregados', code: '7242', name: 'GPON BUS 3 VERTICAL PACK', alfa: 'G-BPK3VERT', tech: 'GPON', price: '$5.00' },
  { cat: 'valores-agregados', code: '7243', name: 'GPON BUS LINE MAINTENANCE', alfa: 'G-BLNEMANT', tech: 'GPON', price: '$5.00' },
  { cat: 'valores-agregados', code: '7244', name: 'GPON BUS LINE MAINTENANCE OFF', alfa: 'G-BMANTOFF', tech: 'GPON', price: '$0.00' },
  { cat: 'valores-agregados', code: '7245', name: 'GPON BUS 200 MNTS LD US', alfa: 'G-BLDUS200', tech: 'GPON', price: '$4.99' },
  { cat: 'valores-agregados', code: '7246', name: 'GPON BUS HUNTING', alfa: 'G-BHUNTING', tech: 'GPON', price: '$9.99', notes: 'Instalación: $30 (cualquier término)' },
  { cat: 'valores-agregados', code: '7141', name: 'GPON BUS VOICE MAIL', alfa: 'G-BVMAIL', tech: 'GPON', price: '$4.99' },
  { cat: 'valores-agregados', code: '7142', name: 'GPON BUS FREE VOICE MAIL', alfa: 'G-BVMFREE', tech: 'GPON', price: '$0.00' },

  // ========== BONOS, DESCUENTOS, PENALIDADES ==========
  { cat: 'bonos', code: '5494', name: 'BONO PORTABILIDAD (por línea)', alfa: 'BONOPORTIN', tech: 'TODAS', price: '-$5.00', notes: 'Descuento mensual por portabilidad' },
  { cat: 'bonos', code: '7751', name: 'BONO PORTABILIDAD PQT 5', alfa: 'BONOPORT25', tech: 'TODAS', price: '-$25.00', notes: 'Descuento mensual PQT 5 líneas' },
  { cat: 'bonos', code: '7752', name: 'BONO PORTABILIDAD PQT 10', alfa: 'BONOPORT50', tech: 'TODAS', price: '-$50.00', notes: 'Descuento mensual PQT 10 líneas' },
  { cat: 'bonos', code: '7336', name: 'AFFINITY 8% PYMES (2016) — 4Mb+', alfa: 'AFNTY8BUS', tech: 'COBRE/VRAD', price: '-8%', notes: 'Descuento sobre factura, internet 4Mb en adelante' },
  { cat: 'bonos', code: '7247', name: 'GPON BUS AFFINITY 8%', alfa: 'G-BAFFNITY', tech: 'GPON', price: '-8%', notes: 'Descuento GPON equivalente' },
  { cat: 'bonos', code: '9063', name: 'PENALIDAD DOWNGRADE INTERNET', alfa: 'PENALDOWNG', tech: 'COBRE/VRAD', price: 'OTC', notes: 'Cargo único: $40 en cualquier término' },
  { cat: 'bonos', code: '7268', name: 'GPON BUS INTERNET DOWNGRADE PENALTY', alfa: 'G-BINTDOWN', tech: 'GPON', price: 'OTC', notes: 'Cargo único: $40 en cualquier término' },
];


// ============================================================
// RENDERING ENGINE
// ============================================================

let currentTech = 'all';
let currentCategory = 'all';
let currentSearch = '';

function getTechClass(tech) {
  if (!tech) return 'tech-all';
  const t = tech.toUpperCase();
  if (t === 'GPON') return 'tech-gpon';
  if (t.includes('COBRE')) return 'tech-cobre';
  if (t === 'VRAD/GPON') return 'tech-vradgpon';
  return 'tech-all';
}

function formatCost(val) {
  if (val === null || val === undefined) return '<span class="cell-cost na">—</span>';
  if (typeof val === 'string') return `<span class="cell-cost">${val}</span>`;
  if (val === 0) return '<span class="cell-cost free-cost">GRATIS</span>';
  return `<span class="cell-cost">$${val.toFixed(2)}</span>`;
}

function formatPenalty(val) {
  if (val === null || val === undefined) return '<span class="cell-cost na">—</span>';
  if (typeof val === 'string') return `<span class="cell-penalty">${val}</span>`;
  return `<span class="cell-penalty">$${val.toFixed(2)}</span>`;
}

function matchesSearch(plan, search) {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    plan.code.toLowerCase().includes(s) ||
    plan.name.toLowerCase().includes(s) ||
    (plan.alfa && plan.alfa.toLowerCase().includes(s)) ||
    plan.tech.toLowerCase().includes(s) ||
    plan.price.toLowerCase().includes(s) ||
    (plan.notes && plan.notes.toLowerCase().includes(s))
  );
}

function matchesTech(plan, tech) {
  if (tech === 'all') return true;
  if (plan.tech === 'TODAS' || plan.tech === 'VRAD/GPON') return true;
  return plan.tech === tech;
}

function highlightText(text, search) {
  if (!search) return text;
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
      p.cat === cat.id &&
      matchesTech(p, currentTech) &&
      matchesSearch(p, currentSearch)
    );

    if (catPlans.length === 0) return;
    totalVisible += catPlans.length;

    const showInstall = cat.hasInstall;
    const showActivation = cat.hasActivation;
    const showMinExtra = cat.hasMinExtra;
    const showPenalty = cat.hasPenalty;

    // For simple categories (no install/activation), show a simpler table
    const isSimple = !showInstall && !showActivation;

    html += `<div class="category-section ${cat.cssClass}">`;
    html += `<div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">`;
    html += `<h2><span class="category-icon">${cat.icon}</span> ${cat.name} <span class="category-count">${catPlans.length}</span></h2>`;
    html += `<span class="category-toggle">▼</span>`;
    html += `</div>`;
    html += `<div class="category-body">`;
    html += `<table class="plan-table">`;

    // THEAD
    html += `<thead>`;
    if (!isSimple) {
      // Multi-row header
      html += `<tr>`;
      html += `<th rowspan="2">Código</th>`;
      html += `<th rowspan="2">Plan</th>`;
      html += `<th rowspan="2">Alfa Code</th>`;
      html += `<th rowspan="2">Tecnología</th>`;
      html += `<th rowspan="2">Precio/Mes</th>`;
      if (showMinExtra) html += `<th rowspan="2">Min. Adic.</th>`;
      if (showInstall) html += `<th colspan="3" class="th-group">Instalación</th>`;
      if (showActivation) html += `<th colspan="3" class="th-group">Activación (Jack)</th>`;
      if (showPenalty) html += `<th rowspan="2">Penalidad</th>`;
      html += `</tr>`;
      html += `<tr class="sub-header">`;
      if (showInstall) {
        html += `<th>0 Meses</th><th>12 Meses</th><th>24 Meses</th>`;
      }
      if (showActivation) {
        html += `<th>0 Meses</th><th>12 Meses</th><th>24 Meses</th>`;
      }
      html += `</tr>`;
    } else {
      // Simple header
      html += `<tr>`;
      html += `<th>Código</th>`;
      html += `<th>Plan / Descripción</th>`;
      html += `<th>Alfa Code</th>`;
      html += `<th>Tecnología</th>`;
      html += `<th>Precio/Mes</th>`;
      if (cat.id === 'tv-equipos') {
        html += `<th>Mensual Financ.</th>`;
        html += `<th>Penalidad</th>`;
      }
      html += `</tr>`;
    }
    html += `</thead>`;

    // TBODY
    html += `<tbody>`;
    catPlans.forEach(plan => {
      const isBundle = plan.bundle;
      const rowClass = isBundle ? 'bundle-row' : '';
      const priceClass = plan.price.startsWith('-') || plan.price.startsWith('$0') ? (plan.price === '$0.00' ? 'free' : 'discount') : '';

      html += `<tr class="${rowClass}">`;
      html += `<td class="cell-code">${highlightText(plan.code, currentSearch)}</td>`;
      html += `<td class="cell-name">${highlightText(plan.name, currentSearch)}</td>`;
      html += `<td class="cell-alfa">${highlightText(plan.alfa || '—', currentSearch)}</td>`;
      html += `<td><span class="tech-badge ${getTechClass(plan.tech)}">${plan.tech}</span></td>`;
      html += `<td class="cell-price ${priceClass}">${plan.price}</td>`;

      if (!isSimple) {
        if (showMinExtra) html += `<td class="cell-min">${plan.minExtra || '—'}</td>`;
        if (showInstall) {
          const inst = plan.install || [null, null, null];
          html += `<td>${formatCost(inst[0])}</td>`;
          html += `<td>${formatCost(inst[1])}</td>`;
          html += `<td>${formatCost(inst[2])}</td>`;
        }
        if (showActivation) {
          const act = plan.activation || [null, null, null];
          html += `<td>${formatCost(act[0])}</td>`;
          html += `<td>${formatCost(act[1])}</td>`;
          html += `<td>${formatCost(act[2])}</td>`;
        }
        if (showPenalty) {
          html += `<td>${formatPenalty(plan.penalty)}</td>`;
        }
      } else if (cat.id === 'tv-equipos') {
        html += `<td class="cell-cost">${plan.monthlyFee || '—'}</td>`;
        html += `<td>${formatPenalty(plan.penalty)}</td>`;
      }

      html += `</tr>`;

      // Notes row
      if (plan.notes) {
        const colspan = isSimple
          ? (cat.id === 'tv-equipos' ? 7 : 5)
          : (5 + (showMinExtra ? 1 : 0) + (showInstall ? 3 : 0) + (showActivation ? 3 : 0) + (showPenalty ? 1 : 0));
        html += `<tr><td colspan="${colspan}" class="notes-cell">💡 ${highlightText(plan.notes, currentSearch)}</td></tr>`;
      }
    });
    html += `</tbody></table></div></div>`;
  });

  container.innerHTML = html;
  noResults.style.display = totalVisible === 0 ? 'block' : 'none';

  // Update stats
  document.getElementById('stats').textContent =
    totalVisible === PLANS.length
      ? `Mostrando ${totalVisible} planes`
      : `Mostrando ${totalVisible} de ${PLANS.length} planes`;
}


// ============================================================
// INITIALIZATION & EVENT HANDLERS
// ============================================================

function init() {
  // Populate category dropdown
  const catSelect = document.getElementById('categoryFilter');
  CATEGORIES.forEach(cat => {
    const count = PLANS.filter(p => p.cat === cat.id).length;
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name} (${count})`;
    catSelect.appendChild(opt);
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

  // Category filter
  catSelect.addEventListener('change', () => {
    currentCategory = catSelect.value;
    renderPlans();
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

  // Initial render
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
