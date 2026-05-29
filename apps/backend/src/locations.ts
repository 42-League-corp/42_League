import { getAppToken } from './ft-api.js';

const FT_LOCATIONS_URL = 'https://api.intra.42.fr/v2/campus';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LocationEntry {
  user: { login: string };
  host: string;
}

interface LocationCache {
  data: Map<string, string>;
  fetchedAt: number;
}

let cache: LocationCache | null = null;

export async function getCampusLocations(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  const token = await getAppToken();
  if (!token) return cache?.data ?? new Map();

  const campusId = process.env.FT_CAMPUS_ID ?? '1';

  try {
    const res = await fetch(
      `${FT_LOCATIONS_URL}/${campusId}/locations?filter[active]=true&page[size]=100`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.warn('[locations] fetch failed', res.status);
      return cache?.data ?? new Map();
    }
    const data = (await res.json()) as LocationEntry[];
    const map = new Map<string, string>();
    for (const loc of data) {
      if (loc.user?.login && loc.host) {
        map.set(loc.user.login, loc.host);
      }
    }
    cache = { data: map, fetchedAt: Date.now() };
    return map;
  } catch (err) {
    console.warn('[locations] error', err);
    return cache?.data ?? new Map();
  }
}
