import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? 'http://localhost:3000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'manifest.webmanifest'],
        // On utilise le manifest.webmanifest custom dans /public — pas celui généré.
        manifest: false,
        devOptions: {
          enabled: false, // SW désactivé en dev pour éviter les caches collants
          type: 'module',
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Ne pas mettre en cache les appels API (cookies-based auth, données live).
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts-stylesheets' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Avatars 42 — cache long.
              urlPattern: /^https:\/\/cdn\.intra\.42\.fr\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'avatars-42',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      proxy: {
        // Proxy /api/* during dev so cookies stay first-party on localhost:5173.
        '/api': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      target: 'esnext',
      sourcemap: true,
      outDir: 'dist',
    },
  };
});
