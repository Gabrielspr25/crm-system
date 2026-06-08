-- Seed: 2026-06-08-planes-modulos-seed.sql
-- Datos iniciales extraídos de los boletines PDF (Junio 2026)
-- Ejecutar DESPUÉS de 2026-06-08-planes-modulos.sql

-- ═══════════════════════════════════════════════════════
-- PÁGINA: PLANES FIJOS
-- Fuente: LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330.pdf
-- ═══════════════════════════════════════════════════════

INSERT INTO planes_modulos (pagina, seccion_key, titulo, subtitulo, descripcion, orden, tipo, contenido, boletin_ref)
VALUES
-- ── Telefonía Medida ──
('fijos', 'telefonia_medida', 'Telefonía Medida', 'BUS 500 MED', 'Planes de voz medidos para negocios. Disponibles en COBRE/VRAD y GPON.', 10, 'tabla',
'{
  "columnas": ["Código","Descripción","Alfa Code","Tecnología","Precio"],
  "filas": [
    {"codigo":"A862","descripcion":"BUS 500 MED BMS LP","alfa_code":"B500BMSLP","tecnologia":"COBRE/VRAD","precio":19.99},
    {"codigo":"A863","descripcion":"BUS 500 MED BMS LADD","alfa_code":"B500BMSAD","tecnologia":"COBRE/VRAD","precio":19.99},
    {"codigo":"A864","descripcion":"BUS 500 MED BML LP","alfa_code":"B500BMLLP","tecnologia":"COBRE/VRAD","precio":19.99},
    {"codigo":"A865","descripcion":"BUS 500 MED BML LADD","alfa_code":"B500BMLAD","tecnologia":"COBRE/VRAD","precio":19.99},
    {"codigo":"A866","descripcion":"GPON BUS 500 MED BMS LP","alfa_code":"GB500BMSLP","tecnologia":"GPON","precio":19.99},
    {"codigo":"A867","descripcion":"GPON BUS 500 MED BMS LADD","alfa_code":"GB500BMSAD","tecnologia":"GPON","precio":19.99},
    {"codigo":"A868","descripcion":"GPON BUS 500 MED BML LP","alfa_code":"GB500BMLLP","tecnologia":"GPON","precio":19.99},
    {"codigo":"A869","descripcion":"GPON BUS 500 MED BML LADD","alfa_code":"GB500BMLAD","tecnologia":"GPON","precio":19.99}
  ]
}',
'LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330'),

