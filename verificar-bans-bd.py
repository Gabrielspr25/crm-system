import pandas as pd
import psycopg2

# Leer Excel
df = pd.read_excel(r'C:\Users\Gabriel\Documentos\Programas\VentasProui\elementos_extra\excels\final_UNIFICADO_CLIENTES_HERNAN_TIPO_BAN_FINAL_G_MINUS_3.xlsx')

# Conectar a BD
conn = psycopg2.connect(
    host='localhost',
    database='crm_pro',
    user='crm_user',
    password='CRM_Seguro_2025!'
)
cur = conn.cursor()

# Obtener BANs de la BD
cur.execute("SELECT DISTINCT ban_number FROM bans")
bans_bd = set([row[0] for row in cur.fetchall()])

print(f'📊 BANs en BD: {len(bans_bd)}')
print(f'📊 BANs en Excel: {df["BAN"].notna().sum()}')
print()

# Verificar si están en Excel
bans_excel = set(df['BAN'].dropna().astype(str).str.strip())

encontrados = bans_bd & bans_excel
no_encontrados = bans_bd - bans_excel

print(f'✅ BANs de BD que SÍ están en Excel: {len(encontrados)}')
print(f'❌ BANs de BD que NO están en Excel: {len(no_encontrados)}')

if no_encontrados:
    print(f'\n❌ Estos BANs NO están en el Excel:')
    for ban in no_encontrados:
        print(f'   - {ban}')

cur.close()
conn.close()
