import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const TSE_TARGET = 'https://resultados.tse.jus.br';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4321,
    host: '127.0.0.1',
    proxy: {
      '/api/tse': {
        target: TSE_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tse/, ''),
      },
    },
  },
  preview: {
    port: 4321,
    host: '127.0.0.1',
    proxy: {
      '/api/tse': {
        target: TSE_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tse/, ''),
      },
    },
  },
});