-- ── Telefonía Ilimitada ──
('fijos', 'telefonia_ilimitada', 'Telefonía Ilimitada', 'Ilimitado PR · PR/US', 'Planes de voz ilimitados locales y con cobertura EE.UU. Incluye paquetes multilínea.', 20, 'tabla',
'{
  "columnas": ["Código","Descripción","Alfa Code","Tecnología","Precio"],
  "filas": [
    {"codigo":"7200","descripcion":"BUS PR ILIM BMS LP","alfa_code":"BPRBMSLP","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"7203","descripcion":"BUS PR ILIM BML LP","alfa_code":"BPRBMLLP","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"6991","descripcion":"PR ILIMITADO L. ADD BMS","alfa_code":"PRBMSADD","tecnologia":"COBRE/VRAD","precio":24.99},
    {"codigo":"6992","descripcion":"PR ILIMITADO L. ADD BML","alfa_code":"PRBMLADD","tecnologia":"COBRE/VRAD","precio":24.99},
    {"codigo":"6644","descripcion":"BUS LD US ILIMITADO (POR LÍNEA)","alfa_code":"USAUNLBUS","tecnologia":"COBRE/VRAD","precio":5.00},
    {"codigo":"A147","descripcion":"GPON BUS PR ILIM LP BMS","alfa_code":"G-BPRBMSLP","tecnologia":"GPON","precio":29.99},
    {"codigo":"A148","descripcion":"GPON BUS PR ILIM LP BML","alfa_code":"G-BPRBMLLP","tecnologia":"GPON","precio":29.99},
    {"codigo":"A149","descripcion":"GPON BUS PR ILIM ADD BMS","alfa_code":"G-BPRADBMS","tecnologia":"GPON","precio":24.99},
    {"codigo":"A150","descripcion":"GPON BUS PR ILIM ADD BML","alfa_code":"G-BPRADBML","tecnologia":"GPON","precio":24.99},
    {"codigo":"A151","descripcion":"GPON BUS LD US ILIMITADO (POR LÍNEA)","alfa_code":"G-BLDUSUNL","tecnologia":"GPON","precio":5.00},
    {"codigo":"6995","descripcion":"PQT 5 PR/US ILIMITADO LP BMS","alfa_code":"5PRUSBMS","tecnologia":"COBRE/VRAD","precio":149.99},
    {"codigo":"6996","descripcion":"PQT 5 PR/US ILIMITADO LP BML","alfa_code":"5PRUSBML","tecnologia":"COBRE/VRAD","precio":149.99},
    {"codigo":"6999","descripcion":"PR/US ILIMITADO L. ADIC PQT BMS","alfa_code":"ADPRUSBMS","tecnologia":"COBRE/VRAD","precio":0.00},
    {"codigo":"7033","descripcion":"PR/US ILIMITADO L. ADIC PQT BML","alfa_code":"ADPRUSBML","tecnologia":"COBRE/VRAD","precio":0.00},
    {"codigo":"A152","descripcion":"GPON BUS PR/US ILIM PQT 5 BMS","alfa_code":"G-BMS5PRUS","tecnologia":"GPON","precio":149.99},
    {"codigo":"A153","descripcion":"GPON BUS PR/US ILIM PQT 5 BML","alfa_code":"G-BML5PRUS","tecnologia":"GPON","precio":149.99},
    {"codigo":"A154","descripcion":"GPON BUS PR/US ILIM PQT ADD BMS","alfa_code":"G-BMSADPQT","tecnologia":"GPON","precio":0.00},
    {"codigo":"A155","descripcion":"GPON BUS PR/US ILIM PQT ADD BML","alfa_code":"G-BMLADPQT","tecnologia":"GPON","precio":0.00}
  ]
}',
'LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330'),

