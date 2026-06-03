import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { PlayerLink } from '../../components/PlayerLink';
import { StatCard } from '../../components/StatCard';
import { TeamEloChart } from '../../components/TeamEloChart';
import { TeamProfileTrophiesSection } from '../../components/TeamTrophiesSection';
import type { TeamProfile } from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GOLD_GRAD = 'linear-gradient(135deg, #d4a04a 0%, #8a5e10 50%, #c79122 100%)';

function PlayerAvatar({ login, imageUrl, size = 64 }: { login: string; imageUrl?: string | null; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden border-2 border-gold/40 flex-shrink-0 flex items-center justify-center font-display font-black text-[#1a1100]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {imageUrl
        ? <img src={imageUrl} alt={login} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_GRAD }}>{login[0]?.toUpperCase()}</div>}
    </div>
  );
}

function KV({ label, value, tone }: { label: string; value: string; tone: 'win' | 'loss' | 'neutral' }) {
  const toneCls = tone === 'win' ? 'text-gold' : tone === 'loss' ? 'text-red' : 'text-text-strong';
  return (
    <div className="flex items-center justify-between text-sm border-b border-gold/10 last:border-0 pb-1.5 last:pb-0">
      <span className="text-muted-2 font-medium uppercase tracking-wider text-xs">{label}</span>
      <span className={`font-display font-extrabold tabular-nums ${toneCls}`}>{value}</span>
    </div>
  );
}

