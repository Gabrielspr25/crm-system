import pandas as pd
import psycopg2
from psycopg2 import sql

# Conexión BD
conn = psycopg2.connect(
    host='localhost',
    database='crm_pro',
    user='crm_user',
    password='CRM_Seguro_2025!'
)
conn.autocommit = False
cur = conn.cursor()

# Leer Excel
print('📥 Leyendo Excel...')
df = pd.read_excel(r'C:\Users\Gabriel\Documentos\Programas\VentasProui\elementos_extra\excels\final_UNIFICADO_CLIENTES_HERNAN_TIPO_BAN_FINAL_G_MINUS_3.xlsx')

# Filtrar solo activas y suspendidas
df_activas = df[df['STATUS'].isin(['A', 'S'])].copy()
print(f'✅ Total líneas activas+suspendidas: {len(df_activas)}\n')

created = 0
updated = 0
errors = []

try:
    for idx, row in df_activas.iterrows():
        if idx % 100 == 0:
            print(f'⏳ Procesando {idx}/{len(df_activas)}...')
        
        try:
            ban_num = str(row['BAN']).strip() if pd.notna(row['BAN']) else None
            sub_num = str(row['SUB']).strip() if pd.notna(row['SUB']) else None
            
            if not ban_num or not sub_num:
                continue
            
            # Nombre y empresa (respetar vacíos)
            nombre = row['Nombre'] if pd.notna(row['Nombre']) and str(row['Nombre']).strip() else None
            apellido = row['Apellido'] if pd.notna(row['Apellido']) and str(row['Apellido']).strip() else None
            razon_social = row['Razon Social'] if pd.notna(row['Razon Social']) and str(row['Razon Social']).strip() else None
            
            # Construir nombre completo solo si hay datos
            name_final = None
            if nombre and apellido:
                name_final = f"{nombre} {apellido}"
            elif nombre:
                name_final = nombre
            
            # Si no hay ni nombre ni razón social, usar BAN como nombre
            if not name_final:
                name_final = f"Cliente BAN {ban_num}"
            if not razon_social:
                razon_social = f"Empresa BAN {ban_num}"
            
            # 1. Buscar o crear cliente por BAN
            cur.execute("SELECT id FROM bans WHERE number = %s", (ban_num,))
            ban_exists = cur.fetchone()
            
            if ban_exists:
                # Ya existe el BAN, obtener cliente
                cur.execute("SELECT client_id FROM bans WHERE number = %s", (ban_num,))
                client_id = cur.fetchone()[0]
                
                # Actualizar cliente si tiene datos nuevos
                if name_final or razon_social:
                    cur.execute("""
                        UPDATE clients 
                        SET name = COALESCE(%s, name),
                            company = COALESCE(%s, company),
                            updated_at = NOW()
                        WHERE id = %s
                    """, (name_final, razon_social, client_id))
                updated += 1
            else:
                # Crear nuevo cliente
                cur.execute("""
                    INSERT INTO clients (name, company, created_at, updated_at)
                    VALUES (%s, %s, NOW(), NOW())
                    RETURNING id
                """, (name_final, razon_social))
                client_id = cur.fetchone()[0]
                
                # Crear BAN
                cur.execute("""
                    INSERT INTO bans (client_id, number, status, created_at)
                    VALUES (%s, %s, 'activo', NOW())
                    RETURNING id
                """, (client_id, ban_num))
                ban_id = cur.fetchone()[0]
                
                # Crear suscriptor
                cur.execute("""
                    INSERT INTO subscribers (ban_id, phone_number, status, created_at)
                    VALUES (%s, %s, 'activo', NOW())
                """, (ban_id, sub_num))
                
                created += 1
        
        except Exception as e:
            errors.append(f'Fila {idx}: {str(e)}')
            continue
    
    # Commit
    conn.commit()
    print(f'\n✅ Importación completada!')
    print(f'   Creados: {created}')
    print(f'   Actualizados: {updated}')
    print(f'   Errores: {len(errors)}')
    
    if errors[:5]:
        print('\n❌ Primeros errores:')
        for err in errors[:5]:
            print(f'   {err}')

except Exception as e:
    conn.rollback()
    print(f'❌ Error fatal: {e}')

finally:
    cur.close()
    conn.close()
