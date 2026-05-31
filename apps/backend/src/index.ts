import { Hono, type Context, type Next } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { randomUUID, createHash } from 'node:crypto';
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
  calculateBabyfootElo,
  shouldCountForElo,
  estimatedEloLoss,
  OPS_DURATION_MS,
  OPS_FORCED_MATCHES,
  OPS_REFUSE_MULTIPLIER,
} from '@42-league/shared';
import { prisma } from './db.js';
import type { Prisma } from '@prisma/client';
import {
  createAuthRouter,
  getAllowedWebOrigins,
  getSessionLogin,
  type FtProfile,
} from './auth.js';
import { backfillMissingImages, fetchAndSavePublicUser } from './ft-api.js';
import { getCampusLocations } from './locations.js';
import { advanceWinner, generateBracket } from './tournament.js';
import { isAdmin } from './admins.js';
import { streamSSE } from 'hono/streaming';
import { registerSse, emit, broadcast, type SseEvent } from './sse.js';
import { verifyToken } from './tokens.js';
import { logAdminAction } from './audit.js';
import { rateLimit } from './rate-limit.js';

// Hardcoded — immutable. No API can grant or revoke this.
const SUPERADMINS = new Set(['abidaux', 'throbert']);

// Backdoor de dev : le header `x-dev-login` permet de se faire passer pour
// n'importe quel utilisateur SANS OAuth. Il est donc STRICTEMENT réservé au dev
// local et n'est honoré que si ALLOW_DEV_LOGIN=true est explicitement positionné.
// Fail-secure : par défaut (prod) le flag est absent → le header est ignoré.
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true';

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

// Un compte « hors-jeu » — banni, désactivé (suppression RGPD programmée) ou
// anonymisé — ne peut plus être défié ni ciblé par un OPS. À appeler AVANT tout
// getOrCreateUser sur la cible : l'upsert remettrait sinon deletionScheduledAt à
// null et réactiverait par mégarde un compte désactivé.
async function assertTargetable(login: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { login },
    select: { bannedAt: true, anonymizedAt: true, deletionScheduledAt: true },
  });
  if (!user || user.bannedAt || user.anonymizedAt || user.deletionScheduledAt) {
    throw new HTTPException(403, { message: 'ce joueur n’est plus disponible' });
  }
}

// Quand un compte sort du jeu (ban, désactivation, anonymisation), ses tournois
// disparaissent : ceux qu'il a CRÉÉS sont supprimés intégralement (cascade →
// entries + matches) et sa place est libérée dans ceux où il n'était qu'inscrit
// et encore en phase d'inscription (retirer une entrée d'un bracket en cours le
// corromprait). Renvoie true si quelque chose a changé (→ broadcast utile).
async function purgeUserFromTournaments(
  tx: Prisma.TransactionClient,
  login: string,
): Promise<boolean> {
  const created = await tx.tournament.deleteMany({ where: { createdByLogin: login } });
  const freed = await tx.tournamentEntry.deleteMany({
    where: { login, tournament: { status: 'registration' } },
  });
  return created.count > 0 || freed.count > 0;
}

// Annule les défis « en cours » (en attente ou acceptés) impliquant un compte
// qui sort du jeu (ban / désactivation / anonymisation) : il ne doit plus avoir
// de duel actif. Renvoie true si au moins un défi a été annulé.
async function cancelUserChallenges(
  tx: Prisma.TransactionClient,
  login: string,
): Promise<boolean> {
  const res = await tx.challenge.updateMany({
    where: {
      OR: [{ challengerLogin: login }, { opponentLogin: login }],
      status: { in: ['pending', 'accepted'] },
    },
    data: { status: 'cancelled', decidedAt: new Date() },
  });
  return res.count > 0;
}

// Filtre Prisma des comptes VISIBLES (en jeu) : ni bannis, ni désactivés
// (suppression RGPD programmée), ni anonymisés. Utilisé pour le classement et
// les listes publiques de joueurs.
const VISIBLE_USER_WHERE = {
  bannedAt: null,
  anonymizedAt: null,
  deletionScheduledAt: null,
} as const;

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
      // RGPD Art. 17 — période de grâce : se reconnecter annule une suppression
      // programmée et restaure intégralement le compte (elo + historique).
      deletionScheduledAt: null,
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
  if (ALLOW_DEV_LOGIN && devLogin) return devLogin;
  throw new HTTPException(401, {
    message: 'not authenticated — call /auth/login',
  });
}

// Variante pour le flux SSE : EventSource ne peut pas envoyer de header
// Authorization, on autorise donc en plus l'auth via ?token=... en query param.
async function getStreamLogin(c: Context): Promise<string> {
  const sessionLogin = await getSessionLogin(c);
  if (sessionLogin) return sessionLogin;
  const secret = process.env.SESSION_SECRET;
  const queryToken = c.req.query('token');
  if (secret && queryToken) {
    const login = verifyToken(queryToken, secret);
    if (login) return login;
  }
  const devLogin = c.req.header('x-dev-login');
  if (ALLOW_DEV_LOGIN && devLogin) return devLogin;
  throw new HTTPException(401, { message: 'not authenticated' });
}

const WEB_APP_ORIGINS = new Set(getAllowedWebOrigins());

// Vrai contrôle de hostname : seul l'intra 42 (intra.42.fr ou un sous-domaine
// *.intra.42.fr) est accepté. Un `includes('intra.42.fr')` laisserait passer
// `https://intra.42.fr.evil.com` — d'où le parsing strict de l'origine.
function isIntra42Origin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    return hostname === 'intra.42.fr' || hostname.endsWith('.intra.42.fr');
  } catch {
    return false;
  }
}

export const app = new Hono();
// =========================================================================
// MIDDLEWARE CORS + PNA BLINDÉ
// =========================================================================
app.use('*', async (c, next) => {
  const reqOrigin = c.req.header('origin') || c.req.header('Origin');
  
  // Autoriser l'origine si elle est dans la liste WEB_APP_ORIGINS (chargée depuis .env) 
  // ou si c'est l'intra 42
  const isAllowed = !!reqOrigin && (WEB_APP_ORIGINS.has(reqOrigin) || isIntra42Origin(reqOrigin));
  const allowedOrigin = isAllowed ? reqOrigin : 'https://profile.intra.42.fr';

  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-dev-login');
  c.header('Access-Control-Allow-Private-Network', 'true');

  if (c.req.method === 'OPTIONS') {
    c.status(204);
    return c.body(null);
  }

  await next();
});

