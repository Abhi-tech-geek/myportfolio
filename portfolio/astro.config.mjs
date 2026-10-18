import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://theabhinavsaxena.in',
  trailingSlash: 'never',
  build: { format: 'file' },
});
