import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built game works from any folder on any static host.
  base: './',
  server: { port: 5273 },
  build: { chunkSizeWarningLimit: 2000 },
});