-- ── 2Play Internet + Voz ──
('fijos', 'dos_play', '2Play — Internet + Voz', 'PRUS ILIM + Internet', 'Paquetes de voz ilimitada PR/US combinados con internet de alta velocidad.', 30, 'tabla',
'{
  "columnas": ["Código","Descripción","Alfa Code","Tecnología","Precio"],
  "filas": [
    {"codigo":"A870","descripcion":"BUS PRUS ILIM + 5M/1M","alfa_code":"BPRU5M","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"A871","descripcion":"BUS PRUS ILIM + 8M/1M","alfa_code":"BPRU8M","tecnologia":"COBRE/VRAD","precio":32.99},
    {"codigo":"A872","descripcion":"BUS PRUS ILIM + 10M/1M","alfa_code":"BPRU10M","tecnologia":"COBRE/VRAD","precio":35.99},
    {"codigo":"A873","descripcion":"BUS PRUS ILIM + 16M/1M","alfa_code":"BPRU16M","tecnologia":"COBRE/VRAD","precio":38.99},
    {"codigo":"A874","descripcion":"BUS PRUS ILIM + 20M/1M - COBRE","alfa_code":"BPRU20M1","tecnologia":"COBRE/VRAD","precio":44.99},
    {"codigo":"A875","descripcion":"BUS PRUS ILIM + 20M/3M - VRAD","alfa_code":"BPRU20M3","tecnologia":"COBRE/VRAD","precio":44.99},
    {"codigo":"A876","descripcion":"BUS PRUS ILIM + 30M/3M","alfa_code":"BPRU30M","tecnologia":"COBRE/VRAD","precio":47.99},
    {"codigo":"A877","descripcion":"BUS PRUS ILIM + 50M/5M","alfa_code":"BPRU50M","tecnologia":"COBRE/VRAD","precio":49.99},
    {"codigo":"A878","descripcion":"BUS PRUS ILIM + 100M/15M (2L) BUNDLE","alfa_code":"-","tecnologia":"COBRE/VRAD","precio":79.99},
    {"codigo":"A878","descripcion":"BUS PRUS ILIM + 100M/15M","alfa_code":"BPRU100M","tecnologia":"COBRE/VRAD","precio":54.99},
    {"codigo":"7107","descripcion":"BUS 2PLAY PR/US ILIM ADD BMS","alfa_code":"B2PBMSAD","tecnologia":"COBRE/VRAD","precio":25.00},
    {"codigo":"7108","descripcion":"BUS 2PLAY PR/US ILIM ADD BML","alfa_code":"B2PBMLAD","tecnologia":"COBRE/VRAD","precio":25.00},
    {"codigo":"A879","descripcion":"GPON BUS PRUS ILIM + 30MB","alfa_code":"G-BPRU30M","tecnologia":"GPON","precio":47.99},
    {"codigo":"A880","descripcion":"GPON BUS PRUS ILIM + 50MB","alfa_code":"G-BPRU50M","tecnologia":"GPON","precio":49.99},
    {"codigo":"A881","descripcion":"GPON BUS PRUS ILIM + 100MB (2L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":79.99},
    {"codigo":"A881","descripcion":"GPON BUS PRUS ILIM + 100MB","alfa_code":"G-BPRU100M","tecnologia":"GPON","precio":54.99},
    {"codigo":"A882","descripcion":"GPON BUS PRUS ILIM + 150MB (2L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":89.99},
    {"codigo":"A882","descripcion":"GPON BUS PRUS ILIM + 150MB","alfa_code":"G-BPRU150M","tecnologia":"GPON","precio":64.99},
    {"codigo":"A883","descripcion":"GPON BUS PRUS ILIM + 200MB (3L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":117.99},
    {"codigo":"A883","descripcion":"GPON BUS PRUS ILIM + 200MB","alfa_code":"G-BPRU200M","tecnologia":"GPON","precio":67.99},
    {"codigo":"A884","descripcion":"GPON BUS PRUS ILIM + 300MB (3L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":124.99},
    {"codigo":"A884","descripcion":"GPON BUS PRUS ILIM + 300MB","alfa_code":"G-BPRU300M","tecnologia":"GPON","precio":74.99},
    {"codigo":"A885","descripcion":"GPON BUS PRUS ILIM + 350MB (3L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":149.99},
    {"codigo":"A885","descripcion":"GPON BUS PRUS ILIM + 350MB","alfa_code":"G-BPRU350M","tecnologia":"GPON","precio":99.99},
    {"codigo":"A886","descripcion":"GPON BUS PRUS ILIM + 450MB (4L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":179.99},
    {"codigo":"A886","descripcion":"GPON BUS PRUS ILIM + 450MB","alfa_code":"G-BPRU450M","tecnologia":"GPON","precio":104.99},
    {"codigo":"A887","descripcion":"GPON BUS PRUS ILIM + 500MB (4L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":249.99},
    {"codigo":"A887","descripcion":"GPON BUS PRUS ILIM + 500MB","alfa_code":"G-BPRU500M","tecnologia":"GPON","precio":174.99},
    {"codigo":"A888","descripcion":"GPON BUS PRUS ILIM + 650MB (4L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":259.99},
    {"codigo":"A888","descripcion":"GPON BUS PRUS ILIM + 650MB","alfa_code":"G-BPRU650M","tecnologia":"GPON","precio":184.99},
    {"codigo":"A889","descripcion":"GPON BUS PRUS ILIM + 1GB (4L) BUNDLE","alfa_code":"-","tecnologia":"GPON","precio":274.99},
    {"codigo":"A889","descripcion":"GPON BUS PRUS ILIM + 1GB","alfa_code":"G-BPRU1GB","tecnologia":"GPON","precio":199.99},
    {"codigo":"A169","descripcion":"GPON BUS 2PLAY PR/US ILIM ADD BMS","alfa_code":"G-BMSADD2P","tecnologia":"GPON","precio":25.00},
    {"codigo":"A170","descripcion":"GPON BUS 2PLAY PR/US ILIM ADD BML","alfa_code":"G-BMLADD2P","tecnologia":"GPON","precio":25.00}
  ]
}',
'LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330'),

