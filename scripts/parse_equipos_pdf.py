#!/usr/bin/env python3
"""
parse_equipos_pdf.py
Extrae la tabla de precios de equipos del boletín Inalámbrico/Claro Hogar.
Uso: python3 parse_equipos_pdf.py <ruta_pdf>
Salida: JSON estructurado por stdout (compatible con contenido de planes_modulos)
"""

import sys
import json
import re

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber no instalado. Correr: pip install pdfplumber"}))
    sys.exit(1)


# ── Columnas esperadas en la tabla principal ──────────────────────────────────
MAIN_COLS = [
    "item_code", "material_sap", "modelo",
    "precio_regular",
    "fin_12", "fin_24", "fin_30", "fin_36",
    "cle_09", "cle_14", "cle_19", "cle_29",
    "cle_39", "cle_49", "cle_59", "cle_69"
]

FIOF_COLS = [
    "item_code", "material_sap", "modelo",
    "precio_regular",
    "fin_12", "fin_24", "fin_30", "fin_36"
]

FIGU_COLS = [
    "item_code", "material_sap", "modelo",
    "precio_regular",
    "fin_24", "fin_36"
]

SECTION_KEYWORDS = {
    "claro_oficina": ["modems claro oficina", "claro oficina"],
    "internet_on_the_go": ["mifi", "internet on the go", "on the go"]
}


def parse_price(val):
    """Convierte '$99.99' o '99.99' o '' en float o None."""
    if val is None:
        return None
    s = str(val).strip().replace("$", "").replace(",", "")
    if not s or s == "-":
        return None
    try:
        f = float(s)
        return None if f == 0.0 else f  # $0.00 = no aplica
    except ValueError:
        return None


def row_to_equipo(cells, col_names):
    """Mapea una fila de celdas a un dict de equipo."""
    equipo = {}
    for i, col in enumerate(col_names):
        val = cells[i] if i < len(cells) else None
        if col in ("item_code", "material_sap", "modelo"):
            equipo[col] = str(val).strip() if val else None
        else:
            equipo[col] = parse_price(val)
    return equipo


def is_section_header(text, keywords):
    t = (text or "").lower()
    return any(kw in t for kw in keywords)


def is_price_row(cells):
    """True si la primera celda parece un Item Code (ej. '33578H')."""
    if not cells:
        return False
    first = str(cells[0] or "").strip()
    return bool(re.match(r"^\d{4,6}[A-Z]?$", first))


def extract_tables(pdf_path):
    result = {
        "secciones": [],
        "financiamiento_of": [],
        "financiamiento_gu": [],
        "ofertas_especiales": []
    }

    current_section = None
    current_section_key = None
    in_fiof = False
    in_figu = False
    notas_buffer = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            raw_text = page.extract_text() or ""

            # Detectar OFERTAS ESPECIALES en texto plano
            if "oferta" in raw_text.lower() and "especial" in raw_text.lower():
                result["ofertas_especiales"] = parse_ofertas_especiales(raw_text)

            for table in tables:
                if not table:
                    continue

                for row in table:
                    if not row or all(c is None or str(c).strip() == "" for c in row):
                        continue

                    row_text = " ".join(str(c or "") for c in row).strip()

                    # Detectar headers de sección
                    if is_section_header(row_text, SECTION_KEYWORDS["claro_oficina"]):
                        current_section_key = "claro_oficina"
                        current_section = {"key": "claro_oficina", "titulo": "Modems Claro Oficina", "equipos": []}
                        result["secciones"].append(current_section)
                        in_fiof = False
                        in_figu = False
                        continue

                    if is_section_header(row_text, SECTION_KEYWORDS["internet_on_the_go"]):
                        current_section_key = "internet_on_the_go"
                        current_section = {"key": "internet_on_the_go", "titulo": "MiFi's Internet On The Go", "equipos": []}
                        result["secciones"].append(current_section)
                        in_fiof = False
                        in_figu = False
                        continue

                    # Detectar bloques FIOF / FIGU por presencia de esos códigos en encabezado
                    if "fiof" in row_text.lower() and not is_price_row(row):
                        in_fiof = True
                        in_figu = False
                        current_section = None
                        continue

                    if "figu" in row_text.lower() and not is_price_row(row):
                        in_figu = True
                        in_fiof = False
                        current_section = None
                        continue

                    # Saltar filas de encabezado de columnas
                    if any(kw in row_text.lower() for kw in [
                        "item code", "material sap", "modelo", "dealer",
                        "fiup12", "fiof12", "figu24", "cle09"
                    ]):
                        continue

                    # Procesar fila de datos
                    if not is_price_row(row):
                        # Puede ser nota al final de tabla
                        notas_buffer.append(row_text)
                        continue

                    nota = notas_buffer[-1] if notas_buffer else None
                    notas_buffer = []

                    if in_figu:
                        eq = row_to_equipo(row, FIGU_COLS)
                        if nota:
                            eq["nota"] = nota
                        result["financiamiento_gu"].append(eq)

                    elif in_fiof:
                        eq = row_to_equipo(row, FIOF_COLS)
                        if nota:
                            eq["nota"] = nota
                        result["financiamiento_of"].append(eq)

                    elif current_section is not None:
                        eq = row_to_equipo(row, MAIN_COLS)
                        current_section["equipos"].append(eq)

    # Eliminar secciones vacías
    result["secciones"] = [s for s in result["secciones"] if s["equipos"]]

    return result


def parse_ofertas_especiales(text):
    """Extrae las ofertas especiales del texto plano del PDF."""
    ofertas = []
    lines = text.split("\n")
    current = None
    num = 0

    for line in lines:
        line = line.strip()
        # Detectar inicio de oferta numerada (1., 2., 3., 4.)
        m = re.match(r"^(\d)\.\s+(.+)", line)
        if m:
            if current:
                ofertas.append(current)
            num = int(m.group(1))
            current = {"num": str(num), "modelo": m.group(2).strip(), "detalles": []}
            continue

        # Detectar sub-item (a), b))
        m2 = re.match(r"^[a-d]\)\s+(.+)", line)
        if m2 and current:
            current["detalles"].append(m2.group(1).strip())
            continue

    if current:
        ofertas.append(current)

    return ofertas


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: python3 parse_equipos_pdf.py <ruta_pdf>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        data = extract_tables(pdf_path)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except FileNotFoundError:
        print(json.dumps({"error": f"Archivo no encontrado: {pdf_path}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