// =========================================================================
// RATE-LIMITING — garde-fou anti-abus pour la bêta
// =========================================================================
// NB : le middleware CORS ci-dessus court-circuite déjà les requêtes OPTIONS
// (preflight) sans appeler next(), donc les limiteurs ne les comptent pas.
// Désactivé sous NODE_ENV=test : les tests d'intégration partagent tous l'IP
// `unknown` (pas de X-Forwarded-For via app.request) et trébucheraient sur le
// plafond. Le middleware lui-même est couvert par rate-limit.test.ts.
if (process.env.NODE_ENV !== 'test') {
  const isMutation = (c: Context) =>
    ['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method);

  // Backstop global : plafond large par IP, juste pour absorber un flood / scan.
  app.use('*', rateLimit({ name: 'global', windowMs: 60_000, max: 600 }));

  // Auth : protège l'échange OAuth contre le brute-force / spam de state.
  app.use('/auth/*', rateLimit({ name: 'auth', windowMs: 15 * 60_000, max: 50 }));

  // Écriture : ne compte que les mutations (déclarations de matchs, défis, ops,
  // tournois, feature-requests). Généreux pour un humain, bloque les floods.
  const writeLimiter = rateLimit({
    name: 'write',
    windowMs: 60_000,
    max: 120,
    skip: (c) => !isMutation(c),
  });
  for (const path of [
    '/matches',
    '/matches/*',
    '/challenges',
    '/challenges/*',
    '/tournaments',
    '/tournaments/*',
    '/ops',
    '/feature-requests',
  ]) {
    app.use(path, writeLimiter);
  }
}

// =========================================================================
// TEMPS RÉEL — events SSE ciblés
// =========================================================================
// Stratégie :
//  - Les changements qui ne concernent que certains joueurs (défis, matchs, ops)
//    sont émis EN CIBLÉ directement dans les handlers via emit([logins], …).
//  - Les changements GLOBAUX visibles par tous (classement, tournois) sont diffusés
//    à tous les clients connectés via les middlewares par domaine ci-dessous.
// Dans tous les cas le front ne ré-interroge QUE la tranche de données concernée
// (et non les 8 endpoints).
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Diffuse `event` à tous les clients après une mutation réussie sur ce préfixe. */
function broadcastOnMutation(event: SseEvent) {
  return async (c: Context, next: Next) => {
    await next();
    if (!MUTATING_METHODS.has(c.req.method)) return;
    if (c.res.status < 200 || c.res.status >= 300) return;
    broadcast(event);
  };
}

// Tournois : liste + bracket sont publics → tout le monde rafraîchit les tournois.
app.use('/tournaments', broadcastOnMutation({ type: 'tournament:update', payload: {} }));
app.use('/tournaments/*', broadcastOnMutation({ type: 'tournament:update', payload: {} }));
// Admin : peut toucher stats / matchs / bans (rare) → refresh complet par sécurité.
app.use('/admin/*', broadcastOnMutation({ type: 'data:update', payload: {} }));

// GOD panel : déclarations / confirmations / rejets de matchs, défis et idées
// ne sont émis qu'EN CIBLÉ aux joueurs concernés → un admin qui regarde le panel
// ne les verrait jamais. On diffuse donc un `panel:update` léger que SEUL le
// front du panel écoute ; les autres clients n'ont pas de listener pour ce type
// → l'event est ignoré côté navigateur, aucun re-fetch inutile.
const panelUpdate = broadcastOnMutation({ type: 'panel:update', payload: {} });
app.use('/matches', panelUpdate);
app.use('/matches/*', panelUpdate);
app.use('/challenges', panelUpdate);
app.use('/challenges/*', panelUpdate);
app.use('/feature-requests', panelUpdate);
app.use('/feature-requests/*', panelUpdate);

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

app.get('/locations', async (c) => {
  await getCurrentLogin(c);
  const map = await getCampusLocations();
  return c.json(Object.fromEntries(map));
});

app.post('/admin/refresh-images', async (c) => {
  const me = await getCurrentLogin(c);
  if (!isAdmin(me)) {
    throw new HTTPException(403, { message: 'admins only' });
  }
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

// ── RGPD Art. 20 — Droit à la portabilité : export de toutes les données personnelles ──
app.get('/me/export', async (c) => {
  const login = await getCurrentLogin(c);
  const [user, matches, challenges, tournamentEntries, featureRequests, ops] = await Promise.all([
    prisma.user.findUnique({ where: { login } }),
    prisma.playedMatch.findMany({
      where: { OR: [{ playerALogin: login }, { playerBLogin: login }] },
      orderBy: { playedAt: 'desc' },
    }),
    prisma.challenge.findMany({
      where: { OR: [{ challengerLogin: login }, { opponentLogin: login }] },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tournamentEntry.findMany({
      where: { login },
      include: { tournament: { select: { id: true, name: true, status: true, createdAt: true } } },
    }),
    prisma.featureRequest.findMany({
      where: { authorId: login },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ops.findMany({
      where: { OR: [{ ownerLogin: login }, { targetLogin: login }] },
      orderBy: { declaredAt: 'desc' },
    }),
  ]);

  c.header('Content-Disposition', `attachment; filename="42league-export-${login}.json"`);
  return c.json({
    exportDate: new Date().toISOString(),
    profile: user,
    matchHistory: matches,
    challenges,
    tournaments: tournamentEntries,
    featureRequests,
    ops,
  });
});

// ── RGPD Art. 17 — Droit à l'effacement : suppression avec période de grâce ──
// La suppression ne fait que PROGRAMMER l'effacement (deletionScheduledAt) :
// le compte disparaît immédiatement des vues publiques mais ses données sont
// conservées. L'anonymisation définitive et irréversible n'a lieu qu'après
// ACCOUNT_GRACE_DAYS jours (job quotidien). Se reconnecter avant l'échéance
// annule la suppression et restaure intégralement le compte — voir
// getOrCreateUser (remise à null de deletionScheduledAt à la connexion).
const ACCOUNT_GRACE_DAYS = Number(process.env.ACCOUNT_GRACE_DAYS ?? 30);

// Anonymisation définitive d'un compte : renomme le login (cascade vers toutes
// les FK ON UPDATE CASCADE), purge les PII et marque anonymizedAt. Réutilisée
// par le job de suppression différée.
async function anonymizeAccount(login: string): Promise<void> {
  const anonLogin =
    'anon_' + createHash('sha256').update(login + Date.now().toString()).digest('hex').slice(0, 8);

  await prisma.$transaction(async (tx) => {
    // Un compte anonymisé est définitivement hors-jeu : on purge ses tournois
    // et ses défis avant de renommer le login (la désactivation l'a
    // normalement déjà fait).
    await purgeUserFromTournaments(tx, login);
    await cancelUserChallenges(tx, login);
    // Mise à jour du login (cascade automatique vers toutes les FK ON UPDATE CASCADE)
    await tx.user.update({
      where: { login },
      data: {
        login: anonLogin,
        ftId: null,
        campus: null,
        imageUrl: null,
        title: null,
        anonymizedAt: new Date(),
        deletionScheduledAt: null,
      },
    });
    // Tables sans FK déclarée : mise à jour manuelle
    await tx.adminAuditLog.updateMany({ where: { actorLogin: login }, data: { actorLogin: anonLogin } });
    await tx.adminAuditLog.updateMany({ where: { targetLogin: login }, data: { targetLogin: anonLogin } });
    await tx.tournamentMatch.updateMany({ where: { recordedByLogin: login }, data: { recordedByLogin: anonLogin } });
  });
}

app.delete('/me/account', async (c) => {
  const login = await getCurrentLogin(c);

  if (SUPERADMINS.has(login.toLowerCase())) {
    throw new HTTPException(400, { message: 'superadmin accounts cannot be anonymized' });
  }

  const tournamentsChanged = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { login },
      data: { deletionScheduledAt: new Date() },
    });
    // Un compte désactivé sort du jeu : ses tournois disparaissent, sa place est
    // libérée là où il était inscrit, et ses défis en cours sont annulés.
    const t = await purgeUserFromTournaments(tx, login);
    await cancelUserChallenges(tx, login);
    return t;
  });

  if (tournamentsChanged) broadcast({ type: 'tournament:update', payload: {} });
  // Rafraîchit les listes (classement + défis des adversaires concernés).
  broadcast({ type: 'data:update', payload: {} });
  return c.json({ ok: true, graceDays: ACCOUNT_GRACE_DAYS });
});

app.get('/events', async (c) => {
  // EventSource ne peut pas envoyer de header Authorization → on accepte aussi
  // le token en query param (?token=...) en plus de la session/cookie habituels.
  const me = await getStreamLogin(c);
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

// ── RGPD Art. 25 — Privacy by design : toutes les données utilisateurs exigent une auth ──

app.get('/users', async (c) => {
  await getCurrentLogin(c);
  // Comptes hors-jeu (bannis / désactivés / anonymisés) masqués des vues publiques.
  return c.json(
    await prisma.user.findMany({ where: VISIBLE_USER_WHERE, orderBy: { elo: 'desc' } }),
  );
});

app.get('/users/:login', async (c) => {
  await getCurrentLogin(c);
  const login = c.req.param('login');
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || user.deletionScheduledAt) {
    // Compte inexistant ou en cours de suppression → traité comme absent.
    throw new HTTPException(404, { message: 'user not found' });
  }
  const [allUsers, played] = await Promise.all([
    prisma.user.findMany({
      where: VISIBLE_USER_WHERE,
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
  await getCurrentLogin(c);
  // Bannis / désactivés / anonymisés ne figurent jamais au classement.
  const users = await prisma.user.findMany({
    where: VISIBLE_USER_WHERE,
    orderBy: { elo: 'desc' },
  });
  return c.json(users.map((u, i) => ({ rank: i + 1, ...u })));
});

app.get('/matches', async (c) => {
  await getCurrentLogin(c);
  return c.json(await prisma.playedMatch.findMany({ orderBy: { playedAt: 'desc' } }));
});

app.get('/matches/pending', async (c) => {
  await getCurrentLogin(c);
  return c.json(await prisma.pendingMatch.findMany({ orderBy: { declaredAt: 'desc' } }));
});

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

// Applique un match en attente comme match joué (calcul ELO + anti-farming +
// création du PlayedMatch + suppression du pending). Partagé entre la confirmation
// normale (par l'adversaire) et la force-validation SUPERADMIN.
type PendingForSettle = {
  id: string;
  declarerLogin: string;
  opponentLogin: string;
  scoreDeclarer: number;
  scoreOpponent: number;
  declaredAt: Date;
};

async function settlePendingAsPlayed(tx: Prisma.TransactionClient, p: PendingForSettle) {
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
    const update = calculateBabyfootElo(userA.elo, userB.elo, winner, scoreA, scoreB);
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

  await tx.pendingMatch.delete({ where: { id: p.id } });

  return tx.playedMatch.create({
    data: {
      id: p.id,
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
}

app.post('/matches/:id/confirm', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConfirmMatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { scoreSelf: confirmedSelf, scoreOpponent: confirmedOpponent } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
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
      // Validation bilatérale échouée → les deux doivent recommencer : on
      // supprime le pending. ⚠️ Ne PAS `throw` ici : une exception ferait
      // rollback de la transaction et annulerait ce delete. On renvoie un
      // marqueur et on lève le 409 APRÈS le commit de la transaction.
      await tx.pendingMatch.delete({ where: { id } });
      return {
        mismatch: true as const,
        message: `Scores différents — ${p.declarerLogin} a déclaré ${p.scoreDeclarer}-${p.scoreOpponent}, tu as soumis ${confirmedOpponent}-${confirmedSelf}. Match annulé, à redéclarer.`,
      };
    }

    const created = await settlePendingAsPlayed(tx, p);

    const opsBetween = await tx.ops.findFirst({
      where: {
        expiresAt: { gt: new Date() },
        forcedUsed: { lt: OPS_FORCED_MATCHES },
        OR: [
          { ownerLogin: created.playerALogin, targetLogin: created.playerBLogin },
          { ownerLogin: created.playerBLogin, targetLogin: created.playerALogin },
        ],
      },
    });
    if (opsBetween) {
      await tx.ops.update({
        where: { id: opsBetween.id },
        data: { forcedUsed: { increment: 1 } },
      });
    }
    return { mismatch: false as const, match: created, opsTouched: !!opsBetween };
  });

  // Le 409 est levé hors transaction : le delete du pending est ainsi committé.
  if (result.mismatch) {
    throw new HTTPException(409, { message: result.message });
  }
  const match = result.match;

  emit([match.playerALogin, match.playerBLogin], { type: 'match:confirmed', payload: match });
  // L'ELO des deux joueurs a changé → le classement bouge pour tout le monde.
  broadcast({ type: 'leaderboard:update', payload: {} });
  if (result.opsTouched) {
    emit([match.playerALogin, match.playerBLogin], {
      type: 'ops:update',
      payload: { reason: 'forced_played' },
    });
  }
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

// Annulation par le déclarant lui-même.
app.post('/matches/:id/cancel', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');

  let opponentLogin: string | undefined;
  await prisma.$transaction(async (tx) => {
    const p = await tx.pendingMatch.findUnique({ where: { id } });
    if (!p) {
      throw new HTTPException(404, { message: 'pending match not found' });
    }
    if (p.declarerLogin !== me) {
      throw new HTTPException(403, {
        message: 'only the declarer can cancel this match',
      });
    }
    opponentLogin = p.opponentLogin;
    await tx.pendingMatch.delete({ where: { id } });
  });

  if (opponentLogin) {
    emit([opponentLogin], { type: 'match:cancelled', payload: { id, cancelledBy: me } });
  }
  return c.json({ id, status: 'cancelled' });
});

// ── SUPERADMIN : forcer la résolution d'un match en attente ──────────────────

app.post('/admin/matches/:id/force-confirm', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const id = c.req.param('id');

  const match = await prisma.$transaction(async (tx) => {
    const p = await tx.pendingMatch.findUnique({ where: { id } });
    if (!p) throw new HTTPException(404, { message: 'pending match not found' });
    return settlePendingAsPlayed(tx, p);
  });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_MATCH',
    target: match.playerALogin,
    payload: {
      forced: 'confirm',
      matchId: id,
      playerA: match.playerALogin,
      playerB: match.playerBLogin,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    },
  });

  emit([match.playerALogin, match.playerBLogin], { type: 'match:confirmed', payload: match });
  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json(match);
});

app.post('/admin/matches/:id/force-cancel', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const id = c.req.param('id');

  const p = await prisma.pendingMatch.findUnique({ where: { id } });
  if (!p) throw new HTTPException(404, { message: 'pending match not found' });
  await prisma.pendingMatch.delete({ where: { id } });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'DELETE_MATCH',
    target: p.declarerLogin,
    payload: {
      forced: 'cancel',
      matchId: id,
      declarer: p.declarerLogin,
      opponent: p.opponentLogin,
      score: `${p.scoreDeclarer}-${p.scoreOpponent}`,
    },
  });

  emit([p.declarerLogin, p.opponentLogin], { type: 'match:expired', payload: { id } });
  return c.json({ id, status: 'cancelled' });
});

// ── SUPERADMIN : gestion des faux joueurs + forçage de résultat ──────────────

const AdminCreateUserSchema = z.object({
  login: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  campus: z.string().trim().max(40).optional(),
  elo: z.number().int().min(0).max(5000).optional(),
});

app.post('/admin/users', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { login, campus, elo } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    throw new HTTPException(409, { message: `Le login "${login}" existe déjà.` });
  }

  const user = await prisma.user.create({
    data: { login, campus: campus ?? null, elo: elo ?? 1000 },
  });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_STATS',
    target: login,
    payload: { created: true, fake: true, campus: campus ?? null, elo: elo ?? 1000 },
  });

  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json(user);
});

