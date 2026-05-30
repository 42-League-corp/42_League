import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { execSync } from 'node:child_process';

// MAJOR.MINOR à bumper manuellement lors d'une refonte majeure.
// BUILD = nombre de commits git → s'incrémente automatiquement à chaque commit.
const RELEASE = '0.4';

function formatDate(raw: string): string {
  // raw = "2026-05-29 14:30:22 +0200"
  const [datePart = '', timePart = ''] = raw.trim().split(' ');
  const [year = '', month = '1', day = '1'] = datePart.split('-');
  const hhmm = timePart.slice(0, 5); // "14:30"
  const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  const monthName = MONTHS[parseInt(month, 10) - 1];
  return `${parseInt(day, 10)} ${monthName} ${year} · ${hhmm}`;
}

function getGitVersion(): { version: string; date: string } {
  try {
    const opts = { encoding: 'utf8' as const, stdio: 'pipe' as const };
    const build = execSync('git rev-list --count HEAD', opts).trim();
    const rawDate = execSync('git log -1 --format=%ci', opts).trim();
    return { version: `${RELEASE}.${build}`, date: formatDate(rawDate) };
  } catch (e) {
    console.warn('[vite] git version detection failed:', e);
    const now = new Date();
    const fallbackDate = formatDate(now.toISOString().replace('T', ' ').replace('Z', ' +0000'));
    return { version: `${RELEASE}.?`, date: fallbackDate };
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const { version, date } = getGitVersion();

  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
      'import.meta.env.VITE_APP_DATE': JSON.stringify(date),
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
