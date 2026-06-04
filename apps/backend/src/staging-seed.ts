import { prisma } from './db.js';

// =========================================================================
// SEED STAGING — données de test, appliquées UNIQUEMENT sur l'env staging
// =========================================================================
// Appelé au démarrage quand APP_ENV === 'staging' (cf. index.ts). Idempotent
// (upsert sur le login) : ré-exécutable à chaque déploiement sans doublon.
//
// ⚠️ Jamais exécuté en prod (gardé par APP_ENV), donc aucune donnée de test ne
//    fuite vers main/prod même quand develop y est mergé.

// Joueurs de test Street Fighter — peuplent le classement SF de staging pour
// pouvoir déclarer des matchs de test. Rôle USER (jamais superadmin).
const SF_TEST_PLAYERS: { login: string; eloSf: number; matchesPlayedSf: number }[] = [
  { login: 'sf_ryu', eloSf: 1180, matchesPlayedSf: 14 },
  { login: 'sf_ken', eloSf: 1095, matchesPlayedSf: 11 },
  { login: 'sf_chunli', eloSf: 1245, matchesPlayedSf: 19 },
  { login: 'sf_guile', eloSf: 1010, matchesPlayedSf: 8 },
  { login: 'sf_zangief', eloSf: 940, matchesPlayedSf: 9 },
  { login: 'sf_dhalsim', eloSf: 1320, matchesPlayedSf: 23 },
  { login: 'sf_blanka', eloSf: 1065, matchesPlayedSf: 12 },
  { login: 'sf_cammy', eloSf: 1205, matchesPlayedSf: 16 },
];

export async function seedStaging(): Promise<void> {
  // jagharra : invité de test sur staging → rôle ADMIN (jamais superadmin).
  // On force le rôle à chaque démarrage pour qu'il reste admin même s'il a été
  // créé en USER lors d'une connexion OAuth antérieure.
  await prisma.user.upsert({
    where: { login: 'jagharra' },
    update: { role: 'ADMIN' },
    create: {
      login: 'jagharra',
      role: 'ADMIN',
      campus: 'Le Havre',
      games: ['babyfoot', 'streetfighter'],
    },
  });

  // tester : compte générique rôle USER, cible du bouton « Tester en mode user »
  // (cf. POST /admin/impersonate-tester). Permet aux admins de vivre l'expérience
  // d'un joueur lambda. On force le rôle USER à chaque démarrage : jamais admin.
  await prisma.user.upsert({
    where: { login: 'tester' },
    update: { role: 'USER' },
    create: {
      login: 'tester',
      role: 'USER',
      campus: 'Le Havre',
      games: ['babyfoot', 'smash', 'chess', 'streetfighter'],
    },
  });

  for (const p of SF_TEST_PLAYERS) {
    await prisma.user.upsert({
      where: { login: p.login },
      update: {
        games: { set: ['streetfighter'] },
        eloSf: p.eloSf,
        matchesPlayedSf: p.matchesPlayedSf,
      },
      create: {
        login: p.login,
        role: 'USER',
        campus: 'Le Havre',
        games: ['streetfighter'],
        eloSf: p.eloSf,
        matchesPlayedSf: p.matchesPlayedSf,
      },
    });
  }

  console.log(
    `🌱 staging seed : jagharra=ADMIN + ${SF_TEST_PLAYERS.length} joueurs Street Fighter`,
  );
}
