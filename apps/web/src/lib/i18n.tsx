import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStoredLang, setStoredLang } from './storage';

export type Lang = 'fr' | 'en';

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

  'panel.profil.title': 'Profil',
  'panel.profil.sub': 'Tes stats actuelles',
  'profil.campus': 'Campus',
  'profil.elo': 'ELO',
  'profil.matchesElo': 'Matchs ELO',
  'profil.winRate': 'Win rate',
  'profil.delta': 'Δ ELO',
  'profil.wins': 'Victoires',
  'profil.losses': 'Défaites',

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

  'panel.profil.title': 'Profile',
  'panel.profil.sub': 'Your current stats',
  'profil.campus': 'Campus',
  'profil.elo': 'ELO',
  'profil.matchesElo': 'ELO Matches',
  'profil.winRate': 'Win rate',
  'profil.delta': 'Δ ELO',
  'profil.wins': 'Wins',
  'profil.losses': 'Losses',

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
};

const DICTS: Record<Lang, Dict> = { fr, en };
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

function readInitialLang(): Lang {
  const stored = getStoredLang();
  if (stored === 'fr' || stored === 'en') return stored;
  if (typeof navigator !== 'undefined' && navigator.language.startsWith('en')) {
    return 'en';
  }
  return 'fr';
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
