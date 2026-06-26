import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Configuración de Vite para la app de Cruces de Inventario.
 *
 * - React + Tailwind CSS v4 como plugins de build.
 * - Alias '@' apuntando a la raíz del proyecto, para imports absolutos.
 *
 * La app no usa variables de entorno: el origen de datos está centralizado
 * en `src/config.ts`. Si en el futuro se externaliza esa URL, puede leerse
 * aquí mediante `loadEnv`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
