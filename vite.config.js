import { defineConfig } from 'vite';

// SAHTEN_ONLINE=false npm run build → versión sin online (la UI de conexión queda deshabilitada). El formato .sahten es el mismo.
const ONLINE = process.env.SAHTEN_ONLINE !== 'false';

export default defineConfig({
  define: { __SAHTEN_ONLINE__: JSON.stringify(ONLINE) },
  // Rutas relativas: el build funciona abierto desde una carpeta (hosting estático, Tauri, file://)
  base: './',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 2500 },
  server: { port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.js'], testTimeout: 60000 },
});
