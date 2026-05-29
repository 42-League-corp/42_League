import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  DeclareMatchSchema,
  ConfirmMatchSchema,
  RejectMatchSchema,
  CreateChallengeSchema,
  RecordResultSchema,
  CreateTournamentSchema,
  TournamentRecordSchema,
  SetTitleSchema,
  DeclareOpsSchema,
  FeatureRequestSchema,
  SetRoleSchema,
  SetFeatureRequestStatusSchema,
  applyElo,
  shouldCountForElo,
} from '@42-league/shared';
import { prisma } from './db.js';
import {
  createAuthRouter,
  getAllowedWebOrigins,
  getSessionLogin,
  type FtProfile,
} from './auth.js';
import { backfillMissingImages, fetchAndSavePublicUser } from './ft-api.js';
import { advanceWinner, generateBracket } from './tournament.js';
import { isAdmin } from './admins.js';
import { streamSSE } from 'hono/streaming';
import { registerSse, emit } from './sse.js';
import { logAdminAction } from './audit.js';

// Hardcoded — immutable. No API can grant or revoke this.
const SUPERADMINS = new Set(['abidaux', 'throbert']);

async function getUserRole(login: string): Promise<'USER' | 'ADMIN' | 'SUPERADMIN'> {
  if (SUPERADMINS.has(login.toLowerCase())) return 'SUPERADMIN';
  const u = await prisma.user.findUnique({ where: { login }, select: { role: true } });
  return (u?.role as 'USER' | 'ADMIN' | 'SUPERADMIN') ?? 'USER';
}

async function requireSuperAdmin(login: string): Promise<void> {
  if (!SUPERADMINS.has(login.toLowerCase())) {
    throw new HTTPException(403, { message: 'superadmins only' });
  }
}

async function requireAdmin(login: string): Promise<void> {
  const role = await getUserRole(login);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new HTTPException(403, { message: 'admins only' });
  }
}

async function assertNotBanned(login: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { login }, select: { bannedAt: true } });
  if (user?.bannedAt) {
    throw new HTTPException(403, { message: 'account suspended' });
  }
}

async function getOrCreateUser(login: string, profile?: FtProfile) {
  const forceSuperAdmin = SUPERADMINS.has(login.toLowerCase());
  const user = await prisma.user.upsert({
    where: { login },
    update: {
      ...(profile
        ? { ftId: profile.ftId, campus: profile.campus, imageUrl: profile.imageUrl }
        : {}),
      // Always re-enforce SUPERADMIN role on login — no one can downgrade it
      ...(forceSuperAdmin ? { role: 'SUPERADMIN' } : {}),
    },
    create: {
      login,
      ftId: profile?.ftId ?? null,
      campus: profile?.campus ?? null,
      imageUrl: profile?.imageUrl ?? null,
      role: forceSuperAdmin ? 'SUPERADMIN' : 'USER',
    },
  });
  if (!user.imageUrl) {
    // background fetch — fire and forget, in-flight dedup inside ft-api
    fetchAndSavePublicUser(login).catch(() => {});
  }
  return user;
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function getCurrentLogin(c: Context): Promise<string> {
  const sessionLogin = await getSessionLogin(c);
  if (sessionLogin) return sessionLogin;
  const devLogin = c.req.header('x-dev-login');
  if (devLogin) return devLogin;
  throw new HTTPException(401, {
    message: 'not authenticated — call /auth/login or set x-dev-login header',
  });
}

const WEB_APP_ORIGINS = new Set(getAllowedWebOrigins());

const app = new Hono();
// =========================================================================
// MIDDLEWARE CORS + PNA BLINDÉ
// =========================================================================
app.use('*', async (c, next) => {
  const reqOrigin = c.req.header('origin') || c.req.header('Origin');
  
  // Autoriser l'origine si elle est dans la liste WEB_APP_ORIGINS (chargée depuis .env) 
  // ou si c'est l'intra 42
  const isAllowed = reqOrigin && (WEB_APP_ORIGINS.has(reqOrigin) || reqOrigin.includes('intra.42.fr'));
  const allowedOrigin = isAllowed ? reqOrigin : 'https://profile.intra.42.fr';

  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-dev-login');
  c.header('Access-Control-Allow-Private-Network', 'true');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
});

// Gestionnaire d'erreurs global (pour que le CORS soit là même sur une erreur 401 !)
app.onError((err, c) => {
  const reqOrigin = c.req.header('origin') || c.req.header('Origin');
  const allowedOrigin = (reqOrigin && reqOrigin.includes('intra.42.fr')) ? reqOrigin : 'https://profile.intra.42.fr';
  
  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-dev-login');
  c.header('Access-Control-Allow-Private-Network', 'true');

  const status = err instanceof HTTPException ? err.status : 500;
  return c.json({ message: err.message || 'Internal Server Error' }, status);
});


app.get('/health', (c) => c.json({ ok: true }));

app.post('/admin/refresh-images', async (c) => {
  const n = await backfillMissingImages();
  return c.json({ scheduled: n });
});

app.post('/admin/users/:login/title', async (c) => {
  const me = await getCurrentLogin(c);
  if (!isAdmin(me)) {
    throw new HTTPException(403, { message: 'admins only' });
  }
  const login = c.req.param('login');
  const body = await c.req.json().catch(() => null);
  const parsed = SetTitleSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const cleaned = parsed.data.title?.trim() || null;
  const before = await prisma.user.findUnique({ where: { login }, select: { title: true } });
  const user = await prisma.user.update({
    where: { login },
    data: { title: cleaned },
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_TITLE',
    target: login,
    payload: { from: before?.title ?? null, to: cleaned },
  });
  return c.json({ login: user.login, title: user.title });
});

app.route(
  '/auth',
  createAuthRouter(async (profile) => {
    await getOrCreateUser(profile.login, profile);
  }),
);

app.get('/me', async (c) => {
  const login = await getCurrentLogin(c);
  const user = await prisma.user.findUnique({ where: { login } });
  const role = await getUserRole(login);
  return c.json({ login, user, role, isAdmin: isAdmin(login) });
});

app.get('/events', async (c) => {
  const me = await getCurrentLogin(c);
  return streamSSE(c, async (stream) => {
    const cleanup = registerSse(me, stream);
    let alive = true;
    stream.onAbort(() => {
      alive = false;
      cleanup();
    });
    await stream.writeSSE({ event: 'connected', data: JSON.stringify({ login: me }) });
    while (alive) {
      await stream.sleep(25_000);
      if (!alive) break;
      try {
        await stream.writeSSE({ event: 'ping', data: String(Date.now()) });
      } catch {
        alive = false;
      }
    }
    cleanup();
  });
});

app.get('/users', async (c) =>
  c.json(await prisma.user.findMany({ orderBy: { elo: 'desc' } })),
);

app.get('/users/:login', async (c) => {
  const login = c.req.param('login');
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    throw new HTTPException(404, { message: 'user not found' });
  }
  const [allUsers, played] = await Promise.all([
    prisma.user.findMany({
      select: { login: true, elo: true },
      orderBy: { elo: 'desc' },
    }),
    prisma.playedMatch.findMany({
      where: {
        OR: [{ playerALogin: login }, { playerBLogin: login }],
      },
      orderBy: { playedAt: 'desc' },
      take: 50,
    }),
  ]);
  const rank = allUsers.findIndex((u) => u.login === login) + 1;
  const wins = played.filter((m) => {
    const isA = m.playerALogin === login;
    return (isA && m.winner === 'A') || (!isA && m.winner === 'B');
  }).length;
  const losses = played.length - wins;
  return c.json({ user, rank: rank || null, wins, losses, recent: played });
});

