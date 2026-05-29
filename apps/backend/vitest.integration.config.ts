import { defineConfig } from 'vitest/config';

// Config dédiée aux tests d'INTÉGRATION (routes HTTP réelles contre une vraie
// DB Postgres de test). Séparée des tests unitaires (src/*.test.ts) qui, eux,
// ne touchent aucune DB et tournent sans infra.
//
// Pré-requis : un Postgres de test joignable via DATABASE_URL (par défaut le
// conteneur jetable local sur :55432 ; en CI, fournir un service postgres et
// exporter DATABASE_URL). Le schéma est appliqué par test/global-setup.ts.
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:55432/league_test';

export default defineConfig({
  test: {
    include: ['test/**/*.itest.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Les tests partagent une seule DB → pas de parallélisme entre fichiers
    // (chaque test fait un TRUNCATE en beforeEach).
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test', // ← empêche index.ts de démarrer serve() + timers de fond
      ALLOW_DEV_LOGIN: 'true', // ← autorise l'auth de test via header x-dev-login
      SESSION_SECRET: 'integration-test-secret',
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