app.delete('/admin/users/:login', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const login = c.req.param('login');

  if (SUPERADMINS.has(login.toLowerCase())) {
    throw new HTTPException(403, { message: 'Un SUPERADMIN ne peut pas être supprimé.' });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) throw new HTTPException(404, { message: 'utilisateur introuvable' });
  if (user.ftId !== null) {
    throw new HTTPException(403, {
      message: 'Seuls les faux comptes (créés manuellement, sans compte 42) peuvent être supprimés.',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.pendingMatch.deleteMany({
      where: { OR: [{ declarerLogin: login }, { opponentLogin: login }] },
    });
    await tx.playedMatch.deleteMany({
      where: { OR: [{ playerALogin: login }, { playerBLogin: login }] },
    });
    await tx.challenge.deleteMany({
      where: { OR: [{ challengerLogin: login }, { opponentLogin: login }] },
    });
    await tx.ops.deleteMany({
      where: { OR: [{ ownerLogin: login }, { targetLogin: login }] },
    });
    await tx.rejectedMatch.deleteMany({
      where: { OR: [{ declarerLogin: login }, { opponentLogin: login }] },
    });
    await tx.featureRequest.deleteMany({ where: { authorId: login } });
    await tx.tournamentEntry.deleteMany({ where: { login } });
    await tx.tournamentMatch.updateMany({ where: { playerALogin: login }, data: { playerALogin: null } });
    await tx.tournamentMatch.updateMany({ where: { playerBLogin: login }, data: { playerBLogin: null } });
    await tx.tournament.updateMany({ where: { winnerLogin: login }, data: { winnerLogin: null } });
    await tx.tournament.deleteMany({ where: { createdByLogin: login } });
    await tx.user.delete({ where: { login } });
  });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_STATS',
    target: login,
    payload: { deletedFakeUser: true },
  });

  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json({ login, deleted: true });
});