app.get('/leaderboard', async (c) => {
  const users = await prisma.user.findMany({ orderBy: { elo: 'desc' } });
  return c.json(users.map((u, i) => ({ rank: i + 1, ...u })));
});

app.get('/matches', async (c) =>
  c.json(await prisma.playedMatch.findMany({ orderBy: { playedAt: 'desc' } })),
);

app.get('/matches/pending', async (c) =>
  c.json(await prisma.pendingMatch.findMany({ orderBy: { declaredAt: 'desc' } })),
);

app.post('/matches', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = DeclareMatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { opponentLogin, scoreSelf, scoreOpponent } = parsed.data;
  if (opponentLogin === me) {
    throw new HTTPException(400, {
      message: 'cannot declare a match against yourself',
    });
  }
  await assertNotBanned(me);
  await getOrCreateUser(me);
  await getOrCreateUser(opponentLogin);
  const pending = await prisma.pendingMatch.create({
    data: {
      id: randomUUID(),
      declarerLogin: me,
      opponentLogin,
      scoreDeclarer: scoreSelf,
      scoreOpponent,
    },
  });
  emit([opponentLogin], {
    type: 'match:pending',
    payload: { id: pending.id, declarerLogin: me, scoreDeclarer: scoreSelf, scoreOpponent },
  });
  return c.json({ id: pending.id, status: 'pending' }, 201);
});

app.post('/matches/:id/confirm', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConfirmMatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { scoreSelf: confirmedSelf, scoreOpponent: confirmedOpponent } = parsed.data;

  const match = await prisma.$transaction(async (tx) => {
    const p = await tx.pendingMatch.findUnique({ where: { id } });
    if (!p) {
      throw new HTTPException(404, { message: 'pending match not found' });
    }
    if (p.opponentLogin !== me) {
      throw new HTTPException(403, {
        message: 'only the opponent can confirm this match',
      });
    }

    if (
      confirmedSelf !== p.scoreOpponent ||
      confirmedOpponent !== p.scoreDeclarer
    ) {
      // Bilateral validation failed → both must redo. Delete the pending entirely.
      await tx.pendingMatch.delete({ where: { id } });
      throw new HTTPException(409, {
        message: `Scores différents — ${p.declarerLogin} a déclaré ${p.scoreDeclarer}-${p.scoreOpponent}, tu as soumis ${confirmedOpponent}-${confirmedSelf}. Match annulé, à redéclarer.`,
      });
    }

    const [a, b] = pairKey(p.declarerLogin, p.opponentLogin);
    const scoreA = p.declarerLogin === a ? p.scoreDeclarer : p.scoreOpponent;
    const scoreB = p.declarerLogin === a ? p.scoreOpponent : p.scoreDeclarer;
    const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';

    const priors = await tx.playedMatch.findMany({
      where: { playerALogin: a, playerBLogin: b },
      select: { playedAt: true, countedForElo: true },
    });
    const countsForElo = shouldCountForElo(priors, p.declaredAt);

    const [userA, userB] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { login: a } }),
      tx.user.findUniqueOrThrow({ where: { login: b } }),
    ]);

    let deltaA = 0;
    let deltaB = 0;
    if (countsForElo) {
      const update = applyElo(
        userA.elo,
        userB.elo,
        winner,
        userA.matchesPlayed,
        userB.matchesPlayed,
      );
      deltaA = update.deltaA;
      deltaB = update.deltaB;
      await tx.user.update({
        where: { login: a },
        data: { elo: update.newA, matchesPlayed: { increment: 1 } },
      });
      await tx.user.update({
        where: { login: b },
        data: { elo: update.newB, matchesPlayed: { increment: 1 } },
      });
    }

    await tx.pendingMatch.delete({ where: { id } });

    return tx.playedMatch.create({
      data: {
        id,
        playerALogin: a,
        playerBLogin: b,
        scoreA,
        scoreB,
        winner,
        playedAt: p.declaredAt,
        countedForElo: countsForElo,
        deltaA,
        deltaB,
      },
    });
  });

  emit([match.playerALogin, match.playerBLogin], { type: 'match:confirmed', payload: match });
  return c.json(match);
});

