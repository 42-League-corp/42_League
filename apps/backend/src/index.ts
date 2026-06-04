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
  BugReportSchema,
  SetBugReportStatusSchema,
  SetRoleSchema,
  SetFeatureRequestStatusSchema,
  FavoritesUpdateSchema,
  Declare2v2MatchSchema,
  Confirm2v2MatchSchema,
  CreateChallenge2v2Schema,
  DeclareFfaSchema,
  ConfirmFfaPositionSchema,
  ContestFfaSchema,
  calculateBabyfootElo,
  calculateFfaElo,
  shouldCountForElo,
  estimatedEloLoss,
  OPS_DURATION_MS,
  OPS_FORCED_MATCHES,
  OPS_REFUSE_MULTIPLIER,
  rankFloor,
  ownedTitles,
} from '@42-league/shared';
import {
  GAME_IDS,
  applyGameElo,
  eloOrderBy,
  parseGameId,
  projectStats,
  ratingUpdate,
  readElo,
  tournamentsWonDelta,
  validateTournamentScore,
} from './games.js';
import { prisma } from './db.js';
import {
  canonicalTeamLogins,
  upsertBabyfootTeam,
  applyElo2v2,
  type Side2v2,
} from './babyfoot2v2.js';
import { seedStaging } from './staging-seed.js';
import type { Prisma } from '@prisma/client';
// Valeur runtime (Prisma.DbNull) pour stocker un JSON NULL en base — distinct du
// `import type` ci-dessus qui, lui, ne sert qu'aux annotations de type.
import { Prisma as PrismaRuntime } from '@prisma/client';
import {
  createAuthRouter,
  getAllowedWebOrigins,
  getSessionLogin,
  isTrusted42Origin,
  type FtProfile,
} from './auth.js';
import { backfillMissingProfiles, fetchAndSavePublicUser } from './ft-api.js';
import { getCampusLocations } from './locations.js';
import {
  advanceWinner,
  generateBracket,
  generatePools,
  qualifiersFromPools,
} from './tournament.js';
import { isAdmin } from './admins.js';
import { streamSSE } from 'hono/streaming';
import { registerSse, emit, broadcast, type SseEvent } from './sse.js';
import { issueStreamToken, issueToken, verifyStreamToken, verifyToken } from './tokens.js';
import { logAdminAction } from './audit.js';
import { rateLimit, clientIp, clearPenalty, getPenaltyInfo } from './rate-limit.js';

// Hardcoded — immutable. No API can grant or revoke this.
const SUPERADMINS = new Set(['abidaux', 'throbert']);

// Compte de test générique (rôle USER, cf. staging-seed.ts) sur lequel un admin
// peut basculer pour vivre l'expérience d'un joueur lambda (POST /admin/impersonate-tester).
const TESTER_LOGIN = 'tester';
// Comptes tester éphémères créés à la volée (bouton « nouveau compte tester ») :
// login unique préfixé `tester-…`. Reconnus comme comptes de test pour la staging
// gate, afin qu'un compte fraîchement créé puisse naviguer sans liste blanche.
const FRESH_TESTER_PREFIX = `${TESTER_LOGIN}-`;
const isTesterLogin = (login: string) =>
  login === TESTER_LOGIN || login.startsWith(FRESH_TESTER_PREFIX);

// Backdoor de dev : le header `x-dev-login` permet de se faire passer pour
// n'importe quel utilisateur SANS OAuth. Il est donc STRICTEMENT réservé au dev
// local et n'est honoré que si ALLOW_DEV_LOGIN=true est explicitement positionné.
// Fail-secure : par défaut (prod) le flag est absent → le header est ignoré.
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true';

// =========================================================================
// CONSENTEMENT RGPD — preuve + version (CGU API 42, Art. 4.2 et Art. 3.1)
// =========================================================================
// Les CGU 42 exigent le consentement explicite de l'utilisateur final AVANT
// tout traitement de ses Données personnelles. On versionne la politique : si
// elle évolue, on bumpe CURRENT_TERMS_VERSION → tous les utilisateurs doivent
// re-consentir. La preuve (date + version) est stockée sur la ligne User.
// Format : 'YYYY-MM-DD' (date de la dernière révision de la politique affichée).
export const CURRENT_TERMS_VERSION = '2026-05-31';

/** Un consentement est requis si jamais donné, ou donné pour une version périmée. */
function consentRequired(user: { termsAcceptedAt: Date | null; termsVersion: string | null } | null): boolean {
  if (!user) return false; // pas encore en base → géré par l'auth, pas par la gate
  return !user.termsAcceptedAt || user.termsVersion !== CURRENT_TERMS_VERSION;
}

// Chemins exemptés de la consent-gate : ils DOIVENT fonctionner avant consentement
// (découverte de l'état, prise/retrait du consentement, droits RGPD, auth, SSE).
const CONSENT_EXEMPT_PATHS = new Set(['/health', '/me', '/me/consent', '/me/export', '/me/account', '/events']);
function isConsentExempt(path: string): boolean {
  return CONSENT_EXEMPT_PATHS.has(path) || path.startsWith('/auth/');
}

// =========================================================================
// PERMISSIONS MODÉRATEUR
// =========================================================================
// Clé → route(s) débloquée(s). ADMIN/SUPERADMIN passent partout sans vérification.
const MODERATOR_PERMISSIONS = [
  'canBan',                  // ban / unban users
  'canEditStats',            // PATCH /admin/users/:login/stats
  'canDeleteMatches',        // DELETE /admin/matches/:id
  'canEditMatches',          // PATCH  /admin/matches/:id
  'canDeletePendingMatches', // DELETE /admin/pending-matches/:id
  'canDeleteRejectedMatches',// GET + DELETE /admin/rejected-matches
  'canDeleteChallenges',     // DELETE /admin/challenges/:id
  'canDeleteOps',            // DELETE /admin/ops/:id
  'canDeleteTournaments',    // DELETE /admin/tournaments/:id
  'canViewSuspicious',       // GET /admin/suspicious
  'canViewAuditLog',         // GET /admin/audit-log
  'canViewHistory',          // GET /admin/all-history
] as const;

type ModeratorPermission = (typeof MODERATOR_PERMISSIONS)[number];
type ModeratorPermissions = Partial<Record<ModeratorPermission, boolean>>;

async function getUserRole(login: string): Promise<'USER' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN'> {
  if (SUPERADMINS.has(login.toLowerCase())) return 'SUPERADMIN';
  const u = await prisma.user.findUnique({ where: { login }, select: { role: true } });
  return (u?.role as 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN') ?? 'USER';
}

async function requireSuperAdmin(login: string): Promise<void> {
  // Garde-fou absolu : SUPERADMIN est uniquement abidaux et throbert (hardcodé).
  // Aucune route API ne peut accorder ce statut.
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

/** Tout admin ou modérateur (pour les routes de consultation basique). */
async function requireAdminOrModerator(login: string): Promise<void> {
  const role = await getUserRole(login);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN' && role !== 'MODERATOR') {
    throw new HTTPException(403, { message: 'admins only' });
  }
}

/**
 * Vérifie qu'un login a la permission demandée :
 * - ADMIN/SUPERADMIN → toujours autorisé
 * - MODERATOR → autorisé si la permission est dans moderatorPermissions
 * - USER → toujours refusé
 */
async function requirePerm(login: string, perm: ModeratorPermission): Promise<void> {
  const role = await getUserRole(login);
  if (role === 'ADMIN' || role === 'SUPERADMIN') return;
  if (role === 'MODERATOR') {
    const u = await prisma.user.findUnique({ where: { login }, select: { moderatorPermissions: true } });
    const perms = u?.moderatorPermissions as ModeratorPermissions | null;
    if (perms?.[perm]) return;
  }
  throw new HTTPException(403, { message: 'insufficient permissions' });
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

// Supprime les FFA Smash EN ATTENTE impliquant un compte qui sort du jeu (ban /
// désactivation / anonymisation) — qu'il en soit le déclarant ou un participant.
// Cascade : la suppression d'un PendingFfa retire ses participants. Renvoie true
// si au moins un FFA en attente a été annulé.
async function cancelUserFfas(tx: Prisma.TransactionClient, login: string): Promise<boolean> {
  const res = await tx.pendingFfa.deleteMany({
    where: { OR: [{ declarerLogin: login }, { participants: { some: { login } } }] },
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

// ── Notifications in-app ──────────────────────────────────────────────────
// Crée une notification et pousse un signal SSE 'notification' pour rafraîchir
// la cloche instantanément (le front poll aussi toutes les 30s en secours).
// Tolérant aux erreurs : une notif ratée ne doit jamais casser l'action métier.
interface NotifInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Jeu d'origine (couleur/emoji + bascule de mode au clic). Absent = transverse. */
  game?: string;
}

async function notify(to: string, n: NotifInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: { id: randomUUID(), recipientLogin: to, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, game: n.game ?? null },
    });
    emit([to], { type: 'notification', payload: {} });
  } catch {
    /* noop — best effort */
  }
}

async function notifyMany(tos: string[], n: NotifInput): Promise<void> {
  if (tos.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: tos.map((to) => ({ id: randomUUID(), recipientLogin: to, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, game: n.game ?? null })),
    });
    emit(tos, { type: 'notification', payload: {} });
  } catch {
    /* noop */
  }
}

// Jeu d'un tournoi (best-effort) — pour teinter les notifs liées à un tournoi.
async function tournamentGame(id: string): Promise<string | undefined> {
  const t = await prisma.tournament
    .findUnique({ where: { id }, select: { game: true } })
    .catch(() => null);
  return t?.game ?? undefined;
}

// Annonce un nouveau joueur à tous les membres visibles de la league.
async function announceNewPlayer(login: string): Promise<void> {
  try {
    const others = await prisma.user.findMany({
      where: { ...VISIBLE_USER_WHERE, login: { not: login } },
      select: { login: true },
    });
    await notifyMany(others.map((u) => u.login), {
      type: 'new_player',
      title: `Nouveau joueur : @${login}`,
      body: `${login} a rejoint la league`,
      link: `/player/${encodeURIComponent(login)}`,
    });
  } catch {
    /* noop */
  }
}

// ── Followers : notifie les abonnés d'un joueur selon leurs préférences ──────
type FollowPref = 'notifyTournament' | 'notifyTop3' | 'notifyTrophy' | 'notifyOps';

async function notifyFollowers(followee: string, pref: FollowPref, n: NotifInput): Promise<void> {
  try {
    const follows = await prisma.follow.findMany({
      where: { followeeLogin: followee, [pref]: true },
      select: { followerLogin: true },
    });
    await notifyMany(follows.map((f) => f.followerLogin), n);
  } catch {
    /* noop */
  }
}

// Notifie les abonnés quand un joueur ENTRE dans le top 3 (transition only).
async function maybeNotifyTop3(login: string, delta: number): Promise<void> {
  if (delta <= 0) return; // pas de montée → rien
  try {
    const users = await prisma.user.findMany({ where: VISIBLE_USER_WHERE, select: { login: true, elo: true } });
    const self = users.find((u) => u.login === login);
    if (!self) return;
    const others = users.filter((u) => u.login !== login);
    const newRank = others.filter((u) => u.elo > self.elo).length + 1;
    const oldRank = others.filter((u) => u.elo > self.elo - delta).length + 1;
    if (oldRank > 3 && newRank <= 3) {
      await notifyFollowers(login, 'notifyTop3', {
        type: 'follow_top3',
        title: `@${login} entre dans le top 3`,
        body: `#${newRank} au classement`,
        link: '/leaderboard',
        game: 'babyfoot',
      });
    }
  } catch {
    /* noop */
  }
}

// Badges d'un joueur : badges par défaut dérivés du rôle (admin/superadmin) et
// du fondateur (throbert), suivis des badges gagnés (stockés en base).
async function badgesFor(login: string, role: string): Promise<string[]> {
  const earned = await prisma.userBadge.findMany({
    where: { userLogin: login },
    select: { code: true },
    orderBy: { awardedAt: 'asc' },
  });
  const out: string[] = [];
  if (login.toLowerCase() === 'throbert') out.push('founder');
  if (role === 'SUPERADMIN') out.push('superadmin');
  else if (role === 'ADMIN') out.push('admin');
  for (const e of earned) out.push(e.code);
  return [...new Set(out)];
}

// Palmarès d'un joueur : ses classements finaux par saison (récents d'abord).
async function palmaresFor(login: string): Promise<
  { seasonId: string; seasonName: string; rank: number; elo: number; wins: number; losses: number }[]
> {
  // Palmarès = classements babyfoot (un par saison) pour éviter les doublons
  // multi-jeux dans la liste du profil.
  const standings = await prisma.seasonStanding.findMany({ where: { login, game: 'babyfoot' } });
  if (!standings.length) return [];
  const seasons = await prisma.season.findMany({
    where: { id: { in: standings.map((s) => s.seasonId) } },
    select: { id: true, name: true, startedAt: true },
  });
  const byId = new Map(seasons.map((s) => [s.id, s]));
  return standings
    .map((s) => ({
      seasonId: s.seasonId,
      seasonName: byId.get(s.seasonId)?.name ?? 'Saison',
      rank: s.rank,
      elo: s.elo,
      wins: s.wins,
      losses: s.losses,
      _t: byId.get(s.seasonId)?.startedAt?.getTime() ?? 0,
    }))
    .sort((a, b) => b._t - a._t)
    .map(({ _t, ...rest }) => rest);
}

// Titres POSSÉDÉS par un joueur (dérivés de ses accomplissements). On agrège
// ses badges, le total de tournois gagnés (toutes disciplines) et son rang dans
// sa discipline principale, puis on délègue la dérivation au module pur
// `ownedTitles` (@42-league/shared/titles), partagé avec le frontend.
async function ownedTitlesFor(
  login: string,
  role: string,
  user: { tournamentsWon: number; tournamentsWonSmash: number; tournamentsWonChess: number; tournamentsWonSf: number; games: string[] } | null,
): Promise<{ key: string; label: string }[]> {
  if (!user) return [];
  const badges = await badgesFor(login, role);
  const tournamentsWon =
    user.tournamentsWon + user.tournamentsWonSmash + user.tournamentsWonChess + user.tournamentsWonSf;
  // Rang dans la discipline principale (1er mode adhéré, défaut babyfoot).
  const primaryGame = parseGameId(user.games?.[0]);
  const ranked = await prisma.user.findMany({
    where: { ...VISIBLE_USER_WHERE, games: { has: primaryGame } },
    orderBy: eloOrderBy(primaryGame),
    select: { login: true },
  });
  const idx = ranked.findIndex((u) => u.login === login);
  const rank = idx >= 0 ? idx + 1 : null;
  return ownedTitles({ login, badges, tournamentsWon, rank });
}