-- ── Televisión ──
('fijos', 'television', 'Televisión', 'Canales Premium', 'Canales de entretenimiento premium disponibles como add-on.', 40, 'tabla',
'{
  "columnas": ["Código","Descripción","Alfa Code","Tecnología","Precio"],
  "filas": [
    {"codigo":"IPLYB","descripcion":"PLAYBOY TV","alfa_code":"-","tecnologia":"VRAD/GPON","precio":19.99}
  ]
}',
'LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330'),

-- ── Complementos y Valores Agregados ──
('fijos', 'complementos', 'Complementos y Valores Agregados', 'Add-ons y servicios de soporte', 'Servicios adicionales, mantenimiento, larga distancia y funciones especiales.', 50, 'tabla',
'{
  "columnas": ["Código","Descripción","Alfa Code","Tecnología","Precio"],
  "filas": [
    {"codigo":"A801","descripcion":"BUS TELE ENTRY SERV (BMS ONLY)","alfa_code":"BTENTRY","tecnologia":"COBRE/VRAD","precio":19.99},
    {"codigo":"A802","descripcion":"GPON BUS TELE ENTRY SERV (BMS ONLY)","alfa_code":"G-BTENTRY","tecnologia":"GPON","precio":19.99},
    {"codigo":"A734","descripcion":"BUS REMOTE CALL FWD PR NUM 6M","alfa_code":"BRCFPR6","tecnologia":"COBRE/VRAD","precio":24.99},
    {"codigo":"A735","descripcion":"BUS REMOTE CALL FWD PR NUM 3M","alfa_code":"BRCFPR3","tecnologia":"COBRE/VRAD","precio":24.99},
    {"codigo":"A736","descripcion":"BUS REMOTE CALL FWD PR NUM NC","alfa_code":"BRCFPR0","tecnologia":"COBRE/VRAD","precio":24.99},
    {"codigo":"A761","descripcion":"GPON BUS REMOTE CALL FWD PR NUM 6M","alfa_code":"G-BRCFPR6","tecnologia":"GPON","precio":24.99},
    {"codigo":"A762","descripcion":"GPON BUS REMOTE CALL FWD PR NUM 3M","alfa_code":"G-BRCFPR3","tecnologia":"GPON","precio":24.99},
    {"codigo":"A763","descripcion":"GPON BUS REMOTE CALL FWD PR NUM NC","alfa_code":"G-BRCFPR0","tecnologia":"GPON","precio":24.99},
    {"codigo":"A737","descripcion":"BUS REMOTE CALL FWD US NUM 6M","alfa_code":"BRCFUS6","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"A738","descripcion":"BUS REMOTE CALL FWD US NUM 3M","alfa_code":"BRCFUS3","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"A739","descripcion":"BUS REMOTE CALL FWD US NUM NC","alfa_code":"BRCFUS0","tecnologia":"COBRE/VRAD","precio":29.99},
    {"codigo":"A798","descripcion":"GPON BUS REMOTE CALL FWD US NUM 6M","alfa_code":"G-BRCFUS6","tecnologia":"GPON","precio":29.99},
    {"codigo":"A799","descripcion":"GPON BUS REMOTE CALL FWD US NUM 3M","alfa_code":"G-BRCFUS3","tecnologia":"GPON","precio":29.99},
    {"codigo":"A800","descripcion":"GPON BUS REMOTE CALL FWD US NUM NC","alfa_code":"G-BRCFUS0","tecnologia":"GPON","precio":29.99},
    {"codigo":"REAKNG","descripcion":"REALITY KING","alfa_code":"-","tecnologia":"VRAD/GPON","precio":24.99},
    {"codigo":"7448","descripcion":"INCREMENTO UPLOAD 1 Mb","alfa_code":"INTUP1M","tecnologia":"COBRE/VRAD","precio":5.00},
    {"codigo":"3241","descripcion":"3 VERTICAL PACK: CID, 3WCALL, TRANSF","alfa_code":"3VERTPACK","tecnologia":"COBRE/VRAD","precio":5.00},
    {"codigo":"2266","descripcion":"CONTRATO DE MANTENIMIENTO","alfa_code":"BIWMCFTJK","tecnologia":"COBRE/VRAD","precio":5.00},
    {"codigo":"3256","descripcion":"CONTRATO DE MANTENIMIENTO GRATIS","alfa_code":"CONTMANOFF","tecnologia":"COBRE/VRAD","precio":0.00},
    {"codigo":"3229","descripcion":"200 MINUTOS LARGA DISTANCIA A US","alfa_code":"LDUS200PCK","tecnologia":"COBRE/VRAD","precio":4.99},
    {"codigo":"3228","descripcion":"HUNTING FEE (AL PILOTO)","alfa_code":"HUNTINFEE","tecnologia":"COBRE/VRAD","precio":9.99},
    {"codigo":"6955","descripcion":"BUS VOICE MAIL","alfa_code":"BVMAIL","tecnologia":"COBRE/VRAD","precio":4.99},
    {"codigo":"9924","descripcion":"VOICE MAIL MAX DSL PLUS COMBO","alfa_code":"VMBUNDLE","tecnologia":"COBRE/VRAD","precio":0.00},
    {"codigo":"3240","descripcion":"LLAMADAS GRATIS DE FIJO A MOVIL CLARO","alfa_code":"FIX2CEL","tecnologia":"COBRE/VRAD","precio":5.00},
    {"codigo":"7242","descripcion":"GPON BUS 3 VERTICAL PACK","alfa_code":"G-BPK3VERT","tecnologia":"GPON","precio":5.00},
    {"codigo":"7243","descripcion":"GPON BUS LINE MAINTENANCE","alfa_code":"G-BLNEMANT","tecnologia":"GPON","precio":5.00},
    {"codigo":"7244","descripcion":"GPON BUS LINE MAINTENANCE OFF","alfa_code":"G-BMANTOFF","tecnologia":"GPON","precio":0.00},
    {"codigo":"7245","descripcion":"GPON BUS 200 MNTS LD US","alfa_code":"G-BLDUS200","tecnologia":"GPON","precio":4.99},
    {"codigo":"7246","descripcion":"GPON BUS HUNTING","alfa_code":"G-BHUNTING","tecnologia":"GPON","precio":9.99},
    {"codigo":"7141","descripcion":"GPON BUS VOICE MAIL","alfa_code":"G-BVMAIL","tecnologia":"GPON","precio":4.99},
    {"codigo":"7142","descripcion":"GPON BUS FREE VOICE MAIL","alfa_code":"G-BVMFREE","tecnologia":"GPON","precio":0.00}
  ]
}',
'LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS @2026(15)-260330')

