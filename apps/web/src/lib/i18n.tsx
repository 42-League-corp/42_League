import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStoredLang, setStoredLang } from './storage';

export type Lang = 'fr' | 'en' | 'es';

type Dict = Record<string, string>;

const fr: Dict = {
  // Topbar / nav
  'app.console': '42 League',
  'nav.defis': 'Défis',
  'nav.tournois': 'Tournois',
  'nav.leaderboard': 'Classement',
  'nav.trophees': 'Trophées',
  'nav.profil': 'Profil',
  'nav.historique': 'Historique',
  'nav.reglages': 'Réglages',
  'nav.god': 'GOD',
  'auth.notConnected': 'non connecté',

  'panel.defis.title': 'Défis',
  'panel.defis.sub': 'Lance un duel — sois honoré.',
  'defis.received': 'Défis reçus',
  'defis.scheduled': 'Matchs planifiés',
  'defis.sent': 'Défis envoyés',
  'defis.challenge': 'Défier un joueur de la league',
  'defis.empty': 'Aucun autre joueur inscrit pour le moment.',
  'defis.from': 'Défi de',
  'defis.to': 'Défi à',
  'defis.vs': 'Match vs',
  'defis.accept': 'Accepter',
  'defis.decline': 'Refuser',
  'defis.cancel': 'Annuler',
  'defis.enterScore': 'Saisir score',
  'defis.send': 'Envoyer',
  'defis.youScore': 'Ton score',
  'defis.oppScorePrefix': 'Score',
  'defis.btn': 'Défier',

  'panel.lb.title': 'Classement',
  'panel.lb.sub': 'joueurs · saison en cours',
  'lb.empty': "Personne n'a encore joué.",
  'lb.col.player': 'Joueur',
  'lb.col.elo': 'ELO',
  'lb.col.w': 'W',
  'lb.col.l': 'L',
  'lb.col.rank': 'Rang',
  'lb.col.games': 'Games',
  'lb.col.winrate': 'Win %',
  'lb.col.streak': 'Série',
  'lb.col.titles': 'Titres',
  'lb.podium.champion': 'Champion',
  'lb.abbr.win': 'V',
  'lb.abbr.loss': 'D',
  'lb.win.full': 'Victoires',
  'lb.win.full1': 'Victoire',
  'lb.loss.full': 'Défaites',
  'lb.loss.full1': 'Défaite',
  'lb.streak.wins': "victoires d'affilée",
  'lb.streak.losses': "défaites d'affilée",
  'idea.title': 'Boîte à idées',
  'idea.subtitle': 'Une feature en tête ? Propose-la, on lit tout.',
  'idea.placeholder': 'Ex : un mode tournoi en double, des badges de saison…',
  'idea.send': 'Envoyer',
  'idea.sending': 'Envoi…',
  'idea.sent': 'Idée envoyée — merci ! 🙌',
  'idea.thanks': 'Merci !',
  'idea.tooShort': 'Au moins 10 caractères',

  'panel.profil.title': 'Profil',
  'panel.profil.sub': 'Tes stats actuelles',
  'profil.campus': 'Campus',
  'profil.elo': 'ELO',
  'profil.matchesElo': 'Matchs ELO',
  'profil.winRate': 'Win rate',
  'profil.delta': 'Δ ELO',
  'profil.wins': 'Victoires',
  'profil.losses': 'Défaites',
  'profil.rank': 'Rang',
  'profil.dodges': 'Fuites',
  'profil.registeredSince': 'Inscrit depuis',
  'profil.recent': 'Derniers matchs',
  'profil.eloEvolution': 'Évolution ELO',
  'profil.notEnoughMatches': 'Pas encore assez de matches',
  'profil.notRegistered': "n'est pas inscrit dans la league.",
  'profil.subtitle': 'Profil 42 League',

  'panel.history.title': 'Historique',
  'panel.history.sub': '50 derniers matchs',
  'history.tab.global': 'Le babyfoot',
  'history.tab.mine': 'Moi',
  'history.global.sub': 'Toutes les dernières games',
  'history.mine.sub': 'Tes games',
  'history.empty': "Aucun match joué pour l'instant.",
  'history.empty.mine': "Tu n'as pas encore joué de game.",
  'history.col.date': 'Date',
  'history.col.opp': 'Adversaire',
  'history.col.score': 'Score',
  'history.col.result': 'Résultat',
  'history.col.delta': 'Δ ELO',
  'history.win': 'VICTOIRE',
  'history.loss': 'DÉFAITE',

  'panel.settings.title': 'Réglages',
  'settings.lang': 'Langue',
  'settings.lang.fr': 'Français',
  'settings.lang.en': 'English',
  'settings.lang.es': 'Español',
  'settings.account': 'Compte',
  'settings.changeAccount': 'Changer de compte',
  'settings.logout': 'Se déconnecter',
  'settings.loggedOut': 'Déconnecté.',
  'settings.connecting': 'Connexion…',

  'anon.title': 'Connexion requise',
  'anon.text':
    'Connecte-toi avec ton compte 42 pour défier tes camarades, suivre ton ELO et grimper au classement.',
  'anon.cta': 'Se connecter avec 42',
  'anon.welcome': 'Bienvenue',

  'common.loading': 'Initialisation…',
  'common.in': 'dans',
  'common.ago': 'il y a',
  'common.toi': 'toi',

  'nav.about': 'À propos',
  'nav.about.short': 'Règles',

  'panel.about.title': 'À propos',
  'about.rules.title': 'Règles du jeu',
  'about.privacy.title': 'Confidentialité',
  'about.tech.title': 'Technique',

  'settings.gdpr.title': 'Données personnelles',
  'settings.gdpr.export': 'Exporter mes données',
  'settings.gdpr.delete': 'Supprimer mon compte',
  'settings.gdpr.delete.confirm': 'Confirmer la suppression',
  'settings.gdpr.delete.warning': 'Action irréversible. Ton profil, login et données identifiables seront anonymisés.',
  'settings.gdpr.cancel': 'Annuler',
  'settings.gdpr.about': 'Politique de confidentialité',
  'settings.gdpr.exporting': 'Export en cours…',
  'settings.gdpr.deleting': 'Suppression en cours…',
  'settings.gdpr.deleted': 'Compte anonymisé. À bientôt.',

  'login.privacy': 'En te connectant, tu acceptes notre',
  'login.privacyLink': 'politique de confidentialité',

  'login.how.title': 'Comment ça marche ?',
  'login.how.reassure': 'Nous ne conservons aucune information personnelle sur toi.',
  'login.how.steps':
    'La connexion utilise OAuth, le standard sécurisé de 42. Tu t’identifies directement sur l’intranet de 42, qui nous confirme simplement ton identité. Ton mot de passe ne passe jamais par nous, et nous ne stockons aucune donnée privée — uniquement ton pseudo et ton avatar publics, le temps de ta session.',
  'login.how.link42': 'La doc OAuth officielle de 42',
  'login.how.linkOauth': 'Comprendre le principe d’OAuth',
  'login.how.linkPrivacy': 'Notre politique de confidentialité',
};