async function getOrCreateUser(login: string, profile?: FtProfile) {
  const forceSuperAdmin = SUPERADMINS.has(login.toLowerCase());
  // Sert à détecter un tout nouveau compte (pour notifier la league).
  const existed = await prisma.user.findUnique({ where: { login }, select: { login: true } });
  const user = await prisma.user.upsert({
    where: { login },
    update: {
      ...(profile
        ? {
            ftId: profile.ftId,
            campus: profile.campus,
            firstName: profile.firstName,
            lastName: profile.lastName,
            imageUrl: profile.imageUrl,
          }
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
  // Nouveau membre → on prévient le reste de la league (fire-and-forget).
  if (!existed) {
    void announceNewPlayer(login);
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
    // Uniquement un token de scope 'sse' (éphémère) — surtout pas le Bearer
    // complet : la query string fuite dans les logs / l'historique / le Referer.
    const login = verifyStreamToken(queryToken, secret);
    if (login) return login;
  }
  const devLogin = c.req.header('x-dev-login');
  if (ALLOW_DEV_LOGIN && devLogin) return devLogin;
  throw new HTTPException(401, { message: 'not authenticated' });
}

const WEB_APP_ORIGINS = new Set(getAllowedWebOrigins());

export const app = new Hono();
// =========================================================================
// MIDDLEWARE CORS + PNA BLINDÉ
// =========================================================================
app.use('*', async (c, next) => {
  const reqOrigin = c.req.header('origin') || c.req.header('Origin');
  
  // Autoriser l'origine si elle est dans la liste WEB_APP_ORIGINS (chargée depuis .env) 
  // ou si c'est l'intra 42
  const isAllowed = !!reqOrigin && (WEB_APP_ORIGINS.has(reqOrigin) || isTrusted42Origin(reqOrigin));
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

  // Les admins (rôle ADMIN ou SUPERADMIN) contournent le rate-limit : leur IP
  // peut légitimement générer beaucoup de requêtes (onglets dev, SSE, modération,
  // reconnexions…). On vérifie la signature du token pour ne pas ouvrir un trou
  // de sécurité, puis le rôle. Les rôles ADMIN vivant en DB, on met en cache les
  // logins admin (TTL 30 s) pour ne pas taper la base à chaque requête.
  let adminLoginCache: Set<string> | null = null;
  let adminCacheExpiry = 0;
  const getAdminLogins = async (): Promise<Set<string>> => {
    const now = Date.now();
    if (adminLoginCache && now < adminCacheExpiry) return adminLoginCache;
    const rows = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
      select: { login: true },
    });
    const set = new Set(rows.map((r) => r.login.toLowerCase()));
    for (const s of SUPERADMINS) set.add(s.toLowerCase());
    adminLoginCache = set;
    adminCacheExpiry = now + 30_000;
    return set;
  };
  const isAdminRequest = async (c: Context): Promise<boolean> => {
    const auth = c.req.header('authorization');
    if (!auth?.startsWith('Bearer ')) return false;
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;
    const login = verifyToken(auth.slice(7), secret);
    if (!login) return false;
    if (SUPERADMINS.has(login.toLowerCase())) return true;
    return (await getAdminLogins()).has(login.toLowerCase());
  };
  // Combine l'exemption admin avec une condition de skip de base (ex. non-mutation).
  const orAdmin = (base?: (c: Context) => boolean) => async (c: Context) =>
    (await isAdminRequest(c)) || (base ? base(c) : false);

  // Clé de comptage : par utilisateur (login signé) quand authentifié, sinon par
  // IP. Tout le campus 42 sort derrière une seule IP publique (NAT) ; compter par
  // IP additionnerait les requêtes de tous les joueurs et déclencherait le
  // backstop alors que chacun navigue normalement. Le login vient du Bearer signé,
  // donc non falsifiable. Fallback IP pour les requêtes pré-auth (OAuth).
  const bySubject = (c: Context): string => {
    const auth = c.req.header('authorization');
    const secret = process.env.SESSION_SECRET;
    if (auth?.startsWith('Bearer ') && secret) {
      const login = verifyToken(auth.slice(7), secret);
      if (login) return `user:${login.toLowerCase()}`;
    }
    return `ip:${clientIp(c)}`;
  };

  // Backstop global (120/min par joueur). Les admins sont exemptés. Pas de
  // pénalité progressive : un burst de navigation (refresh = ~10 requêtes) ne
  // doit jamais déclencher un ban croissant — au pire un 429 qui se purge à la
  // fin de la fenêtre de 60 s. L'escalade reste sur l'auth (brute-force) et les
  // écritures (spam de mutations).
  app.use('*', rateLimit({ name: 'global', windowMs: 60_000, max: 120, key: bySubject, progressive: false, skip: orAdmin() }));

  // Auth : protège l'échange OAuth contre le brute-force. Pré-auth → clé par IP.
  app.use('/auth/*', rateLimit({
    name: 'auth', windowMs: 15 * 60_000, max: 50,
    skip: (c) => c.req.path === '/auth/stream-token',
  }));

  // Quotas par action (24 h) — pénalités progressives en cas de spam. Par joueur
  // (sinon le quota serait partagé par tout le campus). Admins exemptés.
  app.use('/matches',     rateLimit({ name: 'matches-declare',   windowMs: 24 * 3600_000, max: 10, key: bySubject, skip: orAdmin((c) => !isMutation(c)) }));
  // `/matches` est un matcher EXACT → ne couvre pas `/matches/ffa`. Quota dédié à
  // la déclaration FFA (la liste GET est exemptée via `!isMutation`).
  app.use('/matches/ffa', rateLimit({ name: 'ffa-declare',       windowMs: 24 * 3600_000, max: 10, key: bySubject, skip: orAdmin((c) => !isMutation(c)) }));
  app.use('/challenges',  rateLimit({ name: 'challenges-create', windowMs: 24 * 3600_000, max: 10, key: bySubject, skip: orAdmin((c) => !isMutation(c)) }));
  app.use('/tournaments', rateLimit({ name: 'tournaments-create',windowMs: 24 * 3600_000, max: 5,  key: bySubject, skip: orAdmin((c) => !isMutation(c)) }));

  // Écriture générale (mutations restantes), par joueur. Admins exemptés.
  const writeLimiter = rateLimit({ name: 'write', windowMs: 60_000, max: 30, key: bySubject, skip: orAdmin((c) => !isMutation(c)) });
  for (const path of ['/matches/*', '/challenges/*', '/tournaments/*', '/ops', '/feature-requests', '/bug-reports']) {
    app.use(path, writeLimiter);
  }
}

// =========================================================================
// STAGING GATE — accès réservé à une liste blanche (APP_ENV=staging)
// =========================================================================
// Sur l'environnement de staging UNIQUEMENT, toute l'API est réservée aux logins
// de STAGING_ALLOWED. On exempte la santé, tout le flux d'auth/OAuth (sinon
// impossible de se connecter) et /me (le front le lit pour afficher l'écran
// « accès réservé » côté non-autorisé). Défense en profondeur : même un appel API
// direct par un login non autorisé est refusé ici, pas seulement masqué côté front.
//
// throbert & abidaux sont superadmins ; jagharra est invité pour les tests
// (rôle ADMIN, jamais superadmin — cf. staging-seed.ts) ; tester est le compte
// USER générique de l'impersonation (cf. POST /admin/impersonate-tester).
const STAGING_ALLOWED = new Set([...SUPERADMINS, 'jagharra', TESTER_LOGIN]);
if (process.env.APP_ENV === 'staging') {
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();
    const p = c.req.path;
    if (p === '/health' || p.startsWith('/auth') || p === '/me' || p.startsWith('/me/')) {
      return next();
    }
    const login = await getSessionLogin(c);
    if (!login) throw new HTTPException(401, { message: 'staging: connexion requise' });
    if (!STAGING_ALLOWED.has(login.toLowerCase()) && !isTesterLogin(login.toLowerCase())) {
      // Vérifie le flag stagingAllowed en base (accordé via /admin/users/:login/staging-access).
      // Basé sur APP_ENV (var serveur) + DB → non falsifiable par un header client.
      const user = await prisma.user.findUnique({ where: { login }, select: { stagingAllowed: true } });
      if (!user?.stagingAllowed) {
        throw new HTTPException(403, { message: 'staging: accès réservé' });
      }
    }
    return next();
  });
}

// =========================================================================
// CONSENT-GATE — application côté serveur du consentement RGPD
// =========================================================================
// Défense en profondeur : la modale frontend peut être contournée (appel direct
// à l'API, client modifié…). Cette gate garantit qu'AUCUNE donnée 42 n'est lue ni
// écrite tant que l'utilisateur n'a pas consenti — conformément aux CGU 42 qui
// interdisent tout traitement sans consentement explicite préalable.
//
// Logique fail-safe :
//  - Requête non authentifiée → on laisse passer (la route renverra 401 elle-même).
//  - Chemin exempté (auth, /me, consentement, droits RGPD, SSE) → on laisse passer.
//  - Sinon, on vérifie le consentement en base ; s'il manque → 403 consent_required.
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  if (isConsentExempt(c.req.path)) return next();

  const login = await getSessionLogin(c);
  if (!login && !(ALLOW_DEV_LOGIN && c.req.header('x-dev-login'))) return next();
  const effectiveLogin = login ?? c.req.header('x-dev-login');
  if (!effectiveLogin) return next();

  const user = await prisma.user.findUnique({
    where: { login: effectiveLogin },
    select: { termsAcceptedAt: true, termsVersion: true },
  });
  if (consentRequired(user)) {
    throw new HTTPException(403, { message: 'consent_required' });
  }
  return next();
});

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
app.use('/bug-reports', panelUpdate);
app.use('/bug-reports/*', panelUpdate);

// Gestionnaire d'erreurs global (pour que le CORS soit là même sur une erreur 401 !)
app.onError((err, c) => {
  const reqOrigin = c.req.header('origin') || c.req.header('Origin');
  // Même validation stricte que le middleware CORS (hostname exact, pas de
  // sous-chaîne) — et on reflète aussi les origines de l'app web pour qu'elle
  // puisse lire le corps des erreurs (401/403…).
  const allowedOrigin =
    reqOrigin && (WEB_APP_ORIGINS.has(reqOrigin) || isTrusted42Origin(reqOrigin))
      ? reqOrigin
      : 'https://profile.intra.42.fr';

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
  const n = await backfillMissingProfiles();
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

// Cosmétiques actuellement ÉQUIPÉS par un joueur (achetés en boutique) : couleur
// du titre, badge acheté (rendu via une def inline côté front), et image de bannière
// (fond de la carte profil). Renvoyés par /me et /users/:login pour l'affichage profil.
interface EquippedCosmetics {
  titleColor: string | null;
  equippedBadge: { code: string; label: string; icon: string; color: string | null } | null;
  equippedBanner: string | null;
}
async function equippedCosmetics(login: string): Promise<EquippedCosmetics> {
  const rows = await prisma.shopInventory.findMany({
    where: { userLogin: login, equipped: true, item: { category: { in: ['title', 'badge', 'banner'] } } },
    include: { item: true },
  });
  const out: EquippedCosmetics = { titleColor: null, equippedBadge: null, equippedBanner: null };
  for (const r of rows) {
    const it = r.item;
    const payload =
      it.payload && typeof it.payload === 'object' && !Array.isArray(it.payload)
        ? (it.payload as Record<string, unknown>)
        : {};
    if (it.category === 'title') {
      out.titleColor = it.color ?? null;
    } else if (it.category === 'badge') {
      out.equippedBadge = {
        code: typeof payload.code === 'string' ? payload.code : it.id,
        label: typeof payload.label === 'string' ? payload.label : it.name,
        icon: typeof payload.icon === 'string' ? payload.icon : 'Award',
        color: it.color ?? null,
      };
    } else if (it.category === 'banner') {
      out.equippedBanner = typeof payload.image === 'string' ? payload.image : null;
    }
  }
  return out;
}

app.get('/me', async (c) => {
  const login = await getCurrentLogin(c);
  // S'assure que le compte existe (1er login) → permet l'onboarding des modes.
  await getOrCreateUser(login);
  const user = await prisma.user.findUnique({ where: { login } });
  const role = await getUserRole(login);
  const badges = user ? await badgesFor(login, role) : [];
  const palmares = user ? await palmaresFor(login) : [];
  const ownedTitlesList = await ownedTitlesFor(login, role, user);
  const cosmetics = await equippedCosmetics(login);
  return c.json({
    login,
    user,
    role,
    // Titres que le joueur POSSÈDE (dérivés des accomplissements) — sert au
    // sélecteur de titre côté front (cf. PUT /me/title).
    ownedTitles: ownedTitlesList,
    // Cosmétiques équipés (boutique) : couleur titre, badge acheté, bannière de fond.
    titleColor: cosmetics.titleColor,
    equippedBadge: cosmetics.equippedBadge,
    equippedBanner: cosmetics.equippedBanner,
    // Solde « League Coin » du joueur (porte-monnaie boutique).
    coins: user?.leagueCoins ?? 0,
    isAdmin: isAdmin(login),
    // Autorisé à accéder au staging (cf. STAGING_ALLOWED) — le front s'en sert
    // pour la barrière staging sans dupliquer la liste blanche.
    stagingAllowed: STAGING_ALLOWED.has(login.toLowerCase()) || isTesterLogin(login.toLowerCase()),
    badges,
    palmares,
    // Pilote la consent-gate côté frontend (cf. AuthenticatedShell).
    consentRequired: consentRequired(user),
    termsVersion: CURRENT_TERMS_VERSION,
  });
});

// ── Sélection de titre (self-service) ──────────────────────────────────────
// Le joueur choisit lui-même un titre parmi ceux qu'il POSSÈDE (dérivés de ses
// accomplissements, cf. ownedTitlesFor). `title: null` retire le titre. Pour
// rester permissif avec les titres accordés par un admin (route admin distincte
// inchangée), on autorise aussi la conservation du titre actuellement porté.
app.put('/me/title', async (c) => {
  const login = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const raw = body && typeof body.title === 'string' ? body.title.trim() : null;

  await getOrCreateUser(login);
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) throw new HTTPException(404, { message: 'user not found' });

  // Retrait du titre.
  if (!raw) {
    const updated = await prisma.user.update({ where: { login }, data: { title: null } });
    return c.json({ login: updated.login, title: updated.title });
  }

  const role = await getUserRole(login);
  const owned = await ownedTitlesFor(login, role, user);
  const allowed = new Set(owned.map((o) => o.label));
  // Tolère le titre déjà porté (potentiellement accordé par un admin).
  if (user.title) allowed.add(user.title);

  if (!allowed.has(raw)) {
    throw new HTTPException(403, { message: 'titre non débloqué' });
  }

  const updated = await prisma.user.update({ where: { login }, data: { title: raw } });
  return c.json({ login: updated.login, title: updated.title });
});

// ── RGPD / CGU 42 Art. 4.2 — Consentement explicite préalable ──
// Enregistre (accept=true) ou refuse (accept=false) le consentement de l'utilisateur
// final. La preuve = date + version stockées sur la ligne User. Sur refus, le compte
// est supprimé/anonymisé immédiatement (aucune donnée conservée sans consentement).
const ConsentSchema = z.object({ accept: z.boolean() });
app.post('/me/consent', async (c) => {
  const login = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = ConsentSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }

  if (parsed.data.accept) {
    await getOrCreateUser(login);
    await prisma.user.update({
      where: { login },
      data: { termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
    });
    return c.json({ ok: true, accepted: true });
  }

  // Refus → on ne conserve aucune donnée. Un superadmin ne peut pas s'auto-supprimer.
  if (SUPERADMINS.has(login.toLowerCase())) {
    throw new HTTPException(400, { message: 'superadmin accounts cannot be deleted' });
  }
  const existing = await prisma.user.findUnique({
    where: { login },
    select: { matchesPlayed: true, termsAcceptedAt: true },
  });
  // Compte vierge (jamais consenti, aucun match) → suppression sèche, propre et complète.
  // Sinon (re-consentement refusé après évolution de la politique) → anonymisation
  // pour préserver l'intégrité de l'historique des matchs déjà joués.
  const isPristine = !!existing && existing.matchesPlayed === 0 && !existing.termsAcceptedAt;
  if (isPristine) {
    await prisma.user.delete({ where: { login } }).catch(async () => {
      // Garde-fou : si une FK inattendue bloque la suppression, on bascule sur l'anonymisation.
      await anonymizeAccount(login);
    });
  } else if (existing) {
    await anonymizeAccount(login);
  }
  return c.json({ ok: true, accepted: false, deleted: true });
});

// Adhésion aux modes de jeu (onboarding + réglages). Un joueur n'apparaît dans
// les classements/stats d'un mode que s'il y adhère. Côté back, les ratings de
// tous les modes existent pour tout le monde (colonnes par défaut).
app.patch('/me/games', async (c) => {
  const login = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => ({}));
  const raw = Array.isArray(body.games) ? body.games : [];
  const games = [
    ...new Set(raw.filter((g: unknown) => g === 'babyfoot' || g === 'smash' || g === 'chess' || g === 'streetfighter')),
  ] as string[];
  if (games.length === 0) {
    throw new HTTPException(400, { message: 'choisis au moins un mode de jeu' });
  }
  await getOrCreateUser(login);
  const user = await prisma.user.update({
    where: { login },
    data: { games, onboardedAt: new Date() },
  });
  emit([login], { type: 'leaderboard:update', payload: {} });
  return c.json({ games: user.games, onboardedAt: user.onboardedAt });
});

// Personnages favoris (« mains ») par jeu de combat (Smash / Street Fighter).
// PATCH partiel : seules les clés fournies sont écrites. Dédup + cap de sécurité.
app.patch('/me/favorites', async (c) => {
  const login = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = FavoritesUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const dedup = (arr?: string[]) => (arr ? [...new Set(arr)] : undefined);
  const data: { favSmash?: string[]; favSf?: string[] } = {};
  const smash = dedup(parsed.data.smash);
  const sf = dedup(parsed.data.streetfighter);
  if (smash !== undefined) data.favSmash = smash;
  if (sf !== undefined) data.favSf = sf;

  await getOrCreateUser(login);
  const user = await prisma.user.update({ where: { login }, data });
  emit([login], { type: 'leaderboard:update', payload: {} });
  return c.json({ favSmash: user.favSmash, favSf: user.favSf });
});