app.post('/matches/:id/reject', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = RejectMatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }

  const { contestReason, contestMessage } = parsed.data;

  let declarerLogin: string | undefined;
  await prisma.$transaction(async (tx) => {
    const p = await tx.pendingMatch.findUnique({ where: { id } });
    if (!p) {
      throw new HTTPException(404, { message: 'pending match not found' });
    }
    if (p.opponentLogin !== me) {
      throw new HTTPException(403, {
        message: 'only the opponent can reject this match',
      });
    }
    declarerLogin = p.declarerLogin;
    await tx.rejectedMatch.create({
      data: {
        id: randomUUID(),
        declarerLogin: p.declarerLogin,
        opponentLogin: me,
        scoreDeclarer: p.scoreDeclarer,
        scoreOpponent: p.scoreOpponent,
        contestReason,
        contestMessage,
      },
    });
    await tx.pendingMatch.delete({ where: { id } });
  });

  if (declarerLogin) {
    emit([declarerLogin], { type: 'match:rejected', payload: { id, contestReason, rejectedBy: me } });
  }
  return c.json({ id, status: 'rejected', contestReason });
});

app.get('/challenges', async (c) => {
  const me = await getCurrentLogin(c);
  const list = await prisma.challenge.findMany({
    where: {
      OR: [{ challengerLogin: me }, { opponentLogin: me }],
      status: { in: ['pending', 'accepted'] },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  return c.json(list);
});

app.post('/challenges', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { opponentLogin, scheduledAt } = parsed.data;
  if (opponentLogin === me) {
    throw new HTTPException(400, { message: 'cannot challenge yourself' });
  }
  await getOrCreateUser(me);
  await getOrCreateUser(opponentLogin);
  const challenge = await prisma.challenge.create({
    data: {
      id: randomUUID(),
      challengerLogin: me,
      opponentLogin,
      status: 'pending',
      scheduledAt: new Date(scheduledAt),
    },
  });
  emit([opponentLogin], { type: 'challenge:received', payload: challenge });
  return c.json(challenge, 201);
});

app.post('/challenges/:id/accept', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const challenge = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });
    if (ch.opponentLogin !== me) {
      throw new HTTPException(403, { message: 'only the opponent can accept' });
    }
    if (ch.status !== 'pending') {
      throw new HTTPException(409, { message: `challenge is ${ch.status}` });
    }
    return tx.challenge.update({
      where: { id },
      data: { status: 'accepted', decidedAt: new Date() },
    });
  });
  emit([challenge.challengerLogin], { type: 'challenge:accepted', payload: challenge });
  return c.json(challenge);
});

const DODGE_ELO_PENALTY = 10;

app.post('/challenges/:id/decline', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const result = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });
    if (ch.opponentLogin !== me && ch.challengerLogin !== me) {
      throw new HTTPException(403, {
        message: 'only challenger (cancel) or opponent (decline) can do this',
      });
    }
    if (ch.status !== 'pending' && ch.status !== 'accepted') {
      throw new HTTPException(409, { message: `challenge is ${ch.status}` });
    }
    const wasAccepted = ch.status === 'accepted';
    const newStatus = ch.challengerLogin === me ? 'cancelled' : 'declined';
    await tx.challenge.update({
      where: { id },
      data: { status: newStatus, decidedAt: new Date() },
    });
    let penalty = 0;
    if (wasAccepted) {
      penalty = DODGE_ELO_PENALTY;
      await tx.user.update({
        where: { login: me },
        data: {
          elo: { decrement: penalty },
          dodgeCount: { increment: 1 },
        },
      });
    }
    return { status: newStatus, penalty, challengerLogin: ch.challengerLogin, opponentLogin: ch.opponentLogin };
  });
  const otherParty = result.challengerLogin === me ? result.opponentLogin : result.challengerLogin;
  emit([otherParty], {
    type: 'challenge:declined',
    payload: { id, status: result.status, eloPenalty: result.penalty, declinedBy: me },
  });
  return c.json({ id, status: result.status, eloPenalty: result.penalty });
});

