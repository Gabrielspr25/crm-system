import pandas as pd
import os

os.chdir(r'C:\Users\Gabriel\Documentos\Programas\VentasProui\elementos_extra\excels')

files = [
    'final UNIFICADO_CLIENTES_HERNAN.xlsx',
    'final_UNIFICADO_CLIENTES_HERNAN_TIPO_BAN_FINAL_G_MINUS_3.xlsx'
]

for file in files:
    try:
        print(f'\n{"="*60}')
        print(f'📊 ARCHIVO: {file}')
        print(f'{"="*60}')
        
        df = pd.read_excel(file)
        
        print(f'Total filas: {len(df)}')
        print(f'Columnas: {list(df.columns)}')
        
        # Buscar columna de estado/status
        status_cols = [col for col in df.columns if 'status' in col.lower() or 'estado' in col.lower()]
        if status_cols:
            print(f'\n📋 Columna estado: {status_cols[0]}')
            print(df[status_cols[0]].value_counts())
        
        # Buscar columna BAN
        ban_cols = [col for col in df.columns if 'ban' in col.lower()]
        if ban_cols:
            print(f'\n🔢 Columna BAN: {ban_cols[0]}')
            print(f'Con BAN: {df[ban_cols[0]].notna().sum()}')
            print(f'Sin BAN: {df[ban_cols[0]].isna().sum()}')
        
        # Buscar columna empresa/cliente
        name_cols = [col for col in df.columns if 'cliente' in col.lower() or 'empresa' in col.lower() or 'name' in col.lower()]
        if name_cols:
            print(f'\n🏢 Columna nombre: {name_cols[0]}')
            print(f'Con nombre: {df[name_cols[0]].notna().sum()}')
            print(f'Sin nombre: {df[name_cols[0]].isna().sum()}')
            
        # Con BAN pero sin nombre
        if ban_cols and name_cols:
            con_ban_sin_nombre = ((df[ban_cols[0]].notna()) & (df[name_cols[0]].isna())).sum()
            print(f'\n⚠️  Con BAN pero SIN nombre: {con_ban_sin_nombre}')
        
    except Exception as e:
        print(f'❌ Error: {e}')
