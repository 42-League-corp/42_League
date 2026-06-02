import { describe, it, expect, beforeEach } from 'vitest';
import { get, resetDb, seedUser } from './helpers.js';

// Smoke test : valide que toute l'infra d'intégration fonctionne de bout en bout
// (app importée sans serveur, DB de test joignable, auth x-dev-login active).
describe('infra intégration (smoke)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('GET /health → 200 { ok: true } sans auth', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('GET /me sans auth → 401', async () => {
    const r = await get('/me');
    expect(r.status).toBe(401);
  });

  it('GET /me avec x-dev-login → 200 et renvoie le bon login', async () => {
    await seedUser('alice');
    const r = await get('/me', { login: 'alice' });
    expect(r.status).toBe(200);
    expect(r.body.login).toBe('alice');
    expect(r.body.role).toBe('USER');
  });

  it('resetDb isole bien : alice n\'a plus les données du test précédent', async () => {
    // /me appelle getOrCreateUser → alice est (re)créée automatiquement,
    // donc user n'est PAS null. Mais l'isolation est prouvée par imageUrl=null :
    // seedUser() pose imageUrl='https://example.test/alice.jpg', alors que
    // getOrCreateUser sans profil laisse imageUrl à null.
    const r = await get('/me', { login: 'alice' });
    expect(r.status).toBe(200);
    expect(r.body.user).not.toBeNull();          // créée fresh par getOrCreateUser
    expect(r.body.user.imageUrl).toBeNull();     // pas la alice seedée du test précédent
  });
});
