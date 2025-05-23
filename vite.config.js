// vite.config.js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',            // make all asset paths relative
  plugins: [ viteSingleFile() ],
  build: {
    target: 'esnext',     // Three.js often ships modern syntax
    minify: 'terser',     // optional, but produces a smaller bundle
  }
});
