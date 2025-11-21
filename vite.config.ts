import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    allowedHosts: true,
    hmr: {
      overlay: true,
      // Forzar recarga completa en lugar de HMR parcial
      clientPort: 5173,
    },
    // Deshabilitar cache en desarrollo
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    // Generar nuevos hashes en cada build
    rollupOptions: {
      output: {
        // Forzar nuevos nombres de archivo
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    force: true,
    // Invalidar cache de dependencias
    entries: ['src/react-app/main.tsx'],
  },
  // Configuración adicional para evitar cache
  clearScreen: false,
});