// ── RGPD Art. 20 — Droit à la portabilité : export de toutes les données personnelles ──
app.get('/me/export', async (c) => {
  const login = await getCurrentLogin(c);
  const [user, matches, challenges, tournamentEntries, featureRequests, bugReports, ops] = await Promise.all([
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
    prisma.bugReport.findMany({
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
    bugReports,
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
    await cancelUserFfas(tx, login);
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
    await cancelUserFfas(tx, login);
    return t;
  });

  if (tournamentsChanged) broadcast({ type: 'tournament:update', payload: {} });
  // Rafraîchit les listes (classement + défis des adversaires concernés).
  broadcast({ type: 'data:update', payload: {} });
  return c.json({ ok: true, graceDays: ACCOUNT_GRACE_DAYS });
});

// Échange le credential complet (Bearer / session) contre un token éphémère
// dédié au SSE. Le front l'appelle juste avant d'ouvrir l'EventSource — et à
// chaque reconnexion — pour ne jamais mettre le Bearer 30 jours en query string.
app.get('/auth/stream-token', async (c) => {
  const me = await getCurrentLogin(c);
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new HTTPException(500, { message: 'server misconfigured: SESSION_SECRET missing' });
  }
  return c.json({ token: issueStreamToken(me, secret) });
});

app.get('/events', async (c) => {
  // EventSource ne peut pas envoyer de header Authorization → on accepte aussi
  // un token éphémère de scope 'sse' en query param (?token=...), en plus de la
  // session/cookie habituels. Voir GET /auth/stream-token.
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
  const me = await getCurrentLogin(c);
  const login = c.req.param('login');
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || user.deletionScheduledAt) {
    // Compte inexistant ou en cours de suppression → traité comme absent.
    throw new HTTPException(404, { message: 'user not found' });
  }
  const [allUsers, played, followingRows, followersRows] = await Promise.all([
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
    // Réseau du joueur consulté (comme le bloc « following / followers » du profil perso).
    prisma.follow.findMany({
      where: { followerLogin: login },
      include: { followee: { select: { login: true, imageUrl: true, elo: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.follow.findMany({
      where: { followeeLogin: login },
      include: { follower: { select: { login: true, imageUrl: true, elo: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const rank = allUsers.findIndex((u) => u.login === login) + 1;
  const wins = played.filter((m) => {
    const isA = m.playerALogin === login;
    return (isA && m.winner === 'A') || (!isA && m.winner === 'B');
  }).length;
  const losses = played.length - wins;
  const badges = await badgesFor(login, user.role);
  // Statut de suivi du visiteur vis-à-vis de ce profil.
  const follow =
    me === login
      ? null
      : await prisma.follow.findUnique({
          where: { followerLogin_followeeLogin: { followerLogin: me, followeeLogin: login } },
        });
  const palmares = await palmaresFor(login);
  const cosmetics = await equippedCosmetics(login);
  return c.json({
    user,
    rank: rank || null,
    wins,
    losses,
    recent: played,
    badges,
    palmares,
    // Cosmétiques équipés (pour afficher couleur titre / badge / bannière sur la fiche).
    titleColor: cosmetics.titleColor,
    equippedBadge: cosmetics.equippedBadge,
    equippedBanner: cosmetics.equippedBanner,
    followingList: followingRows,
    followersList: followersRows,
    following: !!follow,
    followPrefs: follow
      ? {
          notifyTournament: follow.notifyTournament,
          notifyTop3: follow.notifyTop3,
          notifyTrophy: follow.notifyTrophy,
          notifyOps: follow.notifyOps,
        }
      : null,
  });
});

// Normalise le paramètre de jeu (babyfoot par défaut). Délègue au registry partagé.
const parseGame = parseGameId;

app.get('/leaderboard', async (c) => {
  await getCurrentLogin(c);
  // Classement par jeu : trie sur l'Elo de la discipline et expose ses compteurs
  // sous les mêmes clés (elo / matchesPlayed / tournamentsWon) pour un front unifié.
  const game = parseGame(c.req.query('game'));
  // N'apparaissent au classement d'un mode que les joueurs qui y adhèrent (games).
  const users = await prisma.user.findMany({
    where: { ...VISIBLE_USER_WHERE, games: { has: game } },
    orderBy: eloOrderBy(game),
  });
  return c.json(users.map((u, i) => ({ rank: i + 1, ...u, ...projectStats(u, game) })));
});

// ── Notifications in-app ──────────────────────────────────────────────────
app.get('/notifications', async (c) => {
  const me = await getCurrentLogin(c);
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientLogin: me },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    prisma.notification.count({ where: { recipientLogin: me, read: false } }),
  ]);
  return c.json({ notifications, unread });
});

// Marque comme lues : tout par défaut, ou seulement les `ids` fournis.
app.post('/notifications/read', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? (body.ids as unknown[]).filter((x): x is string => typeof x === 'string')
    : null;
  await prisma.notification.updateMany({
    where: { recipientLogin: me, read: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  return c.json({ ok: true });
});

// ── Matchmaking ─────────────────────────────────────────────────────────────
// File d'attente per-login (cf. modèle MatchmakingQueue). /queue/join insère mon
// entrée puis tente d'apparier avec le plus ancien autre joueur de la même
// discipline. L'appariement crée un défi (Challenge) et notifie LES DEUX joueurs.
// Le joueur apparié "à distance" (par le join de l'autre) découvre le match via
// /queue/status (polling).
const MATCH_NOTIF_WINDOW_MS = 90_000;

interface QueueOpponent {
  login: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl: string | null;
}

async function fetchQueueOpponent(login: string): Promise<QueueOpponent | null> {
  const u = await prisma.user.findUnique({
    where: { login },
    select: { login: true, imageUrl: true },
  });
  if (!u) return null;
  return { login: u.login, imageUrl: u.imageUrl };
}

app.post('/queue/join', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => ({}));
  const game = parseGameId(body?.game);
  await getOrCreateUser(me);
  await assertNotBanned(me);

  // Transaction : (re)pose mon entrée puis cherche le plus ancien autre joueur de
  // la même discipline. Si trouvé, on retire les DEUX entrées atomiquement pour
  // éviter le double-appariement (deux joins concurrents ne peuvent pas saisir le
  // même partenaire — le second ne le retrouvera plus dans la file).
  const paired = await prisma.$transaction(async (tx) => {
    await tx.matchmakingQueue.upsert({
      where: { login: me },
      update: { game, joinedAt: new Date() },
      create: { login: me, game },
    });
    const candidates = await tx.matchmakingQueue.findMany({
      where: { game, login: { not: me } },
      orderBy: { joinedAt: 'asc' },
    });
    for (const cand of candidates) {
      // Exclut les comptes hors-jeu (bannis/désactivés/anonymisés).
      const u = await tx.user.findUnique({
        where: { login: cand.login },
        select: { bannedAt: true, anonymizedAt: true, deletionScheduledAt: true },
      });
      if (!u || u.bannedAt || u.anonymizedAt || u.deletionScheduledAt) {
        await tx.matchmakingQueue.delete({ where: { login: cand.login } }).catch(() => {});
        continue;
      }
      // Appariement : on retire les deux entrées.
      await tx.matchmakingQueue.deleteMany({ where: { login: { in: [me, cand.login] } } });
      return cand.login as string;
    }
    return null;
  });

  if (!paired) {
    return c.json({ matched: false });
  }

  const opponentLogin = paired;
  // Défi entre les deux joueurs, créé DIRECTEMENT en `accepted` : les deux ont
  // explicitement rejoint la file, donc pas d'étape « accepter/refuser ». Le duel
  // atterrit immédiatement dans la liste « duels à jouer » (scheduledDuels) des
  // DEUX joueurs, prêt à être joué plus tard. Best-effort : un échec ne doit pas
  // empêcher la notification d'appariement.
  await prisma.challenge
    .create({
      data: {
        id: randomUUID(),
        challengerLogin: me,
        opponentLogin,
        status: 'accepted',
        decidedAt: new Date(),
        game,
        scheduledAt: new Date(),
      },
    })
    .catch(() => {});

  // Notifie LES DEUX joueurs. Le `link` porte le login de l'adversaire afin que
  // /queue/status puisse re-récupérer l'avatar côté joueur appariné à distance.
  await notify(opponentLogin, {
    type: 'matchmaking',
    title: 'Adversaire trouvé !',
    body: `@${me} t'affronte en ${game}`,
    link: `/challenges?vs=${encodeURIComponent(me)}&game=${encodeURIComponent(game)}`,
    game,
  });
  await notify(me, {
    type: 'matchmaking',
    title: 'Adversaire trouvé !',
    body: `@${opponentLogin} t'affronte en ${game}`,
    link: `/challenges?vs=${encodeURIComponent(opponentLogin)}&game=${encodeURIComponent(game)}`,
    game,
  });
  emit([me, opponentLogin], { type: 'challenge:received', payload: {} });

  const opponent = await fetchQueueOpponent(opponentLogin);
  return c.json({ matched: true, game, opponent });
});

app.post('/queue/leave', async (c) => {
  const me = await getCurrentLogin(c);
  await prisma.matchmakingQueue.deleteMany({ where: { login: me } });
  return c.json({ ok: true });
});

app.get('/queue/status', async (c) => {
  const me = await getCurrentLogin(c);
  const row = await prisma.matchmakingQueue.findUnique({ where: { login: me } });
  if (row) {
    return c.json({ state: 'queued', game: row.game });
  }
  // Détection d'un appariement très récent (déclenché par le join de l'autre).
  // On lit la dernière notif 'matchmaking' non lue dans la fenêtre, puis on la
  // marque lue → 'matched' n'est rapporté qu'une fois (l'animation versus ne
  // boucle pas).
  const since = new Date(Date.now() - MATCH_NOTIF_WINDOW_MS);
  const notif = await prisma.notification.findFirst({
    where: { recipientLogin: me, type: 'matchmaking', read: false, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  });
  if (notif) {
    await prisma.notification.update({ where: { id: notif.id }, data: { read: true } });
    // Récupère le login adverse + le jeu depuis le lien stocké.
    const params = new URLSearchParams((notif.link ?? '').split('?')[1] ?? '');
    const vs = params.get('vs');
    const game = parseGameId(params.get('game'));
    const opponent = vs ? await fetchQueueOpponent(vs) : null;
    return c.json({ state: 'matched', game, opponent });
  }
  return c.json({ state: 'idle' });
});

// ── Saisons ───────────────────────────────────────────────────────────────
app.get('/seasons', async (c) => {
  await getCurrentLogin(c);
  return c.json(await prisma.season.findMany({ orderBy: { startedAt: 'desc' } }));
});

app.get('/seasons/current', async (c) => {
  await getCurrentLogin(c);
  return c.json(await prisma.season.findFirst({ where: { isActive: true } }));
});

app.get('/seasons/:id/standings', async (c) => {
  await getCurrentLogin(c);
  const id = c.req.param('id');
  const game = parseGame(c.req.query('game'));
  return c.json(
    await prisma.seasonStanding.findMany({ where: { seasonId: id, game }, orderBy: { rank: 'asc' } }),
  );
});

const CreateSeasonSchema = z.object({ name: z.string().trim().min(2).max(40) });

// Crée une nouvelle saison active. Refuse s'il y a déjà une saison en cours.
app.post('/seasons', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateSeasonSchema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const active = await prisma.season.findFirst({ where: { isActive: true } });
  if (active) {
    throw new HTTPException(409, { message: "Clôture la saison en cours avant d'en créer une nouvelle." });
  }
  const season = await prisma.season.create({
    data: { id: randomUUID(), name: parsed.data.name, isActive: true },
  });
  broadcast({ type: 'data:update', payload: {} });
  return c.json(season, 201);
});

// Clôture la saison active : snapshot du classement final, badge champion, reset
// ELO/compteurs à 1000/0 pour tout le monde. L'historique des matchs est conservé
// (taggé par saison). IRRÉVERSIBLE.
app.post('/seasons/close', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const result = await prisma.$transaction(async (tx) => {
    const active = await tx.season.findFirst({ where: { isActive: true } });
    if (!active) throw new HTTPException(409, { message: 'Aucune saison active à clôturer.' });

    const allUsers = await tx.user.findMany({ where: VISIBLE_USER_WHERE });
    const matches = await tx.playedMatch.findMany({
      where: { seasonId: active.id },
      select: { playerALogin: true, playerBLogin: true, winner: true, game: true },
    });

    // Snapshot par discipline : on fige un classement distinct pour chaque jeu
    // (joueurs inscrits au mode, classés par leur Elo de ce jeu).
    // Map gameId → login du champion (pour badge avec discipline cloisonnée).
    const champions = new Map<string, string>();
    let totalPlayers = 0;

    for (const g of GAME_IDS) {
      const users = allUsers
        .filter((u) => (u.games ?? ['babyfoot']).includes(g))
        .sort((a, b) => readElo(b, g) - readElo(a, g));
      if (users.length === 0) continue;
      totalPlayers += users.length;
      const wl = new Map<string, { w: number; l: number }>();
      for (const u of users) wl.set(u.login, { w: 0, l: 0 });
      for (const m of matches) {
        if ((m.game ?? 'babyfoot') !== g) continue;
        for (const login of [m.playerALogin, m.playerBLogin]) {
          const rec = wl.get(login);
          if (!rec) continue;
          const isA = m.playerALogin === login;
          const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
          if (won) rec.w++;
          else rec.l++;
        }
      }
      let rank = 0;
      for (const u of users) {
        rank++;
        const s = wl.get(u.login) ?? { w: 0, l: 0 };
        await tx.seasonStanding.create({
          data: {
            id: randomUUID(),
            seasonId: active.id,
            game: g,
            login: u.login,
            rank,
            elo: readElo(u, g),
            wins: s.w,
            losses: s.l,
          },
        });
      }
      const champ = users[0]?.login;
      if (champ) champions.set(g, champ);
    }

    // Badge champion pour le n°1 de chaque discipline — cloisonné par jeu.
    for (const [game, champ] of champions) {
      await tx.userBadge.upsert({
        where: { userLogin_code_game: { userLogin: champ, code: 'season_champion', game } },
        update: { seasonId: active.id },
        create: { id: randomUUID(), userLogin: champ, code: 'season_champion', game, seasonId: active.id },
      });
    }

    // Reset de toutes les disciplines pour la prochaine ère.
    // On ne repart pas d'un plat 1000 : chaque ELO est ramené au PLANCHER de son
    // grade courant (rankFloor) pour récompenser la progression de la saison.
    // Les compteurs de matchs sont eux remis à zéro.
    for (const u of allUsers) {
      await tx.user.update({
        where: { login: u.login },
        data: {
          elo: rankFloor(u.elo),
          matchesPlayed: 0,
          eloSmash: rankFloor(u.eloSmash),
          matchesPlayedSmash: 0,
          eloChess: rankFloor(u.eloChess),
          matchesPlayedChess: 0,
          eloSf: rankFloor(u.eloSf),
          matchesPlayedSf: 0,
        },
      });
    }
    await tx.season.update({ where: { id: active.id }, data: { isActive: false, endedAt: new Date() } });
    const babyfootChamp =
      [...allUsers].filter((u) => (u.games ?? ['babyfoot']).includes('babyfoot')).sort((a, b) => b.elo - a.elo)[0]?.login ?? null;
    return { seasonId: active.id, seasonName: active.name, champion: babyfootChamp, players: totalPlayers };
  });
  if (result.champion) {
    void notify(result.champion, {
      type: 'badge',
      title: '🏆 Champion de saison !',
      body: `Tu remportes ${result.seasonName} — badge débloqué.`,
      link: '/profile',
      game: 'babyfoot',
    });
  }
  broadcast({ type: 'data:update', payload: {} });
  broadcast({ type: 'leaderboard:update', payload: {} });
  return c.json({ closed: true, ...result });
});

// ── Followers / Following ─────────────────────────────────────────────────
const FollowPrefsSchema = z.object({
  notifyTournament: z.boolean().optional(),
  notifyTop3: z.boolean().optional(),
  notifyTrophy: z.boolean().optional(),
  notifyOps: z.boolean().optional(),
});

// Liste des joueurs que je suis (avec leurs infos + mes préférences).
app.get('/follows', async (c) => {
  const me = await getCurrentLogin(c);
  const rows = await prisma.follow.findMany({
    where: { followerLogin: me },
    include: { followee: { select: { login: true, imageUrl: true, elo: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(rows);
});

// Abonnés : les joueurs qui ME suivent (pour l'onglet « followers » du profil).
app.get('/followers', async (c) => {
  const me = await getCurrentLogin(c);
  const rows = await prisma.follow.findMany({
    where: { followeeLogin: me },
    include: { follower: { select: { login: true, imageUrl: true, elo: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(rows);
});

app.post('/follows', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => ({}));
  const login = typeof body.login === 'string' ? body.login.trim() : '';
  if (!login) throw new HTTPException(400, { message: 'login requis' });
  if (login === me) throw new HTTPException(400, { message: 'tu ne peux pas te suivre toi-même' });
  // Pas de suivi d'un compte hors-jeu (banni / désactivé / anonymisé).
  await assertTargetable(login);
  const row = await prisma.follow.upsert({
    where: { followerLogin_followeeLogin: { followerLogin: me, followeeLogin: login } },
    update: {},
    create: { id: randomUUID(), followerLogin: me, followeeLogin: login },
  });
  return c.json(row, 201);
});

app.delete('/follows/:login', async (c) => {
  const me = await getCurrentLogin(c);
  const login = c.req.param('login');
  await prisma.follow.deleteMany({ where: { followerLogin: me, followeeLogin: login } });
  return c.json({ ok: true });
});

app.patch('/follows/:login', async (c) => {
  const me = await getCurrentLogin(c);
  const login = c.req.param('login');
  const body = await c.req.json().catch(() => ({}));
  const parsed = FollowPrefsSchema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const row = await prisma.follow
    .update({
      where: { followerLogin_followeeLogin: { followerLogin: me, followeeLogin: login } },
      data: parsed.data,
    })
    .catch(() => {
      throw new HTTPException(404, { message: 'tu ne suis pas ce joueur' });
    });
  return c.json(row);
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
  const { opponentLogin, scoreSelf, scoreOpponent, game, bestOf, charSelf, charOpponent, stocks } =
    parsed.data;
  if (opponentLogin === me) {
    throw new HTTPException(400, {
      message: 'cannot declare a match against yourself',
    });
  }
  await assertNotBanned(me);
  await getOrCreateUser(me);
  // Sécurité : l'adversaire doit exister, être un vrai utilisateur 42 et disponible.
  const opponent = await prisma.user.findUnique({ where: { login: opponentLogin } });
  if (!opponent) throw new HTTPException(404, { message: 'opponent must login first before being declared' });
  if (!opponent.ftId) throw new HTTPException(403, { message: 'opponent must be a real 42 user' });
  if (opponent.bannedAt || opponent.anonymizedAt || opponent.deletionScheduledAt) throw new HTTPException(403, { message: "ce joueur n'est plus disponible" });
  const pending = await prisma.pendingMatch.create({
    data: {
      id: randomUUID(),
      declarerLogin: me,
      opponentLogin,
      scoreDeclarer: scoreSelf,
      scoreOpponent,
      game,
      bestOf: bestOf ?? null,
      charDeclarer: charSelf ?? null,
      charOpponent: charOpponent ?? null,
      stocks: stocks ?? null,
    },
  });
  emit([opponentLogin], {
    type: 'match:pending',
    payload: { id: pending.id, declarerLogin: me, scoreDeclarer: scoreSelf, scoreOpponent },
  });
  // Pas de notif cloche pour les matchs : les scores à valider vivent
  // uniquement dans la section Défis (+ la bannière popup), via l'event SSE
  // `match:pending` ci-dessus.
  return c.json({ id: pending.id, status: 'pending' }, 201);
});

// ── Déclaration d'un match 2v2 (Babyfoot uniquement) ─────────────────────────
// Le déclarant nomme les 4 joueurs (lui + son coéquipier vs 2 adversaires). Un
// PendingMatch `mode:'2v2'` est créé ; il est validé par l'un des 2 adversaires
// (cf. /matches/:id/confirm) puis réglé par settle2v2PendingAsPlayed.
app.post('/matches/2v2', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = Declare2v2MatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { partnerLogin, opponentLogin, opponent2Login, scoreSelf, scoreOpponent } = parsed.data;
  if ([partnerLogin, opponentLogin, opponent2Login].includes(me)) {
    throw new HTTPException(400, { message: 'cannot declare a 2v2 match involving yourself twice' });
  }
  await assertNotBanned(me);
  await getOrCreateUser(me);
  // Les 3 autres joueurs doivent être de vrais utilisateurs 42 disponibles.
  for (const login of [partnerLogin, opponentLogin, opponent2Login]) {
    const u = await prisma.user.findUnique({ where: { login } });
    if (!u) throw new HTTPException(404, { message: `${login} must login first before being declared` });
    if (!u.ftId) throw new HTTPException(403, { message: `${login} must be a real 42 user` });
    if (u.bannedAt || u.anonymizedAt || u.deletionScheduledAt)
      throw new HTTPException(403, { message: `${login} n'est plus disponible` });
  }

  const pending = await prisma.pendingMatch.create({
    data: {
      id: randomUUID(),
      declarerLogin: me,
      opponentLogin,
      scoreDeclarer: scoreSelf,
      scoreOpponent,
      game: 'babyfoot',
      mode: '2v2',
      partner1Login: partnerLogin,
      partner2Login: opponent2Login,
    },
  });

  // Tous les autres participants sont notifiés (le score à valider apparaît dans Défis).
  emit([partnerLogin, opponentLogin, opponent2Login], {
    type: 'match:pending',
    payload: { id: pending.id, mode: '2v2', declarerLogin: me },
  });

  // Aperçu de l'équipe du déclarant (le duo n'est créé qu'à la validation).
  const [tp1, tp2] = canonicalTeamLogins(me, partnerLogin);
  const existingTeam = await prisma.babyfootTeam.findUnique({
    where: { player1Login_player2Login: { player1Login: tp1, player2Login: tp2 } },
    select: { id: true },
  });
  return c.json(
    {
      id: pending.id,
      status: 'pending',
      myTeamId: existingTeam?.id ?? '',
      myTeamIsNew: !existingTeam,
    },
    201,
  );
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
  game?: string;
  bestOf?: number | null;
  charDeclarer?: string | null;
  charOpponent?: string | null;
  stocks?: number | null;
  // 2v2 Babyfoot — présents uniquement quand mode = '2v2'.
  mode?: string | null;
  partner1Login?: string | null;
  partner2Login?: string | null;
};

// Règlement d'un match 2v2 Babyfoot : crée/maj les BabyfootTeam, applique l'ELO
// (équipe + individuel via babyfoot2v2), supprime le pending et crée le PlayedMatch
// avec les colonnes 2v2. Anti-farming basé sur la paire de teams (indépendant de l'ordre).
async function settle2v2PendingAsPlayed(tx: Prisma.TransactionClient, p: PendingForSettle) {
  const partner1 = p.partner1Login as string; // coéquipier du déclarant
  const partner2 = p.partner2Login as string; // coéquipier de l'adversaire
  // Côté A = équipe du déclarant ; côté B = équipe adverse. On canonicalise chaque duo.
  const [a1, a2] = canonicalTeamLogins(p.declarerLogin, partner1);
  const [b1, b2] = canonicalTeamLogins(p.opponentLogin, partner2);

  const [uA1, uA2, uB1, uB2] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { login: a1 } }),
    tx.user.findUniqueOrThrow({ where: { login: a2 } }),
    tx.user.findUniqueOrThrow({ where: { login: b1 } }),
    tx.user.findUniqueOrThrow({ where: { login: b2 } }),
  ]);
  const eA1 = readElo(uA1, 'babyfoot');
  const eA2 = readElo(uA2, 'babyfoot');
  const eB1 = readElo(uB1, 'babyfoot');
  const eB2 = readElo(uB2, 'babyfoot');

  const teamA = await upsertBabyfootTeam(tx, a1, eA1, a2, eA2);
  const teamB = await upsertBabyfootTeam(tx, b1, eB1, b2, eB2);

  const sideA: Side2v2 = { p1Login: a1, p2Login: a2, teamId: teamA.id, teamElo: teamA.elo, p1Elo: eA1, p2Elo: eA2 };
  const sideB: Side2v2 = { p1Login: b1, p2Login: b2, teamId: teamB.id, teamElo: teamB.elo, p1Elo: eB1, p2Elo: eB2 };

  // scoreA/scoreB orientés côté déclarant (équipe A).
  const scoreA = p.scoreDeclarer;
  const scoreB = p.scoreOpponent;
  const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';

  // Anti-farming par paire de teams (les 2 sens), indépendant du jeu (toujours babyfoot).
  const priors = await tx.playedMatch.findMany({
    where: {
      mode: '2v2',
      OR: [
        { teamAId: teamA.id, teamBId: teamB.id },
        { teamAId: teamB.id, teamBId: teamA.id },
      ],
    },
    select: { playedAt: true, countedForElo: true },
  });
  const countsForElo = shouldCountForElo(priors, p.declaredAt);

  let dA1 = 0, dA2 = 0, dB1 = 0, dB2 = 0;
  if (countsForElo) {
    const r = await applyElo2v2(tx, { winner, sideA, sideB });
    dA1 = r.individual.deltaA1;
    dA2 = r.individual.deltaA2;
    dB1 = r.individual.deltaB1;
    dB2 = r.individual.deltaB2;
  }

  await tx.pendingMatch.delete({ where: { id: p.id } });
  const activeSeason = await tx.season.findFirst({ where: { isActive: true }, select: { id: true } });

  return tx.playedMatch.create({
    data: {
      id: p.id,
      playerALogin: a1,
      playerBLogin: b1,
      playerA2Login: a2,
      playerB2Login: b2,
      scoreA,
      scoreB,
      winner,
      playedAt: p.declaredAt,
      countedForElo: countsForElo,
      deltaA: dA1,
      deltaB: dB1,
      deltaA2: dA2,
      deltaB2: dB2,
      teamAId: teamA.id,
      teamBId: teamB.id,
      seasonId: activeSeason?.id ?? null,
      game: 'babyfoot',
      mode: '2v2',
    },
  });
}

async function settlePendingAsPlayed(tx: Prisma.TransactionClient, p: PendingForSettle) {
  // 2v2 Babyfoot : chemin de règlement dédié (teams + ELO 2v2).
  if (p.mode === '2v2' && p.partner1Login && p.partner2Login) {
    return settle2v2PendingAsPlayed(tx, p);
  }
  const [a, b] = pairKey(p.declarerLogin, p.opponentLogin);
  const declarerIsA = p.declarerLogin === a;
  const scoreA = declarerIsA ? p.scoreDeclarer : p.scoreOpponent;
  const scoreB = declarerIsA ? p.scoreOpponent : p.scoreDeclarer;
  const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';
  const game = parseGameId(p.game);
  // Smash uniquement : les « stocks » (vies) sont spécifiques au Smash. Street
  // Fighter partage la mécanique de set mais n'a pas de stocks.
  const isSmash = game === 'smash';

  // Champs Smash mappés sur les côtés A/B.
  const charA = declarerIsA ? p.charDeclarer ?? null : p.charOpponent ?? null;
  const charB = declarerIsA ? p.charOpponent ?? null : p.charDeclarer ?? null;
  const winnerStocks = p.stocks ?? 1;
  const stocksA = isSmash ? (winner === 'A' ? winnerStocks : 0) : null;
  const stocksB = isSmash ? (winner === 'B' ? winnerStocks : 0) : null;

  // Anti-farming par paire ET par jeu (cooldown indépendant par discipline).
  const priors = await tx.playedMatch.findMany({
    where: { playerALogin: a, playerBLogin: b, game },
    select: { playedAt: true, countedForElo: true },
  });
  const countsForElo = shouldCountForElo(priors, p.declaredAt);

  const [userA, userB] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { login: a } }),
    tx.user.findUniqueOrThrow({ where: { login: b } }),
  ]);

  // Rating courant de la discipline (mapping des colonnes : cf. games.ts).
  const ratingA = readElo(userA, game);
  const ratingB = readElo(userB, game);

  let deltaA = 0;
  let deltaB = 0;
  if (countsForElo) {
    const update = applyGameElo(game, ratingA, ratingB, winner, {
      scoreA,
      scoreB,
      bestOf: p.bestOf,
      winnerStocks,
    });
    deltaA = update.deltaA;
    deltaB = update.deltaB;
    await tx.user.update({ where: { login: a }, data: ratingUpdate(game, update.newA) });
    await tx.user.update({ where: { login: b }, data: ratingUpdate(game, update.newB) });
  }

  await tx.pendingMatch.delete({ where: { id: p.id } });

  const activeSeason = await tx.season.findFirst({ where: { isActive: true }, select: { id: true } });

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
      seasonId: activeSeason?.id ?? null,
      game,
      bestOf: isSmash ? p.bestOf ?? null : null,
      charA,
      charB,
      stocksA,
      stocksB,
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
    // 1v1 : seul l'adversaire confirme. 2v2 : l'un des joueurs de l'équipe ADVERSE
    // (opponent ou son coéquipier) confirme — leur point de vue « self » = score
    // de l'équipe adverse, ce qui garde la vérif miroir valide.
    const canConfirm =
      p.mode === '2v2' ? me === p.opponentLogin || me === p.partner2Login : me === p.opponentLogin;
    if (!canConfirm) {
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

    // OPS = mécanique strictement 1v1 → ignorée pour les matchs 2v2.
    const opsBetween =
      created.mode === '2v2'
        ? null
        : await tx.ops.findFirst({
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

  // Destinataires temps réel : 2 joueurs en 1v1, 4 en 2v2 (avec les coéquipiers).
  const matchRecipients =
    match.mode === '2v2'
      ? ([match.playerALogin, match.playerBLogin, match.playerA2Login, match.playerB2Login].filter(
          Boolean,
        ) as string[])
      : [match.playerALogin, match.playerBLogin];

  // Résultat poussé en temps réel (section Défis + bannière) via cet event.
  // Pas de notif cloche pour les matchs.
  emit(matchRecipients, { type: 'match:confirmed', payload: match });
  // L'ELO des deux joueurs a changé → le classement bouge pour tout le monde.
  broadcast({ type: 'leaderboard:update', payload: {} });
  // Abonnés notifiés si un joueur entre dans le top 3.
  void maybeNotifyTop3(match.playerALogin, match.deltaA);
  void maybeNotifyTop3(match.playerBLogin, match.deltaB);
  if (result.opsTouched) {
    emit([match.playerALogin, match.playerBLogin], {
      type: 'ops:update',
      payload: { reason: 'forced_played' },
    });
    // Le perdant d'un match OPS forcé → ses abonnés sont prévenus.
    const loser = match.winner === 'A' ? match.playerBLogin : match.playerALogin;
    void notifyFollowers(loser, 'notifyOps', {
      type: 'follow_ops',
      title: `@${loser} a perdu un match OPS`,
      link: `/player/${encodeURIComponent(loser)}`,
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

  let rejectRecipients: string[] = [];
  await prisma.$transaction(async (tx) => {
    const p = await tx.pendingMatch.findUnique({ where: { id } });
    if (!p) {
      throw new HTTPException(404, { message: 'pending match not found' });
    }
    // 1v1 : seul l'adversaire rejette. 2v2 : l'équipe adverse (opponent ou son coéquipier).
    const canReject =
      p.mode === '2v2' ? me === p.opponentLogin || me === p.partner2Login : me === p.opponentLogin;
    if (!canReject) {
      throw new HTTPException(403, {
        message: 'only the opponent can reject this match',
      });
    }
    // Le déclarant + son coéquipier (en 2v2) sont prévenus de la contestation.
    rejectRecipients = [p.declarerLogin, p.partner1Login].filter(Boolean) as string[];
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

  if (rejectRecipients.length > 0) {
    // Contestation poussée en temps réel via l'event `match:rejected`
    // (section Défis + bannière). Pas de notif cloche pour les matchs.
    emit(rejectRecipients, { type: 'match:rejected', payload: { id, contestReason, rejectedBy: me } });
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

// =========================================================================
// SMASH FFA (Free-For-All, 3+ joueurs)
// =========================================================================
// Le déclarant propose le classement final complet (position 1..N). Le déclarant
// est auto-confirmé ; chaque AUTRE participant confirme UNIQUEMENT sa propre
// position. Quand toutes les positions sont confirmées, le FFA est réglé : l'ELO
// Smash de chacun bouge selon son rang (round-robin sensible au rating, cf.
// calculateFfaElo) et `matchesPlayedSmash` +1. Une contestation annule le FFA.

type PendingFfaForSettle = {
  id: string;
  declaredAt: Date;
  participants: { login: string; position: number }[];
};

// Règle un FFA confirmé : applique l'ELO par rang, supprime le pending et crée le
// PlayedFfa + ses participants. Suppose les participants disponibles (vérifié en
// amont par le handler de confirmation). Renvoie le PlayedFfa créé (avec participants).
async function settleFfaAsPlayed(tx: Prisma.TransactionClient, p: PendingFfaForSettle) {
  // Ordre du classement final : position 1 = 1er … N = dernier.
  const ordered = [...p.participants].sort((a, b) => a.position - b.position);
  const users = await Promise.all(
    ordered.map((pp) => tx.user.findUniqueOrThrow({ where: { login: pp.login } })),
  );
  const ratings = users.map((u) => readElo(u, 'smash'));
  const deltas = calculateFfaElo(ratings);

  for (let i = 0; i < ordered.length; i++) {
    // ratingUpdate('smash', …) pose le nouvel ELO ET incrémente matchesPlayedSmash.
    await tx.user.update({
      where: { login: ordered[i]!.login },
      data: ratingUpdate('smash', ratings[i]! + deltas[i]!),
    });
  }

  await tx.pendingFfa.delete({ where: { id: p.id } });
  const activeSeason = await tx.season.findFirst({ where: { isActive: true }, select: { id: true } });

  return tx.playedFfa.create({
    data: {
      id: p.id,
      game: 'smash',
      playedAt: p.declaredAt,
      seasonId: activeSeason?.id ?? null,
      countedForElo: true,
      participants: {
        create: ordered.map((pp, i) => ({
          id: randomUUID(),
          login: pp.login,
          position: pp.position,
          ratingBefore: ratings[i]!,
          delta: deltas[i]!,
          ratingAfter: ratings[i]! + deltas[i]!,
        })),
      },
    },
    include: { participants: true },
  });
}

app.get('/matches/ffa/pending', async (c) => {
  await getCurrentLogin(c);
  return c.json(
    await prisma.pendingFfa.findMany({
      orderBy: { declaredAt: 'desc' },
      include: { participants: true },
    }),
  );
});

app.get('/matches/ffa', async (c) => {
  await getCurrentLogin(c);
  return c.json(
    await prisma.playedFfa.findMany({
      orderBy: { playedAt: 'desc' },
      include: { participants: true },
    }),
  );
});

// Déclaration d'un FFA Smash : `ranking` est le classement final proposé
// (ranking[0] = 1er). Les positions sont dérivées de l'ordre (position = index+1).
app.post('/matches/ffa', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = DeclareFfaSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { ranking } = parsed.data;
  if (!ranking.includes(me)) {
    throw new HTTPException(400, { message: 'tu dois faire partie du FFA' });
  }
  await assertNotBanned(me);
  await getOrCreateUser(me);
  // Tous les autres participants doivent être de vrais utilisateurs 42 disponibles.
  for (const login of ranking) {
    if (login === me) continue;
    const u = await prisma.user.findUnique({ where: { login } });
    if (!u) throw new HTTPException(404, { message: `${login} must login first before being declared` });
    if (!u.ftId) throw new HTTPException(403, { message: `${login} must be a real 42 user` });
    if (u.bannedAt || u.anonymizedAt || u.deletionScheduledAt)
      throw new HTTPException(403, { message: `${login} n'est plus disponible` });
  }

  const pending = await prisma.pendingFfa.create({
    data: {
      id: randomUUID(),
      declarerLogin: me,
      game: 'smash',
      participants: {
        create: ranking.map((login, i) => ({
          id: randomUUID(),
          login,
          position: i + 1,
          // Le déclarant valide d'emblée sa propre position.
          confirmed: login === me,
        })),
      },
    },
    include: { participants: true },
  });

  const others = ranking.filter((l) => l !== me);
  emit(others, { type: 'ffa:pending', payload: { id: pending.id, declarerLogin: me } });
  // FFA = résultat « officiel » à valider par chacun → notif cloche (contrairement
  // au 1v1 qui vit seulement dans la section Défis).
  await notifyMany(others, {
    type: 'ffa_pending',
    title: `@${me} t'a placé dans un FFA Smash`,
    body: 'Confirme ta position dans le classement.',
    link: '/defis',
    game: 'smash',
  });
  return c.json({ id: pending.id, status: 'pending' }, 201);
});

// Confirmation de SA propre position. Quand toutes les positions sont confirmées,
// le FFA est réglé dans la foulée.
app.post('/matches/ffa/:id/confirm', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ConfirmFfaPositionSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { position } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    // Verrou de ligne : sérialise les confirmations concurrentes (le dernier
    // confirmant déclenche le règlement, on évite un double-règlement).
    await tx.$executeRaw`SELECT 1 FROM pending_ffas WHERE id = ${id} FOR UPDATE`;
    const pending = await tx.pendingFfa.findUnique({ where: { id }, include: { participants: true } });
    if (!pending) {
      // Déjà réglé ou annulé entre-temps.
      throw new HTTPException(404, { message: 'FFA introuvable (déjà réglé ou annulé)' });
    }
    const mine = pending.participants.find((pp) => pp.login === me);
    if (!mine) {
      throw new HTTPException(403, { message: 'tu ne fais pas partie de ce FFA' });
    }
    if (mine.position !== position) {
      throw new HTTPException(409, {
        message: 'le classement a changé — recharge le FFA avant de confirmer ta place',
      });
    }
    if (!mine.confirmed) {
      await tx.pendingFfaParticipant.update({ where: { id: mine.id }, data: { confirmed: true } });
    }
    const confirmedCount = pending.participants.filter((pp) => pp.confirmed || pp.login === me).length;
    const total = pending.participants.length;
    if (confirmedCount < total) {
      return { settled: false as const, id, confirmed: confirmedCount, total, recipients: pending.participants.map((pp) => pp.login) };
    }

    // Tous confirmés → règlement. Filet de sécurité : un participant devenu
    // indisponible (devrait être déjà nettoyé par l'offboarding) annule le FFA.
    const unavailable = await tx.user.findMany({
      where: {
        login: { in: pending.participants.map((pp) => pp.login) },
        OR: [{ bannedAt: { not: null } }, { anonymizedAt: { not: null } }, { deletionScheduledAt: { not: null } }],
      },
      select: { login: true },
    });
    if (unavailable.length > 0) {
      await tx.pendingFfa.delete({ where: { id } });
      return { settled: false as const, aborted: true as const, id, recipients: pending.participants.map((pp) => pp.login), unavailable: unavailable.map((u) => u.login) };
    }

    const played = await settleFfaAsPlayed(tx, pending);
    return { settled: true as const, played };
  });

  if (result.settled) {
    const played = result.played;
    const logins = played.participants.map((pp) => pp.login);
    emit(logins, { type: 'ffa:confirmed', payload: played });
    // L'ELO Smash de plusieurs joueurs a changé → le classement bouge pour tous.
    broadcast({ type: 'leaderboard:update', payload: {} });
    for (const pp of played.participants) void maybeNotifyTop3(pp.login, pp.delta);
    return c.json(played);
  }
  if ('aborted' in result && result.aborted) {
    emit(result.recipients, { type: 'ffa:cancelled', payload: { id: result.id, reason: 'unavailable' } });
    throw new HTTPException(409, { message: 'un participant n\'est plus disponible — FFA annulé, à redéclarer' });
  }
  // Confirmation enregistrée, en attente des autres.
  emit(result.recipients, { type: 'ffa:progress', payload: { id: result.id, confirmed: result.confirmed, total: result.total } });
  return c.json({ id: result.id, status: 'pending', confirmed: result.confirmed, total: result.total });
});

// Contestation de SA position → annule tout le FFA (le déclarant est notifié).
app.post('/matches/ffa/:id/contest', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = ContestFfaSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { claimedPosition, message } = parsed.data;

  let info: { declarerLogin: string; others: string[]; proposedPosition: number } | undefined;
  await prisma.$transaction(async (tx) => {
    const pending = await tx.pendingFfa.findUnique({ where: { id }, include: { participants: true } });
    if (!pending) throw new HTTPException(404, { message: 'FFA introuvable' });
    const mine = pending.participants.find((pp) => pp.login === me);
    if (!mine) throw new HTTPException(403, { message: 'tu ne fais pas partie de ce FFA' });
    if (me === pending.declarerLogin) {
      throw new HTTPException(400, { message: 'le déclarant annule son FFA, il ne le conteste pas' });
    }
    info = {
      declarerLogin: pending.declarerLogin,
      others: pending.participants.map((pp) => pp.login).filter((l) => l !== me),
      proposedPosition: mine.position,
    };
    await tx.pendingFfa.delete({ where: { id } });
  });

  if (info) {
    emit([info.declarerLogin], {
      type: 'ffa:contested',
      payload: { id, contestedBy: me, claimedPosition, proposedPosition: info.proposedPosition },
    });
    await notify(info.declarerLogin, {
      type: 'ffa_contested',
      title: `@${me} conteste le FFA Smash`,
      body: `Position revendiquée : ${claimedPosition}${message ? ` — « ${message} »` : ''}. FFA annulé.`,
      link: '/defis',
      game: 'smash',
    });
    // Les autres participants voient le FFA disparaître.
    emit(info.others.filter((l) => l !== info!.declarerLogin), { type: 'ffa:cancelled', payload: { id, cancelledBy: me, reason: 'contested' } });
  }
  return c.json({ id, status: 'cancelled' });
});

// Annulation par le déclarant lui-même.
app.post('/matches/ffa/:id/cancel', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');

  let others: string[] = [];
  await prisma.$transaction(async (tx) => {
    const pending = await tx.pendingFfa.findUnique({ where: { id }, include: { participants: true } });
    if (!pending) throw new HTTPException(404, { message: 'FFA introuvable' });
    if (pending.declarerLogin !== me) {
      throw new HTTPException(403, { message: 'seul le déclarant peut annuler ce FFA' });
    }
    others = pending.participants.map((pp) => pp.login).filter((l) => l !== me);
    await tx.pendingFfa.delete({ where: { id } });
  });

  if (others.length > 0) {
    emit(others, { type: 'ffa:cancelled', payload: { id, cancelledBy: me } });
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
    await tx.bugReport.deleteMany({ where: { authorId: login } });
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
      await tx.bugReport.deleteMany({ where: { authorId: { in: removeLogins } } });
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
      // 2v2 : un défi concerne aussi les coéquipiers (partner / opponentPartner).
      OR: [
        { challengerLogin: me },
        { opponentLogin: me },
        { partnerLogin: me },
        { opponentPartnerLogin: me },
      ],
      status: { in: ['pending', 'accepted'] },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  return c.json(list);
});

// POST /challenges/2v2 — défi 2v2 Babyfoot. Le challenger nomme les 4 joueurs ;
// seuls les 2 adversaires doivent accepter (cf. /challenges/:id/accept).
app.post('/challenges/2v2', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateChallenge2v2Schema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { partnerLogin, opponentLogin, opponentPartnerLogin, scheduledAt } = parsed.data;
  if ([partnerLogin, opponentLogin, opponentPartnerLogin].includes(me)) {
    throw new HTTPException(400, { message: 'cannot challenge yourself' });
  }
  for (const login of [partnerLogin, opponentLogin, opponentPartnerLogin]) {
    await assertTargetable(login);
  }
  await getOrCreateUser(me);
  const challenge = await prisma.challenge.create({
    data: {
      id: randomUUID(),
      challengerLogin: me,
      opponentLogin,
      status: 'pending',
      scheduledAt: new Date(scheduledAt),
      game: 'babyfoot',
      mode: '2v2',
      partnerLogin,
      opponentPartnerLogin,
    },
  });
  // Les 3 autres joueurs sont notifiés (les 2 adversaires devront accepter).
  emit([opponentLogin, opponentPartnerLogin, partnerLogin], {
    type: 'challenge:received',
    payload: challenge,
  });
  for (const login of [opponentLogin, opponentPartnerLogin]) {
    void notify(login, {
      type: 'challenge_received',
      title: `@${me} t'a défié en 2v2`,
      body: 'Un nouveau défi en équipe t\'attend',
      link: `/challenges?game=babyfoot`,
      game: 'babyfoot',
    });
  }
  return c.json(challenge, 201);
});

app.post('/challenges', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { opponentLogin, scheduledAt, game } = parsed.data;
  if (opponentLogin === me) {
    throw new HTTPException(400, { message: 'cannot challenge yourself' });
  }
  // Un adversaire banni / désactivé / anonymisé est hors-jeu : pas de défi.
  await assertTargetable(opponentLogin);
  await getOrCreateUser(me);
  const challenge = await prisma.challenge.create({
    data: {
      id: randomUUID(),
      challengerLogin: me,
      opponentLogin,
      status: 'pending',
      scheduledAt: new Date(scheduledAt),
      game,
    },
  });
  emit([opponentLogin], { type: 'challenge:received', payload: challenge });
  void notify(opponentLogin, {
    type: 'challenge_received',
    title: `@${me} t'a défié`,
    body: 'Un nouveau défi t\'attend',
    link: `/challenges?game=${encodeURIComponent(game)}`,
    game,
  });
  return c.json(challenge, 201);
});

app.post('/challenges/:id/accept', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const challenge = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });

    // ── 2v2 : seuls les DEUX adversaires acceptent ; 'accepted' quand les deux. ──
    if (ch.mode === '2v2') {
      if (me !== ch.opponentLogin && me !== ch.opponentPartnerLogin) {
        throw new HTTPException(403, { message: 'only the opponents can accept' });
      }
      if (ch.status === 'accepted') return ch; // idempotent
      if (ch.status !== 'pending') {
        throw new HTTPException(409, { message: `challenge is ${ch.status}` });
      }
      const oppAccepted = me === ch.opponentLogin ? new Date() : ch.opponentAcceptedAt;
      const oppPartnerAccepted =
        me === ch.opponentPartnerLogin ? new Date() : ch.opponentPartnerAcceptedAt;
      const bothAccepted = !!oppAccepted && !!oppPartnerAccepted;
      return tx.challenge.update({
        where: { id },
        data: {
          opponentAcceptedAt: oppAccepted,
          opponentPartnerAcceptedAt: oppPartnerAccepted,
          ...(bothAccepted ? { status: 'accepted', decidedAt: new Date() } : {}),
        },
      });
    }

    if (ch.opponentLogin !== me) {
      throw new HTTPException(403, { message: 'only the opponent can accept' });
    }
    // Idempotent : ré-accepter un défi DÉJÀ accepté (double-clic, course, UI en
    // retard sur mobile) renvoie simplement le défi, pas un 409. On ne lève le
    // 409 que pour les transitions vraiment invalides (refusé/annulé/expiré).
    if (ch.status === 'accepted') return ch;
    if (ch.status !== 'pending') {
      throw new HTTPException(409, { message: `challenge is ${ch.status}` });
    }
    return tx.challenge.update({
      where: { id },
      data: { status: 'accepted', decidedAt: new Date() },
    });
  });
  // Tous les participants doivent rafraîchir leur liste de défis (4 en 2v2).
  const acceptRecipients =
    challenge.mode === '2v2'
      ? ([
          challenge.challengerLogin,
          challenge.opponentLogin,
          challenge.partnerLogin,
          challenge.opponentPartnerLogin,
        ].filter(Boolean) as string[])
      : [challenge.challengerLogin, challenge.opponentLogin];
  emit(acceptRecipients, {
    type: 'challenge:accepted',
    payload: challenge,
  });
  return c.json(challenge);
});

const DODGE_ELO_PENALTY = 10;

app.post('/challenges/:id/decline', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const result = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });
    // 2v2 : les 4 participants peuvent refuser/annuler. 1v1 : challenger ou opponent.
    const participants =
      ch.mode === '2v2'
        ? [ch.challengerLogin, ch.opponentLogin, ch.partnerLogin, ch.opponentPartnerLogin].filter(
            Boolean,
          )
        : [ch.challengerLogin, ch.opponentLogin];
    if (!participants.includes(me)) {
      throw new HTTPException(403, {
        message: 'only challenger (cancel) or opponent (decline) can do this',
      });
    }
    if (ch.status !== 'pending' && ch.status !== 'accepted') {
      throw new HTTPException(409, { message: `challenge is ${ch.status}` });
    }
    const wasAccepted = ch.status === 'accepted';
    // Équipe du challenger (lui + son coéquipier) qui se retire → 'cancelled' ;
    // l'équipe adverse qui refuse → 'declined'. OPS = 1v1 uniquement.
    const isChallengerSide = me === ch.challengerLogin || me === ch.partnerLogin;
    const isOpponentDeclining = ch.mode !== '2v2' && ch.opponentLogin === me;
    const newStatus = isChallengerSide ? 'cancelled' : 'declined';
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
      // Tous les participants (4 en 2v2) à prévenir, hormis celui qui refuse.
      participants: participants as string[],
    };
  });
  const declineRecipients = result.participants.filter((p) => p !== me);
  emit(declineRecipients, {
    type: 'challenge:declined',
    payload: { id, status: result.status, eloPenalty: result.penalty, declinedBy: me },
  });
  // Se désister d'un défi accepté applique une pénalité d'ELO → classement global.
  if (result.penalty > 0) {
    broadcast({ type: 'leaderboard:update', payload: {} });
  }
  // Refus d'un match forcé en OPS (1v1 uniquement) : le compteur forcedUsed a
  // bougé → les deux joueurs concernés doivent rafraîchir leur état OPS.
  if (result.isOps) {
    const otherParty =
      result.challengerLogin === me ? result.opponentLogin : result.challengerLogin;
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
  const { scoreSelf, scoreOpponent, bestOf, charSelf, charOpponent, stocks } = parsed.data;

  const pending = await prisma.$transaction(async (tx) => {
    const ch = await tx.challenge.findUnique({ where: { id } });
    if (!ch) throw new HTTPException(404, { message: 'challenge not found' });
    if (ch.status !== 'accepted') {
      throw new HTTPException(409, {
        message: 'challenge must be accepted before recording a result',
      });
    }

    // ── 2v2 : on crée un PendingMatch équipe orienté côté du recordeur. ──
    if (ch.mode === '2v2') {
      const challengerTeam = [ch.challengerLogin, ch.partnerLogin as string];
      const opponentTeam = [ch.opponentLogin, ch.opponentPartnerLogin as string];
      const iAmChallengerSide = challengerTeam.includes(me);
      if (!iAmChallengerSide && !opponentTeam.includes(me)) {
        throw new HTTPException(403, { message: 'not a participant' });
      }
      const myTeam = iAmChallengerSide ? challengerTeam : opponentTeam;
      const oppTeam = iAmChallengerSide ? opponentTeam : challengerTeam;
      const myTeammate = myTeam.find((l) => l !== me) as string;
      // Score babyfoot validé (un camp atteint 10) via RecordResultSchema babyfoot.
      const checked2v2 = RecordResultSchema.safeParse({ ...parsed.data, game: 'babyfoot' });
      if (!checked2v2.success) {
        throw new HTTPException(400, { message: `Score 2v2 invalide : ${checked2v2.error.message}` });
      }
      await tx.challenge.update({ where: { id }, data: { status: 'recorded' } });
      return tx.pendingMatch.create({
        data: {
          id: randomUUID(),
          declarerLogin: me,
          opponentLogin: oppTeam[0] as string,
          partner1Login: myTeammate,
          partner2Login: oppTeam[1] as string,
          scoreDeclarer: scoreSelf,
          scoreOpponent,
          game: 'babyfoot',
          mode: '2v2',
        },
      });
    }

    if (ch.challengerLogin !== me && ch.opponentLogin !== me) {
      throw new HTTPException(403, { message: 'not a participant' });
    }
    const opponentOfMe =
      ch.challengerLogin === me ? ch.opponentLogin : ch.challengerLogin;
    // Défense : on revalide le résultat selon la discipline RÉELLE du défi
    // (et non le `game` du client, qui peut être absent → défaut babyfoot).
    // Sans ça, un défi d'échecs/smash pouvait être stocké avec un score
    // babyfoot 10-0 (la cause du « 10-0 aux échecs »).
    const checked = RecordResultSchema.safeParse({ ...parsed.data, game: ch.game });
    if (!checked.success) {
      throw new HTTPException(400, {
        message: `Score invalide pour ${ch.game} : ${checked.error.message}`,
      });
    }
    await tx.challenge.update({
      where: { id },
      data: { status: 'recorded' },
    });
    // Le jeu du match en attente est celui du défi (babyfoot / smash).
    return tx.pendingMatch.create({
      data: {
        id: randomUUID(),
        declarerLogin: me,
        opponentLogin: opponentOfMe,
        scoreDeclarer: scoreSelf,
        scoreOpponent,
        game: ch.game,
        bestOf: bestOf ?? null,
        charDeclarer: charSelf ?? null,
        charOpponent: charOpponent ?? null,
        stocks: stocks ?? null,
      },
    });
  });
  // Le défi passe en "recorded" et un match en attente apparaît : les participants
  // (4 en 2v2) doivent rafraîchir leurs défis ET leurs matchs.
  const recordRecipients = (
    pending.mode === '2v2'
      ? [pending.declarerLogin, pending.opponentLogin, pending.partner1Login, pending.partner2Login]
      : [pending.declarerLogin, pending.opponentLogin]
  ).filter(Boolean) as string[];
  emit(recordRecipients, {
    type: 'challenge:recorded',
    payload: { pendingId: pending.id },
  });
  return c.json({ pendingId: pending.id, status: 'pending_confirmation' }, 201);
});

/* ============ TOURNAMENTS ============ */

// Génère les matchs au démarrage : phase de poules (format 'pools') ou bracket à
// élimination directe (format 'elimination', byes inclus si nécessaire).
async function launchTournamentMatches(
  tournamentId: string,
  format: string,
  logins: string[],
): Promise<void> {
  if (format === 'pools') await generatePools(tournamentId, logins);
  else await generateBracket(tournamentId, logins);
}

app.get('/tournaments', async (c) => {
  const me = await getCurrentLogin(c);
  // Tournois filtrés par discipline (mode courant) : pas de partage entre modes.
  const game = parseGame(c.req.query('game'));
  const list = await prisma.tournament.findMany({
    where: { game },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      entries: { select: { login: true } },
      winner: { select: { login: true, imageUrl: true } },
    },
  });
  const isParticipant = (t: (typeof list)[number]) =>
    t.createdByLogin === me || t.entries.some((e) => e.login === me);
  const visible = list.filter((t) => {
    // Tournoi privé : visible uniquement par son créateur, ses invités ou un admin.
    if (t.isPrivate && !isParticipant(t) && !isAdmin(me)) return false;
    // Historique amical : un tournoi amical terminé/annulé n'apparaît que pour ses
    // participants. Les officiels (et tout ce qui est encore vivant) restent publics.
    if (
      t.kind !== 'official' &&
      (t.status === 'finished' || t.status === 'cancelled') &&
      !isParticipant(t) &&
      !isAdmin(me)
    ) {
      return false;
    }
    return true;
  });
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
      // Invitations : l'organisateur voit toutes les invitations en attente ;
      // un joueur invité voit uniquement la sienne.
      invites: {
        where: {
          OR: [
            { status: 'pending' },
            { inviteeLogin: me },
          ],
        },
        select: {
          id: true,
          inviteeLogin: true,
          inviterLogin: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
  if (!tournament) {
    throw new HTTPException(404, { message: 'tournament not found' });
  }
  // Tournoi privé : accessible si créateur, inscrit, invité en attente, ou admin.
  const hasInvite = tournament.invites.some((inv) => inv.inviteeLogin === me);
  if (
    tournament.isPrivate &&
    tournament.createdByLogin !== me &&
    !isAdmin(me) &&
    !tournament.entries.some((e) => e.login === me) &&
    !hasInvite
  ) {
    throw new HTTPException(404, { message: 'tournament not found' });
  }
  // Filtrer les invites visibles selon le rôle :
  // l'organisateur et les admins voient tout ; les autres ne voient que leur propre invite.
  const isOrganizer = tournament.createdByLogin === me;
  const visibleInvites =
    isOrganizer || isAdmin(me)
      ? tournament.invites
      : tournament.invites.filter((inv) => inv.inviteeLogin === me);
  return c.json({ ...tournament, invites: visibleInvites });
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
      format: parsed.data.format,
      game: parsed.data.game,
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
      await launchTournamentMatches(id, t.format, logins);
      await tx.tournament.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      void notifyMany(logins, {
        type: 'tournament',
        title: `Tournoi "${t.name}" lancé`,
        body: 'Le bracket est généré — à toi de jouer !',
        link: `/tournaments/${id}`,
      });
      return { autoStarted: true };
    }
    return { autoStarted: false };
  });
  // Abonnés notifiés que ce joueur a rejoint un tournoi.
  void notifyFollowers(me, 'notifyTournament', {
    type: 'follow_tournament',
    title: `@${me} a rejoint un tournoi`,
    link: `/tournaments/${id}`,
    game: await tournamentGame(id),
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
      await launchTournamentMatches(id, t.format, logins);
      await tx.tournament.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      void notifyMany(logins, {
        type: 'tournament',
        title: `Tournoi "${t.name}" lancé`,
        body: 'Le bracket est généré — à toi de jouer !',
        link: `/tournaments/${id}`,
      });
      return { autoStarted: true };
    }
    return { autoStarted: false };
  });

  emit([login], { type: 'leaderboard:update', payload: {} });
  void notifyFollowers(login, 'notifyTournament', {
    type: 'follow_tournament',
    title: `@${login} a rejoint un tournoi`,
    link: `/tournaments/${id}`,
    game: await tournamentGame(id),
  });
  return c.json({ id, added: login, status: result.autoStarted ? 'in_progress' : 'registration' });
});

