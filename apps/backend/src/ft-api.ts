import { prisma } from './db.js';

const FT_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const FT_USERS_URL = 'https://api.intra.42.fr/v2/users';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
const inFlight = new Set<string>();

async function getAppToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const uid = process.env.FT_OAUTH_UID;
  const secret = process.env.FT_OAUTH_SECRET;
  if (!uid || !secret) return null;
  const res = await fetch(FT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: uid,
      client_secret: secret,
    }),
  });
  if (!res.ok) {
    console.warn('[ft-api] client_credentials token failed', res.status);
    return null;
  }
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return cached.token;
}

interface FtPublicUser {
  id: number;
  login: string;
  campus?: Array<{ name: string }>;
  image?: {
    link?: string | null;
    versions?: { small?: string | null; medium?: string | null } | null;
  } | null;
}

export async function fetchAndSavePublicUser(login: string): Promise<void> {
  if (inFlight.has(login)) return;
  inFlight.add(login);
  try {
    const token = await getAppToken();
    if (!token) return;
    const res = await fetch(`${FT_USERS_URL}/${encodeURIComponent(login)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[ft-api] fetch ${login} failed`, res.status);
      }
      return;
    }
    const u = (await res.json()) as FtPublicUser;
    const imageUrl =
      u.image?.versions?.medium ??
      u.image?.versions?.small ??
      u.image?.link ??
      null;
    await prisma.user.update({
      where: { login },
      data: {
        ftId: u.id,
        campus: u.campus?.[0]?.name ?? undefined,
        imageUrl: imageUrl ?? undefined,
      },
    });
  } catch (err) {
    console.warn(`[ft-api] fetch ${login} error`, err);
  } finally {
    inFlight.delete(login);
  }
}

export async function backfillMissingImages(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { imageUrl: null },
    select: { login: true },
  });
  await Promise.allSettled(users.map((u) => fetchAndSavePublicUser(u.login)));
  return users.length;
}
