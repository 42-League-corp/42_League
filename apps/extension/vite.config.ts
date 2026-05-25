import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  server: {
    // The popup builds for Chrome — it never collides with the web app's port.
    port: 5180,
    strictPort: true,
    host: true,
  },
});