/* ─── Invitations tournoi ─────────────────────────────────────────────────── */

// Envoie une invitation à un joueur (organisateur ou admin uniquement).
// La cible recevra une notification et pourra accepter / refuser.
app.post('/tournaments/:id/invite', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { login: inviteeLogin } = z.object({ login: z.string().trim().min(1) }).parse(body);

  const result = await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({ where: { id }, include: { entries: true } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.createdByLogin !== me && !isAdmin(me)) {
      throw new HTTPException(403, { message: "seul l'organisateur ou un admin peut inviter" });
    }
    if (t.status !== 'registration') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    const target = await tx.user.findUnique({ where: { login: inviteeLogin } });
    if (!target || target.bannedAt || target.anonymizedAt || target.deletionScheduledAt) {
      throw new HTTPException(404, { message: `joueur introuvable : ${inviteeLogin}` });
    }
    if (t.entries.some((e) => e.login === inviteeLogin)) {
      throw new HTTPException(409, { message: 'joueur déjà inscrit' });
    }
    if (t.entries.length >= t.capacity) {
      throw new HTTPException(409, { message: 'tournoi complet' });
    }
    // Idempotent : si une invitation est déjà en attente, on la renvoie.
    const existing = await tx.tournamentInvite.findUnique({
      where: { tournamentId_inviteeLogin: { tournamentId: id, inviteeLogin } },
    });
    if (existing) {
      if (existing.status === 'pending') return existing;
      // Re-inviter après un refus : on remet en pending.
      return tx.tournamentInvite.update({
        where: { id: existing.id },
        data: { status: 'pending', decidedAt: null },
      });
    }
    return tx.tournamentInvite.create({
      data: { id: randomUUID(), tournamentId: id, inviterLogin: me, inviteeLogin },
    });
  });

  const invTournament = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true, game: true },
  });
  void notify(inviteeLogin, {
    type: 'tournament_invite',
    title: `Invitation au tournoi "${invTournament?.name}"`,
    body: `@${me} t'invite à rejoindre le tournoi`,
    link: `/tournaments/${id}`,
    game: invTournament?.game ?? undefined,
  });
  emit([inviteeLogin], { type: 'tournament:invite', payload: { tournamentId: id, inviteId: result.id } });
  return c.json(result, 201);
});

