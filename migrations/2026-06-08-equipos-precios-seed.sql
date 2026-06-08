-- Seed: módulo equipos_precios_inalambrico
-- Tabla de precios de equipos para Claro Hogar e Internet On The Go
-- Re-ejecutable con ON CONFLICT UPDATE

INSERT INTO planes_modulos
  (pagina, seccion_key, titulo, subtitulo, descripcion, orden, activo, tipo, contenido, boletin_ref)
VALUES (
  'inalambrico',
  'equipos_precios_inalambrico',
  'Tabla de Precios — Equipos',
  'Claro Oficina · Internet On The Go',
  'Equipos y precios disponibles para planes Claro Hogar e Internet On The Go. Incluye financiamiento y ofertas especiales vigentes.',
  99,
  true,
  'equipos_precios',
  '{
    "secciones": [
      {
        "key": "claro_oficina",
        "titulo": "Modems Claro Oficina",
        "equipos": [
          {
            "item_code": "33578H",
            "material_sap": "7012893",
            "modelo": "PCD R402X Black Router - 4G",
            "precio_regular": 99.99,
            "fin_12": 8.33, "fin_24": 4.17, "fin_30": 3.33, "fin_36": 2.78,
            "cle_09": 99.99, "cle_14": 99.99, "cle_19": 0, "cle_29": 0,
            "cle_39": 0, "cle_49": 0, "cle_59": 0, "cle_69": 0
          },
          {
            "item_code": "33759H",
            "material_sap": "7013492",
            "modelo": "SENSE CONNECT SC421 ROUTER - 4G",
            "precio_regular": 149.99,
            "fin_12": 12.50, "fin_24": 6.25, "fin_30": 5.00, "fin_36": 4.17,
            "cle_09": null, "cle_14": null, "cle_19": null, "cle_29": null,
            "cle_39": null, "cle_49": null, "cle_59": null, "cle_69": null
          },
          {
            "item_code": "33348H",
            "material_sap": "7012279",
            "modelo": "Franklin JEXstream CG890 5G",
            "precio_regular": 249.99,
            "fin_12": 20.83, "fin_24": 10.42, "fin_30": 8.33, "fin_36": 6.94,
            "cle_09": 299.99, "cle_14": 299.99, "cle_19": 299.99, "cle_29": 299.99,
            "cle_39": 199.99, "cle_49": 99.99, "cle_59": 0, "cle_69": 0
          },
          {
            "item_code": "31642H",
            "material_sap": "7008216",
            "modelo": "Franklin R910 4G",
            "precio_regular": 139.99,
            "fin_12": 11.67, "fin_24": 5.83, "fin_30": 4.67, "fin_36": 3.89,
            "cle_09": 139.99, "cle_14": 139.99, "cle_19": 139.99, "cle_29": 0,
            "cle_39": 0, "cle_49": 0, "cle_59": 0, "cle_69": 0
          },
          {
            "item_code": "32042H",
            "material_sap": "7009082",
            "modelo": "NETGEAR MR1100 ROUTER/MIFI BLACK 5G",
            "precio_regular": 309.99,
            "fin_12": 25.83, "fin_24": 12.92, "fin_30": 10.33, "fin_36": 8.61,
            "cle_09": 309.99, "cle_14": 249.99, "cle_19": 229.99, "cle_29": 189.99,
            "cle_39": 149.99, "cle_49": 149.99, "cle_59": 69.99, "cle_69": 29.99
          }
        ]
      },
      {
        "key": "internet_on_the_go",
        "titulo": "MiFi''s Internet On The Go",
        "equipos": [
          {
            "item_code": "31670H",
            "material_sap": "7008217",
            "modelo": "FRANKLIN R717 MIFI 4G",
            "precio_regular": 41.99,
            "fin_12": 3.50, "fin_24": 1.75, "fin_30": 1.40, "fin_36": 1.17,
            "cle_09": 41.99, "cle_14": 41.99, "cle_19": 0, "cle_29": 0,
            "cle_39": 0, "cle_49": 0, "cle_59": 0, "cle_69": 0
          },
          {
            "item_code": "32788H",
            "material_sap": "7010844",
            "modelo": "FRANKLIN RT410 MIFI 4G",
            "precio_regular": 99.99,
            "fin_12": 8.33, "fin_24": 4.17, "fin_30": 3.33, "fin_36": 2.78,
            "cle_09": 99.99, "cle_14": 99.99, "cle_19": 41.99, "cle_29": 0,
            "cle_39": 0, "cle_49": 0, "cle_59": 0, "cle_69": 0
          },
          {
            "item_code": "32328H",
            "material_sap": "7009571",
            "modelo": "FRANKLIN RG1000 5G",
            "precio_regular": 399.99,
            "fin_12": 33.33, "fin_24": 16.67, "fin_30": 13.33, "fin_36": 11.11,
            "cle_09": 399.99, "cle_14": 399.99, "cle_19": 399.99, "cle_29": 299.99,
            "cle_39": 249.99, "cle_49": 199.99, "cle_59": 199.99, "cle_69": 199.99
          },
          {
            "item_code": "33556H",
            "material_sap": "7006669",
            "modelo": "Netgear M6 Pro 5G",
            "precio_regular": 599.99,
            "fin_12": 50.00, "fin_24": 25.00, "fin_30": 20.00, "fin_36": 16.67,
            "cle_09": null, "cle_14": null, "cle_19": null, "cle_29": null,
            "cle_39": null, "cle_49": null, "cle_59": null, "cle_69": null
          },
          {
            "item_code": "33638H",
            "material_sap": "7013126",
            "modelo": "Franklin JEXstream RG2100 5G",
            "precio_regular": 299.99,
            "fin_12": 25.00, "fin_24": 12.50, "fin_30": 10.00, "fin_36": 8.33,
            "cle_09": 299.99, "cle_14": 299.99, "cle_19": 299.99, "cle_29": 299.99,
            "cle_39": 139.99, "cle_49": 99.99, "cle_59": 99.99, "cle_69": 0
          }
        ]
      }
    ],
    "financiamiento_of": [
      {
        "item_code": "31670H", "material_sap": "7008217",
        "modelo": "FRANKLIN R717 MIFI 4G",
        "precio_regular": 41.99,
        "fin_12": 3.50, "fin_24": 1.75, "fin_30": 1.40, "fin_36": 1.17,
        "nota": null
      },
      {
        "item_code": "32788H", "material_sap": "7010844",
        "modelo": "FRANKLIN RT410 MIFI 4G",
        "precio_regular": 41.99,
        "fin_12": 3.50, "fin_24": 1.75, "fin_30": 1.40, "fin_36": 1.17,
        "nota": null
      },
      {
        "item_code": "31642H", "material_sap": "7008216",
        "modelo": "Franklin R910 4G",
        "precio_regular": 54.99,
        "fin_12": 4.58, "fin_24": 2.29, "fin_30": 1.83, "fin_36": 1.53,
        "nota": null
      },
      {
        "item_code": "32788H", "material_sap": "7010844",
        "modelo": "FRANKLIN RT410 MIFI",
        "precio_regular": 99.99,
        "fin_12": 8.33, "fin_24": 4.17, "fin_30": 3.33, "fin_36": 2.78,
        "nota": "Gratis si el plan es $30 o más utilizando este price code"
      }
    ],
    "financiamiento_gu": [
      {
        "item_code": "32788H", "material_sap": "7010844",
        "modelo": "FRANKLIN RT410 MIFI",
        "precio_regular": 41.99,
        "fin_24": 1.75, "fin_36": 1.17,
        "nota": "Oferta Convergente en planes menores de $30"
      }
    ],
    "ofertas_especiales": [
      {
        "num": "1",
        "modelo": "SenseConnect SC421",
        "detalles": [
          "Claro Hogar: $29.99 en financiamiento de 24 plazos en plan desde $30.00, paga $1.25 al mes."
        ]
      },
      {
        "num": "2",
        "modelo": "PCD R402X",
        "detalles": [
          "Claro Oficina: Gratis en financiamiento de 24 plazos en plan desde $30.00"
        ]
      },
      {
        "num": "3",
        "modelo": "Franklin RT 410",
        "detalles": [
          "Internet OnTheGo: Gratis en financiamiento de 24 plazos en plan desde $30.00 sólo para cliente convergente usando códigos FIOF.",
          "$41.99 en financiamiento de 24 ó 36 plazos en planes menores de $30.00 sólo para cliente convergente usando códigos FIGU."
        ]
      },
      {
        "num": "4",
        "modelo": "Franklin CG890",
        "detalles": [
          "Claro Oficina: Gratis en plan de $50 en financiamiento de 24 plazos."
        ]
      }
    ]
  }'::jsonb,
  'Boletín Inalámbrico 2026-06'
)
ON CONFLICT (pagina, seccion_key)
DO UPDATE SET
  contenido   = EXCLUDED.contenido,
  boletin_ref = EXCLUDED.boletin_ref,
  updated_at  = NOW();

-- Verificar
SELECT seccion_key, tipo,
       jsonb_array_length(contenido->'secciones') AS secciones,
       jsonb_array_length(contenido->'ofertas_especiales') AS ofertas
FROM planes_modulos
WHERE seccion_key = 'equipos_precios_inalambrico';
