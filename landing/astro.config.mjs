import { defineConfig } from 'astro/config';

// `format: 'file'` emits flat .html files (e.g. dist/index.de.html)
// instead of nested directories, preserving the existing URL scheme.
export default defineConfig({
  build: {
    format: 'file',
  },
  compressHTML: true,
});
