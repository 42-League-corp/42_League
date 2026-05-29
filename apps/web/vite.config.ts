import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { execSync } from 'node:child_process';

// MAJOR.MINOR à bumper manuellement lors d'une refonte majeure.
// BUILD = nombre de commits git → s'incrémente automatiquement à chaque commit.
const RELEASE = '0.4';

function getGitVersion(): { version: string; date: string } {
  try {
    const build = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    const isoDate = execSync('git log -1 --format=%ci', { encoding: 'utf8' }).trim().slice(0, 10);
    return { version: `${RELEASE}.${build}`, date: isoDate };
  } catch {
    return { version: `${RELEASE}.0`, date: new Date().toISOString().slice(0, 10) };
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const { version, date } = getGitVersion();

  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_DATE__: JSON.stringify(date),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'manifest.webmanifest'],
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
