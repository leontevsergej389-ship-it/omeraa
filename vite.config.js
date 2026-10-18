import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = `http://localhost:${process.env.PORT || 3001}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Фронтенд и API живут на разных портах только в разработке — Vite проксирует запросы на Node-сервер.
    proxy: {
      '/api': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