ON CONFLICT (pagina, seccion_key) DO UPDATE SET
  titulo       = EXCLUDED.titulo,
  subtitulo    = EXCLUDED.subtitulo,
  descripcion  = EXCLUDED.descripcion,
  orden        = EXCLUDED.orden,
  tipo         = EXCLUDED.tipo,
  contenido    = EXCLUDED.contenido,
  boletin_ref  = EXCLUDED.boletin_ref,
  updated_at   = NOW();

-- ═══════════════════════════════════════════════════════
-- PÁGINA: PLANES MÓVILES
-- Fuente: Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv.pdf
-- ═══════════════════════════════════════════════════════

INSERT INTO planes_modulos (pagina, seccion_key, titulo, subtitulo, descripcion, orden, tipo, contenido, boletin_ref)
VALUES
('moviles', 'business_red_plus', 'Business Red PLUS', 'BREDP1–BREDP10 · Hotspot 15GB', 'Plan multilíneas Business Red PLUS. Hasta 10 líneas. AutoPay -$10/línea. Disponible en Pospago y Financiamiento.', 10, 'multilinea',
'{
  "max_lineas": 10,
  "autopay_descuento": 10,
  "hotspot": "15GB PUJ",
  "disponible": ["Pospago","Financiamiento"],
  "dispositivos": ["Smartphones","Tablets","Módems Banda Ancha"],
  "nota": "Mismo precio siempre. No mezclar con otros multilíneas en el mismo BAN.",
  "lineas": [
    {"linea":1,"codigo":"BREDP1","precio":65},
    {"linea":2,"codigo":"BREDP2","precio":45},
    {"linea":3,"codigo":"BREDP3","precio":20},
    {"linea":4,"codigo":"BREDP4","precio":30},
    {"linea":5,"codigo":"BREDP5","precio":15},
    {"linea":6,"codigo":"BREDP6","precio":35},
    {"linea":7,"codigo":"BREDP7","precio":35},
    {"linea":8,"codigo":"BREDP8","precio":35},
    {"linea":9,"codigo":"BREDP9","precio":35},
    {"linea":10,"codigo":"BREDP10","precio":35}
  ]
}',
'Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv'),

