import { defineConfig } from 'astro/config';
import { createHash } from 'node:crypto';
import { themeInit } from './src/lib/theme-init.mjs';

// The pre-paint theme script is `is:inline`, which Astro does not hash itself.
const themeInitHash = `sha256-${createHash('sha256').update(themeInit).digest('base64')}`;

export default defineConfig({
  site: 'https://theabhinavsaxena.in',
  trailingSlash: 'never',
  build: { format: 'file' },
  markdown: { syntaxHighlight: false },
  security: {
    // Content Security Policy: Astro hashes every script/style it emits, so only our own
    // code can run. Everything else is locked to this origin.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: { hashes: [themeInitHash] },
      styleDirective: {
        // inline style="" attributes carry per-card colors and view-transition names
        resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }],
      },
    },
  },
});
