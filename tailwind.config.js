/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#020617', // slate-950
        'secondary': '#0f172a', // slate-900
        'tertiary': '#1e293b', // slate-800
        'accent': '#10b981', // emerald-500
        'text-primary': '#f8fafc', // slate-50
        'text-secondary': '#94a3b8', // slate-400
        'border-primary': '#475569', // slate-600
      },
    },
  },
  plugins: [],
}