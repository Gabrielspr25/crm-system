import pandas as pd

# Leer Excel
df = pd.read_excel(r'C:\Users\Gabriel\Documentos\Programas\VentasProui\elementos_extra\excels\final_UNIFICADO_CLIENTES_HERNAN_TIPO_BAN_FINAL_G_MINUS_3.xlsx')

# BANs de ejemplo que vi en la imagen
bans_prueba = [
    '110068900',
    '314495100', 
    '315030100',
    '316415000',
    '317734000',
    '317983200',
    '319136300',
    '319288900',
    '319453100',
    '319889600',
    '374200110',
    '374565100'
]

print(f'📊 Total BANs en Excel: {len(df)}\n')
print('='*60)
print('Verificando BANs de la BD...')
print('='*60)

for ban in bans_prueba:
    existe = ban in df['BAN'].astype(str).values
    status = df[df['BAN'].astype(str) == ban]['STATUS'].values
    
    if existe and len(status) > 0:
        print(f'✅ {ban} - SÍ está en Excel - Status: {status[0]}')
    else:
        print(f'❌ {ban} - NO está en Excel')

# Contar total de coincidencias
bans_bd_en_excel = [ban for ban in bans_prueba if ban in df['BAN'].astype(str).values]
print(f'\n📊 Total verificados: {len(bans_prueba)}')
print(f'✅ Encontrados en Excel: {len(bans_bd_en_excel)} ({len(bans_bd_en_excel)/len(bans_prueba)*100:.1f}%)')
