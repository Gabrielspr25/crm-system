import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Para permitir acceso externo
    open: false, // No abrir automáticamente en producción
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://crmp.ss-group.cloud'
          : 'http://localhost:3001',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  base: '/'
})
