import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Browsers refuse to load `<script type="module">` from file://, so the build
 * is emitted as a single classic script and the module/crossorigin attributes
 * are dropped. This lets `dist/index.html` work by double-clicking it, as well
 * as being served from GitHub Pages or `vite preview`.
 */
function classicScriptBuild(): Plugin {
  return {
    name: 'zapped:classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const scripts: string[] = [];
      const stripped = html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_m, src: string) => {
          scripts.push(`<script defer src="${src}"></script>`);
          return '';
        })
        .replace(/ crossorigin(="[^"]*")?/g, '');
      return stripped.replace('</body>', `${scripts.join('\n')}\n</body>`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [classicScriptBuild()],
  build: {
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
