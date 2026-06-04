import type { Lang } from '../i18n';

type Dict = Record<string, string>;

/**
 * Traductions du domaine « Réglages » + noms des modes de jeu.
 * Fusionné dans le dictionnaire global par i18n.tsx.
 */
export const dict: Record<Lang, Dict> = {
  fr: {
    // Noms canoniques des modes de jeu
    'game.babyfoot': 'Babyfoot',
    'game.smash': 'Smash',
    'game.chess': 'Échecs',
    'game.streetfighter': 'Street Fighter',

    // Réglages — modes de jeu
    'settings.gameModes.title': 'Modes de jeu',
    'settings.gameModes.hint': 'Tu apparais dans les classements et stats des modes activés.',
    'settings.gameModes.minOne': 'Au moins un mode doit rester actif',

    // Réglages — compte / divers
    'settings.connectedAs': 'Connecté en tant que',
    'settings.exportError': "Erreur lors de l'export.",
    'settings.deleteError': 'Erreur lors de la suppression.',

    // Sélecteur d'univers (FAB)
    'settings.universe': 'Univers',
    'settings.close': 'Fermer',
    'settings.currentUniverse': 'Univers actuel',
    'settings.changeGame': 'Changer de jeu.',
  },
  en: {
    'game.babyfoot': 'Babyfoot',
    'game.smash': 'Smash',
    'game.chess': 'Chess',
    'game.streetfighter': 'Street Fighter',

    'settings.gameModes.title': 'Game modes',
    'settings.gameModes.hint': 'You appear in the leaderboards and stats of the modes you enable.',
    'settings.gameModes.minOne': 'At least one mode must stay active',

    'settings.connectedAs': 'Signed in as',
    'settings.exportError': 'Export failed.',
    'settings.deleteError': 'Deletion failed.',

    'settings.universe': 'Universe',
    'settings.close': 'Close',
    'settings.currentUniverse': 'Current universe',
    'settings.changeGame': 'Change game.',
  },
  es: {
    'game.babyfoot': 'Babyfoot',
    'game.smash': 'Smash',
    'game.chess': 'Ajedrez',
    'game.streetfighter': 'Street Fighter',

    'settings.gameModes.title': 'Modos de juego',
    'settings.gameModes.hint': 'Apareces en las clasificaciones y estadísticas de los modos activados.',
    'settings.gameModes.minOne': 'Al menos un modo debe permanecer activo',

    'settings.connectedAs': 'Conectado como',
    'settings.exportError': 'Error al exportar.',
    'settings.deleteError': 'Error al eliminar.',

    'settings.universe': 'Universo',
    'settings.close': 'Cerrar',
    'settings.currentUniverse': 'Universo actual',
    'settings.changeGame': 'Cambiar de juego.',
  },
};
