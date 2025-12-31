import pandas as pd
import sys

# Leer Excel
file_path = "LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)(v.2)-240829 new 2024.xlsx"
df = pd.read_excel(file_path, header=None)

print(f"Total filas: {len(df)}")
print("\nPrimeras 20 filas:")
print(df.head(20).to_string())

print("\n\nColumnas por fila:")
for i in range(min(10, len(df))):
    print(f"Fila {i}: {len(df.iloc[i])} columnas - {list(df.iloc[i])}")