app.post('/challenges/:id/record', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = RecordResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { scoreSelf, scoreOpponent } = parsed.data;

  const pending = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });
    if (ch.status !== 'accepted') {
      throw new HTTPException(409, {
        message: 'challenge must be accepted before recording a result',
      });
    }
    if (ch.challengerLogin !== me && ch.opponentLogin !== me) {
      throw new HTTPException(403, { message: 'not a participant' });
    }
    const opponentOfMe =
      ch.challengerLogin === me ? ch.opponentLogin : ch.challengerLogin;
    await tx.challenge.update({
      where: { id },
      data: { status: 'recorded' },
    });
    return tx.pendingMatch.create({
      data: {
        id: randomUUID(),
        declarerLogin: me,
        opponentLogin: opponentOfMe,
        scoreDeclarer: scoreSelf,
        scoreOpponent,
      },
    });
  });
  return c.json({ pendingId: pending.id, status: 'pending_confirmation' }, 201);
});

/* ============ TOURNAMENTS ============ */

app.get('/tournaments', async (c) => {
  const list = await prisma.tournament.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      entries: { select: { login: true } },
      winner: { select: { login: true, imageUrl: true } },
    },
  });
  return c.json(list);
});

app.get('/tournaments/:id', async (c) => {
  const id = c.req.param('id');
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          user: { select: { login: true, imageUrl: true, elo: true } },
        },
      },
      matches: {
        orderBy: [{ round: 'asc' }, { slot: 'asc' }],
      },
      winner: { select: { login: true, imageUrl: true } },
    },
  });
  if (!tournament) {
    throw new HTTPException(404, { message: 'tournament not found' });
  }
  return c.json(tournament);
});

app.post('/tournaments', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  if (parsed.data.kind === 'official' && !isAdmin(me)) {
    throw new HTTPException(403, {
      message: 'only admins can create official tournaments',
    });
  }
  await getOrCreateUser(me);
  const tournament = await prisma.tournament.create({
    data: {
      id: randomUUID(),
      name: parsed.data.name,
      kind: parsed.data.kind,
      capacity: parsed.data.capacity,
      status: 'registration',
      createdByLogin: me,
      entries: { create: { login: me } },
    },
    include: { entries: { select: { login: true } } },
  });
  return c.json(tournament, 201);
});

app.post('/tournaments/:id/join', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  await getOrCreateUser(me);
  const result = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({
      where: { id },
      include: { entries: true },
    });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.status !== 'registration') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    if (t.entries.some((e) => e.login === me)) {
      throw new HTTPException(409, { message: 'already registered' });
    }
    if (t.entries.length >= t.capacity) {
      throw new HTTPException(409, { message: 'tournament is full' });
    }
    await tx.tournamentEntry.create({
      data: { tournamentId: id, login: me },
    });
    // Auto-start if full
    const newCount = t.entries.length + 1;
    if (newCount === t.capacity) {
      const logins = [...t.entries.map((e) => e.login), me];
      await generateBracket(id, t.capacity, logins);
      await tx.tournament.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      return { autoStarted: true };
    }
    return { autoStarted: false };
  });
  return c.json({ id, status: result.autoStarted ? 'in_progress' : 'registration' });
});

app.post('/tournaments/:id/leave', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({ where: { id } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.status !== 'registration') {
      throw new HTTPException(409, {
        message: 'cannot leave once tournament started',
      });
    }
    await tx.tournamentEntry.delete({
      where: { tournamentId_login: { tournamentId: id, login: me } },
    });
  });
  return c.json({ id, left: true });
});

app.post('/tournaments/:id/start', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const result = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({
      where: { id },
      include: { entries: true },
    });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.createdByLogin !== me) {
      throw new HTTPException(403, { message: 'only the organizer can start' });
    }
    if (t.status !== 'registration') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    if (t.entries.length !== t.capacity) {
      throw new HTTPException(409, {
        message: `need exactly ${t.capacity} players (have ${t.entries.length})`,
      });
    }
    await generateBracket(id, t.capacity, t.entries.map((e) => e.login));
    await tx.tournament.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
    return true;
  });
  return c.json({ id, started: result });
});

app.post('/tournaments/:id/cancel', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({ where: { id } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.createdByLogin !== me) {
      throw new HTTPException(403, {
        message: 'only the organizer can cancel',
      });
    }
    if (t.status === 'finished' || t.status === 'cancelled') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    await tx.tournament.update({
      where: { id },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
  });
  return c.json({ id, cancelled: true });
});

app.post('/tournaments/:id/matches/:matchId/record', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const matchId = c.req.param('matchId');
  const body = await c.req.json().catch(() => null);
  const parsed = TournamentRecordSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { scoreA, scoreB } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || m.tournamentId !== id) {
      throw new HTTPException(404, { message: 'match not found' });
    }
    if (!m.playerALogin || !m.playerBLogin) {
      throw new HTTPException(409, {
        message: 'match has no players yet (previous round pending)',
      });
    }
    if (m.confirmedAt) {
      throw new HTTPException(409, { message: 'match already confirmed' });
    }
    if (m.playerALogin !== me && m.playerBLogin !== me) {
      throw new HTTPException(403, { message: 'not a participant' });
    }
    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        scoreA,
        scoreB,
        recordedByLogin: me,
        recordedAt: new Date(),
        winnerLogin: null,
        confirmedAt: null,
      },
    });
  });
  return c.json({ id: matchId, status: 'pending_confirmation' });
});

