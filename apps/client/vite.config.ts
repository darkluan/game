import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Use the core's TypeScript source directly so it hot-reloads without a build step.
      '@game/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
});
