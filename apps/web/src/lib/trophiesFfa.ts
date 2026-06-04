/**
 * Calcul client-side des trophées du mode Smash FFA (Free-For-All).
 *
 * Même pattern que `trophies.ts` (calcul pur, aucune mutation) : on agrège les
 * `PlayedFfa` chargés à la demande dans TrophiesSection puis on couronne un
 * vainqueur par trophée. Réutilise le type `TrophyResult` → s'affiche dans la
 * même `TrophyGrid` que les trophées individuels.
 *
 * Un « vrai » FFA = au moins 3 participants (un 2-joueurs n'est qu'un 1v1).
 */

import type { LeaderboardEntry, PlayedFfa } from './api';
import type { TrophyResult } from './trophies';

// ─── Constantes ───────────────────────────────────────────────────────────────

const FFA_MIN_PARTICIPANTS = 3; // sous ce seuil ce n'est pas un FFA
const FFA_MIN_PLAYED = 3; // FFA disputés mini (Vétéran / Intouchable)
const KING_MIN_WINS = 2; // 1res places mini pour « Le Roi de l'Arène »
const PODIUM_MIN = 3; // podiums mini pour « L'Habitué du Podium »

// ─── Agrégat par joueur ───────────────────────────────────────────────────────

interface FfaAcc {
  login: string;
  played: number;
  wins: number; // position 1
  podiums: number; // position <= 3
  sumPos: number; // somme des positions (pour la moyenne)
  bestDelta: number; // plus gros gain d'ELO sur un seul FFA
}

/**
 * Calcule les trophées FFA Smash à partir de l'historique FFA et du classement
 * Smash (pour les avatars des vainqueurs).
 */
export function computeFfaTrophies(
  ffas: PlayedFfa[],
  leaderboard: LeaderboardEntry[],
): TrophyResult[] {
  const acc = new Map<string, FfaAcc>();
  const ensure = (login: string): FfaAcc => {
    let a = acc.get(login);
    if (!a) {
      a = { login, played: 0, wins: 0, podiums: 0, sumPos: 0, bestDelta: -Infinity };
      acc.set(login, a);
    }
    return a;
  };

  for (const ffa of ffas) {
    if (!ffa.countedForElo) continue;
    if (ffa.participants.length < FFA_MIN_PARTICIPANTS) continue;
    for (const p of ffa.participants) {
      const a = ensure(p.login);
      a.played++;
      if (p.position === 1) a.wins++;
      if (p.position <= 3) a.podiums++;
      a.sumPos += p.position;
      if (p.delta > a.bestDelta) a.bestDelta = p.delta;
    }
  }

  const all = [...acc.values()];
  const imageOf = (login: string): string | null =>
    leaderboard.find((u) => u.login === login)?.imageUrl ?? null;

  /** Sélectionne le meilleur joueur selon `score` (plus haut = mieux). */
  const best = (
    eligible: (a: FfaAcc) => boolean,
    score: (a: FfaAcc) => number,
  ): { winner: FfaAcc | null; value: number } => {
    let winner: FfaAcc | null = null;
    let value = -Infinity;
    for (const a of all) {
      if (!eligible(a)) continue;
      const s = score(a);
      if (s > value) {
        value = s;
        winner = a;
      }
    }
    return { winner, value };
  };

  const build = (
    sel: { winner: FfaAcc | null; value: number },
    earned: boolean,
    opts: {
      emoji: string;
      title: string;
      subtitle: string;
      description: string;
      color: TrophyResult['color'];
      value: (w: FfaAcc) => string;
      hint: string;
    },
  ): TrophyResult => {
    const win = earned ? sel.winner : null;
    return {
      emoji: opts.emoji,
      title: opts.title,
      subtitle: opts.subtitle,
      winner: win ? { login: win.login, imageUrl: imageOf(win.login) } : null,
      value: win ? opts.value(win) : '—',
      hint: opts.hint,
      color: opts.color,
      earned: win !== null,
    };
  };

  // 1. Le Roi de l'Arène — le plus de 1res places.
  const king = best(() => true, (a) => a.wins);
  const kingT = build(king, king.winner !== null && king.value >= KING_MIN_WINS, {
    emoji: '👑',
    title: "Le Roi de l'Arène",
    subtitle: 'Le plus de FFA remportés',
    description:
      `Couronne le joueur ayant terminé 1er du plus grand nombre de FFA Smash. ` +
      `Au milieu du chaos à 3, 4 joueurs ou plus, c'est lui qui sort vainqueur le plus souvent. ` +
      `Minimum ${KING_MIN_WINS} victoires.`,
    color: 'gold',
    value: (w) => `${w.wins} victoire${w.wins > 1 ? 's' : ''}`,
    hint: `≥${KING_MIN_WINS} FFA gagnés`,
  });

  // 2. L'Habitué du Podium — le plus de top 3.
  const podium = best(() => true, (a) => a.podiums);
  const podiumT = build(podium, podium.winner !== null && podium.value >= PODIUM_MIN, {
    emoji: '🥉',
    title: "L'Habitué du Podium",
    subtitle: 'Le plus de top 3 en FFA',
    description:
      `Pour le joueur le plus régulièrement sur le podium (1re, 2e ou 3e place) en FFA Smash. ` +
      `Pas toujours le meilleur, mais quasiment jamais ridicule : la constance avant tout. ` +
      `Minimum ${PODIUM_MIN} podiums.`,
    color: 'bronze',
    value: (w) => `${w.podiums} podiums`,
    hint: `≥${PODIUM_MIN} top 3`,
  });

  // 3. Le Vétéran du Chaos — le plus de FFA disputés.
  const veteran = best(() => true, (a) => a.played);
  const veteranT = build(veteran, veteran.winner !== null && veteran.value >= FFA_MIN_PLAYED, {
    emoji: '🔁',
    title: 'Le Vétéran du Chaos',
    subtitle: 'Le plus de FFA disputés',
    description:
      `Récompense le joueur ayant participé au plus grand nombre de FFA Smash. ` +
      `Toujours partant pour plonger dans la mêlée, quel que soit le résultat. ` +
      `Minimum ${FFA_MIN_PLAYED} FFA.`,
    color: 'green',
    value: (w) => `${w.played} FFA`,
    hint: `≥${FFA_MIN_PLAYED} FFA disputés`,
  });

  // 4. L'Intouchable — meilleure position moyenne (la plus basse).
  // On maximise l'opposé de la moyenne → la plus petite moyenne gagne.
  const untouchable = best(
    (a) => a.played >= FFA_MIN_PLAYED,
    (a) => -(a.sumPos / a.played),
  );
  const untouchableT = build(untouchable, untouchable.winner !== null, {
    emoji: '🎯',
    title: "L'Intouchable",
    subtitle: 'La meilleure position moyenne',
    description:
      `Décerné au joueur (≥${FFA_MIN_PLAYED} FFA) à la meilleure place MOYENNE sur l'ensemble ` +
      `de ses FFA. Là où d'autres alternent gloire et fond du classement, lui finit toujours ` +
      `tout devant. La régularité au sommet.`,
    color: 'cyan',
    value: (w) => `${(w.sumPos / w.played).toFixed(1)} de moyenne`,
    hint: `≥${FFA_MIN_PLAYED} FFA, plus basse position moyenne`,
  });

  return [kingT, podiumT, veteranT, untouchableT];
}