// Le joueur invité accepte → il est ajouté comme participant (auto-start si plein).
app.post('/tournaments/:id/invites/:inviteId/accept', async (c) => {
  const me = await getCurrentLogin(c);
  const { id, inviteId } = c.req.param();

  const { autoStarted } = await prisma.$transaction(async (tx) => {
    const invite = await tx.tournamentInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.tournamentId !== id) {
      throw new HTTPException(404, { message: 'invitation introuvable' });
    }
    if (invite.inviteeLogin !== me) {
      throw new HTTPException(403, { message: 'cette invitation ne te concerne pas' });
    }
    if (invite.status !== 'pending') {
      throw new HTTPException(409, { message: `invitation déjà ${invite.status}` });
    }
    const t = await tx.tournament.findUnique({ where: { id }, include: { entries: true } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.status !== 'registration') {
      throw new HTTPException(409, { message: `tournament is ${t.status}` });
    }
    if (t.entries.length >= t.capacity) {
      throw new HTTPException(409, { message: 'tournoi complet' });
    }
    if (t.entries.some((e) => e.login === me)) {
      // Déjà inscrit (ex. re-invite) — marquer comme accepté quand même.
      await tx.tournamentInvite.update({
        where: { id: inviteId },
        data: { status: 'accepted', decidedAt: new Date() },
      });
      return { autoStarted: false };
    }

    await tx.tournamentInvite.update({
      where: { id: inviteId },
      data: { status: 'accepted', decidedAt: new Date() },
    });
    await tx.tournamentEntry.create({ data: { tournamentId: id, login: me } });

    const newCount = t.entries.length + 1;
    if (newCount === t.capacity) {
      const logins = [...t.entries.map((e) => e.login), me];
      await launchTournamentMatches(id, t.format, logins);
      await tx.tournament.update({
        where: { id },
        data: { status: 'in_progress', startedAt: new Date() },
      });
      void notifyMany(logins, {
        type: 'tournament',
        title: `Tournoi "${t.name}" lancé`,
        body: 'Le bracket est généré — à toi de jouer !',
        link: `/tournaments/${id}`,
      });
      return { autoStarted: true };
    }
    return { autoStarted: false };
  });

  broadcast({ type: 'tournament:update', payload: {} });
  void notifyFollowers(me, 'notifyTournament', {
    type: 'follow_tournament',
    title: `@${me} a rejoint un tournoi`,
    link: `/tournaments/${id}`,
    game: await tournamentGame(id),
  });
  return c.json({ id, inviteId, status: autoStarted ? 'in_progress' : 'registration' });
});

