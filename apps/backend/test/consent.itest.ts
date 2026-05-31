import { describe, it, expect, beforeEach } from 'vitest';
import { get, post, del, resetDb, seedUser } from './helpers.js';
import { prisma } from '../src/db.js';
import { CURRENT_TERMS_VERSION } from '../src/index.js';

// Tests d'intégration de la CONSENT-GATE (RGPD / CGU API 42, Art. 3.1 & 4.2).
//
// Garantie visée : aucune donnée 42 n'est lue/écrite tant que l'utilisateur n'a
// pas consenti, et ce de façon NON CONTOURNABLE (application côté serveur, pas
// seulement dans la modale frontend). On vérifie :
//   - le blocage 403 consent_required sur toutes les routes de données ;
//   - les exemptions strictement nécessaires (/me, consentement, droits RGPD) ;
//   - l'acceptation qui débloque + enregistre la preuve (date + version) ;
//   - le refus qui supprime (compte vierge) ou anonymise (compte avec historique) ;
//   - le re-consentement forcé après évolution de la politique (bump de version) ;
//   - le fail-safe : non authentifié → 401 (et non 403), superadmin protégé.

describe('consent-gate — blocage avant consentement', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice', { consented: false });
    await seedUser('bob'); // consenti (défaut) — sert d'adversaire
  });

  it('GET /me reste accessible et signale consentRequired: true', async () => {
    const r = await get('/me', { login: 'alice' });
    expect(r.status).toBe(200);
    expect(r.body.consentRequired).toBe(true);
    expect(r.body.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it.each([
    ['GET', '/leaderboard'],
    ['GET', '/matches'],
    ['GET', '/matches/pending'],
    ['GET', '/challenges'],
    ['GET', '/tournaments'],
    ['GET', '/ops'],
    ['GET', '/users'],
  ])('%s %s → 403 consent_required', async (method, path) => {
    const r = await get(path, { login: 'alice' });
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('consent_required');
  });

  it('POST /challenges (mutation) → 403 consent_required', async () => {
    const r = await post('/challenges', {
      login: 'alice',
      body: { opponentLogin: 'bob', scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
    });
    expect(r.status).toBe(403);
    expect(r.body.message).toBe('consent_required');
  });

  it('les droits RGPD restent exerçables sans consentement (export)', async () => {
    const r = await get('/me/export', { login: 'alice' });
    expect(r.status).toBe(200);
    expect(r.body.profile.login).toBe('alice');
  });
});

describe('consent-gate — acceptation', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice', { consented: false });
  });

  it('POST /me/consent {accept:true} → 200 et enregistre la preuve', async () => {
    const r = await post('/me/consent', { login: 'alice', body: { accept: true } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, accepted: true });

    const user = await prisma.user.findUnique({ where: { login: 'alice' } });
    expect(user?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user?.termsVersion).toBe(CURRENT_TERMS_VERSION);
  });

  it('après acceptation, les routes de données sont débloquées', async () => {
    await post('/me/consent', { login: 'alice', body: { accept: true } });
    const lb = await get('/leaderboard', { login: 'alice' });
    expect(lb.status).toBe(200);
    const me = await get('/me', { login: 'alice' });
    expect(me.body.consentRequired).toBe(false);
  });

  it('payload invalide (accept manquant) → 400', async () => {
    const r = await post('/me/consent', { login: 'alice', body: {} });
    expect(r.status).toBe(400);
  });
});

describe('consent-gate — refus', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('compte vierge : refus → suppression complète du compte', async () => {
    await seedUser('newbie', { consented: false });
    const r = await post('/me/consent', { login: 'newbie', body: { accept: false } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, accepted: false, deleted: true });

    const user = await prisma.user.findUnique({ where: { login: 'newbie' } });
    expect(user).toBeNull();
    // Aucun résidu anonymisé non plus (compte vierge → suppression sèche).
    const anons = await prisma.user.count({ where: { anonymizedAt: { not: null } } });
    expect(anons).toBe(0);
  });

  it('compte avec historique : refus → anonymisation (historique préservé)', async () => {
    // matchesPlayed > 0 → considéré non vierge → anonymisation au lieu de suppression.
    await seedUser('veteran', { consented: false, matchesPlayed: 5 });
    const r = await post('/me/consent', { login: 'veteran', body: { accept: false } });
    expect(r.status).toBe(200);

    // Le login d'origine n'existe plus…
    expect(await prisma.user.findUnique({ where: { login: 'veteran' } })).toBeNull();
    // …mais un compte anonymisé subsiste, dépourvu de toute donnée 42.
    const anon = await prisma.user.findFirst({ where: { anonymizedAt: { not: null } } });
    expect(anon).not.toBeNull();
    expect(anon?.login.startsWith('anon_')).toBe(true);
    expect(anon?.ftId).toBeNull();
    expect(anon?.campus).toBeNull();
    expect(anon?.imageUrl).toBeNull();
    expect(anon?.matchesPlayed).toBe(5); // historique sportif conservé
  });

  it('superadmin : refus → 400 (compte indestructible)', async () => {
    await seedUser('abidaux', { consented: false, role: 'SUPERADMIN' });
    const r = await post('/me/consent', { login: 'abidaux', body: { accept: false } });
    expect(r.status).toBe(400);
    // Le compte est intact.
    expect(await prisma.user.findUnique({ where: { login: 'abidaux' } })).not.toBeNull();
  });
});

describe('consent-gate — re-consentement après évolution de la politique', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('version périmée → consentRequired: true et routes bloquées', async () => {
    await seedUser('carol'); // consenti à la version courante
    // Simule un ancien consentement sur une version désormais périmée.
    await prisma.user.update({
      where: { login: 'carol' },
      data: { termsVersion: 'v0-obsolete', termsAcceptedAt: new Date('2020-01-01') },
    });

    const me = await get('/me', { login: 'carol' });
    expect(me.body.consentRequired).toBe(true);

    const lb = await get('/leaderboard', { login: 'carol' });
    expect(lb.status).toBe(403);

    // Re-consentement → remet à jour la version et débloque.
    await post('/me/consent', { login: 'carol', body: { accept: true } });
    const after = await get('/leaderboard', { login: 'carol' });
    expect(after.status).toBe(200);
  });
});

describe('consent-gate — fail-safe authentification', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice', { consented: false });
  });

  it('non authentifié → 401 (et non 403) : la gate ne masque pas l\'auth', async () => {
    const r = await get('/leaderboard');
    expect(r.status).toBe(401);
  });

  it('login inexistant en base → la gate laisse passer (la route gère)', async () => {
    // Pas de user "ghost" → consentRequired(null)=false → pas de 403 parasite.
    const r = await get('/leaderboard', { login: 'ghost' });
    expect(r.status).toBe(200);
  });
});
