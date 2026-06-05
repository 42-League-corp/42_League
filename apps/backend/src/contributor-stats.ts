// Stats de contributions git par membre (lignes ajoutées / supprimées / net).
//
// Reproduit l'esprit de l'alias `git lines` (~/authorlines.sh) :
//   git log --no-merges --numstat --pretty=@%ae
//   → somme des ajouts/suppressions par auteur, en ignorant les fichiers
//     binaires (numstat = "-"), net = ajouts - suppressions.
//
// Deux sources, dans cet ordre :
//   1. EN DIRECT via `git` quand le dépôt est disponible (dev) — vraiment à jour.
//   2. EN REPLI sur la variable d'env CONTRIBUTOR_STATS (JSON injecté AU BUILD)
//      car le conteneur de prod n'a ni binaire `git` ni dossier `.git`.
// Le résultat est mis en cache 60 s pour ne pas relancer `git` à chaque requête.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export interface ContributorStat {
  added: number;
  deleted: number;
  net: number;
}

// login interne → e-mails git connus (en minuscules) de la personne. Les
// identités multiples (machines / comptes) sont fusionnées sous un seul login.
const CONTRIBUTOR_EMAILS: Record<string, string[]> = {
  throbert: ['frozyxyt.76@gmail.com', 'thomas.robert76@hotmail.com'],
  abidaux: ['abidaux@student.42lehavre.fr', 'adr.bidaux@gmail.com'],
};

const EMAIL_TO_LOGIN = new Map<string, string>();
for (const [login, emails] of Object.entries(CONTRIBUTOR_EMAILS)) {
  for (const e of emails) EMAIL_TO_LOGIN.set(e.toLowerCase(), login);
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; data: Record<string, ContributorStat> } | null = null;

function emptyStats(): Record<string, ContributorStat> {
  const out: Record<string, ContributorStat> = {};
  for (const login of Object.keys(CONTRIBUTOR_EMAILS)) out[login] = { added: 0, deleted: 0, net: 0 };
  return out;
}

/** Parse la sortie `git log --numstat --pretty=@%ae` et agrège par login connu. */
function parseGitLog(stdout: string): Record<string, ContributorStat> {
  const out = emptyStats();
  let current: string | null = null;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('@')) {
      current = EMAIL_TO_LOGIN.get(line.slice(1).trim().toLowerCase()) ?? null;
      continue;
    }
    const agg = current ? out[current] : undefined;
    if (!agg) continue;
    // numstat : "<ajouts>\t<suppr>\t<chemin>" ; "-" = binaire (ignoré).
    const parts = line.split('\t');
    if (parts.length < 3 || parts[0] === '-' || parts[1] === '-') continue;
    const added = Number(parts[0]);
    const deleted = Number(parts[1]);
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) continue;
    agg.added += added;
    agg.deleted += deleted;
  }
  for (const s of Object.values(out)) s.net = s.added - s.deleted;
  return out;
}

/** Tente le calcul en direct via git. `null` si git/le dépôt est indisponible. */
async function computeFromGit(): Promise<Record<string, ContributorStat> | null> {
  try {
    const { stdout } = await execFileP(
      'git',
      ['log', '--no-merges', '--numstat', '--pretty=format:@%ae'],
      { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024, timeout: 10_000 },
    );
    return parseGitLog(stdout);
  } catch {
    return null;
  }
}

/** Repli : JSON injecté au build (CONTRIBUTOR_STATS). `null` si absent/invalide. */
function readFromEnv(): Record<string, ContributorStat> | null {
  const raw = process.env.CONTRIBUTOR_STATS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ContributorStat>>;
    const out = emptyStats();
    for (const [login, agg] of Object.entries(out)) {
      const s = parsed[login];
      if (!s) continue;
      agg.added = Number(s.added) || 0;
      agg.deleted = Number(s.deleted) || 0;
      agg.net = agg.added - agg.deleted;
    }
    return out;
  } catch {
    return null;
  }
}

/** Stats de contributions par login, mises en cache 60 s. */
export async function getContributorStats(): Promise<Record<string, ContributorStat>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;
  const data = (await computeFromGit()) ?? readFromEnv() ?? emptyStats();
  cache = { at: now, data };
  return data;
}
