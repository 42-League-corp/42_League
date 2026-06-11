import type { Tournament } from './api';

export interface WinnerTeam {
  /** Tournoi en doubles : le vainqueur est une paire. */
  is2v2: boolean;
  /** Libellé : nom d'équipe (2v2) ou login (1v1). */
  label: string;
  members: { login: string; imageUrl: string | null }[];
}

/**
 * Résout le VAINQUEUR d'un tournoi en équipe : en 2v2 c'est le DUO entier
 * (capitaine + coéquipier, avec le nom d'équipe si défini), en 1v1 le joueur seul.
 * Marche aussi bien depuis la liste (entries `{login, partnerLogin, teamName}`) que
 * depuis le détail (entries enrichies `user`/`partner` avec avatars). Renvoie null
 * si pas de vainqueur.
 */
export function winnerTeam(t: Tournament): WinnerTeam | null {
  const login = t.winner?.login ?? t.winnerLogin ?? null;
  if (!login) return null;
  return teamForCaptain(t, login, t.winner?.imageUrl ?? null);
}

/**
 * Résout N'IMPORTE QUEL capitaine en équipe (duo en 2v2, joueur seul en 1v1) —
 * généralisation de `winnerTeam` pour afficher le podium complet (2e/3e/4e).
 */
export function teamForCaptain(
  t: Tournament,
  login: string,
  fallbackImg: string | null = null,
): WinnerTeam {
  const is2v2 = t.mode === '2v2';
  const e = (t.entries ?? []).find((x) => x.login === login || x.partnerLogin === login);
  const capImg = e?.user?.imageUrl ?? fallbackImg;
  if (!is2v2 || !e) return { is2v2, label: login, members: [{ login, imageUrl: capImg }] };
  const members: { login: string; imageUrl: string | null }[] = [
    { login: e.login, imageUrl: capImg },
  ];
  if (e.partnerLogin) {
    members.push({ login: e.partnerLogin, imageUrl: e.partner?.imageUrl ?? null });
  }
  return { is2v2, label: e.teamName ?? members.map((m) => `@${m.login}`).join(' & '), members };
}
