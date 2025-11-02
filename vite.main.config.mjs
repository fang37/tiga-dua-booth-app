import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    build: {
    rollupOptions: {
      external: ['better-sqlite3', 'sharp', '@google-cloud/local-auth', 'node-printer'],
    },
  },
});
