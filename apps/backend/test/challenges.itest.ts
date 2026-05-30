import { describe, it, expect, beforeEach } from 'vitest';
import { get, post, resetDb, seedUser, futureISO } from './helpers.js';

// Tests d'intégration du cycle de vie d'un défi (challenge) :
//   create → accept/decline → record (qui produit un PendingMatch à confirmer).
// On couvre les permissions, les transitions d'état interdites, et la pénalité
// d'ELO appliquée quand on se désiste d'un défi DÉJÀ accepté (dodge).

async function createChallenge(challenger: string, opponent: string): Promise<string> {
  const r = await post('/challenges', {
    login: challenger,
    body: { opponentLogin: opponent, scheduledAt: futureISO(60) },
  });
  expect(r.status).toBe(201);
  return r.body.id;
}

describe('challenges — création', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
  });

  it('sans auth → 401', async () => {
    const r = await post('/challenges', {
      body: { opponentLogin: 'bob', scheduledAt: futureISO(60) },
    });
    expect(r.status).toBe(401);
  });

  it('valide → 201 et visible des deux côtés', async () => {
    const id = await createChallenge('alice', 'bob');
    const forBob = await get('/challenges', { login: 'bob' });
    const forAlice = await get('/challenges', { login: 'alice' });
    expect(forBob.body.map((c: any) => c.id)).toContain(id);
    expect(forAlice.body.map((c: any) => c.id)).toContain(id);
  });

  it('se défier soi-même → 400', async () => {
    const r = await post('/challenges', {
      login: 'alice',
      body: { opponentLogin: 'alice', scheduledAt: futureISO(60) },
    });
    expect(r.status).toBe(400);
  });

  it('date dans le passé → 400', async () => {
    const r = await post('/challenges', {
      login: 'alice',
      body: { opponentLogin: 'bob', scheduledAt: futureISO(-120) },
    });
    expect(r.status).toBe(400);
  });
});

describe('challenges — accept / decline', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
  });

  it('seul l’adversaire peut accepter (le challenger → 403)', async () => {
    const id = await createChallenge('alice', 'bob');
    const r = await post(`/challenges/${id}/accept`, { login: 'alice' });
    expect(r.status).toBe(403);
  });

  it('accept → status accepted', async () => {
    const id = await createChallenge('alice', 'bob');
    const r = await post(`/challenges/${id}/accept`, { login: 'bob' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('accepted');
  });

  it('accepter deux fois → 409', async () => {
    const id = await createChallenge('alice', 'bob');
    await post(`/challenges/${id}/accept`, { login: 'bob' });
    const r = await post(`/challenges/${id}/accept`, { login: 'bob' });
    expect(r.status).toBe(409);
  });

  it('refuser un défi PENDING → declined, aucune pénalité', async () => {
    const id = await createChallenge('alice', 'bob');
    const r = await post(`/challenges/${id}/decline`, { login: 'bob' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('declined');
    expect(r.body.eloPenalty).toBe(0);
    const bob = await get('/users/bob', { login: 'bob' });
    expect(bob.body.user.elo).toBe(1000);
  });

  it('le challenger annule un défi PENDING → cancelled', async () => {
    const id = await createChallenge('alice', 'bob');
    const r = await post(`/challenges/${id}/decline`, { login: 'alice' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('cancelled');
    expect(r.body.eloPenalty).toBe(0);
  });

  it('se désister d’un défi ACCEPTÉ → pénalité d’ELO + dodgeCount', async () => {
    const id = await createChallenge('alice', 'bob');
    await post(`/challenges/${id}/accept`, { login: 'bob' });
    const r = await post(`/challenges/${id}/decline`, { login: 'bob' });
    expect(r.status).toBe(200);
    expect(r.body.eloPenalty).toBeGreaterThan(0);

    const bob = await get('/users/bob', { login: 'bob' });
    expect(bob.body.user.elo).toBe(1000 - r.body.eloPenalty);
    expect(bob.body.user.dodgeCount).toBe(1);
  });
});

describe('challenges — record', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
  });

  it('enregistrer avant acceptation → 409', async () => {
    const id = await createChallenge('alice', 'bob');
    const r = await post(`/challenges/${id}/record`, {
      login: 'alice',
      body: { scoreSelf: 10, scoreOpponent: 4 },
    });
    expect(r.status).toBe(409);
  });

  it('record après accept → crée un PendingMatch à confirmer', async () => {
    const id = await createChallenge('alice', 'bob');
    await post(`/challenges/${id}/accept`, { login: 'bob' });
    const r = await post(`/challenges/${id}/record`, {
      login: 'alice',
      body: { scoreSelf: 10, scoreOpponent: 4 },
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('pending_confirmation');

    // un pending match est apparu pour bob (l'adversaire du déclarant)
    const pendings = await get('/matches/pending', { login: 'bob' });
    expect(pendings.body).toHaveLength(1);
    expect(pendings.body[0]).toMatchObject({
      declarerLogin: 'alice',
      opponentLogin: 'bob',
      scoreDeclarer: 10,
      scoreOpponent: 4,
    });

    // le défi n'est plus actif (status recorded → absent de la liste pending/accepted)
    const active = await get('/challenges', { login: 'alice' });
    expect(active.body.map((c: any) => c.id)).not.toContain(id);
  });

  it('un non-participant ne peut pas enregistrer → 403', async () => {
    await seedUser('carol');
    const id = await createChallenge('alice', 'bob');
    await post(`/challenges/${id}/accept`, { login: 'bob' });
    const r = await post(`/challenges/${id}/record`, {
      login: 'carol',
      body: { scoreSelf: 10, scoreOpponent: 4 },
    });
    expect(r.status).toBe(403);
  });
});
