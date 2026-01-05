import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { readFileSync } from "fs";

const timestamp = Date.now();
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Plugin para reemplazar __VERSION__ en HTML
const replaceVersionPlugin = () => {
  return {
    name: 'replace-version',
    transformIndexHtml(html: string) {
      return html
        .replace(/__VERSION__/g, version)
        .replace(/__BUILD_TIME__/g, timestamp.toString());
    }
  };
};

export default defineConfig({
  plugins: [react(), cloudflare(), replaceVersionPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    },
    watch: {
      usePolling: true,
      interval: 100
    },
  },
  build: {
    rollupOptions: {
      output: {
        // HASH ÚNICO POR BUILD - IMPOSIBLE DE CACHEAR
        entryFileNames: `assets/[name]-${timestamp}-[hash].js`,
        chunkFileNames: `assets/[name]-${timestamp}-[hash].js`,
        assetFileNames: `assets/[name]-${timestamp}-[hash].[ext]`,
        manualChunks: undefined
      }
    },
    sourcemap: true,
    minify: 'terser',
    emptyOutDir: true,
    // FORZAR rebuild completo
    target: 'esnext',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    force: true,
    entries: ['src/react-app/main.tsx'],
  },
  clearScreen: false,
  // Variable global única
  define: {
    __BUILD_TIME__: JSON.stringify(timestamp),
  },
});