const en: Dict = {
  'app.console': '42 League',
  'nav.defis': 'Challenges',
  'nav.tournois': 'Tournaments',
  'nav.leaderboard': 'Leaderboard',
  'nav.trophees': 'Hall of Fame',
  'nav.profil': 'Profile',
  'nav.historique': 'History',
  'nav.reglages': 'Settings',
  'nav.god': 'GOD',
  'auth.notConnected': 'not signed in',

  'panel.defis.title': 'Challenges',
  'panel.defis.sub': 'Throw down — earn glory.',
  'defis.received': 'Incoming challenges',
  'defis.scheduled': 'Scheduled matches',
  'defis.sent': 'Sent challenges',
  'defis.challenge': 'Challenge a player from the league',
  'defis.empty': 'No other player registered yet.',
  'defis.from': 'Challenge from',
  'defis.to': 'Challenge to',
  'defis.vs': 'Match vs',
  'defis.accept': 'Accept',
  'defis.decline': 'Decline',
  'defis.cancel': 'Cancel',
  'defis.enterScore': 'Enter score',
  'defis.send': 'Send',
  'defis.youScore': 'Your score',
  'defis.oppScorePrefix': 'Score for',
  'defis.btn': 'Challenge',

  'panel.lb.title': 'Leaderboard',
  'panel.lb.sub': 'players · current season',
  'lb.empty': 'No one has played yet.',
  'lb.col.player': 'Player',
  'lb.col.elo': 'ELO',
  'lb.col.w': 'W',
  'lb.col.l': 'L',
  'lb.col.rank': 'Rank',
  'lb.col.games': 'Games',
  'lb.col.winrate': 'Win %',
  'lb.col.streak': 'Streak',
  'lb.col.titles': 'Titles',
  'lb.podium.champion': 'Champion',
  'lb.abbr.win': 'W',
  'lb.abbr.loss': 'L',
  'lb.win.full': 'Wins',
  'lb.win.full1': 'Win',
  'lb.loss.full': 'Losses',
  'lb.loss.full1': 'Loss',
  'lb.streak.wins': 'wins in a row',
  'lb.streak.losses': 'losses in a row',
  'idea.title': 'Idea box',
  'idea.subtitle': 'Got a feature in mind? Drop it — we read everything.',
  'idea.placeholder': 'E.g. a doubles tournament mode, seasonal badges…',
  'idea.send': 'Send',
  'idea.sending': 'Sending…',
  'idea.sent': 'Idea sent — thanks! 🙌',
  'idea.thanks': 'Thanks!',
  'idea.tooShort': 'At least 10 characters',

  'panel.profil.title': 'Profile',
  'panel.profil.sub': 'Your current stats',
  'profil.campus': 'Campus',
  'profil.elo': 'ELO',
  'profil.matchesElo': 'ELO Matches',
  'profil.winRate': 'Win rate',
  'profil.delta': 'Δ ELO',
  'profil.wins': 'Wins',
  'profil.losses': 'Losses',
  'profil.rank': 'Rank',
  'profil.dodges': 'Dodges',
  'profil.registeredSince': 'Member since',
  'profil.recent': 'Recent matches',
  'profil.eloEvolution': 'ELO progression',
  'profil.notEnoughMatches': 'Not enough matches yet',
  'profil.notRegistered': 'is not registered in the league.',
  'profil.subtitle': '42 League profile',

  'panel.history.title': 'History',
  'panel.history.sub': 'Last 50 matches',
  'history.tab.global': 'The table',
  'history.tab.mine': 'You',
  'history.global.sub': 'All recent games',
  'history.mine.sub': 'Your games',
  'history.empty': 'No match played yet.',
  'history.empty.mine': "You haven't played any game yet.",
  'history.col.date': 'Date',
  'history.col.opp': 'Opponent',
  'history.col.score': 'Score',
  'history.col.result': 'Result',
  'history.col.delta': 'Δ ELO',
  'history.win': 'WIN',
  'history.loss': 'LOSS',

  'panel.settings.title': 'Settings',
  'settings.lang': 'Language',
  'settings.lang.fr': 'Français',
  'settings.lang.en': 'English',
  'settings.lang.es': 'Español',
  'settings.account': 'Account',
  'settings.changeAccount': 'Change account',
  'settings.logout': 'Sign out',
  'settings.loggedOut': 'Signed out.',
  'settings.connecting': 'Signing in…',

  'anon.title': 'Sign in required',
  'anon.text':
    'Sign in with your 42 account to challenge your peers, track your ELO and climb the ladder.',
  'anon.cta': 'Sign in with 42',
  'anon.welcome': 'Welcome',

  'common.loading': 'Loading…',
  'common.in': 'in',
  'common.ago': '',
  'common.toi': 'you',

  'nav.about': 'About',
  'nav.about.short': 'Rules',

  'panel.about.title': 'About',
  'about.rules.title': 'Game rules',
  'about.privacy.title': 'Privacy',
  'about.tech.title': 'Tech',

  'settings.gdpr.title': 'Personal data',
  'settings.gdpr.export': 'Export my data',
  'settings.gdpr.delete': 'Delete my account',
  'settings.gdpr.delete.confirm': 'Confirm deletion',
  'settings.gdpr.delete.warning': 'Irreversible. Your profile, login and personal data will be anonymized.',
  'settings.gdpr.cancel': 'Cancel',
  'settings.gdpr.about': 'Privacy policy',
  'settings.gdpr.exporting': 'Exporting…',
  'settings.gdpr.deleting': 'Deleting…',
  'settings.gdpr.deleted': 'Account anonymized. See you.',

  'login.privacy': 'By signing in, you accept our',
  'login.privacyLink': 'privacy policy',

  'login.how.title': 'How does it work?',
  'login.how.reassure': 'We don’t keep any personal information about you.',
  'login.how.steps':
    'Sign-in uses OAuth, 42’s secure standard. You authenticate directly on 42’s intranet, which simply confirms your identity to us. Your password never goes through us, and we don’t store any private data — only your public nickname and avatar, for the duration of your session.',
  'login.how.link42': '42’s official OAuth documentation',
  'login.how.linkOauth': 'Understand how OAuth works',
  'login.how.linkPrivacy': 'Our privacy policy',
};