app.post('/tournaments/:id/matches/:matchId/confirm', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const matchId = c.req.param('matchId');
  const body = await c.req.json().catch(() => null);
  const parsed = TournamentRecordSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { scoreA, scoreB } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || m.tournamentId !== id) {
      throw new HTTPException(404, { message: 'match not found' });
    }
    if (!m.recordedByLogin || m.scoreA == null || m.scoreB == null) {
      throw new HTTPException(409, { message: 'no score recorded yet' });
    }
    if (m.confirmedAt) {
      throw new HTTPException(409, { message: 'match already confirmed' });
    }
    if (m.recordedByLogin === me) {
      throw new HTTPException(403, {
        message: "you can't confirm your own score",
      });
    }
    if (m.playerALogin !== me && m.playerBLogin !== me) {
      throw new HTTPException(403, { message: 'not a participant' });
    }
    if (m.scoreA !== scoreA || m.scoreB !== scoreB) {
      // Reset score → both must redo
      await tx.tournamentMatch.update({
        where: { id: matchId },
        data: {
          scoreA: null,
          scoreB: null,
          recordedByLogin: null,
          recordedAt: null,
        },
      });
      throw new HTTPException(409, {
        message: `Scores différents — saisi ${m.scoreA}-${m.scoreB}, tu as soumis ${scoreA}-${scoreB}. Score reset, à ressaisir.`,
      });
    }
    const winnerLogin =
      scoreA > scoreB ? m.playerALogin! : m.playerBLogin!;
    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: { winnerLogin, confirmedAt: new Date() },
    });
    const t = await tx.tournament.findUniqueOrThrow({ where: { id } });
    const adv = await advanceWinner(id, m.round, m.slot, winnerLogin, t.capacity);
    let finished = false;
    if (adv.isFinal) {
      await tx.tournament.update({
        where: { id },
        data: {
          status: 'finished',
          finishedAt: new Date(),
          winnerLogin,
        },
      });
      await tx.user.update({
        where: { login: winnerLogin },
        data: { tournamentsWon: { increment: 1 } },
      });
      finished = true;
    }
    return { winnerLogin, finished };
  });
  return c.json({ id: matchId, ...result });
});

app.post('/tournaments/:id/matches/:matchId/reject', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const matchId = c.req.param('matchId');
  await prisma.$transaction(async (tx) => {
    const m = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m || m.tournamentId !== id) {
      throw new HTTPException(404, { message: 'match not found' });
    }
    if (m.confirmedAt) {
      throw new HTTPException(409, { message: 'match already confirmed' });
    }
    if (m.playerALogin !== me && m.playerBLogin !== me) {
      throw new HTTPException(403, { message: 'not a participant' });
    }
    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        scoreA: null,
        scoreB: null,
        recordedByLogin: null,
        recordedAt: null,
      },
    });
  });
  return c.json({ id: matchId, rejected: true });
});

/* ============ ADMIN — ROLE MANAGEMENT ============ */

// Only SUPERADMINS can promote/demote. SUPERADMIN itself is immutable (hardcoded).
app.post('/admin/users/:login/role', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const targetLogin = c.req.param('login');
  if (SUPERADMINS.has(targetLogin.toLowerCase())) {
    throw new HTTPException(400, { message: 'cannot change role of a superadmin' });
  }
  const target = await prisma.user.findUnique({ where: { login: targetLogin } });
  if (!target) {
    throw new HTTPException(404, { message: 'user not found' });
  }
  const body = await c.req.json().catch(() => null);
  const parsed = SetRoleSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const updated = await prisma.user.update({
    where: { login: targetLogin },
    data: { role: parsed.data.role },
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'SET_ROLE',
    target: targetLogin,
    payload: { from: target.role, to: parsed.data.role },
  });
  return c.json({ login: updated.login, role: updated.role });
});

/* ============ FEATURE REQUESTS ============ */

app.post('/feature-requests', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = FeatureRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  await getOrCreateUser(me);
  const fr = await prisma.featureRequest.create({
    data: { id: randomUUID(), text: parsed.data.text, authorId: me },
  });
  return c.json(fr, 201);
});

app.get('/feature-requests', async (c) => {
  const me = await getCurrentLogin(c);
  const role = await getUserRole(me);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new HTTPException(403, { message: 'admins only' });
  }
  const list = await prisma.featureRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { login: true, imageUrl: true } } },
  });
  return c.json(list);
});

app.patch('/feature-requests/:id/status', async (c) => {
  const me = await getCurrentLogin(c);
  const role = await getUserRole(me);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new HTTPException(403, { message: 'admins only' });
  }
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = SetFeatureRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const fr = await prisma.featureRequest.update({
    where: { id },
    data: { status: parsed.data.status },
  }).catch(() => { throw new HTTPException(404, { message: 'feature request not found' }); });
  return c.json(fr);
});

/* ============ OPS ============ */
const OPS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const OPS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

app.get('/ops', async (c) => {
  const now = new Date();
  const list = await prisma.ops.findMany({
    where: { expiresAt: { gt: now } },
  });
  return c.json(list);
});

