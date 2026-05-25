import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.VITE_API_BASE_URL ?? 'http://localhost:3000';

  return {
    plugins: [react()],
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
