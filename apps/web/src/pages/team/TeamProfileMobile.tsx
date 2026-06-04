import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { PlayerLink } from '../../components/PlayerLink';
import { TeamEloChart } from '../../components/TeamEloChart';
import { TeamProfileTrophiesSection } from '../../components/TeamTrophiesSection';
import type { TeamProfile } from '../../lib/api';
import { useI18n, useT } from '../../lib/i18n';

// ─── Avatar en overlap pour un duo ───────────────────────────────────────────

const GOLD_GRAD = 'linear-gradient(135deg, #d4a04a 0%, #8a5e10 50%, #c79122 100%)';

function DuoAvatars({
  login1, img1, login2, img2, size = 20,
}: {
  login1: string; img1: string | null;
  login2: string; img2: string | null;
  size?: number;
}) {
  const cls = `rounded-full overflow-hidden border-2 border-gold/40 flex-shrink-0 flex items-center justify-center font-display font-black text-[#1a1100]`;
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return (
    <div className="relative flex-shrink-0" style={{ width: size + size * 0.5, height: size }}>
      {/* Back avatar */}
      <div className={cls} style={{ ...style, position: 'absolute', left: size * 0.5 }}>
        {img2
          ? <img src={img2} alt={login2} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_GRAD }}>{login2[0]?.toUpperCase()}</div>}
      </div>
      {/* Front avatar with ring */}
      <div className={cls} style={{ ...style, position: 'absolute', left: 0, outline: '2px solid rgba(21,18,14,1)' }}>
        {img1
          ? <img src={img1} alt={login1} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_GRAD }}>{login1[0]?.toUpperCase()}</div>}
      </div>
    </div>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function TeamHeroCard({ team }: { team: TeamProfile }) {
  const t = useT();
  const games = team.wins + team.losses;
  const winRate = games === 0 ? 0 : Math.round((team.wins / games) * 100);
  const deltaTotal = team.eloHistory.reduce((s, p) => s + p.delta, 0);
  const teamName = team.name ?? `${team.player1Login} & ${team.player2Login}`;
  const isUp = deltaTotal >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: 'linear-gradient(180deg, #2a241c 0%, #1d1914 18%, #15120e 50%, #1d1914 82%, #2a241c 100%)',
        border: '1px solid rgba(255,201,74,0.38)',
        boxShadow: 'inset 0 1px 0 rgba(255,215,120,0.16), 0 12px 36px -8px rgba(255,201,74,0.20)',
      }}
    >
      {/* Accent lines */}
      <div className="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 hud-diag opacity-30 pointer-events-none" />

      <div className="relative z-10 px-5 pt-5 pb-5 space-y-4">
        {/* Identity row */}
        <div className="flex items-center gap-4">
          <DuoAvatars
            login1={team.player1Login} img1={team.player1ImageUrl ?? null}
            login2={team.player2Login} img2={team.player2ImageUrl ?? null}
            size={56}
          />
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl font-black text-text-strong truncate tracking-tight">
              {teamName}
            </div>
            {team.name && (
              <div className="text-[11px] text-muted-2 font-mono mt-0.5">
                <PlayerLink login={team.player1Login} className="hover:text-gold transition-colors">
                  {team.player1Login}
                </PlayerLink>
                {' & '}
                <PlayerLink login={team.player2Login} className="hover:text-gold transition-colors">
                  {team.player2Login}
                </PlayerLink>
              </div>
            )}
            {!team.name && (
              <div className="text-[10px] text-muted-2 font-medium mt-0.5 italic">
                {t('team.noName')}
              </div>
            )}
          </div>

          {/* Rank badge */}
          {team.rank <= 3 && (
            <div className="font-display text-2xl flex-shrink-0">
              {team.rank === 1 ? '🥇' : team.rank === 2 ? '🥈' : '🥉'}
            </div>
          )}
          {team.rank > 3 && (
            <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-bg-1/60 border border-gold/30 font-mono text-xs font-extrabold text-gold tabular-nums">
              #{team.rank}
            </div>
          )}
        </div>

        {/* ELO + delta */}
        <div className="flex items-end justify-between px-1">
          <div>
            <div className="font-display text-[52px] font-black leading-none tabular-nums text-gold"
              style={{ textShadow: '0 0 24px rgba(255,201,74,0.35)' }}>
              {team.elo}
            </div>
            <div className="text-[10px] text-muted uppercase tracking-[0.32em] font-extrabold mt-0.5">
              {t('team.elo.label')}
            </div>
          </div>
          {deltaTotal !== 0 && (
            <div className={`flex flex-col items-end ${isUp ? 'text-gold' : 'text-red'}`}>
              <div className="flex items-center gap-1 font-mono text-lg font-extrabold tabular-nums">
                {isUp ? <TrendingUp className="w-4 h-4" strokeWidth={2.5} /> : <TrendingDown className="w-4 h-4" strokeWidth={2.5} />}
                {isUp ? '+' : ''}{deltaTotal}
              </div>
              <div className="text-[9px] text-muted uppercase tracking-wider font-bold">
                {t('team.delta.total')}
              </div>
            </div>
          )}
        </div>

        {/* Stats pills */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: t('lb.abbr.win'), value: team.wins, tone: 'text-gold' },
            { label: t('lb.abbr.loss'), value: team.losses, tone: 'text-red' },
            { label: 'WR', value: `${winRate}%`, tone: winRate >= 50 ? 'text-gold' : 'text-red' },
            { label: 'GM', value: games, tone: 'text-text-strong' },
          ].map(({ label, value, tone }) => (
            <div key={label} className="metal-plate rounded-lg px-1 py-2 flex flex-col items-center gap-0.5">
              <div className={`font-display text-base font-black tabular-nums leading-none ${tone}`}>
                {value}
              </div>
              <div className="text-[9px] text-muted-2 uppercase tracking-wider font-extrabold">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, badge }: { title: string; badge?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
      <span className="font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold text-gold/90">
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="font-mono text-[10px] text-muted tabular-nums">· {badge}</span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent ml-2" />
    </div>
  );
}