// Le joueur invité refuse l'invitation.
app.post('/tournaments/:id/invites/:inviteId/decline', async (c) => {
  const me = await getCurrentLogin(c);
  const { id, inviteId } = c.req.param();

  const invite = await prisma.$transaction(async (tx) => {
    const inv = await tx.tournamentInvite.findUnique({ where: { id: inviteId } });
    if (!inv || inv.tournamentId !== id) {
      throw new HTTPException(404, { message: 'invitation introuvable' });
    }
    if (inv.inviteeLogin !== me) {
      throw new HTTPException(403, { message: 'cette invitation ne te concerne pas' });
    }
    if (inv.status !== 'pending') {
      throw new HTTPException(409, { message: `invitation déjà ${inv.status}` });
    }
    return tx.tournamentInvite.update({
      where: { id: inviteId },
      data: { status: 'declined', decidedAt: new Date() },
    });
  });

  emit([invite.inviterLogin], { type: 'tournament:invite_declined', payload: { tournamentId: id, inviteeLogin: me } });
  return c.json({ id, inviteId, status: 'declined' });
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
    await launchTournamentMatches(id, t.format, t.entries.map((e) => e.login));
    await tx.tournament.update({
      where: { id },
      data: { status: 'in_progress', startedAt: new Date() },
    });
    void notifyMany(t.entries.map((e) => e.login), {
      type: 'tournament',
      title: `Tournoi "${t.name}" lancé`,
      body: 'Le bracket est généré — à toi de jouer !',
      link: `/tournaments/${id}`,
      game: t.game,
    });
    return true;
  });
  return c.json({ id, started: result });
});

