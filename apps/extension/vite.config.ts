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
    port: 5173,
    strictPort: true,
    host: true, // Toujours nécessaire pour WSL
    cors: true, // <-- AJOUT : Autorise Chrome à lire les fichiers
    origin: 'http://localhost:5173', // <-- AJOUT : Indique à CRX où trouver les assets
    hmr: {
      port: 5173,
      host: 'localhost',
    },
  },
});