// Phrase de confirmation exacte exigée pour le reset total de la base.
// Doit être tapée à la main côté front (copier-coller bloqué) ET renvoyée ici.
const RESET_CONFIRM_PHRASE = 'oui je suis sure de ce que je fais';

// Reset COMPLET de la ligue (SUPERADMIN). Supprime tout l'historique de jeu
// (matchs joués/en attente, défis, ops, rejets, tournois) et remet chaque joueur
// conservé à zéro (ELO 1000, matchs/dodges/trophées 0, titre effacé). Les comptes
// supprimés/anonymisés (joueurs partis) ne sont PAS conservés. Irréversible.
app.post('/admin/reset-database', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);

  const body = await c.req.json().catch(() => ({}));
  if (typeof body.confirm !== 'string' || body.confirm.trim() !== RESET_CONFIRM_PHRASE) {
    throw new HTTPException(400, {
      message: 'Phrase de confirmation incorrecte — reset annulé.',
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Effacer tout l'historique de jeu.
    await tx.pendingMatch.deleteMany({});
    await tx.playedMatch.deleteMany({});
    await tx.challenge.deleteMany({});
    await tx.ops.deleteMany({});
    await tx.rejectedMatch.deleteMany({});
    await tx.tournament.deleteMany({}); // cascade → entries + tournament_matches

    // 2. Retirer définitivement les comptes désactivés / supprimés (joueurs partis),
    //    sauf les SUPERADMIN qui sont toujours préservés.
    const gone = await tx.user.findMany({
      where: { OR: [{ deletionScheduledAt: { not: null } }, { anonymizedAt: { not: null } }] },
      select: { login: true },
    });
    const removeLogins = gone
      .map((u) => u.login)
      .filter((l) => !SUPERADMINS.has(l.toLowerCase()));
    if (removeLogins.length > 0) {
      await tx.featureRequest.deleteMany({ where: { authorId: { in: removeLogins } } });
      await tx.user.deleteMany({ where: { login: { in: removeLogins } } });
    }

    // 3. Remettre tous les joueurs conservés à zéro.
    const reset = await tx.user.updateMany({
      data: { elo: 1000, matchesPlayed: 0, dodgeCount: 0, tournamentsWon: 0, title: null },
    });

    return { removedUsers: removeLogins.length, resetUsers: reset.count };
  });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'RESET_DATABASE',
    target: null,
    payload: result,
  });

  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json({ reset: true, ...result });
});

