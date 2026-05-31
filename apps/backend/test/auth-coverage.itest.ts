import { describe, it, expect, beforeEach } from 'vitest';
import { get, post, resetDb, seedUser } from './helpers.js';

// Tests de NON-RÉGRESSION du cloisonnement (CGU API 42, Art. 3 & 4.1).
//
// Garantie : aucune donnée 42 ne sort du Réseau 42. Concrètement :
//   1. toute route exposant des données 42 renvoie 401 SANS authentification ;
//   2. seul /health est public (et ne révèle aucune donnée) ;
//   3. les routes /admin/* exigent le rôle admin (un USER lambda → 403).
//
// Ce fichier fige la liste des routes : si une nouvelle route oublie
// `getCurrentLogin`/`requireAdmin`, un test casse → la fuite est détectée en CI.

// Toutes les routes de LECTURE exposant des données 42 (logins, photos, ELO…).
const READ_ROUTES_REQUIRING_AUTH = [
  '/locations',
  '/users',
  '/users/bob',
  '/leaderboard',
  '/matches',
  '/matches/pending',
  '/challenges',
  '/tournaments',
  '/tournaments/some-id',
  '/ops',
  '/ops/me',
  '/ops/user/bob',
  '/feature-requests',
  // Routes admin (lecture)
  '/admin/users',
  '/admin/suspicious',
  '/admin/audit-log',
  '/admin/all-history',
  '/admin/rejected-matches',
  '/admin/users/bob/moderation',
];

// Routes admin sensibles testées pour l'élévation de privilège (USER → 403).
const ADMIN_ROUTES_GET = [
  '/admin/users',
  '/admin/suspicious',
  '/admin/audit-log',
  '/admin/all-history',
  '/admin/rejected-matches',
  '/admin/users/bob/moderation',
];

describe('cloisonnement — aucune donnée 42 accessible sans authentification', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('GET /health est la SEULE route publique et ne révèle aucune donnée', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it.each(READ_ROUTES_REQUIRING_AUTH)('GET %s sans auth → 401', async (path) => {
    const r = await get(path);
    expect(r.status).toBe(401);
  });

  it('POST /admin/refresh-images sans auth → 401 (pas d\'appel API 42 non autorisé)', async () => {
    const r = await post('/admin/refresh-images', { body: {} });
    expect(r.status).toBe(401);
  });
});

describe('privilèges — un USER lambda ne peut pas agir en admin', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice'); // USER, consenti
  });

  it.each(ADMIN_ROUTES_GET)('GET %s en tant que USER → 403', async (path) => {
    const r = await get(path, { login: 'alice' });
    expect(r.status).toBe(403);
  });

  it('POST /admin/refresh-images en tant que USER → 403', async () => {
    const r = await post('/admin/refresh-images', { login: 'alice', body: {} });
    expect(r.status).toBe(403);
  });

  it('POST /admin/users/:login/ban en tant que USER → 403', async () => {
    await seedUser('bob');
    const r = await post('/admin/users/bob/ban', { login: 'alice', body: {} });
    expect(r.status).toBe(403);
  });
});
