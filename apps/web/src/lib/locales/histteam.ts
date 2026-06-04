import type { Lang } from '../i18n';

type Dict = Record<string, string>;

/**
 * Traductions du domaine « histteam ». Fusionné dans le dictionnaire global par i18n.tsx.
 */
export const dict: Record<Lang, Dict> = {
  fr: {
    // Historique — stats perso (desktop)
    'history.stat.games': 'Games',
    'history.stat.winRate': 'Win rate',
    'history.stat.eloNet': 'ELO net',
    // Historique — divers
    'history.outOfElo': 'hors ELO',
    'history.result.win': 'Victoire',
    'history.result.draw': 'Nulle',

    // Team — page / erreurs
    'team.loadError': 'Erreur de chargement.',
    'team.notFound': 'Équipe introuvable',
    'team.notFound.sub': "Cette équipe n'existe pas ou a été supprimée.",
    'team.back': 'Retour',

    // Team — identité / panneaux
    'team.panel.title': 'Équipe 2v2',
    'team.panel.sub': 'Babyfoot',
    'team.badge.2v2': 'Babyfoot 2v2',
    'team.elo.label': 'ELO ÉQUIPE',
    'team.noName': 'Équipe sans nom — 2v2 Babyfoot',
    'team.delta.total': 'Total',

    // Team — stats
    'team.winRate': 'Win Rate',
    'team.wins': 'Victoires',
    'team.losses': 'Défaites',
    'team.matchesPlayed': 'Matches joués',
    'team.deltaTotal': 'Δ ELO total',
    'team.createdAt': 'Créée le',

    // Team — sections
    'team.trophies': "Trophées d'Équipe",
    'team.players': 'Les Joueurs',
    'team.viewProfile': 'Voir le profil →',
    'team.performance': 'Performance',
    'team.performance.sub': 'Courbe ELO · historique',
    'team.eloProgress.full': "Progression ELO de l'Équipe",
    'team.eloProgress': 'Progression ELO',
    'team.history': 'Historique des matches',
    'team.history.recent': 'Derniers matches',

    // Team — colonnes / table
    'team.col.date': 'Date',
    'team.col.opponents': 'Adversaires',
    'team.col.score': 'Score',
    'team.col.result': 'Résultat',
    'team.col.elo': 'ELO',
    'team.result.win': 'Victoire',
    'team.result.loss': 'Défaite',

    // Team — états vides
    'team.empty.desktop': "Aucun match confirmé pour l'instant.",
    'team.empty.mobile': 'Aucun match enregistré.',
  },
  en: {
    'history.stat.games': 'Games',
    'history.stat.winRate': 'Win rate',
    'history.stat.eloNet': 'Net ELO',
    'history.outOfElo': 'no ELO',
    'history.result.win': 'Win',
    'history.result.draw': 'Draw',

    'team.loadError': 'Loading error.',
    'team.notFound': 'Team not found',
    'team.notFound.sub': "This team doesn't exist or has been deleted.",
    'team.back': 'Back',

    'team.panel.title': '2v2 Team',
    'team.panel.sub': 'Foosball',
    'team.badge.2v2': 'Foosball 2v2',
    'team.elo.label': 'TEAM ELO',
    'team.noName': 'Unnamed team — 2v2 Foosball',
    'team.delta.total': 'Total',

    'team.winRate': 'Win Rate',
    'team.wins': 'Wins',
    'team.losses': 'Losses',
    'team.matchesPlayed': 'Matches played',
    'team.deltaTotal': 'Total Δ ELO',
    'team.createdAt': 'Created on',

    'team.trophies': 'Team Trophies',
    'team.players': 'The Players',
    'team.viewProfile': 'View profile →',
    'team.performance': 'Performance',
    'team.performance.sub': 'ELO curve · history',
    'team.eloProgress.full': 'Team ELO Progression',
    'team.eloProgress': 'ELO Progression',
    'team.history': 'Match history',
    'team.history.recent': 'Recent matches',

    'team.col.date': 'Date',
    'team.col.opponents': 'Opponents',
    'team.col.score': 'Score',
    'team.col.result': 'Result',
    'team.col.elo': 'ELO',
    'team.result.win': 'Win',
    'team.result.loss': 'Loss',

    'team.empty.desktop': 'No confirmed match yet.',
    'team.empty.mobile': 'No match recorded.',
  },
  es: {
    'history.stat.games': 'Partidas',
    'history.stat.winRate': '% Victorias',
    'history.stat.eloNet': 'ELO neto',
    'history.outOfElo': 'sin ELO',
    'history.result.win': 'Victoria',
    'history.result.draw': 'Tablas',

    'team.loadError': 'Error de carga.',
    'team.notFound': 'Equipo no encontrado',
    'team.notFound.sub': 'Este equipo no existe o ha sido eliminado.',
    'team.back': 'Volver',

    'team.panel.title': 'Equipo 2v2',
    'team.panel.sub': 'Futbolín',
    'team.badge.2v2': 'Futbolín 2v2',
    'team.elo.label': 'ELO EQUIPO',
    'team.noName': 'Equipo sin nombre — 2v2 Futbolín',
    'team.delta.total': 'Total',

    'team.winRate': '% Victorias',
    'team.wins': 'Victorias',
    'team.losses': 'Derrotas',
    'team.matchesPlayed': 'Partidos jugados',
    'team.deltaTotal': 'Δ ELO total',
    'team.createdAt': 'Creado el',

    'team.trophies': 'Trofeos de Equipo',
    'team.players': 'Los Jugadores',
    'team.viewProfile': 'Ver perfil →',
    'team.performance': 'Rendimiento',
    'team.performance.sub': 'Curva ELO · historial',
    'team.eloProgress.full': 'Progresión ELO del Equipo',
    'team.eloProgress': 'Progresión ELO',
    'team.history': 'Historial de partidos',
    'team.history.recent': 'Últimos partidos',

    'team.col.date': 'Fecha',
    'team.col.opponents': 'Rivales',
    'team.col.score': 'Marcador',
    'team.col.result': 'Resultado',
    'team.col.elo': 'ELO',
    'team.result.win': 'Victoria',
    'team.result.loss': 'Derrota',

    'team.empty.desktop': 'Aún no hay ningún partido confirmado.',
    'team.empty.mobile': 'Ningún partido registrado.',
  },
};