const AdminForceResultSchema = z
  .object({
    playerA: z.string().trim().min(1),
    playerB: z.string().trim().min(1),
    scoreA: z.number().int().min(0).max(50),
    scoreB: z.number().int().min(0).max(50),
  })
  .refine((d) => d.playerA !== d.playerB, { message: 'Les deux joueurs doivent être différents.' })
  .refine((d) => d.scoreA !== d.scoreB, { message: 'Match nul impossible — il faut un vainqueur.' });

app.post('/admin/matches/force-result', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminForceResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { playerA: pA, playerB: pB, scoreA: sIn, scoreB: sInB } = parsed.data;

  const match = await prisma.$transaction(async (tx) => {
    const [uA, uB] = await Promise.all([
      tx.user.findUnique({ where: { login: pA } }),
      tx.user.findUnique({ where: { login: pB } }),
    ]);
    if (!uA) throw new HTTPException(404, { message: `Joueur introuvable : ${pA}` });
    if (!uB) throw new HTTPException(404, { message: `Joueur introuvable : ${pB}` });

    const [a, b] = pairKey(pA, pB);
    const scoreA = a === pA ? sIn : sInB;
    const scoreB = a === pA ? sInB : sIn;
    const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';

    const userA = a === pA ? uA : uB;
    const userB = a === pA ? uB : uA;
    const update = calculateBabyfootElo(userA.elo, userB.elo, winner, scoreA, scoreB);

    await tx.user.update({
      where: { login: a },
      data: { elo: update.newA, matchesPlayed: { increment: 1 } },
    });
    await tx.user.update({
      where: { login: b },
      data: { elo: update.newB, matchesPlayed: { increment: 1 } },
    });

    return tx.playedMatch.create({
      data: {
        id: randomUUID(),
        playerALogin: a,
        playerBLogin: b,
        scoreA,
        scoreB,
        winner,
        playedAt: new Date(),
        countedForElo: true,
        deltaA: update.deltaA,
        deltaB: update.deltaB,
      },
    });
  });

  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_MATCH',
    target: match.playerALogin,
    payload: {
      forcedResult: true,
      playerA: match.playerALogin,
      playerB: match.playerBLogin,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    },
  });

  emit([match.playerALogin, match.playerBLogin], { type: 'match:confirmed', payload: match });
  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json(match);
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
  // Un adversaire banni / désactivé / anonymisé est hors-jeu : pas de défi.
  await assertTargetable(opponentLogin);
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
    const isOpponentDeclining = ch.opponentLogin === me;
    const newStatus = ch.challengerLogin === me ? 'cancelled' : 'declined';
    await tx.challenge.update({
      where: { id },
      data: { status: newStatus, decidedAt: new Date() },
    });

    // ─── OPS : refus d'un match forcé ─────────────────────────────────────
    // Si la cible (me) refuse un défi de SON traqueur (le challenger) pendant
    // l'OPS actif, et que le quota de 3 matchs forcés n'est pas épuisé, la
    // pénalité est de 3× l'ELO qu'une défaite « normale » aurait coûté — bien
    // plus salée qu'un simple dodge. Vaut même pour un défi seulement "pending".
    let opsPenalty = 0;
    if (isOpponentDeclining) {
      const activeOps = await tx.ops.findFirst({
        where: {
          ownerLogin: ch.challengerLogin,
          targetLogin: me,
          expiresAt: { gt: new Date() },
        },
      });
      if (activeOps && activeOps.forcedUsed < OPS_FORCED_MATCHES) {
        const [target, hunter] = await Promise.all([
          tx.user.findUniqueOrThrow({ where: { login: me } }),
          tx.user.findUniqueOrThrow({ where: { login: ch.challengerLogin } }),
        ]);
        opsPenalty = OPS_REFUSE_MULTIPLIER * estimatedEloLoss(target.elo, hunter.elo);
        await tx.ops.update({
          where: { id: activeOps.id },
          data: { forcedUsed: { increment: 1 } },
        });
      }
    }

    let penalty = 0;
    if (opsPenalty > 0) {
      penalty = opsPenalty;
      await tx.user.update({
        where: { login: me },
        data: {
          elo: { decrement: penalty },
          dodgeCount: { increment: 1 },
        },
      });
    } else if (wasAccepted) {
      penalty = DODGE_ELO_PENALTY;
      await tx.user.update({
        where: { login: me },
        data: {
          elo: { decrement: penalty },
          dodgeCount: { increment: 1 },
        },
      });
    }
    return {
      status: newStatus,
      penalty,
      isOps: opsPenalty > 0,
      challengerLogin: ch.challengerLogin,
      opponentLogin: ch.opponentLogin,
    };
  });
  const otherParty = result.challengerLogin === me ? result.opponentLogin : result.challengerLogin;
  emit([otherParty], {
    type: 'challenge:declined',
    payload: { id, status: result.status, eloPenalty: result.penalty, declinedBy: me },
  });
  // Se désister d'un défi accepté applique une pénalité d'ELO → classement global.
  if (result.penalty > 0) {
    broadcast({ type: 'leaderboard:update', payload: {} });
  }
  // Refus d'un match forcé en OPS : le compteur forcedUsed a bougé → les deux
  // joueurs concernés doivent rafraîchir leur état OPS.
  if (result.isOps) {
    emit([me, otherParty], { type: 'ops:update', payload: { reason: 'forced_refused' } });
  }
  return c.json({ id, status: result.status, eloPenalty: result.penalty, isOps: result.isOps });
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
  // Le défi passe en "recorded" et un match en attente apparaît : les deux joueurs
  // doivent rafraîchir leurs défis ET leurs matchs.
  emit([pending.declarerLogin, pending.opponentLogin], {
    type: 'challenge:recorded',
    payload: { pendingId: pending.id },
  });
  return c.json({ pendingId: pending.id, status: 'pending_confirmation' }, 201);
});

