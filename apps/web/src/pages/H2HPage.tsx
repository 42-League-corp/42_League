import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { RankedBadge } from '../components/RankedBadge';
import { PlayerLink } from '../components/PlayerLink';
import { useLeagueData } from '../hooks/useLeagueData';
import { computePlayerStats } from '../lib/playerStats';
import type { PlayedMatch } from '../lib/api';
import { useT } from '../lib/i18n';

/** Vue d'un match du point de vue d'un joueur. */
function sideOf(m: PlayedMatch, login: string) {
  const isA = m.playerALogin === login;
  return {
    won: (isA && m.winner === 'A') || (!isA && m.winner === 'B'),
    scoreFor: isA ? m.scoreA : m.scoreB,
    scoreAgainst: isA ? m.scoreB : m.scoreA,
    delta: isA ? m.deltaA : m.deltaB,
  };
}

function fmtDateFr(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
}

/**
 * Head-to-Head : /h2h?a=<login>&b=<login>
 * Compare deux joueurs et leurs confrontations directes (ELO uniquement),
 * entièrement calculé côté client depuis le contexte LeagueData.
 */
export function H2HPage() {
  const [params] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const { leaderboard, matches } = useLeagueData();
  const t = useT();

  const data = useMemo(() => {
    if (!a || !b || a === b) return null;
    // Confrontations directes comptées pour l'ELO, plus récentes d'abord.
    const h2h = matches
      .filter(
        (m) =>
          m.countedForElo &&
          ((m.playerALogin === a && m.playerBLogin === b) ||
            (m.playerALogin === b && m.playerBLogin === a)),
      )
      .sort((x, y) => new Date(y.playedAt).getTime() - new Date(x.playedAt).getTime());

    let winsA = 0;
    let winsB = 0;
    let eloNetA = 0;
    let eloNetB = 0;
    let goalsA = 0;
    let goalsB = 0;
    for (const m of h2h) {
      const sa = sideOf(m, a);
      if (sa.won) winsA++;
      else winsB++;
      eloNetA += sa.delta;
      eloNetB += sideOf(m, b).delta;
      goalsA += sa.scoreFor;
      goalsB += sa.scoreAgainst;
    }
    const n = h2h.length;
    return {
      h2h,
      n,
      winsA,
      winsB,
      eloNetA,
      eloNetB,
      avgA: n ? Math.round((goalsA / n) * 10) / 10 : 0,
      avgB: n ? Math.round((goalsB / n) * 10) / 10 : 0,
      last: h2h[0] ?? null,
    };
  }, [a, b, matches]);

  if (!a || !b || a === b) {
    return (
      <Panel title={t('h2h.title')} sub={t('h2h.sub.compare')} accent="swords">
        <div className="text-center text-muted-2 py-10">
          {t('h2h.missing')}
        </div>
      </Panel>
    );
  }

  const ea = leaderboard.find((u) => u.login === a) ?? null;
  const eb = leaderboard.find((u) => u.login === b) ?? null;
  const statsA = computePlayerStats(a, matches, 0);
  const statsB = computePlayerStats(b, matches, 0);

  return (
    <Panel title={t('h2h.title')} sub={t('h2h.sub.direct')} accent="swords">
      {/* Deux profils côte à côte */}
      <div className="flex items-stretch gap-3 sm:gap-4">
        <ProfileSide
          login={a}
          imageUrl={ea?.imageUrl ?? null}
          elo={ea?.elo}
          winRate={statsA.winRate}
          wins={statsA.wins}
          losses={statsA.losses}
          align="left"
        />
        <div className="flex flex-col items-center justify-center px-1">
          <span className="font-display text-2xl font-black text-gold leading-none">VS</span>
          {data && data.n > 0 && (
            <span className="mt-1 font-mono text-lg font-extrabold tabular-nums text-text-strong">
              {data.winsA}<span className="text-muted-2">–</span>{data.winsB}
            </span>
          )}
        </div>
        <ProfileSide
          login={b}
          imageUrl={eb?.imageUrl ?? null}
          elo={eb?.elo}
          winRate={statsB.winRate}
          wins={statsB.wins}
          losses={statsB.losses}
          align="right"
        />
      </div>

      {/* Stats H2H */}
      {!data || data.n === 0 ? (
        <div className="mt-6 text-center text-muted-2 py-8 card-hud rounded-xl">
          {t('h2h.never.a')} <span className="text-text font-semibold">{t('h2h.never.b')}</span> {t('h2h.never.c')}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <H2HStat label={t('h2h.stat.confrontations')} value={String(data.n)} />
            <H2HStat label={t('h2h.stat.record')} value={`${data.winsA} – ${data.winsB}`} />
            <H2HStat
              label={`${t('h2h.stat.eloNet')} · ${a}`}
              value={`${data.eloNetA >= 0 ? '+' : ''}${data.eloNetA}`}
              tone={data.eloNetA >= 0 ? 'win' : 'loss'}
            />
            <H2HStat
              label={`${t('h2h.stat.eloNet')} · ${b}`}
              value={`${data.eloNetB >= 0 ? '+' : ''}${data.eloNetB}`}
              tone={data.eloNetB >= 0 ? 'win' : 'loss'}
            />
            <H2HStat label={t('h2h.stat.avgScore')} value={`${data.avgA} – ${data.avgB}`} />
            {data.last && (
              <H2HStat
                label={t('h2h.stat.lastMatch')}
                value={`${sideOf(data.last, a).scoreFor}–${sideOf(data.last, a).scoreAgainst}`}
                sub={fmtDateFr(data.last.playedAt)}
              />
            )}
          </div>

          {/* Timeline des 10 derniers matchs (vus de A) */}
          <div className="mt-6">
            <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
              {t('h2h.last10')}
              <span className="text-muted-2 normal-case tracking-normal font-mono">· {t('h2h.seenFrom')} {a}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              {data.h2h.slice(0, 10).map((m, i) => {
                const sa = sideOf(m, a);
                return (
                  <div
                    key={i}
                    className={`card-hud rounded-lg px-2.5 py-2 flex flex-col items-center gap-0.5 min-w-[64px] border ${
                      sa.won ? 'border-[#7fd66e]/30' : 'border-red/30'
                    }`}
                    title={fmtDateFr(m.playedAt)}
                  >
                    <span
                      className={`text-[10px] font-black uppercase ${sa.won ? 'text-[#7fd66e]' : 'text-red'}`}
                    >
                      {sa.won ? t('h2h.win') : t('h2h.loss')}
                    </span>
                    <span className="font-mono text-sm font-extrabold tabular-nums text-text-strong">
                      {sa.scoreFor}–{sa.scoreAgainst}
                    </span>
                    <span className="text-[9px] text-muted-2 font-mono">{fmtDateFr(m.playedAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <Link
          to="/leaderboard"
          className="text-[11px] uppercase tracking-wider text-muted-2 hover:text-gold transition-colors"
        >
          {t('h2h.back')}
        </Link>
      </div>
    </Panel>
  );
}

function ProfileSide({
  login,
  imageUrl,
  elo,
  winRate,
  wins,
  losses,
  align,
}: {
  login: string;
  imageUrl: string | null;
  elo?: number;
  winRate: number;
  wins: number;
  losses: number;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={`flex-1 min-w-0 card-hud rounded-2xl p-4 flex flex-col items-center text-center gap-2 ${
        align === 'right' ? 'border-gold/25' : 'border-gold/25'
      }`}
    >
      <PlayerLink login={login} className="flex-col !gap-2">
        <Avatar login={login} imageUrl={imageUrl} size="lg" className="ring-2 ring-gold/40" />
        <span className="font-extrabold text-text-strong text-sm truncate max-w-[120px]">{login}</span>
      </PlayerLink>
      <div className="flex items-center gap-1.5">
        <span className="font-display text-xl font-black text-gold tabular-nums">{elo ?? '—'}</span>
        <RankedBadge size="xs" />
      </div>
      <div className="text-[11px] text-muted-2">
        <span className="text-text font-semibold">{winRate}%</span> WR ·{' '}
        <span className="text-[#7fd66e] font-semibold">{wins}</span>
        <span className="text-muted-2">-</span>
        <span className="text-red font-semibold">{losses}</span>
      </div>
    </div>
  );
}

function H2HStat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'win' | 'loss';
}) {
  const toneCls = tone === 'win' ? 'text-gold' : tone === 'loss' ? 'text-red' : 'text-text-strong';
  return (
    <div className="card-hud rounded-xl px-3 py-2.5 text-center">
      <div className={`font-display text-lg font-black tabular-nums leading-none ${toneCls}`}>{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-2 font-bold truncate">{label}</div>
      {sub && <div className="text-[9px] text-muted-2 font-mono mt-0.5">{sub}</div>}
    </div>
  );
}
