import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

/** Figma's plugin iframe is most reliable with a classic <script> at the end of <body>. */
function classicScript(): Plugin {
  return {
    name: 'figma-classic-script',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type !== 'asset' || !f.fileName.endsWith('.html')) continue;
        let html = String(f.source);
        const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) continue;
        html = html.replace(m[0], '');
        html = html.replace('</body>', () => `<script>${m[1]}</script>\n</body>`);
        f.source = html;
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: resolve(__dirname, 'src/ui'),
  plugins: [react(), viteSingleFile(), classicScript()],
  define: {
    __DEV__: JSON.stringify(mode === 'development'),
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    __VERSION__: JSON.stringify(pkg.version),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')),
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    target: 'es2019',
    modulePreload: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/ui.html'),
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
}));