function ChartLabel({ title }: { title: string }) {
  return (
    <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-3 flex items-center gap-2">
      <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
      {title}
      <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface TeamProfileDesktopProps {
  team: TeamProfile;
}

export function TeamProfileDesktop({ team }: TeamProfileDesktopProps) {
  const navigate = useNavigate();
  const teamName = team.name ?? `${team.player1Login} & ${team.player2Login}`;
  const games = team.wins + team.losses;
  const winRate = games === 0 ? 0 : Math.round((team.wins / games) * 100);
  const deltaTotal = team.eloHistory.reduce((s, p) => s + p.delta, 0);

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-muted-2 hover:text-gold transition-colors text-xs font-bold uppercase tracking-wider tap-transparent"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        Retour
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* ── Panneau gauche : identité + stats ─────────────────────────── */}
        <Panel title="Équipe 2v2" sub="Babyfoot" accent="user">

          {/* Hero bloc */}
          <div
            className="relative overflow-hidden rounded-2xl mb-6 border border-gold/35"
            style={{
              background: 'linear-gradient(180deg, #2a241c 0%, #15120e 55%, #1d1914 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,215,120,0.15), 0 12px 32px -12px rgba(255,201,74,0.25)',
            }}
          >
            <div className="absolute inset-0 hud-diag opacity-30 pointer-events-none" />
            <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent pointer-events-none" />

            <div className="relative z-10 p-5 flex items-center gap-5">
              {/* Duo avatars en overlap */}
              <div className="relative flex-shrink-0" style={{ width: 88, height: 64 }}>
                <div className="absolute right-0 top-0">
                  <PlayerAvatar login={team.player2Login} imageUrl={team.player2ImageUrl} size={56} />
                </div>
                <div style={{ position: 'absolute', left: 0, top: 4, outline: '2px solid #15120e', borderRadius: '50%' }}>
                  <PlayerAvatar login={team.player1Login} imageUrl={team.player1ImageUrl} size={56} />
                </div>
              </div>

              {/* Identité */}
              <div className="flex-1 min-w-0">
                <div className="font-display text-2xl font-black text-text-strong truncate tracking-tight">
                  {teamName}
                </div>
                {team.name && (
                  <div className="text-xs text-muted-2 font-mono mt-0.5">
                    <PlayerLink login={team.player1Login} className="hover:text-gold transition-colors">{team.player1Login}</PlayerLink>
                    {' & '}
                    <PlayerLink login={team.player2Login} className="hover:text-gold transition-colors">{team.player2Login}</PlayerLink>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-2 font-bold uppercase tracking-wider bg-bg-1/60 border border-border/60 rounded-full px-2.5 py-1">
                    <Shield className="w-3 h-3 text-gold/70" strokeWidth={2} />
                    Babyfoot 2v2
                  </span>
                  {team.rank > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.25 }}
                      className="font-mono text-[11px] font-extrabold tabular-nums rounded-full px-2.5 py-1 bg-bg-1/60 text-gold border border-gold/40"
                    >
                      #{team.rank}
                    </motion.span>
                  )}
                </div>
              </div>

              {/* ELO bloc */}
              <div className="text-left flex-shrink-0 pl-2">
                <div
                  className="font-display text-[2.75rem] leading-none font-black text-gold-emboss tabular-nums"
                  style={{ textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,201,74,0.35)' }}
                >
                  {team.elo}
                </div>
                <div className="mt-1 text-[10px] text-muted uppercase tracking-[0.28em] font-extrabold">
                  ELO ÉQUIPE
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <StatCard value={String(team.elo)} label="ELO" tone="teal" />
            <StatCard value={`${winRate}%`} label="Win Rate" tone={winRate >= 50 ? 'win' : 'loss'} />
            <StatCard value={String(team.wins)} label="Victoires" tone="win" />
            <StatCard value={String(team.losses)} label="Défaites" tone="loss" />
          </div>

          {/* KV details */}
          <div className="space-y-1.5 card-hud rounded-xl px-4 py-3 mb-4">
            <KV label="Matches joués" value={String(games)} tone="neutral" />
            <KV label="Δ ELO total" value={`${deltaTotal >= 0 ? '+' : ''}${deltaTotal}`} tone={deltaTotal >= 0 ? 'win' : 'loss'} />
            <KV
              label="Créée le"
              value={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(team.createdAt))}
              tone="neutral"
            />
          </div>

          {/* Trophées d'équipe */}
          <div className="mt-4">
            <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
              Trophées d'Équipe
              <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
            </div>
            <TeamProfileTrophiesSection teamId={team.id} />
          </div>

          {/* Player profiles */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { login: team.player1Login, img: team.player1ImageUrl },
              { login: team.player2Login, img: team.player2ImageUrl },
            ].map(({ login, img }) => (
              <PlayerLink
                key={login}
                login={login}
                className="flex items-center gap-3 card-hud rounded-xl px-4 py-3 border border-transparent hover:border-gold/25 transition-all group"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gold/30">
                  {img
                    ? <img src={img} alt={login} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-display font-black text-xs text-[#1a1100]" style={{ background: GOLD_GRAD }}>{login[0]?.toUpperCase()}</div>}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text-strong truncate group-hover:text-gold transition-colors">
                    {login}
                  </div>
                  <div className="text-[10px] text-muted font-medium">Voir le profil →</div>
                </div>
              </PlayerLink>
            ))}
          </div>
        </Panel>

        {/* ── Panneau droit : ELO chart + historique ─────────────────────── */}
        <Panel title="Performance" sub="Courbe ELO · historique">

          {/* ELO chart */}
          <div className="mb-6 card-hud rounded-xl px-4 pt-3 pb-4 border-gold/20">
            <ChartLabel title="Progression ELO de l'Équipe" />
            <TeamEloChart points={team.eloHistory} height={240} uid={team.id} />
          </div>

          {/* Match history table */}
          {team.eloHistory.length > 0 && (
            <>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-text-strong mb-3">
                Historique des matches
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted">
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Adversaires</th>
                      <th className="text-right px-3 py-2">Score</th>
                      <th className="text-right px-3 py-2">Résultat</th>
                      <th className="text-right px-3 py-2">ELO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...team.eloHistory].reverse().slice(0, 25).map((p, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-3 py-2 text-muted-2 text-xs whitespace-nowrap">
                          {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(p.playedAt))}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="text-muted-2">vs </span>
                          <PlayerLink login={p.opponentPlayer1Login} className="hover:text-gold transition-colors">
                            {p.opponentPlayer1Login}
                          </PlayerLink>
                          <span className="text-muted-2 mx-1">&amp;</span>
                          <PlayerLink login={p.opponentPlayer2Login} className="hover:text-gold transition-colors">
                            {p.opponentPlayer2Login}
                          </PlayerLink>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono text-xs">
                          {p.scoreTeam}–{p.scoreOpponent}
                        </td>
                        <td className={`px-3 py-2 text-right text-[10px] uppercase font-extrabold ${p.won ? 'text-gold' : 'text-red'}`}>
                          {p.won ? 'Victoire' : 'Défaite'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono text-xs font-extrabold tabular-nums ${p.delta >= 0 ? 'text-[#7fd66e]' : 'text-red'}`}>
                          {p.delta >= 0 ? '+' : ''}{p.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {team.eloHistory.length === 0 && (
            <div className="text-center text-muted-2 text-sm py-10 italic">
              Aucun match confirmé pour l'instant.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
