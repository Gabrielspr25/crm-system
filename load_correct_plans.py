import pandas as pd

# Leer Excel completo
df = pd.read_excel('LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx', header=None)

def safe_float(val):
    if pd.isna(val) or str(val).strip() == '-' or str(val).strip() == '':
        return 0
    try:
        return float(val)
    except:
        return 0

plans = []

# Filas 3-14: MEDIDOS
for i in range(2, 14):
    row = df.iloc[i]
    if pd.notna(row[1]):
        plans.append({
            'code': str(row[1]),
            'description': str(row[3]) if pd.notna(row[3]) else '',
            'price': safe_float(row[5]),
            'alfa_code': str(row[7]) if pd.notna(row[7]) else '',
            'category': 'MEDIDOS',
            'technology': 'COBRE',
            'inst_0m': safe_float(row[9]),
            'inst_12m': safe_float(row[11]),
            'inst_24m': safe_float(row[13]),
            'act_0m': safe_float(row[15]),
            'act_12m': safe_float(row[17]),
            'act_24m': safe_float(row[19]),
            'penalty': safe_float(row[21])
        })

# Filas 15-66: 1PLAY (Ilimitados)
for i in range(17, 66):
    row = df.iloc[i]
    if pd.notna(row[1]) and str(row[1]).strip() != '':
        plans.append({
            'code': str(row[1]),
            'description': str(row[3]) if pd.notna(row[3]) else '',
            'price': safe_float(row[5]),
            'alfa_code': str(row[7]) if pd.notna(row[7]) else '',
            'category': 'FIJO',
            'technology': 'COBRE',
            'inst_0m': safe_float(row[9]),
            'inst_12m': safe_float(row[11]),
            'inst_24m': safe_float(row[13]),
            'act_0m': safe_float(row[15]),
            'act_12m': safe_float(row[17]),
            'act_24m': safe_float(row[19]),
            'penalty': safe_float(row[21])
        })

# Filas 69-108: 1PLAY (COBRE/GPON)
for i in range(70, 108):
    row = df.iloc[i]
    if pd.notna(row[1]) and str(row[1]).strip() != '':
        tech = 'GPON' if 'GPON' in str(row[3]).upper() else 'COBRE'
        plans.append({
            'code': str(row[1]),
            'description': str(row[3]) if pd.notna(row[3]) else '',
            'price': safe_float(row[5]),
            'alfa_code': str(row[7]) if pd.notna(row[7]) else '',
            'category': 'FIJO',
            'technology': tech,
            'inst_0m': safe_float(row[9]),
            'inst_12m': safe_float(row[11]),
            'inst_24m': safe_float(row[13]),
            'act_0m': safe_float(row[15]),
            'act_12m': safe_float(row[17]),
            'act_24m': safe_float(row[19]),
            'penalty': safe_float(row[21])
        })

# Filas 111-120: TV y Complementos
for i in range(111, 121):
    row = df.iloc[i]
    if pd.notna(row[1]) and str(row[1]).strip() != '':
        plans.append({
            'code': str(row[1]),
            'description': str(row[3]) if pd.notna(row[3]) else '',
            'price': safe_float(row[5]),
            'alfa_code': str(row[7]) if pd.notna(row[7]) else '',
            'category': 'TV',
            'technology': 'COBRE',
            'inst_0m': safe_float(row[9]),
            'inst_12m': safe_float(row[11]),
            'inst_24m': safe_float(row[13]),
            'act_0m': safe_float(row[15]),
            'act_12m': safe_float(row[17]),
            'act_24m': safe_float(row[19]),
            'penalty': safe_float(row[21])
        })

# Generar SQL
sql = ""
for p in plans:
    name = p['description'][:200] if p['description'] else f"Plan {p['code']}"
    sql += f"""INSERT INTO plans (category_id, name, code, alpha_code, description, price, technology, installation_0m, installation_12m, installation_24m, activation_0m, activation_12m, activation_24m, penalty, is_active) VALUES ((SELECT id FROM plan_categories WHERE code = '{p['category']}'), '{name.replace("'", "''")}', '{p['code']}', '{p['alfa_code']}', '{p['description'].replace("'", "''")}', {p['price']}, '{p['technology']}', {p['inst_0m']}, {p['inst_12m']}, {p['inst_24m']}, {p['act_0m']}, {p['act_12m']}, {p['act_24m']}, {p['penalty']}, true);
"""

with open('load_plans_correct.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"✅ {len(plans)} planes generados")
from collections import Counter
cats = Counter([p['category'] for p in plans])
for cat, count in sorted(cats.items()):
    print(f"  {cat}: {count}")