('moviles', 'business_red_extreme', 'Business Red EXTREME', 'BREDE1–BREDE10 · Hotspot 50GB', 'Plan multilíneas Business Red EXTREME. Hasta 10 líneas. AutoPay -$10/línea. Hotspot 50GB PUJ.', 20, 'multilinea',
'{
  "max_lineas": 10,
  "autopay_descuento": 10,
  "hotspot": "50GB PUJ",
  "disponible": ["Pospago","Financiamiento"],
  "dispositivos": ["Smartphones","Tablets","Módems Banda Ancha"],
  "nota": "Mismo precio siempre. No mezclar con otros multilíneas en el mismo BAN.",
  "lineas": [
    {"linea":1,"codigo":"BREDE1","precio":75},
    {"linea":2,"codigo":"BREDE2","precio":45},
    {"linea":3,"codigo":"BREDE3","precio":15},
    {"linea":4,"codigo":"BREDE4","precio":35},
    {"linea":5,"codigo":"BREDE5","precio":30},
    {"linea":6,"codigo":"BREDE6","precio":40},
    {"linea":7,"codigo":"BREDE7","precio":40},
    {"linea":8,"codigo":"BREDE8","precio":40},
    {"linea":9,"codigo":"BREDE9","precio":40},
    {"linea":10,"codigo":"BREDE10","precio":40}
  ]
}',
'Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv'),

('moviles', 'business_red_supreme', 'Business Red SUPREME', 'BREDS1–BREDS10 · Hotspot 100GB', 'Plan multilíneas Business Red SUPREME. Hasta 10 líneas. AutoPay -$10/línea. Hotspot 100GB PUJ.', 30, 'multilinea',
'{
  "max_lineas": 10,
  "autopay_descuento": 10,
  "hotspot": "100GB PUJ",
  "disponible": ["Pospago","Financiamiento"],
  "dispositivos": ["Smartphones","Tablets","Módems Banda Ancha"],
  "nota": "Mismo precio siempre. No mezclar con otros multilíneas en el mismo BAN.",
  "lineas": [
    {"linea":1,"codigo":"BREDS1","precio":95},
    {"linea":2,"codigo":"BREDS2","precio":75},
    {"linea":3,"codigo":"BREDS3","precio":40},
    {"linea":4,"codigo":"BREDS4","precio":30},
    {"linea":5,"codigo":"BREDS5","precio":35},
    {"linea":6,"codigo":"BREDS6","precio":25},
    {"linea":7,"codigo":"BREDS7","precio":50},
    {"linea":8,"codigo":"BREDS8","precio":50},
    {"linea":9,"codigo":"BREDS9","precio":50},
    {"linea":10,"codigo":"BREDS10","precio":50}
  ]
}',
'Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv'),

