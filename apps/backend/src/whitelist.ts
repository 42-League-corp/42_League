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

// Open beta : whitelist désactivée → tout login 42 valide peut se connecter.
// (typé `boolean` explicitement pour garder la logique d'appartenance compilable
// quand le flag vaut true — pas de narrowing en littéral.)
export const WHITELIST_DISABLED: boolean = true;

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
  'jagharra',
];

const normalized = new Set(WHITELIST.map((l) => l.toLowerCase()));

export function isWhitelisted(login: string): boolean {
  if (WHITELIST_DISABLED) return true;
  return normalized.has(login.toLowerCase());
}
