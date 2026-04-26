# 📊 CHECKPOINT PANEL GENERAL – CRM (CUARTEL DE AGENTES)

## 🔒 Estado del sistema
**PRODUCCIÓN ESTABLE**

- Commit base: `ebb5840`
- Rango: `e32d541..ebb5840`
- Rama: `main` sincronizada con `origin/main`
- URL: https://crmp.ss-group.cloud/panel

---

## ✅ Validaciones técnicas

| Check | Resultado |
|---|---|
| npm run build | OK (36s) |
| Deploy | OK (PM2 pid 3423623, restart 142) |
| Agente sistema | 52/52, 0 fallos |
| Endpoints nuevos | ninguno |
| Backend modificado | ninguno |
| Schema modificado | ninguno |

---

## ⚙️ Reglas de arquitectura (OBLIGATORIAS)

- NO modificar backend sin aprobación explícita
- NO crear endpoints nuevos para este widget
- NO modificar schema
- Fuente oficial: `GET /api/agents/tasks`

---

## 👥 Comportamiento por rol

- **Vendedor**: solo ve su desempeño (filtro server-side).
- **Admin / Supervisor**: ve todos los vendedores + fila "Sin asignar".

---

## 📈 Lógica de desempeño

**Fórmula** (tal como vive en [Home.tsx](src/react-app/pages/Home.tsx) y se validó en producción):

```
pct = round( (done / total) * 100 )    cuando total > 0
pct = 0                                  cuando total = 0
```

**Reglas**:
- `done`: tareas con `status === 'done'`
- `pending`: tareas con `status === 'pending'`
- `total`: todas las tareas asignadas a ese vendedor (cualquier status)
- Si `total = 0` → **% no aplica** (se muestra `"—"` en UI)

---

## 🎨 Bandas de color

| Rango | Estado | Color |
|---|---|---|
| ≥ 70% | Alto desempeño | Verde (`emerald-300`) |
| 40%–69% | Medio | Ámbar (`amber-300`) |
| < 40% | Bajo desempeño | Rojo (`red-300`) |

---

## 📊 Ejemplo validado

| Vendedor | Total | Done | Pending | % |
|---|:---:|:---:|:---:|:---:|
| SP_X | 3 | 2 | 1 | 67% |
| SP_Y | 1 | 1 | 0 | 100% |

---

## ⚠️ Consideraciones

- El % es **indicador de ejecución**, no de ventas.
- Mide consistencia, no volumen.
- Detecta: baja disciplina, carga desbalanceada, tareas sin seguimiento.

---

## 🎯 Uso estratégico

- **Rojo** → priorizar coaching.
- **Ámbar** → mantener ritmo.
- **Verde** → escalar o asignar más carga.
