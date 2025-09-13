import { defineConfig } from 'vite';
import { resolve } from 'path'; // <-- Add this import

// https://vitejs.dev/config
export default defineConfig({
  // Add the root property here
  root: resolve(__dirname, 'src/renderer'), 
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
    },
  },
});