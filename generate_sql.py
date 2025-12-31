import pandas as pd

# Leer Excel
file_path = "LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx"
df = pd.read_excel(file_path, header=None)

plans = []
current_tech = "GENERAL"

for i, row in df.iterrows():
    try:
        # Detectar tecnología
        if pd.notna(row[1]) and isinstance(row[1], str):
            if "COBRE" in row[1].upper() or "VRAD" in row[1].upper():
                current_tech = "COBRE"
            elif "GPON" in row[1].upper():
                current_tech = "GPON"
        
        # Detectar planes (tienen código en columna 1)
        if pd.notna(row[1]) and isinstance(row[1], str) and len(row[1]) <= 6:
            code = str(row[1]).strip()
            # Verificar que sea un código válido (letras y números, no palabras como "Código")
            if code and not code.lower() in ['código', 'codigo', 'cobre', 'gpon', 'cobre/vrad'] and (code[0].isalpha() or code[0].isdigit()) and len(code) >= 3:
                desc = str(row[3]) if pd.notna(row[3]) else ""
                
                # Skip si la descripción es un header
                if desc.lower() in ['planes', 'descripción', 'nan']:
                    continue
                    
                price = float(row[5]) if pd.notna(row[5]) and str(row[5]).replace('.','').replace(',','').isdigit() else 0
                alfa = str(row[7]) if pd.notna(row[7]) and row[7] != 'nan' else ""
                
                # Costos de instalación (manejar '-' y NaN)
                def safe_float(val):
                    if pd.isna(val) or str(val).strip() == '-' or str(val).strip() == '':
                        return 0
                    try:
                        return float(val)
                    except:
                        return 0
                
                inst_0m = safe_float(row[9])
                inst_12m = safe_float(row[11])
                inst_24m = safe_float(row[13])
                act_0m = safe_float(row[15])
                act_12m = safe_float(row[17])
                act_24m = safe_float(row[19])
                penalty = safe_float(row[21])
                
                # Detectar categoría - USAR CATEGORÍAS QUE EXISTEN EN LA DB
                desc_upper = desc.upper()
                # TV - Planes de televisión
                if "VERTICAL" in desc_upper or "LINEA" in desc_upper or "CONTRATO" in desc_upper:
                    category = "TV"
                # 3 Play - Internet + Voz + TV
                elif "3PLAY" in desc_upper or "3 PLAY" in desc_upper:
                    category = "3PLAY"
                # 2 Play - Internet + Voz  
                elif "2PLAY" in desc_upper or "2 PLAY" in desc_upper:
                    category = "2PLAY"
                # FIJO - Telefonía fija (BUS, BMS, BML, ILIM son planes de telefonía fija)
                elif "BUS" in desc_upper or "BMS" in desc_upper or "BML" in desc_upper or "ILIM" in desc_upper or "PRUS" in desc_upper or "PR " in desc_upper or "REMOTE" in desc_upper:
                    category = "FIJO"
                # Móvil - Planes celulares
                elif "MOVIL" in desc_upper or "MÓVIL" in desc_upper or "GB" in desc_upper or "CELULAR" in desc_upper:
                    category = "MOVIL"
                # INTERNET - Internet (si no es 2PLAY o 3PLAY)
                elif "MODEM" in desc_upper or "BANDA ANCHA" in desc_upper or "INTERNET" in desc_upper:
                    category = "INTERNET"
                else:
                    category = "FIJO"  # Default a FIJO en lugar de GENERAL
                
                plans.append({
                    'code': code,
                    'description': desc,
                    'price': price,
                    'alfa_code': alfa,
                    'category': category,
                    'technology': current_tech,
                    'inst_0m': inst_0m,
                    'inst_12m': inst_12m,
                    'inst_24m': inst_24m,
                    'act_0m': act_0m,
                    'act_12m': act_12m,
                    'act_24m': act_24m,
                    'penalty': penalty
                })
    except Exception as e:
        # Skip problematic rows
        continue

print(f"✅ Total planes encontrados: {len(plans)}")

# Generar SQL
sql = "-- Borrar planes existentes\nDELETE FROM plans;\n\n"
sql += "-- Insertar planes\n"

for p in plans:
    # Use description as name (required field)
    name = p['description'][:200] if p['description'] else f"Plan {p['code']}"
    
    sql += f"""INSERT INTO plans (category_id, name, code, alpha_code, description, price, technology, installation_0m, installation_12m, installation_24m, activation_0m, activation_12m, activation_24m, penalty, is_active) 
VALUES ((SELECT id FROM plan_categories WHERE code = '{p['category']}'), '{name.replace("'", "''")}', '{p['code']}', '{p['alfa_code']}', '{p['description'].replace("'", "''")}', {p['price']}, '{p['technology']}', {p['inst_0m']}, {p['inst_12m']}, {p['inst_24m']}, {p['act_0m']}, {p['act_12m']}, {p['act_24m']}, {p['penalty']}, true);
"""

# Guardar SQL
with open('load_plans.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"✅ SQL generado: load_plans.sql")
print(f"\n📊 Categorías:")
from collections import Counter
cats = Counter([p['category'] for p in plans])
for cat, count in sorted(cats.items()):
    print(f"  {cat}: {count} planes")