// ─── Historique des matches ───────────────────────────────────────────────────

function TeamMatchHistory({ team }: { team: TeamProfile }) {
  const t = useT();
  const { locale } = useI18n();
  const history = [...team.eloHistory].reverse().slice(0, 20);
  if (history.length === 0) {
    return (
      <div className="text-center text-muted-2 text-sm py-6 italic">
        {t('team.empty.mobile')}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {history.map((p, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 rounded-xl px-4 py-2.5 card-hud border-l-2 ${
            p.won ? 'border-l-gold/60' : 'border-l-red/60'
          }`}
        >
          <div className={`text-[10px] font-extrabold uppercase tracking-wide w-10 flex-shrink-0 ${p.won ? 'text-gold' : 'text-red'}`}>
            {p.won ? t('lb.abbr.win') : t('lb.abbr.loss')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text-strong truncate">
              vs{' '}
              <PlayerLink login={p.opponentPlayer1Login} className="hover:text-gold transition-colors">
                {p.opponentPlayer1Login}
              </PlayerLink>
              {' & '}
              <PlayerLink login={p.opponentPlayer2Login} className="hover:text-gold transition-colors">
                {p.opponentPlayer2Login}
              </PlayerLink>
            </div>
            <div className="text-[10px] text-muted-2 font-mono">
              {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(p.playedAt))}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="font-mono text-sm font-extrabold text-text-strong tabular-nums">
              {p.scoreTeam}–{p.scoreOpponent}
            </div>
            <div className={`text-[9px] font-mono tabular-nums ${p.delta >= 0 ? 'text-[#7fd66e]' : 'text-red'}`}>
              {p.delta >= 0 ? '+' : ''}{p.delta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

interface TeamProfileMobileProps {
  team: TeamProfile;
  onRefresh: () => Promise<void>;
}

export function TeamProfileMobile({ team, onRefresh }: TeamProfileMobileProps) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <PullToRefresh onRefresh={onRefresh}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-muted-2 hover:text-gold transition-colors text-xs font-bold uppercase tracking-wider mb-4 tap-transparent"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        {t('team.back')}
      </button>

      <div className="space-y-5">
        {/* Hero */}
        <TeamHeroCard team={team} />

        {/* ELO chart */}
        <div className="card-hud rounded-2xl px-4 pt-3 pb-4 border-gold/20">
          <SectionHeader title={t('team.eloProgress')} />
          <TeamEloChart points={team.eloHistory} height={150} uid={team.id} />
        </div>

        {/* Joueurs */}
        <section>
          <SectionHeader title={t('team.players')} />
          <div className="grid grid-cols-2 gap-2">
            {[
              { login: team.player1Login, img: team.player1ImageUrl },
              { login: team.player2Login, img: team.player2ImageUrl },
            ].map(({ login, img }) => (
              <PlayerLink
                key={login}
                login={login}
                className="flex items-center gap-2.5 card-hud rounded-xl px-3 py-2.5 hover:border-gold/30 border border-transparent transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gold/30">
                  {img
                    ? <img src={img} alt={login} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-display font-black text-[10px] text-[#1a1100]" style={{ background: GOLD_GRAD }}>{login[0]?.toUpperCase()}</div>}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-strong truncate">{login}</div>
                  <div className="text-[9px] text-muted font-medium">{t('team.viewProfile')}</div>
                </div>
              </PlayerLink>
            ))}
          </div>
        </section>

        {/* Trophées d'équipe */}
        <section>
          <SectionHeader title={t('team.trophies')} />
          <TeamProfileTrophiesSection teamId={team.id} />
        </section>

        {/* Match history */}
        <section>
          <SectionHeader title={t('team.history.recent')} badge={team.eloHistory.length} />
          <TeamMatchHistory team={team} />
        </section>
      </div>
    </PullToRefresh>
  );
}