app.get('/ops/me', async (c) => {
  const me = await getCurrentLogin(c);
  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - OPS_COOLDOWN_MS);
  const [activeAsOwner, lastAsOwner, activeAsTarget] = await Promise.all([
    prisma.ops.findFirst({
      where: { ownerLogin: me, expiresAt: { gt: now } },
      include: { target: { select: { login: true, imageUrl: true } } },
    }),
    prisma.ops.findFirst({
      where: { ownerLogin: me },
      orderBy: { expiresAt: 'desc' },
    }),
    prisma.ops.findFirst({
      where: { targetLogin: me, expiresAt: { gt: now } },
      include: { owner: { select: { login: true, imageUrl: true } } },
    }),
  ]);
  let canDeclareAt: Date | null = null;
  if (activeAsOwner) {
    canDeclareAt = new Date(activeAsOwner.expiresAt.getTime() + OPS_COOLDOWN_MS);
  } else if (lastAsOwner && lastAsOwner.expiresAt > cooldownThreshold) {
    canDeclareAt = new Date(lastAsOwner.expiresAt.getTime() + OPS_COOLDOWN_MS);
  }
  return c.json({
    current: activeAsOwner,
    targetedBy: activeAsTarget,
    canDeclareAt,
  });
});

app.post('/ops', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = DeclareOpsSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const target = parsed.data.targetLogin;
  if (target === me) {
    throw new HTTPException(400, { message: 'cannot target yourself' });
  }
  await getOrCreateUser(me);
  await getOrCreateUser(target);

  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - OPS_COOLDOWN_MS);

  const ops = await prisma.$transaction(async (tx) => {
    const ownerActive = await tx.ops.findFirst({
      where: { ownerLogin: me, expiresAt: { gt: now } },
    });
    if (ownerActive) {
      throw new HTTPException(409, {
        message: `tu as déjà un ops actif (${ownerActive.targetLogin}) jusqu'au ${ownerActive.expiresAt.toISOString()}`,
      });
    }
    const ownerCooldown = await tx.ops.findFirst({
      where: { ownerLogin: me, expiresAt: { gt: cooldownThreshold } },
      orderBy: { expiresAt: 'desc' },
    });
    if (ownerCooldown) {
      const next = new Date(ownerCooldown.expiresAt.getTime() + OPS_COOLDOWN_MS);
      throw new HTTPException(409, {
        message: `cooldown actif jusqu'au ${next.toISOString()}`,
      });
    }
    const targetTargeted = await tx.ops.findFirst({
      where: { targetLogin: target, expiresAt: { gt: now } },
    });
    if (targetTargeted) {
      throw new HTTPException(409, {
        message: `${target} est déjà l'ops de quelqu'un d'autre`,
      });
    }
    const targetTargeting = await tx.ops.findFirst({
      where: { ownerLogin: target, expiresAt: { gt: now } },
    });
    if (targetTargeting) {
      throw new HTTPException(409, {
        message: `${target} a actuellement quelqu'un comme ops`,
      });
    }
    return tx.ops.create({
      data: {
        id: randomUUID(),
        ownerLogin: me,
        targetLogin: target,
        declaredAt: now,
        expiresAt: new Date(now.getTime() + OPS_DURATION_MS),
      },
      include: { target: { select: { login: true, imageUrl: true } } },
    });
  });
  return c.json(ops, 201);
});

app.get('/ops/user/:login', async (c) => {
  const login = c.req.param('login');
  const now = new Date();
  const [asOwner, asTarget] = await Promise.all([
    prisma.ops.findFirst({
      where: { ownerLogin: login, expiresAt: { gt: now } },
      include: { target: { select: { login: true, imageUrl: true } } },
    }),
    prisma.ops.findFirst({
      where: { targetLogin: login, expiresAt: { gt: now } },
      include: { owner: { select: { login: true, imageUrl: true } } },
    }),
  ]);
  return c.json({ owns: asOwner, targetedBy: asTarget });
});

/* ============ ADMIN — USERS ============ */

app.get('/admin/users', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'desc' }, { elo: 'desc' }],
  });
  return c.json(users);
});

app.patch('/admin/users/:login/stats', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const login = c.req.param('login');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    elo: z.number().int().min(0).optional(),
    matchesPlayed: z.number().int().min(0).optional(),
    dodgeCount: z.number().int().min(0).optional(),
    tournamentsWon: z.number().int().min(0).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const before = await prisma.user.findUnique({
    where: { login },
    select: { elo: true, matchesPlayed: true, dodgeCount: true, tournamentsWon: true },
  });
  const user = await prisma.user.update({ where: { login }, data: parsed.data })
    .catch(() => { throw new HTTPException(404, { message: 'user not found' }); });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_STATS',
    target: login,
    payload: { before, after: parsed.data },
  });
  return c.json(user);
});

app.post('/admin/users/:login/ban', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const login = c.req.param('login');
  if (SUPERADMINS.has(login.toLowerCase())) {
    throw new HTTPException(400, { message: 'cannot ban a superadmin' });
  }
  const user = await prisma.user.update({ where: { login }, data: { bannedAt: new Date() } })
    .catch(() => { throw new HTTPException(404, { message: 'user not found' }); });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'BAN_USER',
    target: login,
  });
  return c.json({ login: user.login, bannedAt: user.bannedAt });
});

app.post('/admin/users/:login/unban', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const login = c.req.param('login');
  const user = await prisma.user.update({ where: { login }, data: { bannedAt: null } })
    .catch(() => { throw new HTTPException(404, { message: 'user not found' }); });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'UNBAN_USER',
    target: login,
  });
  return c.json({ login: user.login, bannedAt: null });
});

