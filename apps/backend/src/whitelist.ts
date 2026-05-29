// ─────────────────────────────────────────────────────────────
// 42 League — whitelist d'accès à l'extension
//
// Ajoute / retire les logins 42 ici. Seuls ces comptes peuvent
// s'authentifier via OAuth. Tout autre login se voit refusé
// après le callback OAuth avec une page d'erreur.
//
// Pour DÉSACTIVER la whitelist (mode open beta) :
//   - vider le tableau OU
//   - mettre `export const WHITELIST_DISABLED = true;` ci-dessous
// ─────────────────────────────────────────────────────────────

export const WHITELIST_DISABLED = false;

export const WHITELIST: string[] = [
  'throbert',
  'nithomas',
  'rbardet-',
  'jubrouss',
  'abidaux',
  'garside',
  'ytennah',
  'hkeromne',
  'sbonneau',
  'mosmond',
];

const normalized = new Set(WHITELIST.map((l) => l.toLowerCase()));

export function isWhitelisted(login: string): boolean {
  if (WHITELIST_DISABLED) return true;
  return normalized.has(login.toLowerCase());
}
