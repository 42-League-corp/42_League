// ─────────────────────────────────────────────────────────────
// 42 League — admins
//
// Logins autorisés à créer/valider les tournois OFFICIELS.
// Édite la liste à la main, le backend rechargera automatiquement.
// ─────────────────────────────────────────────────────────────

export const ADMINS: string[] = [
  'throbert',
];

const normalized = new Set(ADMINS.map((l) => l.toLowerCase()));

export function isAdmin(login: string): boolean {
  return normalized.has(login.toLowerCase());
}