('moviles', 'business_red_sin_fronteras', 'Business Red SIN FRONTERAS', 'BREDSF1–BREDSF10 · Hotspot 100GB · 18+ Países', 'Plan multilíneas Business Red SIN FRONTERAS. Cobertura PR + USA + México + Canadá + RD + 14 países AMX. Hasta 10 líneas.', 40, 'multilinea',
'{
  "max_lineas": 10,
  "autopay_descuento": 10,
  "hotspot": "100GB PUJ",
  "disponible": ["Pospago","Financiamiento"],
  "dispositivos": ["Smartphones","Tablets","Módems Banda Ancha"],
  "cobertura": ["PR","USA","México","Canadá","Rep. Dominicana","Argentina","Uruguay","Paraguay","Panamá","Guatemala","Nicaragua","Honduras","Costa Rica","Perú","Chile","Colombia","El Salvador","Brasil","Ecuador"],
  "nota": "Mismo precio siempre. No mezclar con otros multilíneas en el mismo BAN.",
  "lineas": [
    {"linea":1,"codigo":"BREDSF1","precio":100},
    {"linea":2,"codigo":"BREDSF2","precio":80},
    {"linea":3,"codigo":"BREDSF3","precio":45},
    {"linea":4,"codigo":"BREDSF4","precio":35},
    {"linea":5,"codigo":"BREDSF5","precio":40},
    {"linea":6,"codigo":"BREDSF6","precio":30},
    {"linea":7,"codigo":"BREDSF7","precio":55},
    {"linea":8,"codigo":"BREDSF8","precio":55},
    {"linea":9,"codigo":"BREDSF9","precio":55},
    {"linea":10,"codigo":"BREDSF10","precio":55}
  ]
}',
'Boletin Nuevos Planes Multilineas Business Red PYMES-SUB-240802-rv')

ON CONFLICT (pagina, seccion_key) DO UPDATE SET
  titulo       = EXCLUDED.titulo,
  subtitulo    = EXCLUDED.subtitulo,
  descripcion  = EXCLUDED.descripcion,
  orden        = EXCLUDED.orden,
  tipo         = EXCLUDED.tipo,
  contenido    = EXCLUDED.contenido,
  boletin_ref  = EXCLUDED.boletin_ref,
  updated_at   = NOW();

-- ═══════════════════════════════════════════════════════
-- PÁGINA: INALÁMBRICO / IoT
-- Fuente: Boletin INT Go, Claro Oficina y IoT 1al30junio2026- CORP.pdf
-- ═══════════════════════════════════════════════════════

INSERT INTO planes_modulos (pagina, seccion_key, titulo, subtitulo, descripcion, orden, tipo, contenido, vigencia_desde, vigencia_hasta, boletin_ref)
VALUES
('inalambrico', 'internet_on_the_go', 'Internet On The Go', 'Planes Solo y Convergente', 'Internet móvil portátil. Planes Solo (solo dispositivo) y Convergente (cliente con línea fija Claro).', 10, 'inalambrico',
'{
  "planes_solo": [
    {"nombre":"25GB","codigo":"BAIC009","precio":30,"datos":"25GB","velocidad_reducida":"2Mbps","equipo_gratis":"Franklin RT410 4G"},
    {"nombre":"75GB","codigo":"BAIC010","precio":40,"datos":"75GB","velocidad_reducida":"2Mbps","equipo_gratis":"Franklin RT410 4G"},
    {"nombre":"125GB","codigo":"BAIC011","precio":50,"datos":"125GB","velocidad_reducida":"2Mbps","equipo_gratis":"Franklin RG2100 5G"}
  ],
  "planes_convergente": [
    {"nombre":"50GB","codigo":"BAIL009D","precio":30,"datos":"50GB","velocidad_reducida":"2Mbps","nota":"Doble datos vs Solo"},
    {"nombre":"150GB","codigo":"BAIC012","precio":40,"datos":"150GB","velocidad_reducida":"2Mbps","nota":"Doble datos vs Solo"},
    {"nombre":"250GB","codigo":"BAIL011D","precio":50,"datos":"250GB","velocidad_reducida":"2Mbps","nota":"Doble datos vs Solo"}
  ],
  "backup": [
    {"nombre":"5GB Backup","codigo":"BAIC017","precio":9.99,"datos":"5GB","uso":"Fijo / Cloud Backup"},
    {"nombre":"10GB Backup","codigo":"BAIC018","precio":15,"datos":"10GB","uso":"Fijo / Cloud Backup"}
  ],
  "equipos": [
    {"nombre":"Franklin RT410 4G","costo":"Gratis desde $30/mes","byop":false},
    {"nombre":"Franklin RG2100 5G","costo":"Gratis en $50/mes","byop_precio":299.99}
  ]
}',
'2026-06-01','2026-06-30','Boletin INT Go, Claro Oficina y IoT 1al30junio2026- CORP'),