app.get('/admin/users/:login/moderation', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const login = c.req.param('login');
  const [user, recentMatches, rejectionsEmitted, rejectionsReceived] = await Promise.all([
    prisma.user.findUnique({ where: { login } }),
    prisma.playedMatch.findMany({
      where: { OR: [{ playerALogin: login }, { playerBLogin: login }] },
      orderBy: { playedAt: 'desc' },
      take: 50,
    }),
    // Emitted: this player was opponent and chose to reject
    prisma.rejectedMatch.findMany({
      where: { opponentLogin: login },
      orderBy: { rejectedAt: 'desc' },
    }),
    // Received: someone rejected this player's declarations
    prisma.rejectedMatch.findMany({
      where: { declarerLogin: login },
      orderBy: { rejectedAt: 'desc' },
    }),
  ]);
  if (!user) throw new HTTPException(404, { message: 'user not found' });
  const opponentCounts: Record<string, number> = {};
  for (const m of recentMatches) {
    const opp = m.playerALogin === login ? m.playerBLogin : m.playerALogin;
    opponentCounts[opp] = (opponentCounts[opp] ?? 0) + 1;
  }
  const topOpponents = Object.entries(opponentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([opp, count]) => ({ login: opp, count }));
  return c.json({ user, recentMatches, topOpponents, rejectionsEmitted, rejectionsReceived });
});

/* ============ ADMIN — MATCHES ============ */

app.delete('/admin/matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const id = c.req.param('id');
  const match = await prisma.playedMatch.findUnique({ where: { id } });
  if (!match) throw new HTTPException(404, { message: 'match not found' });
  await prisma.$transaction(async (tx) => {
    if (match.countedForElo) {
      await tx.user.update({
        where: { login: match.playerALogin },
        data: { elo: { decrement: match.deltaA }, matchesPlayed: { decrement: 1 } },
      });
      await tx.user.update({
        where: { login: match.playerBLogin },
        data: { elo: { decrement: match.deltaB }, matchesPlayed: { decrement: 1 } },
      });
    }
    await tx.playedMatch.delete({ where: { id } });
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'DELETE_MATCH',
    payload: {
      matchId: id,
      playerA: match.playerALogin,
      playerB: match.playerBLogin,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      countedForElo: match.countedForElo,
    },
  });
  return c.json({ id, deleted: true });
});

app.patch('/admin/matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    scoreA: z.number().int().min(0),
    scoreB: z.number().int().min(0),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const match = await prisma.playedMatch.findUnique({ where: { id } });
  if (!match) throw new HTTPException(404, { message: 'match not found' });
  const winner: 'A' | 'B' = parsed.data.scoreA > parsed.data.scoreB ? 'A' : 'B';
  const updated = await prisma.playedMatch.update({
    where: { id },
    data: { scoreA: parsed.data.scoreA, scoreB: parsed.data.scoreB, winner },
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_MATCH',
    payload: {
      matchId: id,
      before: { scoreA: match.scoreA, scoreB: match.scoreB, winner: match.winner },
      after: { scoreA: parsed.data.scoreA, scoreB: parsed.data.scoreB, winner },
    },
  });
  return c.json(updated);
});

app.get('/admin/rejected-matches', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const list = await prisma.rejectedMatch.findMany({
    orderBy: { rejectedAt: 'desc' },
    take: 200,
  });
  return c.json(list);
});

