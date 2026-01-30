# Estilos y Componentes Visuales VentasPro CRM

## Framework y Base
- **Framework CSS:** Tailwind CSS
  - Configuración en `src/react-app/index.css`:
    - `@tailwind base;`
    - `@tailwind components;`
    - `@tailwind utilities;`
- **Fuente principal:**
  - `font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;`
  - Definido en `index.css` y aplicado globalmente.

## Iconografía
- **Librería:** [lucide-react](https://lucide.dev/)
- **Uso:**
  - Íconos en tarjetas, botones, menús, alertas, etc.
  - Ejemplo: `<DollarSign className="w-8 h-8 text-green-400" />`

## Tarjetas y Paneles
- **Clases principales:**
  - `bg-slate-50`, `bg-slate-950`, `rounded-xl`, `shadow-2xl`, `border`, `p-4`, `min-h-screen`
  - **Dark mode:**
    - `dark:bg-slate-950`, `dark:text-slate-200`, `dark:border-slate-700`
- **Ejemplo de tarjeta resumen:**
  ```jsx
  <div className="bg-blue-500 rounded-xl shadow-lg p-6 text-white flex items-center gap-4">
    <DollarSign className="w-8 h-8" />
    <div>
      <div className="text-lg font-bold">Ganancia Empresa</div>
      <div className="text-2xl">$1,000.00</div>
    </div>
  </div>
  ```

## Botones
- **Clases comunes:**
  - `bg-blue-500`, `bg-green-500`, `rounded`, `px-4`, `py-2`, `hover:bg-blue-600`, `text-white`, `font-semibold`
- **Ejemplo:**
  ```jsx
  <button className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded shadow">
    Guardar
  </button>
  ```

## Badges y Estados
- **Colores contextuales:**
  - Pendiente: `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`
  - Completado: `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`
  - Cancelado: `bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400`
- **Ejemplo:**
  ```jsx
  <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
    Completado
  </span>
  ```

## Tablas y Listas
- **Encabezados:**
  - `text-xs`, `font-medium`, `uppercase`, `tracking-wider`, `bg-gray-800`, `border-gray-700`
- **Filas:**
  - `bg-slate-50`, `dark:bg-slate-900`, `hover:bg-slate-100`, `border-b`
- **Ejemplo:**
  ```jsx
  <table className="min-w-full divide-y divide-gray-700">
    <thead className="bg-gray-800">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
        ...
      </tr>
    </thead>
    <tbody className="bg-slate-50 dark:bg-slate-900 divide-y divide-gray-700">
      <tr>
        <td className="px-4 py-2">FERRETERIA COMERCIAL</td>
        ...
      </tr>
    </tbody>
  </table>
  ```

## Animaciones y Alertas
- **Animaciones:**
  - `animate-pulse` para notificaciones y alertas temporales.
- **Alertas:**
  - `bg-red-500 text-white p-3 text-center font-semibold`
  - `fixed top-0 left-0 right-0 z-[100]`

## Avatares y Tarjetas de Usuario
- **Avatares:**
  - `rounded-full`, `bg-slate-200`, `w-10 h-10`, `flex items-center justify-center`
- **Tarjeta de usuario:**
  ```jsx
  <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-lg">
    <div className="rounded-full bg-slate-200 w-10 h-10 flex items-center justify-center font-bold text-slate-700">
      G
    </div>
    <div>
      <div className="font-semibold text-white">Gabriel</div>
      <div className="text-xs text-green-400">% Comisión: 30.00%</div>
    </div>
  </div>
  ```

## Otros detalles
- **Inputs y formularios:**
  - `bg-slate-100`, `dark:bg-slate-800`, `rounded`, `border`, `px-3`, `py-2`, `focus:outline-none`, `focus:ring-2`, `focus:ring-blue-500`
- **Scrollbars:**
  - Personalizados con clases Tailwind y/o CSS nativo.
- **Responsive:**
  - Uso de `flex`, `grid`, `gap`, `w-full`, `max-w-4xl`, etc.

---

> Todos los estilos siguen la convención de Tailwind CSS, con soporte para dark mode y responsividad. Los íconos y tarjetas usan lucide-react y clases utilitarias para mantener un diseño moderno y consistente.