('inalambrico', 'claro_oficina', 'Claro Oficina (IFI)', 'Voz + Internet 30Mbps', 'Solución fija inalámbrica para oficinas. Incluye voz + internet 30Mbps. AutoPago -$5/mes.', 20, 'inalambrico',
'{
  "planes": [
    {
      "nombre":"Regular",
      "codigo":"HOCV003V",
      "precio":50,
      "precio_autopago":45,
      "datos":"150GB",
      "velocidad_reducida":"2Mbps",
      "internet":"30Mbps",
      "incluye":["Voz","Internet 30Mbps","150GB datos"]
    },
    {
      "nombre":"Convergente",
      "codigo":"HOCV003DV",
      "precio":50,
      "precio_autopago":45,
      "datos":"300GB",
      "velocidad_reducida":"2Mbps",
      "internet":"30Mbps",
      "incluye":["Voz","Internet 30Mbps","300GB datos"]
    }
  ],
  "equipos": [
    {"nombre":"PCD R402X","costo":"Gratis desde $30/mes"},
    {"nombre":"Franklin RT410","costo":"Gratis desde $30/mes"},
    {"nombre":"Franklin CG890 5G","costo":"Gratis en $50/mes"},
    {"nombre":"SC421","costo":"$29.99"}
  ],
  "nota": "AutoPago -$5 = $45/mes"
}',
'2026-06-01','2026-06-30','Boletin INT Go, Claro Oficina y IoT 1al30junio2026- CORP'),

('inalambrico', 'iot_telemetria', 'IoT / Telemetría', 'Machine-to-Machine · Solo PR', 'Planes de datos para dispositivos IoT y telemetría. Machine-to-machine, bloquea al agotar datos.', 30, 'iot',
'{
  "planes": [
    {"nombre":"100MB","codigo":"BAC100","precio":2.99,"datos":"100MB"},
    {"nombre":"250MB","codigo":"BAC250","precio":3.99,"datos":"250MB"},
    {"nombre":"500MB","codigo":"BAC500","precio":5.99,"datos":"500MB"},
    {"nombre":"1GB","codigo":"BAC1GB","precio":9.99,"datos":"1GB"}
  ],
  "notas": [
    "Solo disponible en Puerto Rico",
    "Conexión machine-to-machine únicamente",
    "Servicio se bloquea al agotar datos del mes",
    "SIM IoT: $4.99 c/u"
  ],
  "adicionales": [
    {"nombre":"APN Privado","precio":499.99,"tipo":"one-time"},
    {"nombre":"IP Estático","precio":0,"tipo":"sin costo adicional"}
  ]
}',
'2026-06-01','2026-06-30','Boletin INT Go, Claro Oficina y IoT 1al30junio2026- CORP')

ON CONFLICT (pagina, seccion_key) DO UPDATE SET
  titulo         = EXCLUDED.titulo,
  subtitulo      = EXCLUDED.subtitulo,
  descripcion    = EXCLUDED.descripcion,
  orden          = EXCLUDED.orden,
  tipo           = EXCLUDED.tipo,
  contenido      = EXCLUDED.contenido,
  vigencia_desde = EXCLUDED.vigencia_desde,
  vigencia_hasta = EXCLUDED.vigencia_hasta,
  boletin_ref    = EXCLUDED.boletin_ref,
  updated_at     = NOW();