app.get('/admin/suspicious', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);

  const [allMatches, allUsers] = await Promise.all([
    prisma.playedMatch.findMany({ orderBy: { playedAt: 'asc' } }),
    prisma.user.findMany({ select: { login: true, elo: true, matchesPlayed: true } }),
  ]);

  type Flag = {
    type: 'pair_domination' | 'recent_farming' | 'elo_spike' | 'victim_pattern';
    severity: 'low' | 'medium' | 'high';
    players: string[];
    detail: string;
    matchCount?: number;
    winRate?: number;
    eloGain?: number;
  };

  const flags: Flag[] = [];
  const now = new Date();
  const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Build pair stats ───────────────────────────────────────────────────
  type PairEntry = { playerA: string; playerB: string; matches: { winner: string; playedAt: Date }[] };
  const pairs = new Map<string, PairEntry>();

  for (const m of allMatches) {
    const [a, b] = m.playerALogin < m.playerBLogin
      ? [m.playerALogin, m.playerBLogin]
      : [m.playerBLogin, m.playerALogin];
    const key = `${a}|||${b}`;
    let entry = pairs.get(key);
    if (!entry) {
      entry = { playerA: a, playerB: b, matches: [] };
      pairs.set(key, entry);
    }
    const winner = m.winner === 'A' ? m.playerALogin : m.playerBLogin;
    entry.matches.push({ winner, playedAt: m.playedAt });
  }

  // ── Per-player overall win rates (for victim_pattern) ─────────────────
  const playerWins = new Map<string, { wins: number; total: number }>();
  for (const m of allMatches) {
    const winnerLogin = m.winner === 'A' ? m.playerALogin : m.playerBLogin;
    const loserLogin  = m.winner === 'A' ? m.playerBLogin : m.playerALogin;
    const w = playerWins.get(winnerLogin) ?? { wins: 0, total: 0 };
    w.wins++; w.total++;
    playerWins.set(winnerLogin, w);
    const l = playerWins.get(loserLogin) ?? { wins: 0, total: 0 };
    l.total++;
    playerWins.set(loserLogin, l);
  }

  // ── Pair-based flags ───────────────────────────────────────────────────
  for (const { playerA, playerB, matches } of pairs.values()) {
    const total = matches.length;
    if (total < 3) continue;

    const winsA = matches.filter(m => m.winner === playerA).length;
    const winRateA = winsA / total;
    const dominant   = winRateA >= 0.5 ? playerA : playerB;
    const dominated  = winRateA >= 0.5 ? playerB : playerA;
    const dominantWR = Math.max(winRateA, 1 - winRateA);

    // Pair domination: one side wins 75%+ over 5+ matches
    if (total >= 5 && dominantWR >= 0.75) {
      const severity: Flag['severity'] = dominantWR >= 0.9 ? 'high' : dominantWR >= 0.83 ? 'medium' : 'low';
      flags.push({
        type: 'pair_domination',
        severity,
        players: [dominant, dominated],
        detail: `${dominant} gagne ${Math.round(dominantWR * 100)}% des matchs face à ${dominated} sur ${total} confrontations.`,
        matchCount: total,
        winRate: dominantWR,
      });
    }

    // Recent farming: 15+ matches in 7 days between same pair (2+ per day per player)
    const recentCount = matches.filter(m => m.playedAt >= day7Ago).length;
    if (recentCount >= 15) {
      flags.push({
        type: 'recent_farming',
        severity: recentCount >= 20 ? 'high' : 'medium',
        players: [playerA, playerB],
        detail: `${playerA} et ${playerB} ont joué ${recentCount} fois ensemble ces 7 derniers jours — rythme anormalement élevé.`,
        matchCount: recentCount,
      });
    }

    // Victim pattern: victim has decent global win rate but consistently loses vs one specific player
    if (total >= 5 && dominantWR >= 0.8) {
      const victimOverall = playerWins.get(dominated);
      if (victimOverall && victimOverall.total >= 8) {
        const victimGlobalWR = victimOverall.wins / victimOverall.total;
        // Globally decent (>35%) but crushed in this matchup → targeted
        if (victimGlobalWR >= 0.35) {
          flags.push({
            type: 'victim_pattern',
            severity: 'high',
            players: [dominant, dominated],
            detail: `${dominated} gagne ${Math.round(victimGlobalWR * 100)}% de ses matchs globalement, mais perd ${Math.round(dominantWR * 100)}% face à ${dominant} spécifiquement. Possible don d'ELO volontaire.`,
            matchCount: total,
            winRate: dominantWR,
          });
        }
      }
    }
  }

  // ── Per-player ELO spike (last 30 days, z-score) ──────────────────────
  const playerGains = new Map<string, { login: string; gain: number; count: number }>();

  for (const m of allMatches) {
    if (m.playedAt < day30Ago || !m.countedForElo) continue;
    const a = playerGains.get(m.playerALogin) ?? { login: m.playerALogin, gain: 0, count: 0 };
    a.gain += m.deltaA; a.count++;
    playerGains.set(m.playerALogin, a);
    const b = playerGains.get(m.playerBLogin) ?? { login: m.playerBLogin, gain: 0, count: 0 };
    b.gain += m.deltaB; b.count++;
    playerGains.set(m.playerBLogin, b);
  }

  const activePlayers = [...playerGains.values()].filter(p => p.count >= 5);
  if (activePlayers.length >= 3) {
    const gainValues = activePlayers.map(p => p.gain);
    const avg = gainValues.reduce((s, v) => s + v, 0) / gainValues.length;
    const variance = gainValues.reduce((s, v) => s + (v - avg) ** 2, 0) / gainValues.length;
    const std = Math.sqrt(variance);
    const threshold = avg + 2 * std;

    for (const p of activePlayers) {
      if (p.gain > threshold && p.gain > 80) {
        const severity: Flag['severity'] = p.gain > avg + 3 * std ? 'high' : 'medium';
        flags.push({
          type: 'elo_spike',
          severity,
          players: [p.login],
          detail: `${p.login} a gagné +${p.gain} ELO en 30 jours (${p.count} matchs). Moyenne communauté : ${Math.round(avg > 0 ? avg : 0)} ELO (+${Math.round(p.gain - avg)} au-dessus).`,
          matchCount: p.count,
          eloGain: p.gain,
        });
      }
    }
  }

  // Sort: high → medium → low, deduplicate pair flags (keep highest severity)
  const seen = new Set<string>();
  const deduped: Flag[] = [];
  const order = { high: 0, medium: 1, low: 2 } as const;
  flags.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const f of flags) {
    const key = `${f.type}:${[...f.players].sort().join(':')}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(f); }
  }

  return c.json(deduped);
});

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  actor: z.string().min(1).max(64).optional(),
  target: z.string().min(1).max(64).optional(),
  action: z
    .enum([
      'SET_ROLE', 'BAN_USER', 'UNBAN_USER', 'EDIT_STATS',
      'EDIT_TITLE', 'DELETE_MATCH', 'EDIT_MATCH', 'REFRESH_IMAGES',
    ])
    .optional(),
});

app.get('/admin/audit-log', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const url = new URL(c.req.url);
  const parsed = AuditQuerySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    actor: url.searchParams.get('actor') ?? undefined,
    target: url.searchParams.get('target') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
  });
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { limit, actor, target, action } = parsed.data;
  const entries = await prisma.adminAuditLog.findMany({
    where: {
      ...(actor ? { actorLogin: actor } : {}),
      ...(target ? { targetLogin: target } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return c.json(entries);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`42 League backend listening on http://localhost:${info.port}`);
});