/* ============ TOURNAMENTS ============ */

app.get('/tournaments', async (c) => {
  const me = await getCurrentLogin(c);
  const list = await prisma.tournament.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      entries: { select: { login: true } },
      winner: { select: { login: true, imageUrl: true } },
    },
  });
  // Tournoi privé : visible uniquement par son créateur, ses invités (entries) ou un admin.
  const visible = list.filter(
    (t) =>
      !t.isPrivate ||
      t.createdByLogin === me ||
      isAdmin(me) ||
      t.entries.some((e) => e.login === me),
  );
  return c.json(visible);
});

app.get('/tournaments/:id', async (c) => {
  const me = await getCurrentLogin(c);
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
  // Tournoi privé : accessible uniquement au créateur, aux invités ou à un admin.
  if (
    tournament.isPrivate &&
    tournament.createdByLogin !== me &&
    !isAdmin(me) &&
    !tournament.entries.some((e) => e.login === me)
  ) {
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
      isPrivate: parsed.data.private,
      imageUrl: parsed.data.imageUrl ?? null,
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
    // Tournoi privé : pas d'inscription libre, l'organisateur invite (add-player).
    if (t.isPrivate && t.createdByLogin !== me && !isAdmin(me)) {
      throw new HTTPException(403, { message: 'tournoi privé — sur invitation uniquement' });
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

// Inviter / ajouter directement un joueur existant à un tournoi (organisateur ou
// admin), pendant la phase d'inscription. Auto-démarre si le tournoi devient plein.
const AddTournamentPlayerSchema = z.object({ login: z.string().trim().min(1) });

app.post('/tournaments/:id/add-player', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = AddTournamentPlayerSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const login = parsed.data.login;

  const result = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({ where: { id }, include: { entries: true } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.createdByLogin !== me && !isAdmin(me)) {
      throw new HTTPException(403, {
        message: "seul l'organisateur ou un admin peut inviter des joueurs",
      });
    }
    if (t.status !== 'registration') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    const target = await tx.user.findUnique({ where: { login } });
    if (!target || target.bannedAt || target.anonymizedAt || target.deletionScheduledAt) {
      throw new HTTPException(404, { message: `joueur introuvable : ${login}` });
    }
    if (t.entries.some((e) => e.login === login)) {
      throw new HTTPException(409, { message: 'joueur déjà inscrit' });
    }
    if (t.entries.length >= t.capacity) {
      throw new HTTPException(409, { message: 'tournoi complet' });
    }
    await tx.tournamentEntry.create({ data: { tournamentId: id, login } });
    const newCount = t.entries.length + 1;
    if (newCount === t.capacity) {
      const logins = [...t.entries.map((e) => e.login), login];
      await generateBracket(id, t.capacity, logins);
      await tx.tournament.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      return { autoStarted: true };
    }
    return { autoStarted: false };
  });

  emit([login], { type: 'leaderboard:update', payload: {} });
  return c.json({ id, added: login, status: result.autoStarted ? 'in_progress' : 'registration' });
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
// Durée d'un OPS : 24h (partagée avec le front via @42-league/shared).
// Le cooldown reste plus long : un seul OPS par semaine pour rester un acte fort.
const OPS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Expiration des ops en temps réel ──────────────────────────────────────
// Un ops expire — puis son cooldown se termine — uniquement par le temps, sans
// aucune mutation HTTP → aucun event SSE n'est émis naturellement. On programme
// donc des timers serveur qui poussent `ops:update` aux joueurs concernés au
// moment exact de ces transitions. (OPS_DURATION = 24h < limite setTimeout ~24,8j.)
// La marge de +1s garantit que la requête de relecture voie bien l'ops comme
// expiré (filtre expiresAt > now côté lecture).
function scheduleOpsTimers(ownerLogin: string, targetLogin: string, expiresAt: Date): void {
  const expiryDelay = expiresAt.getTime() - Date.now() + 1000;
  if (expiryDelay > 0) {
    // À l'expiration : `current` (auteur) et `targetedBy` (cible) repassent à null.
    setTimeout(() => {
      emit([ownerLogin, targetLogin], { type: 'ops:update', payload: { reason: 'expired' } });
    }, expiryDelay);
  }
  const cooldownDelay = expiresAt.getTime() + OPS_COOLDOWN_MS - Date.now() + 1000;
  if (cooldownDelay > 0) {
    // À la fin du cooldown : l'auteur peut redéclarer (canDeclareAt franchi).
    setTimeout(() => {
      emit([ownerLogin], { type: 'ops:update', payload: { reason: 'cooldown_ended' } });
    }, cooldownDelay);
  }
}

// Au démarrage, on re-programme les timers des ops encore actifs ou en cooldown :
// les setTimeout sont perdus à chaque redémarrage du process.
async function rescheduleOpsTimers(): Promise<void> {
  const cooldownThreshold = new Date(Date.now() - OPS_COOLDOWN_MS);
  const pending = await prisma.ops.findMany({
    where: { expiresAt: { gt: cooldownThreshold } },
  });
  for (const o of pending) scheduleOpsTimers(o.ownerLogin, o.targetLogin, o.expiresAt);
}

app.get('/ops', async (c) => {
  await getCurrentLogin(c);
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
  // Une cible bannie / désactivée / anonymisée est hors-jeu : pas d'OPS.
  await assertTargetable(target);
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
  emit([me, target], { type: 'ops:update', payload: ops });
  // Programme l'émission de `ops:update` à l'expiration + fin de cooldown.
  scheduleOpsTimers(me, target, ops.expiresAt);
  return c.json(ops, 201);
});

app.get('/ops/user/:login', async (c) => {
  await getCurrentLogin(c);
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
  const { user, tournamentsChanged } = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { login }, data: { bannedAt: new Date() } })
      .catch(() => { throw new HTTPException(404, { message: 'user not found' }); });
    // Un banni quitte les tournois : ceux qu'il a créés disparaissent, et sa
    // place est libérée là où il n'était qu'inscrit (phase d'inscription).
    const changed = await purgeUserFromTournaments(tx, login);
    // Ses défis/duels en cours sont annulés (plus de duel actif pour lui).
    await cancelUserChallenges(tx, login);
    return { user: u, tournamentsChanged: changed };
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'BAN_USER',
    target: login,
  });
  if (tournamentsChanged) broadcast({ type: 'tournament:update', payload: {} });
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

app.delete('/admin/rejected-matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const { id } = c.req.param();
  const row = await prisma.rejectedMatch.findUnique({ where: { id } });
  if (!row) throw new HTTPException(404, { message: 'rejected match not found' });
  await prisma.rejectedMatch.delete({ where: { id } });
  void logAdminAction(c, {
    actor: me, actorRole: await getUserRole(me),
    action: 'DELETE_REJECTED_MATCH',
    target: row.declarerLogin,
    payload: { id, declarerLogin: row.declarerLogin, opponentLogin: row.opponentLogin },
  });
  return c.json({ id, deleted: true });
});

app.delete('/admin/pending-matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const { id } = c.req.param();
  const row = await prisma.pendingMatch.findUnique({ where: { id } });
  if (!row) throw new HTTPException(404, { message: 'pending match not found' });
  await prisma.pendingMatch.delete({ where: { id } });
  emit([row.declarerLogin, row.opponentLogin], { type: 'match:cancelled', payload: { id, cancelledBy: me } });
  void logAdminAction(c, {
    actor: me, actorRole: await getUserRole(me),
    action: 'DELETE_PENDING_MATCH',
    target: row.declarerLogin,
    payload: { id, declarerLogin: row.declarerLogin, opponentLogin: row.opponentLogin },
  });
  return c.json({ id, deleted: true });
});