// Annulation par l'organisateur (ou un admin) : le tournoi est supprimé pour de bon
// et disparaît des listes (cascade → entries + matchs). Pas de statut « annulé ».
app.post('/tournaments/:id/cancel', async (c) => {
  const me = await getCurrentLogin(c);
  const id = c.req.param('id');
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({ where: { id } });
    if (!t) throw new HTTPException(404, { message: 'tournament not found' });
    if (t.createdByLogin !== me && !isAdmin(me)) {
      throw new HTTPException(403, {
        message: 'only the organizer can cancel',
      });
    }
    if (t.status === 'finished') {
      throw new HTTPException(409, { message: 'tournament is finished' });
    }
    await tx.tournament.delete({ where: { id } });
  });
  return c.json({ id, cancelled: true, deleted: true });
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
    // Validation du score selon la discipline du tournoi (échecs 1-0, smash set,
    // babyfoot 10-x) — empêche le « 10-0 » sur une finale d'échecs/smash.
    const tour = await tx.tournament.findUnique({ where: { id }, select: { game: true } });
    const scoreErr = validateTournamentScore(parseGameId(tour?.game), scoreA, scoreB);
    if (scoreErr) throw new HTTPException(400, { message: scoreErr });
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

    // Match de poule : pas de propagation. Quand toutes les poules sont terminées,
    // on génère le bracket des qualifiés (top 2 par poule, seeding croisé).
    if (m.stage === 'pool') {
      const remaining = await tx.tournamentMatch.count({
        where: { tournamentId: id, stage: 'pool', confirmedAt: null },
      });
      let bracketGenerated = false;
      if (remaining === 0) {
        const poolMatches = await tx.tournamentMatch.findMany({
          where: { tournamentId: id, stage: 'pool' },
          select: {
            poolIndex: true,
            playerALogin: true,
            playerBLogin: true,
            scoreA: true,
            scoreB: true,
            winnerLogin: true,
          },
        });
        const qualifiers = qualifiersFromPools(poolMatches);
        await generateBracket(id, qualifiers, { preSeeded: true });
        bracketGenerated = true;
      }
      return { winnerLogin, finished: false, bracketGenerated };
    }

    // Match de bracket : propage le gagnant. Le nombre de rounds est calculé depuis
    // les matchs réels (byes / poules font diverger taille du bracket et capacité).
    const agg = await tx.tournamentMatch.aggregate({
      where: { tournamentId: id, stage: 'bracket' },
      _max: { round: true },
    });
    const totalBracketRounds = agg._max.round ?? 1;
    const adv = await advanceWinner(id, m.round, m.slot, winnerLogin, totalBracketRounds);
    let finished = false;
    if (adv.isFinal) {
      const tour = await tx.tournament.update({
        where: { id },
        data: {
          status: 'finished',
          finishedAt: new Date(),
          winnerLogin,
        },
        select: { game: true },
      });
      // Crédite le bon compteur de titres selon la discipline du tournoi.
      await tx.user.update({
        where: { login: winnerLogin },
        data: tournamentsWonDelta(parseGameId(tour.game), 1),
      });
      finished = true;
    }
    return { winnerLogin, finished, bracketGenerated: false };
  });
  if (result.bracketGenerated) {
    const players = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      select: { login: true },
    });
    void notifyMany(players.map((p) => p.login), {
      type: 'tournament',
      title: 'Phase de poules terminée',
      body: 'Le bracket des qualifiés est prêt — place à l’élimination directe !',
      link: `/tournaments/${id}`,
      game: await tournamentGame(id),
    });
  }
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

// Accorde ou retire l'accès staging à un utilisateur (flag stagingAllowed, indépendant du rôle).
// BUG CORRIGÉ : l'ancienne version accordait SUPERADMIN, ce qui était dangereux.
// Désormais : le rôle DB n'est PAS modifié — USER reste USER, ADMIN reste ADMIN, etc.
// Seul le flag `stagingAllowed` change. Le SUPERADMIN reste exclusivement abidaux/throbert.
app.post('/admin/users/:login/staging-access', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const targetLogin = c.req.param('login');
  if (SUPERADMINS.has(targetLogin.toLowerCase())) {
    throw new HTTPException(400, { message: 'cannot modify a hardcoded superadmin' });
  }
  const target = await prisma.user.findUnique({ where: { login: targetLogin } });
  if (!target) throw new HTTPException(404, { message: 'user not found' });
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ grant: z.boolean() }).safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  // On modifie UNIQUEMENT stagingAllowed — le rôle est préservé.
  const updated = await prisma.user.update({
    where: { login: targetLogin },
    data: { stagingAllowed: parsed.data.grant },
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'SET_ROLE',
    target: targetLogin,
    payload: { stagingAccess: parsed.data.grant },
  });
  return c.json({ login: updated.login, role: updated.role, stagingAllowed: updated.stagingAllowed });
});

// =========================================================================
// IMPERSONATION « TESTER » — staging uniquement
// =========================================================================
// Délivre à un admin/superadmin un token d'authentification du compte de test
// générique `tester` (rôle USER) afin qu'il puisse vivre l'expérience d'un joueur
// lambda et tester sans privilèges. Garde-fous :
//  - staging UNIQUEMENT (jamais en prod, fail-secure sur APP_ENV) ;
//  - réservé aux admins (requireAdmin) ;
//  - SEUL le compte `tester` dédié est ciblable — on ne mint jamais le token d'un
//    compte réel arbitraire, ce qui interdit toute usurpation d'un vrai joueur.
// Le retour au compte d'origine est purement côté client (le front sauvegarde le
// token de l'admin avant de le remplacer — cf. startImpersonation/stopImpersonation).
app.post('/admin/impersonate-tester', async (c) => {
  if (process.env.APP_ENV !== 'staging') {
    throw new HTTPException(403, { message: 'staging only' });
  }
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HTTPException(500, { message: 'server misconfigured' });
  // Garantit l'existence du compte (rôle USER) même si le seed n'a pas tourné.
  await getOrCreateUser(TESTER_LOGIN);
  const token = issueToken(TESTER_LOGIN, secret);
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'IMPERSONATE_TESTER',
    target: TESTER_LOGIN,
  });
  return c.json({ token, login: TESTER_LOGIN });
});

// Variante : crée un compte tester TOUT NEUF (login unique `tester-…`) puis délivre
// son token. Permet de revivre l'arrivée d'un joueur fraîchement créé (onboarding à
// faire, stats vierges) à chaque clic. Mêmes garde-fous : staging only + admin.
app.post('/admin/impersonate-fresh-tester', async (c) => {
  if (process.env.APP_ENV !== 'staging') {
    throw new HTTPException(403, { message: 'staging only' });
  }
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HTTPException(500, { message: 'server misconfigured' });
  // Login unique court (≤ 20 car.) ; `onboardedAt` laissé null → onboarding rejoué.
  const login = `${FRESH_TESTER_PREFIX}${randomUUID().slice(0, 8)}`;
  await prisma.user.create({
    data: { login, role: 'USER', campus: 'Le Havre' },
  });
  const token = issueToken(login, secret);
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'IMPERSONATE_TESTER',
    target: login,
  });
  return c.json({ token, login });
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

/* ============ BUG REPORTS (boîte à tickets) ============ */

app.post('/bug-reports', async (c) => {
  const me = await getCurrentLogin(c);
  const body = await c.req.json().catch(() => null);
  const parsed = BugReportSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  await getOrCreateUser(me);
  const br = await prisma.bugReport.create({
    data: { id: randomUUID(), text: parsed.data.text, authorId: me },
  });
  return c.json(br, 201);
});

app.get('/bug-reports', async (c) => {
  const me = await getCurrentLogin(c);
  const role = await getUserRole(me);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new HTTPException(403, { message: 'admins only' });
  }
  const list = await prisma.bugReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { login: true, imageUrl: true } } },
  });
  return c.json(list);
});

app.patch('/bug-reports/:id/status', async (c) => {
  const me = await getCurrentLogin(c);
  const role = await getUserRole(me);
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    throw new HTTPException(403, { message: 'admins only' });
  }
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = SetBugReportStatusSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const br = await prisma.bugReport.update({
    where: { id },
    data: { status: parsed.data.status },
  }).catch(() => { throw new HTTPException(404, { message: 'bug report not found' }); });
  return c.json(br);
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
  void notify(target, {
    type: 'ops_targeted',
    title: `@${me} t'a pris pour cible`,
    body: 'Un OPS te vise — tes 3 prochains défis face à lui sont forcés.',
    link: '/profile',
  });
  // Abonnés du traqueur notifiés qu'il a lancé un OPS.
  void notifyFollowers(me, 'notifyOps', {
    type: 'follow_ops',
    title: `@${me} a lancé un OPS`,
    body: `Cible : @${target}`,
    link: `/player/${encodeURIComponent(me)}`,
  });
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

// ─── Rate-limit : déblocage manuel (SUPERADMIN uniquement) ───────────────────

// Renvoie l'état de la pénalité de l'appelant — utile pour diagnostiquer.
// Les pénalités sont indexées par sujet (user:login quand authentifié), avec un
// repli sur l'IP pour les blocages pré-auth.
app.get('/admin/rate-limit/me', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const ip = clientIp(c);
  const subject = `user:${me.toLowerCase()}`;
  const info = getPenaltyInfo(subject) ?? getPenaltyInfo(`ip:${ip}`);
  return c.json({ subject, ip, penalty: info });
});

// Efface la pénalité de l'appelant (sujet user + IP) — à utiliser quand on est
// bloqué. Le bypass superadmin dans le rate-limiter global permet d'atteindre
// cet endpoint même puni, à condition de présenter son Bearer.
app.delete('/admin/rate-limit/me', async (c) => {
  const me = await getCurrentLogin(c);
  await requireSuperAdmin(me);
  const ip = clientIp(c);
  const subject = `user:${me.toLowerCase()}`;
  clearPenalty(subject);
  clearPenalty(`ip:${ip}`);
  return c.json({ cleared: true, subject, ip });
});

app.get('/admin/users', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdminOrModerator(me);
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'desc' }, { elo: 'desc' }],
  });
  return c.json(users);
});

app.patch('/admin/users/:login/stats', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canEditStats');
  const login = c.req.param('login');
  if (SUPERADMINS.has(login.toLowerCase()) && !SUPERADMINS.has(me.toLowerCase())) {
    throw new HTTPException(403, { message: "cannot modify a superadmin's stats" });
  }
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    elo: z.number().int().min(0).optional(),
    matchesPlayed: z.number().int().min(0).optional(),
    dodgeCount: z.number().int().min(0).optional(),
    tournamentsWon: z.number().int().min(0).optional(),
    // Gestion granulaire par discipline (smash / échecs).
    eloSmash: z.number().int().min(0).optional(),
    matchesPlayedSmash: z.number().int().min(0).optional(),
    tournamentsWonSmash: z.number().int().min(0).optional(),
    eloChess: z.number().int().min(0).optional(),
    matchesPlayedChess: z.number().int().min(0).optional(),
    tournamentsWonChess: z.number().int().min(0).optional(),
    eloSf: z.number().int().min(0).optional(),
    matchesPlayedSf: z.number().int().min(0).optional(),
    tournamentsWonSf: z.number().int().min(0).optional(),
    // Modes auxquels le joueur adhère.
    games: z.array(z.enum(['babyfoot', 'smash', 'chess', 'streetfighter'])).min(1).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const before = await prisma.user.findUnique({
    where: { login },
    select: {
      elo: true,
      matchesPlayed: true,
      dodgeCount: true,
      tournamentsWon: true,
      eloSmash: true,
      matchesPlayedSmash: true,
      tournamentsWonSmash: true,
      eloChess: true,
      matchesPlayedChess: true,
      tournamentsWonChess: true,
      eloSf: true,
      matchesPlayedSf: true,
      tournamentsWonSf: true,
      games: true,
    },
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
  await requirePerm(me, 'canBan');
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
    await cancelUserFfas(tx, login);
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
  await requirePerm(me, 'canBan');
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
  await requireAdminOrModerator(me);
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
  return c.json({
    user,
    recentMatches,
    topOpponents,
    rejectionsEmitted,
    rejectionsReceived,
    // Permissions du modérateur (null si pas MODERATOR).
    moderatorPermissions: user.role === 'MODERATOR'
      ? (user.moderatorPermissions as ModeratorPermissions | null) ?? {}
      : null,
    availablePermissions: MODERATOR_PERMISSIONS,
  });
});

/* ============ ADMIN — MATCHES ============ */

app.delete('/admin/matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canDeleteMatches');
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
  await requirePerm(me, 'canEditMatches');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    scoreA: z.number().int().min(0),
    scoreB: z.number().int().min(0),
    playerALogin: z.string().trim().min(1).optional(),
    playerBLogin: z.string().trim().min(1).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.message });
  const { scoreA, scoreB, playerALogin: nextPlayerA, playerBLogin: nextPlayerB } = parsed.data;
  if (nextPlayerA && nextPlayerB && nextPlayerA === nextPlayerB) {
    throw new HTTPException(400, { message: 'players must be different' });
  }
  const match = await prisma.playedMatch.findUnique({ where: { id } });
  if (!match) throw new HTTPException(404, { message: 'match not found' });

  const nextA = nextPlayerA ?? match.playerALogin;
  const nextB = nextPlayerB ?? match.playerBLogin;
  if (nextA === nextB) {
    throw new HTTPException(400, { message: 'players must be different' });
  }

  const winner: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';
  const game = parseGameId(match.game);

  const updated = await prisma.$transaction(async (tx) => {
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

    const priors = await tx.playedMatch.findMany({
      where: {
        id: { not: id },
        playerALogin: nextA,
        playerBLogin: nextB,
        game: match.game,
      },
      select: { playedAt: true, countedForElo: true },
    });
    const countsForElo = shouldCountForElo(priors, match.playedAt);

    const [userA, userB] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { login: nextA } }),
      tx.user.findUniqueOrThrow({ where: { login: nextB } }),
    ]);

    let deltaA = 0;
    let deltaB = 0;
    if (countsForElo) {
      const ratingA = readElo(userA, game);
      const ratingB = readElo(userB, game);
      const outcome = (game === 'smash' || game === 'streetfighter')
        ? {
            scoreA,
            scoreB,
            bestOf: match.bestOf ?? 3,
            winnerStocks: winner === 'A' ? (match.stocksA ?? 1) : (match.stocksB ?? 1),
          }
        : { scoreA, scoreB };
      const update = applyGameElo(game, ratingA, ratingB, winner, outcome);
      deltaA = update.deltaA;
      deltaB = update.deltaB;
      await tx.user.update({ where: { login: nextA }, data: ratingUpdate(game, update.newA) });
      await tx.user.update({ where: { login: nextB }, data: ratingUpdate(game, update.newB) });
    }

    return tx.playedMatch.update({
      where: { id },
      data: {
        playerALogin: nextA,
        playerBLogin: nextB,
        scoreA,
        scoreB,
        winner,
        countedForElo: countsForElo,
        deltaA,
        deltaB,
      },
    });
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'EDIT_MATCH',
    payload: {
      matchId: id,
      before: {
        playerA: match.playerALogin,
        playerB: match.playerBLogin,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        winner: match.winner,
      },
      after: {
        playerA: nextA,
        playerB: nextB,
        scoreA,
        scoreB,
        winner,
      },
    },
  });
  return c.json(updated);
});

app.get('/admin/rejected-matches', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canDeleteRejectedMatches');
  const list = await prisma.rejectedMatch.findMany({
    orderBy: { rejectedAt: 'desc' },
    take: 200,
  });
  return c.json(list);
});

app.delete('/admin/rejected-matches/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canDeleteRejectedMatches');
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
  await requirePerm(me, 'canDeletePendingMatches');
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
  await requirePerm(me, 'canDeleteChallenges');
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
  await requirePerm(me, 'canDeleteOps');
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

// Suppression d'un tournoi par un admin (n'importe quel statut, y compris terminé).
// Si le tournoi était terminé, on décrémente le compteur de victoires du vainqueur.
app.delete('/admin/tournaments/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canDeleteTournaments');
  const { id } = c.req.param();
  const row = await prisma.tournament.findUnique({ where: { id } });
  if (!row) throw new HTTPException(404, { message: 'tournament not found' });
  await prisma.$transaction(async (tx) => {
    if (row.status === 'finished' && row.winnerLogin) {
      await tx.user.update({
        where: { login: row.winnerLogin },
        data: tournamentsWonDelta(parseGameId(row.game), -1),
      });
    }
    await tx.tournament.delete({ where: { id } }); // cascade → entries + matchs
  });
  broadcast({ type: 'tournament:update', payload: {} });
  void logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'DELETE_TOURNAMENT',
    target: row.createdByLogin,
    payload: { id, name: row.name, kind: row.kind, status: row.status, winnerLogin: row.winnerLogin },
  });
  return c.json({ id, deleted: true });
});

