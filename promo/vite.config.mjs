import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: here,
  base: './',
  logLevel: 'warn',
  build: {
    outDir: path.join(here, 'out', 'css'),
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { input: path.join(here, 'app-css.js') },
  },
});