app.delete('/admin/challenges/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const { id } = c.req.param();
  const row = await prisma.challenge.findUnique({ where: { id } });
  if (!row) throw new HTTPException(404, { message: 'challenge not found' });
  await prisma.challenge.delete({ where: { id } });
  void logAdminAction(c, {
    actor: me, actorRole: await getUserRole(me),
    action: 'DELETE_CHALLENGE',
    target: row.challengerLogin,
    payload: { id, challengerLogin: row.challengerLogin, opponentLogin: row.opponentLogin, status: row.status },
  });
  return c.json({ id, deleted: true });
});

app.delete('/admin/ops/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const { id } = c.req.param();
  const row = await prisma.ops.findUnique({ where: { id } });
  if (!row) throw new HTTPException(404, { message: 'ops not found' });
  await prisma.ops.delete({ where: { id } });
  emit([row.ownerLogin, row.targetLogin], { type: 'ops:update', payload: {} });
  void logAdminAction(c, {
    actor: me, actorRole: await getUserRole(me),
    action: 'DELETE_OPS',
    target: row.ownerLogin,
    payload: { id, ownerLogin: row.ownerLogin, targetLogin: row.targetLogin },
  });
  return c.json({ id, deleted: true });
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

// ── Admin all-history : timeline unifiée ──────────────────────────────────
app.get('/admin/all-history', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const url = new URL(c.req.url);
  const loginFilter = url.searchParams.get('login') ?? undefined;
  const typeFilter = url.searchParams.get('type') ?? undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 1000);

  const loginWhere = loginFilter
    ? { OR: [{ challengerLogin: loginFilter }, { opponentLogin: loginFilter }] }
    : {};
  const loginWhereAB = loginFilter
    ? { OR: [{ playerALogin: loginFilter }, { playerBLogin: loginFilter }] }
    : {};
  const loginWhereDO = loginFilter
    ? { OR: [{ declarerLogin: loginFilter }, { opponentLogin: loginFilter }] }
    : {};
  const loginWhereOps = loginFilter
    ? { OR: [{ ownerLogin: loginFilter }, { targetLogin: loginFilter }] }
    : {};

  const [challenges, pending, played, rejected, ops] = await Promise.all([
    (!typeFilter || typeFilter === 'challenge')
      ? prisma.challenge.findMany({ where: loginWhere, orderBy: { createdAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'pending_match')
      ? prisma.pendingMatch.findMany({ where: loginWhereDO, orderBy: { declaredAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'played_match')
      ? prisma.playedMatch.findMany({ where: loginWhereAB, orderBy: { playedAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'rejected_match')
      ? prisma.rejectedMatch.findMany({ where: loginWhereDO, orderBy: { rejectedAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'ops')
      ? prisma.ops.findMany({ where: loginWhereOps, orderBy: { declaredAt: 'desc' }, take: limit })
      : Promise.resolve([]),
  ]);

  type Event = {
    id: string;
    type: 'challenge' | 'pending_match' | 'played_match' | 'rejected_match' | 'ops';
    at: string;
    playerA: string;
    playerB: string;
    status?: string;
    scoreA?: number;
    scoreB?: number;
    winner?: string;
    deltaA?: number;
    deltaB?: number;
    countedForElo?: boolean;
    contestReason?: string;
    contestMessage?: string;
    forcedUsed?: number;
    scheduledAt?: string;
    decidedAt?: string | null;
    expiresAt?: string;
  };

  const events: Event[] = [
    ...challenges.map((c) => ({
      id: c.id,
      type: 'challenge' as const,
      at: c.createdAt.toISOString(),
      playerA: c.challengerLogin,
      playerB: c.opponentLogin,
      status: c.status,
      scheduledAt: c.scheduledAt.toISOString(),
      decidedAt: c.decidedAt?.toISOString() ?? null,
    })),
    ...pending.map((p) => ({
      id: p.id,
      type: 'pending_match' as const,
      at: p.declaredAt.toISOString(),
      playerA: p.declarerLogin,
      playerB: p.opponentLogin,
      scoreA: p.scoreDeclarer,
      scoreB: p.scoreOpponent,
    })),
    ...played.map((m) => ({
      id: m.id,
      type: 'played_match' as const,
      at: m.playedAt.toISOString(),
      playerA: m.playerALogin,
      playerB: m.playerBLogin,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: m.winner,
      deltaA: m.deltaA,
      deltaB: m.deltaB,
      countedForElo: m.countedForElo,
    })),
    ...rejected.map((r) => ({
      id: r.id,
      type: 'rejected_match' as const,
      at: r.rejectedAt.toISOString(),
      playerA: r.declarerLogin,
      playerB: r.opponentLogin,
      scoreA: r.scoreDeclarer,
      scoreB: r.scoreOpponent,
      contestReason: r.contestReason,
      contestMessage: r.contestMessage,
    })),
    ...ops.map((o) => ({
      id: o.id,
      type: 'ops' as const,
      at: o.declaredAt.toISOString(),
      playerA: o.ownerLogin,
      playerB: o.targetLogin,
      forcedUsed: o.forcedUsed,
      expiresAt: o.expiresAt.toISOString(),
    })),
  ];

  events.sort((a, b) => b.at.localeCompare(a.at));
  return c.json(events.slice(0, limit));
});

// ── RGPD Art. 5(1)(e) — Purge automatique des logs admin après 24 mois ──
async function purgeOldAuditLogs(): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  const { count } = await prisma.adminAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  if (count > 0) console.log(`[purge] ${count} audit log entries older than 24 months deleted`);
}

// ── Expiration des matchs en attente non confirmés ──
// Un PendingMatch jamais confirmé ni refusé reste affiché indéfiniment et pollue
// l'UI des deux joueurs. On les purge après PENDING_MATCH_TTL_HOURS et on notifie
// les deux camps pour que leur liste se rafraîchisse.
const PENDING_MATCH_TTL_HOURS = Number(process.env.PENDING_MATCH_TTL_HOURS ?? 72);

async function purgeStalePendingMatches(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_MATCH_TTL_HOURS * 60 * 60 * 1000);
  const stale = await prisma.pendingMatch.findMany({
    where: { declaredAt: { lt: cutoff } },
    select: { id: true, declarerLogin: true, opponentLogin: true },
  });
  if (stale.length === 0) return;
  await prisma.pendingMatch.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
  for (const m of stale) {
    emit([m.declarerLogin, m.opponentLogin], {
      type: 'match:expired',
      payload: { id: m.id },
    });
  }
  console.log(
    `[purge] ${stale.length} pending match(es) older than ${PENDING_MATCH_TTL_HOURS}h deleted`,
  );
}

// ── RGPD Art. 17 — Anonymisation différée des comptes supprimés ──
// Les comptes dont la suppression a été demandée il y a plus de
// ACCOUNT_GRACE_DAYS jours (et pas encore anonymisés) sont anonymisés
// définitivement. Une reconnexion avant l'échéance a remis deletionScheduledAt
// à null (getOrCreateUser), donc ils n'apparaissent jamais ici.
async function purgeScheduledDeletions(): Promise<void> {
  const cutoff = new Date(Date.now() - ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.user.findMany({
    where: { deletionScheduledAt: { lt: cutoff }, anonymizedAt: null },
    select: { login: true },
  });
  for (const u of due) {
    await anonymizeAccount(u.login);
  }
  if (due.length > 0) {
    console.log(
      `[purge] ${due.length} account(s) anonymized after ${ACCOUNT_GRACE_DAYS}-day grace period`,
    );
  }
}

const port = Number(process.env.PORT ?? 3000);

// En environnement de test (NODE_ENV=test), on importe `app` pour le tester via
// app.request(...) SANS démarrer le serveur HTTP ni les timers de fond (purge,
// ops). Sinon vitest ne se terminerait jamais (handles ouverts).
if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`42 League backend listening on http://localhost:${info.port}`);
    rescheduleOpsTimers().catch((err) => {
      console.error('failed to reschedule ops timers', err);
    });
    const runDailyPurges = () => {
      purgeOldAuditLogs().catch((err) => {
        console.error('failed to purge old audit logs', err);
      });
      purgeStalePendingMatches().catch((err) => {
        console.error('failed to purge stale pending matches', err);
      });
      purgeScheduledDeletions().catch((err) => {
        console.error('failed to purge scheduled account deletions', err);
      });
    };
    runDailyPurges();
    // Purge quotidienne à 03h00
    const msUntil3am = (() => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(3, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.getTime() - now.getTime();
    })();
    setTimeout(() => {
      runDailyPurges();
      setInterval(runDailyPurges, 24 * 60 * 60 * 1000);
    }, msUntil3am);
  });
}