app.get('/admin/suspicious', async (c) => {
  const me = await getCurrentLogin(c);
  await requirePerm(me, 'canViewSuspicious');

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
  await requirePerm(me, 'canViewAuditLog');
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
  await requirePerm(me, 'canViewHistory');
  const url = new URL(c.req.url);
  const loginFilter = url.searchParams.get('login') ?? undefined;
  const typeFilter = url.searchParams.get('type') ?? undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 1000);
  // Filtre par discipline. challenge/pending/played portent `game` ; rejected/ops
  // sont antérieurs au multi-jeu (babyfoot) → exclus dès qu'on cible smash/échecs.
  const gq = url.searchParams.get('game');
  const gameFilter = gq === 'smash' || gq === 'chess' || gq === 'streetfighter' || gq === 'babyfoot' ? gq : null;
  const gameWhere = gameFilter ? { game: gameFilter } : {};
  const includeLegacy = !gameFilter || gameFilter === 'babyfoot';

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
      ? prisma.challenge.findMany({ where: { ...loginWhere, ...gameWhere }, orderBy: { createdAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'pending_match')
      ? prisma.pendingMatch.findMany({ where: { ...loginWhereDO, ...gameWhere }, orderBy: { declaredAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (!typeFilter || typeFilter === 'played_match')
      ? prisma.playedMatch.findMany({ where: { ...loginWhereAB, ...gameWhere }, orderBy: { playedAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (includeLegacy && (!typeFilter || typeFilter === 'rejected_match'))
      ? prisma.rejectedMatch.findMany({ where: loginWhereDO, orderBy: { rejectedAt: 'desc' }, take: limit })
      : Promise.resolve([]),
    (includeLegacy && (!typeFilter || typeFilter === 'ops'))
      ? prisma.ops.findMany({ where: loginWhereOps, orderBy: { declaredAt: 'desc' }, take: limit })
      : Promise.resolve([]),
  ]);

  type Event = {
    id: string;
    type: 'challenge' | 'pending_match' | 'played_match' | 'rejected_match' | 'ops';
    at: string;
    game: string;
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
      game: c.game,
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
      game: p.game,
      playerA: p.declarerLogin,
      playerB: p.opponentLogin,
      scoreA: p.scoreDeclarer,
      scoreB: p.scoreOpponent,
    })),
    ...played.map((m) => ({
      id: m.id,
      type: 'played_match' as const,
      at: m.playedAt.toISOString(),
      game: m.game,
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
      game: 'babyfoot',
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
      game: 'babyfoot',
      playerA: o.ownerLogin,
      playerB: o.targetLogin,
      forcedUsed: o.forcedUsed,
      expiresAt: o.expiresAt.toISOString(),
    })),
  ];

  events.sort((a, b) => b.at.localeCompare(a.at));
  return c.json(events.slice(0, limit));
});

// ─── Boutique « League Coin » ──────────────────────────────────────────────────
//
// Économie cosmétique : les joueurs dépensent des League Coins (porte-monnaie
// `user.leagueCoins`) pour acquérir des objets (titres, bannières…) puis les
// équipent (au plus un équipé par catégorie). L'attribution de coins est réservée
// aux admins via /admin/shop/grant.

// Sérialise un ShopItem Prisma vers la forme `ShopItemData` attendue par le front.
// Le `payload` JSON est transmis tel quel.
function serializeShopItem(item: {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string | null;
  price: number;
  payload: Prisma.JsonValue | null;
  active: boolean;
  sortOrder: number;
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    color: item.color ?? null,
    price: item.price,
    payload: item.payload ?? null,
    active: item.active,
    sortOrder: item.sortOrder,
  };
}

// GET /shop — catalogue actif + solde + objets possédés par le joueur courant.
app.get('/shop', async (c) => {
  const login = await getCurrentLogin(c);
  await getOrCreateUser(login);
  const [user, items, owned] = await Promise.all([
    prisma.user.findUnique({ where: { login }, select: { leagueCoins: true } }),
    prisma.shopItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.shopInventory.findMany({ where: { userLogin: login }, select: { itemId: true } }),
  ]);
  return c.json({
    coins: user?.leagueCoins ?? 0,
    items: items.map(serializeShopItem),
    owned: owned.map((o) => o.itemId),
  });
});

// POST /shop/:id/buy — achète un objet. Re-vérifie solde & possession dans une
// transaction pour éviter les doubles achats / soldes négatifs.
app.post('/shop/:id/buy', async (c) => {
  const login = await getCurrentLogin(c);
  await getOrCreateUser(login);
  const itemId = c.req.param('id');

  const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
  if (!item || !item.active) {
    throw new HTTPException(404, { message: 'objet introuvable' });
  }

  const coins = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { login }, select: { leagueCoins: true } });
    if (!user) throw new HTTPException(404, { message: 'utilisateur introuvable' });
    const already = await tx.shopInventory.findUnique({
      where: { userLogin_itemId: { userLogin: login, itemId } },
    });
    if (already) throw new HTTPException(409, { message: 'objet déjà possédé' });
    if (user.leagueCoins < item.price) {
      throw new HTTPException(400, { message: 'solde insuffisant' });
    }
    const updated = await tx.user.update({
      where: { login },
      data: { leagueCoins: { decrement: item.price } },
      select: { leagueCoins: true },
    });
    await tx.shopInventory.create({ data: { userLogin: login, itemId } });
    return updated.leagueCoins;
  });

  emit([login], { type: 'panel:update', payload: {} });
  return c.json({ ok: true, coins });
});

// GET /me/inventory — inventaire détaillé du joueur courant (objet + état équipé).
app.get('/me/inventory', async (c) => {
  const login = await getCurrentLogin(c);
  await getOrCreateUser(login);
  const rows = await prisma.shopInventory.findMany({
    where: { userLogin: login },
    include: { item: true },
    orderBy: { acquiredAt: 'asc' },
  });
  return c.json(
    rows.map((r) => ({
      itemId: r.itemId,
      item: serializeShopItem(r.item),
      equipped: r.equipped,
      acquiredAt: r.acquiredAt.toISOString(),
    })),
  );
});

// POST /me/inventory/:id/equip — (dé)équipe un objet possédé. Au plus un objet
// équipé par catégorie. Un titre équipé est reflété dans `user.title`.
const EquipSchema = z.object({ equipped: z.boolean() });
app.post('/me/inventory/:id/equip', async (c) => {
  const login = await getCurrentLogin(c);
  await getOrCreateUser(login);
  const itemId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = EquipSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { equipped } = parsed.data;

  const row = await prisma.shopInventory.findUnique({
    where: { userLogin_itemId: { userLogin: login, itemId } },
    include: { item: true },
  });
  if (!row) throw new HTTPException(404, { message: 'objet non possédé' });

  const category = row.item.category;
  // Le payload titre porte la chaîne à appliquer sur user.title.
  const titlePayload =
    category === 'title' &&
    row.item.payload &&
    typeof row.item.payload === 'object' &&
    !Array.isArray(row.item.payload)
      ? (row.item.payload as Record<string, unknown>).title
      : undefined;
  const titleStr = typeof titlePayload === 'string' ? titlePayload : null;

  await prisma.$transaction(async (tx) => {
    if (equipped) {
      // Un seul objet équipé par catégorie : on déséquipe les autres de la même catégorie.
      await tx.shopInventory.updateMany({
        where: { userLogin: login, equipped: true, item: { category } },
        data: { equipped: false },
      });
      await tx.shopInventory.update({
        where: { userLogin_itemId: { userLogin: login, itemId } },
        data: { equipped: true },
      });
      if (category === 'title' && titleStr) {
        await tx.user.update({ where: { login }, data: { title: titleStr } });
      }
    } else {
      await tx.shopInventory.update({
        where: { userLogin_itemId: { userLogin: login, itemId } },
        data: { equipped: false },
      });
      if (category === 'title' && titleStr) {
        const u = await tx.user.findUnique({ where: { login }, select: { title: true } });
        if (u?.title === titleStr) {
          await tx.user.update({ where: { login }, data: { title: null } });
        }
      }
    }
  });

  emit([login], { type: 'panel:update', payload: {} });
  return c.json({ ok: true });
});

// ── Boutique : administration du catalogue ──────────────────────────────────
// Cap d'octets sur l'image data-URL d'une bannière (~700 Ko) : évite de gonfler
// la table et les réponses /shop. La validation de DIMENSIONS exacte est côté client.
const MAX_BANNER_DATAURL_LEN = 700_000;
const ShopItemCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().nullish(),
    category: z.enum(['title', 'banner', 'badge', 'cosmetic']),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'couleur invalide (format #rrggbb)')
      .nullish(),
    price: z.number().int().min(0),
    payload: z.record(z.any()).nullish(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.category === 'banner') {
      const img = d.payload && typeof d.payload.image === 'string' ? d.payload.image : '';
      if (!img.startsWith('data:image/')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bannière : image (data-URL) requise' });
      } else if (img.length > MAX_BANNER_DATAURL_LEN) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bannière trop lourde (max ~700 Ko)' });
      }
    }
    if (d.category === 'badge') {
      const code = d.payload && typeof d.payload.code === 'string' ? d.payload.code : '';
      const label = d.payload && typeof d.payload.label === 'string' ? d.payload.label : '';
      if (!code || !label) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'badge : code et label requis' });
      }
    }
  });
// `.partial()` n'existe pas sur un ZodEffects → on repart de l'objet de base.
const ShopItemUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullish(),
  category: z.enum(['title', 'banner', 'badge', 'cosmetic']).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'couleur invalide (format #rrggbb)')
    .nullish(),
  price: z.number().int().min(0).optional(),
  payload: z.record(z.any()).nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ── Permissions des modérateurs ──────────────────────────────────────────────
// Seuls les ADMIN/SUPERADMIN peuvent attribuer des permissions à un modérateur.
// Le corps doit être un objet partiel { canBan: true, canDeleteMatches: false, … }.
// Les clés non reconnues sont ignorées (liste blanche stricte → pas d'injection).
app.patch('/admin/users/:login/moderator-permissions', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const targetLogin = c.req.param('login');
  if (SUPERADMINS.has(targetLogin.toLowerCase())) {
    throw new HTTPException(400, { message: 'cannot modify a hardcoded superadmin' });
  }
  const target = await prisma.user.findUnique({
    where: { login: targetLogin },
    select: { login: true, role: true },
  });
  if (!target) throw new HTTPException(404, { message: 'user not found' });
  if (target.role !== 'MODERATOR') {
    throw new HTTPException(400, { message: 'user is not a MODERATOR — change their role first' });
  }
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HTTPException(400, { message: 'invalid body' });
  }
  const permissions: Partial<Record<ModeratorPermission, boolean>> = {};
  for (const perm of MODERATOR_PERMISSIONS) {
    if (typeof (body as Record<string, unknown>)[perm] === 'boolean') {
      permissions[perm] = (body as Record<string, boolean>)[perm];
    }
  }
  const updated = await prisma.user.update({
    where: { login: targetLogin },
    data: { moderatorPermissions: permissions },
  });
  await logAdminAction(c, {
    actor: me,
    actorRole: await getUserRole(me),
    action: 'SET_MODERATOR_PERMISSIONS',
    target: targetLogin,
    payload: { permissions },
  });
  return c.json({ login: updated.login, moderatorPermissions: updated.moderatorPermissions });
});

// GET /admin/shop/items — catalogue complet (objets inactifs inclus).
app.get('/admin/shop/items', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const items = await prisma.shopItem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return c.json(items.map(serializeShopItem));
});

// POST /admin/shop/items — crée un objet de boutique.
app.post('/admin/shop/items', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const body = await c.req.json().catch(() => null);
  const parsed = ShopItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const d = parsed.data;
  const item = await prisma.shopItem.create({
    data: {
      name: d.name,
      description: d.description ?? null,
      category: d.category,
      color: d.color ?? null,
      price: d.price,
      payload: (d.payload ?? PrismaRuntime.DbNull) as Prisma.InputJsonValue | typeof PrismaRuntime.DbNull,
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
    },
  });
  return c.json(serializeShopItem(item));
});

// PATCH /admin/shop/items/:id — met à jour partiellement un objet.
app.patch('/admin/shop/items/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = ShopItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const d = parsed.data;
  const data: Prisma.ShopItemUpdateInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.description !== undefined) data.description = d.description ?? null;
  if (d.category !== undefined) data.category = d.category;
  if (d.color !== undefined) data.color = d.color ?? null;
  if (d.price !== undefined) data.price = d.price;
  if (d.payload !== undefined) {
    data.payload = (d.payload ?? PrismaRuntime.DbNull) as Prisma.InputJsonValue | typeof PrismaRuntime.DbNull;
  }
  if (d.active !== undefined) data.active = d.active;
  if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;
  const item = await prisma.shopItem.update({ where: { id }, data });
  return c.json(serializeShopItem(item));
});

// DELETE /admin/shop/items/:id — supprime un objet (cascade sur l'inventaire).
app.delete('/admin/shop/items/:id', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const id = c.req.param('id');
  await prisma.shopItem.delete({ where: { id } });
  return c.json({ ok: true });
});

// POST /admin/shop/grant — crédite (ou débite) des League Coins à un joueur.
// `amount` peut être négatif ; le solde résultant est borné à >= 0.
const ShopGrantSchema = z.object({
  login: z.string().trim().min(1),
  amount: z.number().int(),
});
app.post('/admin/shop/grant', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const body = await c.req.json().catch(() => null);
  const parsed = ShopGrantSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { login, amount } = parsed.data;
  const target = await prisma.user.findUnique({
    where: { login },
    select: { leagueCoins: true },
  });
  if (!target) throw new HTTPException(404, { message: 'utilisateur introuvable' });
  const next = Math.max(0, target.leagueCoins + amount);
  await prisma.user.update({ where: { login }, data: { leagueCoins: next } });
  emit([login], { type: 'panel:update', payload: {} });
  return c.json({ ok: true, login, coins: next });
});

// POST /admin/shop/grant-item — donne un cosmétique (titre/badge/bannière/cosmétique)
// à un joueur (insertion dans son inventaire), avec auto-équipement optionnel.
const ShopGrantItemSchema = z.object({
  login: z.string().trim().min(1),
  itemId: z.string().min(1),
  equip: z.boolean().optional(),
});
app.post('/admin/shop/grant-item', async (c) => {
  const me = await getCurrentLogin(c);
  await requireAdmin(me);
  const body = await c.req.json().catch(() => null);
  const parsed = ShopGrantItemSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.message });
  }
  const { login, itemId, equip } = parsed.data;
  const [target, item] = await Promise.all([
    prisma.user.findUnique({ where: { login }, select: { login: true } }),
    prisma.shopItem.findUnique({ where: { id: itemId } }),
  ]);
  if (!target) throw new HTTPException(404, { message: 'utilisateur introuvable' });
  if (!item) throw new HTTPException(404, { message: 'objet introuvable' });

  // Titre éventuel à refléter sur user.title si on auto-équipe.
  const titleStr =
    item.category === 'title' && item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
      ? typeof (item.payload as Record<string, unknown>).title === 'string'
        ? ((item.payload as Record<string, unknown>).title as string)
        : null
      : null;

  await prisma.$transaction(async (tx) => {
    // Insère dans l'inventaire (sans doublon).
    await tx.shopInventory.upsert({
      where: { userLogin_itemId: { userLogin: login, itemId } },
      update: {},
      create: { userLogin: login, itemId },
    });
    if (equip) {
      // Un seul équipé par catégorie : on déséquipe les autres de la même catégorie.
      await tx.shopInventory.updateMany({
        where: { userLogin: login, equipped: true, item: { category: item.category } },
        data: { equipped: false },
      });
      await tx.shopInventory.update({
        where: { userLogin_itemId: { userLogin: login, itemId } },
        data: { equipped: true },
      });
      if (item.category === 'title' && titleStr) {
        await tx.user.update({ where: { login }, data: { title: titleStr } });
      }
    }
  });

  emit([login], { type: 'panel:update', payload: {} });
  return c.json({ ok: true, login, itemId, equipped: !!equip });
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
    select: { id: true, declarerLogin: true, opponentLogin: true, partner1Login: true, partner2Login: true },
  });
  if (stale.length === 0) return;
  await prisma.pendingMatch.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
  for (const m of stale) {
    // 2v2 : prévenir aussi les coéquipiers.
    const recipients = [m.declarerLogin, m.opponentLogin, m.partner1Login, m.partner2Login].filter(
      Boolean,
    ) as string[];
    emit(recipients, {
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
    // Seed de données de test — staging uniquement, jamais en prod.
    if (process.env.APP_ENV === 'staging') {
      seedStaging().catch((err) => {
        console.error('failed to seed staging test data', err);
      });
    }
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
