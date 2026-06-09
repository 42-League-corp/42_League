import { describe, it, expect, beforeEach } from 'vitest';
import { get, post, patch, resetDb, seedUser } from './helpers.js';

// Tests d'intégration des routes équipes Babyfoot 2v2. Couvre le bug « la
// création de duo n'apparaît pas sur la page 2v2 » : un duel 2v2 déclaré doit
// matérialiser le duo, immédiatement visible via GET /teams?login=, même avant
// d'avoir joué un seul match validé.

/** Déclare un 2v2 (declarer+partner) vs (opp+opp2) et renvoie l'id du pending. */
async function declare2v2(
  declarer: string,
  partner: string,
  opponent: string,
  opponent2: string,
  scoreSelf = 10,
  scoreOpponent = 5,
): Promise<string> {
  const r = await post('/matches/2v2', {
    login: declarer,
    body: { partnerLogin: partner, opponentLogin: opponent, opponent2Login: opponent2, scoreSelf, scoreOpponent },
  });
  expect(r.status).toBe(201);
  return r.body.id;
}

describe('teams 2v2 — listing « mes équipes »', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
    await seedUser('carol');
    await seedUser('dave');
  });

  it('GET /teams sans login → 400', async () => {
    const r = await get('/teams', { login: 'alice' });
    expect(r.status).toBe(400);
  });

  it('GET /teams sans auth → 401', async () => {
    const r = await get('/teams?login=alice');
    expect(r.status).toBe(401);
  });

  it('déclarer un 2v2 crée le duo, visible AUSSITÔT dans /teams (0 match joué)', async () => {
    await declare2v2('alice', 'bob', 'carol', 'dave');

    // Le duo apparaît pour les deux membres, indépendamment de l'ordre des logins.
    for (const login of ['alice', 'bob']) {
      const r = await get(`/teams?login=${login}`, { login });
      expect(r.status).toBe(200);
      expect(r.body).toHaveLength(1);
      const team = r.body[0];
      // Logins canoniques triés : alice < bob.
      expect(team.player1Login).toBe('alice');
      expect(team.player2Login).toBe('bob');
      expect(team.wins).toBe(0);
      expect(team.losses).toBe(0);
      expect(typeof team.id).toBe('string');
      expect(typeof team.elo).toBe('number');
    }

    // Un joueur non concerné n'a pas d'équipe.
    const none = await get('/teams?login=carol', { login: 'carol' });
    expect(none.status).toBe(200);
    // carol fait partie du duo adverse, mais celui-ci n'est créé qu'à la validation.
    expect(none.body).toHaveLength(0);
  });
});

describe('teams 2v2 — profil + historique ELO', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
    await seedUser('carol');
    await seedUser('dave');
  });

  it('GET /teams/:id introuvable → 404', async () => {
    const r = await get('/teams/does-not-exist', { login: 'alice' });
    expect(r.status).toBe(404);
  });

  it('après match validé, le profil expose un historique ELO cohérent', async () => {
    const pendingId = await declare2v2('alice', 'bob', 'carol', 'dave', 10, 5);

    // Récupère l'id du duo alice&bob.
    const list = await get('/teams?login=alice', { login: 'alice' });
    const teamId = list.body[0].id;

    // En 2v2 la confirmation est une simple confirmation de présence : les 3
    // non-déclarants confirment chacun. Les 2 premiers reçoivent 202 (waiting),
    // le 3e déclenche le settlement et reçoit 200 + le match.
    const confirmers = ['bob', 'carol', 'dave'];
    for (let i = 0; i < confirmers.length; i++) {
      const r = await post(`/matches/${pendingId}/confirm`, { login: confirmers[i] });
      expect(r.status).toBe(i === confirmers.length - 1 ? 200 : 202);
    }

    const prof = await get(`/teams/${teamId}`, { login: 'alice' });
    expect(prof.status).toBe(200);
    expect(prof.body.id).toBe(teamId);
    expect(prof.body.wins).toBe(1);
    expect(prof.body.losses).toBe(0);
    expect(Array.isArray(prof.body.eloHistory)).toBe(true);
    expect(prof.body.eloHistory).toHaveLength(1);

    const point = prof.body.eloHistory[0];
    expect(point.won).toBe(true);
    expect(point.scoreTeam).toBe(10);
    expect(point.scoreOpponent).toBe(5);
    // Le dernier point de l'historique doit égaler l'ELO courant du duo.
    expect(point.elo).toBe(prof.body.elo);
    // Adversaires = carol & dave (peu importe l'ordre).
    expect([point.opponentPlayer1Login, point.opponentPlayer2Login].sort()).toEqual(['carol', 'dave']);
  });
});

describe('teams 2v2 — renommage', () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser('alice');
    await seedUser('bob');
    await seedUser('carol');
    await seedUser('dave');
  });

  async function makeTeam(): Promise<string> {
    await declare2v2('alice', 'bob', 'carol', 'dave');
    const list = await get('/teams?login=alice', { login: 'alice' });
    return list.body[0].id;
  }

  it('un membre peut renommer son duo', async () => {
    const teamId = await makeTeam();
    const r = await patch(`/teams/${teamId}/name`, { login: 'alice', body: { name: 'Les Invincibles' } });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Les Invincibles');
  });

  it('un non-membre ne peut pas renommer → 403', async () => {
    const teamId = await makeTeam();
    const r = await patch(`/teams/${teamId}/name`, { login: 'carol', body: { name: 'Vol de nom' } });
    expect(r.status).toBe(403);
  });

  it('nom vide → 400', async () => {
    const teamId = await makeTeam();
    const r = await patch(`/teams/${teamId}/name`, { login: 'alice', body: { name: '   ' } });
    expect(r.status).toBe(400);
  });
});
