import pandas as pd
import json

# Leer Excel
file_path = "LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx"
df = pd.read_excel(file_path, header=None)

plans = []
current_tech = "GENERAL"

for i, row in df.iterrows():
    try:
        if pd.notna(row[1]) and isinstance(row[1], str):
            if "COBRE" in row[1].upper() or "VRAD" in row[1].upper():
                current_tech = "COBRE"
            elif "GPON" in row[1].upper():
                current_tech = "GPON"
        
        if pd.notna(row[1]) and isinstance(row[1], str) and len(row[1]) <= 6:
            code = str(row[1]).strip()
            if code and not code.lower() in ['código', 'codigo', 'cobre', 'gpon', 'cobre/vrad'] and (code[0].isalpha() or code[0].isdigit()) and len(code) >= 3:
                desc = str(row[3]) if pd.notna(row[3]) else ""
                if desc.lower() in ['planes', 'descripción', 'nan']:
                    continue
                    
                price = float(row[5]) if pd.notna(row[5]) and str(row[5]).replace('.','').replace(',','').isdigit() else 0
                alfa = str(row[7]) if pd.notna(row[7]) and row[7] != 'nan' else ""
                
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
                
                desc_upper = desc.upper()
                if "VERTICAL" in desc_upper or "LINEA" in desc_upper or "CONTRATO" in desc_upper:
                    category = "TV"
                elif "3PLAY" in desc_upper or "3 PLAY" in desc_upper:
                    category = "3PLAY"
                elif "2PLAY" in desc_upper or "2 PLAY" in desc_upper:
                    category = "2PLAY"
                elif "BUS" in desc_upper or "BMS" in desc_upper or "BML" in desc_upper or "ILIM" in desc_upper or "PRUS" in desc_upper or "PR " in desc_upper:
                    category = "1PLAY"
                elif "MOVIL" in desc_upper or "MÓVIL" in desc_upper or "GB" in desc_upper or "CELULAR" in desc_upper:
                    category = "MOVIL"
                elif "MODEM" in desc_upper or "BANDA ANCHA" in desc_upper:
                    category = "BANDA_ANCHA"
                else:
                    category = "GENERAL"
                
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
        continue

# Leer HTML template
with open('planes_claro.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Inyectar datos
plans_json = json.dumps(plans, ensure_ascii=False, indent=2)
html = html.replace('PLANS_DATA_PLACEHOLDER', plans_json)

# Guardar HTML final
with open('planes_claro_final.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"✅ HTML generado: planes_claro_final.html ({len(plans)} planes)")
print("\n📊 Categorías:")
from collections import Counter
cats = Counter([p['category'] for p in plans])
for cat, count in sorted(cats.items()):
    print(f"  {cat}: {count} planes")
