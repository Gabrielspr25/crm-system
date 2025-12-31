import pandas as pd
import os

os.chdir(r'C:\Users\Gabriel\Documentos\Programas\VentasProui\elementos_extra\excels')

file = 'final_UNIFICADO_CLIENTES_HERNAN_TIPO_BAN_FINAL_G_MINUS_3.xlsx'

print(f'📊 Analizando: {file}\n')

df = pd.read_excel(file)

print(f'Total filas: {len(df)}')
print()

# Estadísticas de estado
print('='*60)
print('📋 ESTADO DE LÍNEAS')
print('='*60)
print(f"Activas (A): {(df['STATUS'] == 'A').sum()}")
print(f"Canceladas (C): {(df['STATUS'] == 'C').sum()}")
print(f"Suspendidas (S): {(df['STATUS'] == 'S').sum()}")
print()

# Las suspendidas NO son activas
activas_y_suspendidas = ((df['STATUS'] == 'A') | (df['STATUS'] == 'S')).sum()
print(f"✅ ACTIVAS + SUSPENDIDAS = {activas_y_suspendidas}")
print(f"❌ SOLO ACTIVAS (sin suspendidas) = {(df['STATUS'] == 'A').sum()}")
print()

# Con BAN y sin nombre de empresa
print('='*60)
print('🏢 ANÁLISIS DE NOMBRES')
print('='*60)

con_ban = df['BAN'].notna()
sin_razon_social = df['Razon Social'].isna() | (df['Razon Social'] == '')
sin_nombre = df['Nombre'].isna() | (df['Nombre'] == '')
sin_apellido = df['Apellido'].isna() | (df['Apellido'] == '')

con_ban_sin_razon = (con_ban & sin_razon_social).sum()
con_ban_sin_nombre_completo = (con_ban & sin_nombre & sin_apellido).sum()
con_ban_sin_nada = (con_ban & sin_razon_social & sin_nombre & sin_apellido).sum()

print(f"Con BAN: {con_ban.sum()}")
print(f"Con BAN pero SIN Razón Social: {con_ban_sin_razon}")
print(f"Con BAN pero SIN Nombre+Apellido: {con_ban_sin_nombre_completo}")
print(f"Con BAN pero SIN NADA (ni razón ni nombre): {con_ban_sin_nada}")
print()

# Total limpio para importar
importables = (con_ban & (df['STATUS'] == 'A')).sum()
print('='*60)
print(f"✅ TOTAL IMPORTABLES (Activas con BAN): {importables}")
print('='*60)