const es: Dict = {
  'app.console': '42 League',
  'nav.defis': 'Desafíos',
  'nav.tournois': 'Torneos',
  'nav.leaderboard': 'Clasificación',
  'nav.trophees': 'Salón de la fama',
  'nav.profil': 'Perfil',
  'nav.historique': 'Historial',
  'nav.reglages': 'Ajustes',
  'nav.god': 'GOD',
  'auth.notConnected': 'no conectado',

  'panel.defis.title': 'Desafíos',
  'panel.defis.sub': 'Lanza un duelo — gánate la gloria.',
  'defis.received': 'Desafíos recibidos',
  'defis.scheduled': 'Partidos programados',
  'defis.sent': 'Desafíos enviados',
  'defis.challenge': 'Desafía a un jugador de la liga',
  'defis.empty': 'Aún no hay otros jugadores inscritos.',
  'defis.from': 'Desafío de',
  'defis.to': 'Desafío a',
  'defis.vs': 'Partido vs',
  'defis.accept': 'Aceptar',
  'defis.decline': 'Rechazar',
  'defis.cancel': 'Cancelar',
  'defis.enterScore': 'Introducir marcador',
  'defis.send': 'Enviar',
  'defis.youScore': 'Tu marcador',
  'defis.oppScorePrefix': 'Marcador de',
  'defis.btn': 'Desafiar',

  'panel.lb.title': 'Clasificación',
  'panel.lb.sub': 'jugadores · temporada actual',
  'lb.empty': 'Nadie ha jugado todavía.',
  'lb.col.player': 'Jugador',
  'lb.col.elo': 'ELO',
  'lb.col.w': 'V',
  'lb.col.l': 'D',
  'lb.col.rank': 'Rango',
  'lb.col.games': 'Partidas',
  'lb.col.winrate': 'Vict. %',
  'lb.col.streak': 'Racha',
  'lb.col.titles': 'Títulos',
  'lb.podium.champion': 'Campeón',
  'lb.abbr.win': 'V',
  'lb.abbr.loss': 'D',
  'lb.win.full': 'Victorias',
  'lb.win.full1': 'Victoria',
  'lb.loss.full': 'Derrotas',
  'lb.loss.full1': 'Derrota',
  'lb.streak.wins': 'victorias seguidas',
  'lb.streak.losses': 'derrotas seguidas',
  'idea.title': 'Buzón de ideas',
  'idea.subtitle': '¿Tienes una idea? Cuéntanosla — lo leemos todo.',
  'idea.placeholder': 'Ej.: un modo torneo por parejas, insignias de temporada…',
  'idea.send': 'Enviar',
  'idea.sending': 'Enviando…',
  'idea.sent': '¡Idea enviada — gracias! 🙌',
  'idea.thanks': '¡Gracias!',
  'idea.tooShort': 'Al menos 10 caracteres',

  'panel.profil.title': 'Perfil',
  'panel.profil.sub': 'Tus estadísticas actuales',
  'profil.campus': 'Campus',
  'profil.elo': 'ELO',
  'profil.matchesElo': 'Partidas ELO',
  'profil.winRate': '% Victorias',
  'profil.delta': 'Δ ELO',
  'profil.wins': 'Victorias',
  'profil.losses': 'Derrotas',
  'profil.rank': 'Rango',
  'profil.dodges': 'Fugas',
  'profil.registeredSince': 'Miembro desde',
  'profil.recent': 'Últimas partidas',
  'profil.eloEvolution': 'Evolución ELO',
  'profil.notEnoughMatches': 'Aún no hay suficientes partidas',
  'profil.notRegistered': 'no está inscrito en la liga.',
  'profil.subtitle': 'Perfil 42 League',

  'panel.history.title': 'Historial',
  'panel.history.sub': 'Últimos 50 partidos',
  'history.tab.global': 'La mesa',
  'history.tab.mine': 'Tú',
  'history.global.sub': 'Todas las partidas recientes',
  'history.mine.sub': 'Tus partidas',
  'history.empty': 'Aún no se ha jugado ningún partido.',
  'history.empty.mine': 'Todavía no has jugado ninguna partida.',
  'history.col.date': 'Fecha',
  'history.col.opp': 'Rival',
  'history.col.score': 'Marcador',
  'history.col.result': 'Resultado',
  'history.col.delta': 'Δ ELO',
  'history.win': 'VICTORIA',
  'history.loss': 'DERROTA',

  'panel.settings.title': 'Ajustes',
  'settings.lang': 'Idioma',
  'settings.lang.fr': 'Français',
  'settings.lang.en': 'English',
  'settings.lang.es': 'Español',
  'settings.account': 'Cuenta',
  'settings.changeAccount': 'Cambiar de cuenta',
  'settings.logout': 'Cerrar sesión',
  'settings.loggedOut': 'Sesión cerrada.',
  'settings.connecting': 'Conectando…',

  'anon.title': 'Inicio de sesión requerido',
  'anon.text':
    'Inicia sesión con tu cuenta 42 para desafiar a tus compañeros, seguir tu ELO y escalar en la clasificación.',
  'anon.cta': 'Iniciar sesión con 42',
  'anon.welcome': 'Bienvenido',

  'common.loading': 'Cargando…',
  'common.in': 'en',
  'common.ago': 'hace',
  'common.toi': 'tú',

  'nav.about': 'Acerca de',
  'nav.about.short': 'Reglas',

  'panel.about.title': 'Acerca de',
  'about.rules.title': 'Reglas del juego',
  'about.privacy.title': 'Privacidad',
  'about.tech.title': 'Técnica',

  'settings.gdpr.title': 'Datos personales',
  'settings.gdpr.export': 'Exportar mis datos',
  'settings.gdpr.delete': 'Eliminar mi cuenta',
  'settings.gdpr.delete.confirm': 'Confirmar eliminación',
  'settings.gdpr.delete.warning': 'Acción irreversible. Tu perfil, login y datos identificables serán anonimizados.',
  'settings.gdpr.cancel': 'Cancelar',
  'settings.gdpr.about': 'Política de privacidad',
  'settings.gdpr.exporting': 'Exportando…',
  'settings.gdpr.deleting': 'Eliminando…',
  'settings.gdpr.deleted': 'Cuenta anonimizada. Hasta pronto.',

  'login.privacy': 'Al iniciar sesión, aceptas nuestra',
  'login.privacyLink': 'política de privacidad',

  'login.how.title': '¿Cómo funciona?',
  'login.how.reassure': 'No guardamos ninguna información personal sobre ti.',
  'login.how.steps':
    'El inicio de sesión usa OAuth, el estándar seguro de 42. Te identificas directamente en la intranet de 42, que simplemente nos confirma tu identidad. Tu contraseña nunca pasa por nosotros y no almacenamos ningún dato privado — solo tu apodo y tu avatar públicos, durante tu sesión.',
  'login.how.link42': 'La documentación oficial de OAuth de 42',
  'login.how.linkOauth': 'Entender cómo funciona OAuth',
  'login.how.linkPrivacy': 'Nuestra política de privacidad',
};

const DICTS: Record<Lang, Dict> = { fr, en, es };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };

function readInitialLang(): Lang {
  const stored = getStoredLang();
  if (stored === 'fr' || stored === 'en' || stored === 'es') return stored;
  // Détection navigateur : espagnol → es, français → fr, sinon anglais par défaut.
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('fr')) return 'fr';
  }
  return 'en';
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readInitialLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setStoredLang(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      t: (key) => dict[key] ?? fr[key] ?? key,
      locale: LOCALES[lang],
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
  return ctx;
}

export function useT(): (key: string) => string {
  return useI18n().t;
}
