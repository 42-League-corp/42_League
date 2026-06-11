import { useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../Avatar';
import { useLeagueData } from '../../hooks/useLeagueData';
import { computeStandings } from '../../lib/tournamentStandings';
import { api, type Tournament, type TournamentMatch, type TournamentEntry } from '../../lib/api';

interface TeamView {
  /** Libellé d'affichage : nom d'équipe (2v2) ou login (1v1). */
  label: string;
  members: { login: string; imageUrl: string | null }[];
}

/** Résout un login (capitaine) en son équipe (duo en 2v2, joueur seul en 1v1). */
function teamForLogin(
  login: string,
  entries: TournamentEntry[],
  imgByLogin: Map<string, string | null>,
  is2v2: boolean,
): TeamView {
  const img = (l: string) => imgByLogin.get(l) ?? null;
  if (!is2v2) return { label: login, members: [{ login, imageUrl: img(login) }] };
  const e = entries.find((x) => x.login === login || x.partnerLogin === login);
  if (!e) return { label: login, members: [{ login, imageUrl: img(login) }] };
  const members: { login: string; imageUrl: string | null }[] = [
    { login: e.login, imageUrl: e.user?.imageUrl ?? img(e.login) },
  ];
  if (e.partnerLogin) {
    members.push({ login: e.partnerLogin, imageUrl: e.partner?.imageUrl ?? img(e.partnerLogin) });
  }
  return { label: e.teamName ?? members.map((m) => `@${m.login}`).join(' & '), members };
}

interface Summary {
  is2v2: boolean;
  winner: TeamView | null;
  winnerWins: number;
  totalMatches: number;
  leagueDiff: number | null; // goal average du vainqueur en phase de ligue (si format ligue)
  final: TournamentMatch | null;
  semis: TournamentMatch[];
}

function summarize(t: Tournament, imgByLogin: Map<string, string | null>): Summary | null {
  const matches = t.matches ?? [];
  const entries = t.entries ?? [];
  const is2v2 = t.mode === '2v2';
  const bracket = matches.filter((m) => (m.stage ?? 'bracket') === 'bracket');
  const winnerLogin = t.winnerLogin ?? null;
  // Matchs réellement joués (deux scores) — toutes phases confondues.
  const totalMatches = matches.filter((m) => m.scoreA != null && m.scoreB != null).length;
  if (!winnerLogin && bracket.length === 0) return null;

  let final: TournamentMatch | null = null;
  let semis: TournamentMatch[] = [];
  if (bracket.length > 0) {
    const maxRound = Math.max(...bracket.map((m) => m.round));
    final = bracket.find((m) => m.round === maxRound) ?? null;
    semis = bracket.filter((m) => m.round === maxRound - 1).sort((a, b) => a.slot - b.slot);
  }
  const winLogin = winnerLogin ?? final?.winnerLogin ?? null;
  const winnerWins = winLogin ? bracket.filter((m) => m.winnerLogin === winLogin).length : 0;

  // Goal average de ligue (phase 'league' uniquement) pour le vainqueur.
  const leagueMatches = matches.filter((m) => m.stage === 'league');
  let leagueDiff: number | null = null;
  if (leagueMatches.length > 0 && winLogin) {
    const row = computeStandings(leagueMatches, 'league').find((s) => s.login === winLogin);
    if (row) leagueDiff = row.diff;
  }

  return {
    is2v2,
    winner: winLogin ? teamForLogin(winLogin, entries, imgByLogin, is2v2) : null,
    winnerWins,
    totalMatches,
    leagueDiff,
    final,
    semis,
  };
}

/** Mini-équipe : avatars empilés + libellé (duo en 2v2, joueur seul en 1v1). */
function TeamTag({ team, won }: { team: TeamView; won?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${won ? 'text-gold font-bold' : 'text-muted-2'}`}>
      <span className="flex -space-x-1.5 shrink-0">
        {team.members.map((m) => (
          <Avatar key={m.login} login={m.login} imageUrl={m.imageUrl} size="xs" />
        ))}
      </span>
      <span className="truncate">{team.label}</span>
    </span>
  );
}

/** Ligne de match « équipe A  score  équipe B », vainqueur surligné. */
function MatchLine({
  m,
  entries,
  imgByLogin,
  is2v2,
}: {
  m: TournamentMatch;
  entries: TournamentEntry[];
  imgByLogin: Map<string, string | null>;
  is2v2: boolean;
}) {
  const aWon = !!m.winnerLogin && m.winnerLogin === m.playerALogin;
  const bWon = !!m.winnerLogin && m.winnerLogin === m.playerBLogin;
  const a = m.playerALogin ? teamForLogin(m.playerALogin, entries, imgByLogin, is2v2) : null;
  const b = m.playerBLogin ? teamForLogin(m.playerBLogin, entries, imgByLogin, is2v2) : null;
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="flex-1 min-w-0 flex justify-end">
        {a ? <TeamTag team={a} won={aWon} /> : <span className="text-muted-2">—</span>}
      </span>
      <span className="font-mono tabular-nums text-text-strong shrink-0">
        {m.scoreA ?? '-'}–{m.scoreB ?? '-'}
      </span>
      <span className="flex-1 min-w-0">
        {b ? <TeamTag team={b} won={bWon} /> : <span className="text-muted-2">—</span>}
      </span>
    </div>
  );
}

/**
 * Enveloppe une carte de tournoi TERMINÉ : au survol (desktop), charge le détail
 * (la liste n'embarque ni matchs ni inscrits) et affiche une carte riche via un
 * PORTAL positionné (au-dessus, ou en dessous si trop haut), jamais rogné.
 * Gère le 2v2 (duos + avatars + vainqueur = l'équipe entière) et indique le mode.
 */
export function PastTournamentHover({ t, children }: { t: Tournament; children: ReactNode }) {
  const { leaderboard } = useLeagueData();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Tournament | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // La carte SUIT LA SOURIS : coin positionné près du curseur (décalé), basculé à
  // gauche/au-dessus quand on approche d'un bord de l'écran.
  const place = (e: ReactMouseEvent) => {
    const w = 330, h = 340, pad = 12, off = 18;
    let left = e.clientX + off;
    let top = e.clientY + off;
    if (left + w > window.innerWidth - pad) left = Math.max(pad, e.clientX - w - off);
    if (top + h > window.innerHeight - pad) top = Math.max(pad, e.clientY - h - off);
    setPos({ left, top });
  };
  const onEnter = (e: ReactMouseEvent) => {
    place(e);
    setOpen(true);
    if (!detail) api.tournament(t.id).then(setDetail).catch(() => {});
  };

  // Photos par login : inscrits (capitaines + coéquipiers) puis classement courant.
  const imgByLogin = new Map<string, string | null>();
  for (const u of leaderboard) imgByLogin.set(u.login, u.imageUrl);
  for (const e of detail?.entries ?? []) {
    if (e.user) imgByLogin.set(e.login, e.user.imageUrl);
    if (e.partner && e.partnerLogin) imgByLogin.set(e.partnerLogin, e.partner.imageUrl);
  }

  const s = detail ? summarize(detail, imgByLogin) : null;
  const entries = detail?.entries ?? [];

  return (
    <div ref={ref} className="relative" onMouseEnter={onEnter} onMouseMove={place} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && s && s.winner && pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[2147483600] w-80 rounded-xl border border-gold/30 bg-bg-0/98 backdrop-blur-sm shadow-2xl shadow-black/60 p-3"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-extrabold text-text-strong truncate flex-1">{t.name}</span>
              {s.is2v2 && (
                <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red/15 border border-red/40 text-red shrink-0">
                  2v2
                </span>
              )}
            </div>

            {/* Vainqueur (équipe entière en 2v2) + parcours */}
            <div className="flex items-center gap-2 mb-2.5 rounded-lg bg-gold/10 border border-gold/25 px-2 py-1.5">
              <span className="text-base leading-none">🏆</span>
              <span className="flex -space-x-2 shrink-0">
                {s.winner.members.map((m) => (
                  <Avatar key={m.login} login={m.login} imageUrl={m.imageUrl} size="sm" />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-gold truncate">{s.winner.label}</span>
                <span className="block text-[9px] text-muted-2 uppercase tracking-wider">
                  Vainqueur{s.is2v2 ? ' (duo)' : ''} · {s.winnerWins} victoire{s.winnerWins > 1 ? 's' : ''}
                </span>
              </span>
            </div>

            {/* Stats du tournoi */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 rounded-lg bg-bg-2/50 border border-border/50 px-2 py-1 text-center">
                <div className="text-[8px] uppercase tracking-wider text-muted-2 font-bold">Matchs joués</div>
                <div className="font-display font-black text-sm text-text-strong tabular-nums">{s.totalMatches}</div>
              </div>
              {s.leagueDiff != null && (
                <div className="flex-1 rounded-lg bg-bg-2/50 border border-border/50 px-2 py-1 text-center">
                  <div className="text-[8px] uppercase tracking-wider text-muted-2 font-bold">Goal avg (ligue)</div>
                  <div className={`font-display font-black text-sm tabular-nums ${s.leagueDiff >= 0 ? 'text-[#7fd66e]' : 'text-red'}`}>
                    {s.leagueDiff > 0 ? '+' : ''}{s.leagueDiff}
                  </div>
                </div>
              )}
            </div>

            {s.semis.length > 0 && (
              <div className="mb-2">
                <div className="text-[9px] uppercase tracking-wider text-muted font-bold mb-1">Demi-finales</div>
                <div className="space-y-1">
                  {s.semis.map((m) => (
                    <MatchLine key={m.id} m={m} entries={entries} imgByLogin={imgByLogin} is2v2={s.is2v2} />
                  ))}
                </div>
              </div>
            )}
            {s.final && (
              <div className="mb-2">
                <div className="text-[9px] uppercase tracking-wider text-gold/80 font-bold mb-1">Finale</div>
                <MatchLine m={s.final} entries={entries} imgByLogin={imgByLogin} is2v2={s.is2v2} />
              </div>
            )}

            <div className="text-[9px] text-muted-2 text-center pt-1 border-t border-border/50">
              Cliquer pour voir le détail →
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
