-- Agrega campo "guia" al módulo internet_on_the_go
-- Perfil del cliente ideal para Internet On The Go
-- Re-ejecutable: usa jsonb_set para no pisar otros campos

UPDATE planes_modulos
SET contenido = jsonb_set(
  contenido,
  '{guia}',
  '[
    {
      "num": "1",
      "titulo": "Negocios que trabajan en la calle",
      "intro": "El cliente ideal de INTGO no está sentado en un escritorio todo el día. Su trabajo es visitar, inspeccionar, instalar, verificar, entregar, supervisar.",
      "puntos": [
        "Técnicos en ruta",
        "Equipos de field service",
        "Servicios de mantenimiento",
        "Seguridad privada en ronda",
        "Supervisores de obras"
      ],
      "cierre": "Estos necesitan un internet que viaje con ellos."
    },
    {
      "num": "2",
      "titulo": "Operaciones que cambian de lugar constantemente",
      "intro": "Si el negocio no opera siempre en el mismo sitio, INTGO hace sentido inmediato:",
      "puntos": [
        "Kioscos o carpas temporeras",
        "Eventos, ferias, activaciones",
        "Pop-up shops",
        "Equipos que montan / desmontan diariamente"
      ],
      "cierre": "Son clientes que requieren conexión flexible, no anclada a una dirección."
    },
    {
      "num": "3",
      "titulo": "Equipos de trabajo remoto que no pueden depender del Wi-Fi",
      "intro": "Cuando el empleado trabaja desde:",
      "puntos": [
        "el carro",
        "la carretera",
        "un café",
        "un cliente",
        "o cualquier punto del país"
      ],
      "cierre": "INTGO convierte cualquier lugar en estación de trabajo confiable."
    },
    {
      "num": "4",
      "titulo": "Empresas que necesitan conexión inmediata en tránsito",
      "intro": "No pueden esperar instalación ni coordinar citas. Necesitan internet ahora, desde donde estén.",
      "cierre": "Aquí es donde INTGO brilla: se enciende, se conecta y la operación sigue."
    },
    {
      "num": "5",
      "titulo": "Organizaciones con líneas dedicadas para tareas móviles",
      "intro": "Muchos negocios asignan INTGO a:",
      "puntos": [
        "Laptops en campo",
        "Tablets para inspecciones",
        "Procesos de inventario externo",
        "Sistemas móviles de levantamiento de datos"
      ],
      "cierre": "Este cliente busca control y autonomía en la calle, no internet para un local."
    },
    {
      "num": null,
      "titulo": "En resumen…",
      "intro": "El cliente perfecto para Internet On The Go es ese negocio cuya operación no vive en un sitio fijo. Trabajan en movimiento, dependen de la carretera, cambian de ubicación o atienden tareas fuera de la oficina.",
      "cita": "\"Mi trabajo no es en un escritorio, es donde me toque ir\" → Internet On The Go es su match perfecto."
    }
  ]'::jsonb,
  true
)
WHERE pagina = 'inalambrico' AND seccion_key = 'internet_on_the_go';

-- Verificar
SELECT seccion_key, jsonb_array_length(contenido->'guia') AS secciones_guia
FROM planes_modulos
WHERE seccion_key = 'internet_on_the_go';
