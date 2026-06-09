/* ─────────────────────────────────────────────────────────────────────────
 * RÉACTIONS JOUEUR — memes contextuels déclenchés par la perf du joueur.
 *
 * Registry data-driven : une réaction = un prédicat sur les stats + un meme +
 * des clés i18n. Pour en ajouter une (ex. « gagne trop », « farm un pote »),
 * il suffit de pousser un objet dans PLAYER_REACTIONS — aucun composant à
 * toucher. La sélection prend la réaction active de plus haute priorité.
 *
 * Lien avec le GOD panel : les seuils « suspects » (don d'ELO, défaites en
 * série) sont centralisés dans REACTION_THRESHOLDS et alignés sur les
 * heuristiques du flag `victim_pattern` côté serveur (GET /admin/suspicious).
 * Une seule source de vérité pour « ce joueur perd anormalement ».
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Signaux de perf consommés par les prédicats. Sous-ensemble structurel de
 * `ProfilStats` (cf. useProfilLogic) — on n'importe pas la page pour garder ce
 * module sans dépendance UI et réutilisable partout (profil, fiche joueur…).
 */
export interface ReactionSignals {
  /** Série en cours signée : négatif = défaites consécutives, positif = victoires. */
  currentStreak: number;
  /** Win-rate global, 0–100. */
  winRate: number;
  /** Nombre total de matchs décisifs (V + D). */
  total: number;
}

export type ReactionTone = 'taunt' | 'praise';

export interface PlayerReaction {
  id: string;
  /** Ton du message : moquerie (perd) ou éloge (gagne). Sert au style. */
  tone: ReactionTone;
  /** Meme servi depuis /public. */
  image: string;
  /** Clés i18n (titre, message, et suffixe du compteur). */
  titleKey: string;
  messageKey: string;
  countSuffixKey: string;
  /** Priorité : la plus haute l'emporte si plusieurs réactions matchent. */
  priority: number;
  /** Déclenchement. */
  test: (s: ReactionSignals) => boolean;
  /** Compteur mis en avant (ex. longueur de la série). */
  count: (s: ReactionSignals) => number;
  /**
   * Signature de gravité : tant qu'elle ne change pas, une réaction déjà
   * fermée ne réapparaît pas. Quand elle change (série qui s'allonge), le meme
   * resurgit. Permet de re-narguer à chaque nouvelle défaite sans spammer.
   */
  signature: (s: ReactionSignals) => string;
}

/**
 * Seuils des heuristiques « suspectes ». Calés sur le flag `victim_pattern` du
 * GOD panel (don d'ELO volontaire). Modifier ici se répercute partout.
 */
export const REACTION_THRESHOLDS = {
  /** Défaites consécutives à partir desquelles on soupçonne un don d'ELO. */
  suspiciousLossStreak: 5,
  /** Victoires consécutives à partir desquelles on chambre le sweat. */
  hotWinStreak: 5,
} as const;

/**
 * Registry des réactions, par priorité décroissante implicite (la sélection
 * tranche via `priority`). Ajouter une réaction « gagne trop » = un objet ici.
 */
export const PLAYER_REACTIONS: PlayerReaction[] = [
  {
    id: 'suspicious-loss-streak',
    tone: 'taunt',
    image: '/memes/peluche-suspicious.gif',
    titleKey: 'reaction.suspiciousLoss.title',
    messageKey: 'reaction.suspiciousLoss.message',
    countSuffixKey: 'reaction.suspiciousLoss.countSuffix',
    priority: 100,
    test: (s) => s.currentStreak <= -REACTION_THRESHOLDS.suspiciousLossStreak,
    count: (s) => Math.abs(s.currentStreak),
    signature: (s) => `loss:${Math.abs(s.currentStreak)}`,
  },
  {
    id: 'hot-win-streak',
    tone: 'praise',
    image: '/memes/shocked.webp',
    titleKey: 'reaction.hotWin.title',
    messageKey: 'reaction.hotWin.message',
    countSuffixKey: 'reaction.hotWin.countSuffix',
    priority: 90,
    test: (s) => s.currentStreak >= REACTION_THRESHOLDS.hotWinStreak,
    count: (s) => s.currentStreak,
    signature: (s) => `win:${s.currentStreak}`,
  },
];

/** Réaction active de plus haute priorité, ou null si aucune ne matche. */
export function pickReaction(signals: ReactionSignals): PlayerReaction | null {
  let best: PlayerReaction | null = null;
  for (const r of PLAYER_REACTIONS) {
    if (r.test(signals) && (!best || r.priority > best.priority)) best = r;
  }
  return best;
}
