/**
 * Badges visuels pour les trophées d'équipe 2v2.
 *
 * Deux exports :
 *  - `TeamTrophyBadge` — chip compact avec tooltip, pour TeamProfile et Hall of Fame.
 *  - `TeamTrophyCard`  — grande carte style HUD (utilisée dans TeamTrophiesSection).
 */

import { motion } from 'framer-motion';
import { Tooltip } from './Tooltip';
import { TiltCard } from './TiltCard';
import type { TeamTrophyResult, TeamTrophyWinner } from '../lib/trophies2v2';
import { teamDisplayName } from '../lib/trophies2v2';
import { useNavigate } from 'react-router-dom';

// ─── Palette couleurs (reprend TrophiesSection) ───────────────────────────────

const COLOR_TEXT: Record<string, string> = {
  gold:    'text-gold',
  violet:  'text-[#c97bff]',
  red:     'text-red',
  green:   'text-[#7fd66e]',
  cyan:    'text-[#f5b942]',
  sapphire:'text-[#7aa8ff]',
  bronze:  'text-[#cd7f32]',
  crimson: 'text-[#dc143c]',
  magenta: 'text-[#ff5bb0]',
};

const COLOR_HEX: Record<string, string> = {
  gold:    '#ffc94a',
  violet:  '#c97bff',
  red:     '#ff5366',
  green:   '#7fd66e',
  cyan:    '#f5b942',
  sapphire:'#7aa8ff',
  bronze:  '#cd7f32',
  crimson: '#dc143c',
  magenta: '#ff5bb0',
};

const COLOR_BORDER: Record<string, string> = {
  gold:    'border-gold/40',
  violet:  'border-[#c97bff]/40',
  red:     'border-red/40',
  green:   'border-[#10b981]/40',
  cyan:    'border-teal/40',
  sapphire:'border-[#3b82f6]/40',
  bronze:  'border-[#cd7f32]/40',
  crimson: 'border-[#dc143c]/40',
  magenta: 'border-[#ff3bd9]/40',
};

// ─── Duo avatar (overlap) ─────────────────────────────────────────────────────

const GOLD_GRAD = 'linear-gradient(135deg, #d4a04a 0%, #8a5e10 50%, #c79122 100%)';

export function DuoAvatar({ winner, size = 24 }: { winner: TeamTrophyWinner; size?: number }) {
  const cls = `rounded-full overflow-hidden border border-gold/40 flex-shrink-0 flex items-center justify-center font-display font-black text-[#1a1100]`;
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return (
    <div className="relative flex-shrink-0" style={{ width: size + size * 0.45, height: size }}>
      <div className={cls} style={{ ...style, position: 'absolute', right: 0 }}>
        {winner.player2ImageUrl
          ? <img src={winner.player2ImageUrl} alt={winner.player2Login} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_GRAD }}>{winner.player2Login[0]?.toUpperCase()}</div>}
      </div>
      <div className={cls} style={{ ...style, position: 'absolute', left: 0, outline: '1.5px solid rgba(21,18,14,1)' }}>
        {winner.player1ImageUrl
          ? <img src={winner.player1ImageUrl} alt={winner.player1Login} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: GOLD_GRAD }}>{winner.player1Login[0]?.toUpperCase()}</div>}
      </div>
    </div>
  );
}

// ─── TeamTrophyBadge — chip compact ──────────────────────────────────────────

interface TeamTrophyBadgeProps {
  trophy: TeamTrophyResult;
  size?: 'xs' | 'sm' | 'md';
  /** Affiche le nom de l'équipe gagnante à côté de l'icône. */
  showWinner?: boolean;
}

/**
 * Chip de trophée d'équipe avec tooltip sur hover.
 *
 * Usage : `<TeamTrophyBadge trophy={t} size="sm" showWinner />`
 *
 * - Si `!trophy.earned`, le badge est grisé et le tooltip indique la condition.
 * - Clic → navigue vers la page de l'équipe (si earned).
 */
export function TeamTrophyBadge({ trophy, size = 'sm', showWinner = false }: TeamTrophyBadgeProps) {
  const navigate = useNavigate();
  const color = COLOR_HEX[trophy.color] ?? '#ffc94a';
  const textCls = COLOR_TEXT[trophy.color] ?? 'text-gold';

  const sizeCls =
    size === 'xs' ? 'text-[8px] px-1.5 py-0.5 gap-0.5' :
    size === 'md' ? 'text-xs  px-3   py-1.5 gap-1.5'   :
                   'text-[10px] px-2 py-0.5 gap-1';
  const avatarSize = size === 'md' ? 20 : 16;

  const tooltipContent = (
    <div className="max-w-[220px] text-center space-y-1">
      <div className="font-extrabold text-text-strong">{trophy.emoji} {trophy.title}</div>
      <div className="text-muted-2 leading-snug text-[10px]">{trophy.description}</div>
      {!trophy.earned && (
        <div className="text-[9px] text-muted italic">🔒 {trophy.hint}</div>
      )}
      {trophy.earned && (
        <div className="text-[9px] font-mono text-gold">{trophy.value}</div>
      )}
    </div>
  );

  return (
    <Tooltip label={tooltipContent} side="top">
      <motion.button
        type="button"
        disabled={!trophy.earned}
        onClick={() => trophy.earned && trophy.winner && navigate(`/team/${trophy.winner.id}`)}
        className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-[0.1em] border leading-none ${sizeCls} ${
          trophy.earned ? '' : 'opacity-40 grayscale cursor-default'
        }`}
        style={{
          color,
          borderColor: `${color}55`,
          background: `linear-gradient(110deg, ${color}14 0%, ${color}33 45%, ${color}14 70%)`,
          backgroundSize: '220% 100%',
        }}
        animate={trophy.earned ? { backgroundPosition: ['0% 0%', '220% 0%'] } : {}}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
      >
        <span>{trophy.emoji}</span>
        <span className={textCls}>{trophy.title}</span>
        {showWinner && trophy.winner && (
          <>
            <DuoAvatar winner={trophy.winner} size={avatarSize} />
            <span className="text-muted-2 font-semibold normal-case tracking-normal">
              {teamDisplayName(trophy.winner)}
            </span>
          </>
        )}
      </motion.button>
    </Tooltip>
  );
}

// ─── TeamTrophyCard — grande carte HUD (utilisée dans le Hall of Fame) ────────

/**
 * Carte premium style holographique pour le Hall of Fame des équipes 2v2.
 * Utilise le TiltCard partagé (tilt 3D + brillance au hover) — même logique
 * d'animation que les cartes de trophées solo, mix et FFA.
 */
export function TeamTrophyCard({ trophy }: { trophy: TeamTrophyResult }) {
  const navigate = useNavigate();
  const color = COLOR_HEX[trophy.color] ?? '#ffc94a';
  const textCls = COLOR_TEXT[trophy.color] ?? 'text-gold';
  const borderCls = COLOR_BORDER[trophy.color] ?? 'border-gold/40';

  return (
    <TiltCard
      glowHex={color}
      className={`card-hud overflow-hidden rounded-xl p-3.5 flex flex-col gap-2.5 border ${borderCls} ${
        trophy.earned ? 'hover-glow cursor-pointer' : 'opacity-60'
      }`}
      onClick={() => trophy.earned && trophy.winner && navigate(`/team/${trophy.winner.id}`)}
      style={trophy.earned ? { boxShadow: `0 0 0 1px ${color}22, 0 8px 20px -8px ${color}40` } : undefined}
    >
      {/* Accent top line */}
      {trophy.earned && (
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
        />
      )}

      {/* Header : emoji + titre */}
      <div className="flex items-center gap-2.5">
        <div className="text-2xl leading-none">{trophy.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-extrabold uppercase tracking-wider ${textCls}`}>
            {trophy.title}
          </div>
          <div className="text-[10px] text-muted-2 leading-tight">{trophy.subtitle}</div>
        </div>
        {/* 2v2 pill */}
        <span className="flex-shrink-0 text-[8px] font-extrabold uppercase tracking-wider text-muted border border-muted/30 rounded-full px-1.5 py-0.5">
          2v2
        </span>
      </div>

      {/* Gagnant */}
      {!trophy.earned ? (
        <div className="text-[11px] text-muted-2 italic flex items-center gap-1.5">
          <span>🔒</span>
          <span>Personne ne le détient encore</span>
        </div>
      ) : trophy.winner ? (
        <div className="flex items-center gap-2.5 mt-0.5">
          <DuoAvatar winner={trophy.winner} size={32} />
          <div className="min-w-0">
            <div
              className={`text-xs font-extrabold truncate ${textCls}`}
              style={{ textShadow: `0 0 10px ${color}55` }}
            >
              {teamDisplayName(trophy.winner)}
            </div>
            {trophy.winner.name && (
              <div className="text-[9px] text-muted font-mono truncate">
                {trophy.winner.player1Login} &amp; {trophy.winner.player2Login}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Valeur + description tooltip */}
      <div className="flex items-end justify-between gap-2 mt-auto">
        <div
          className={`font-display text-lg font-black tabular-nums leading-none ${textCls}`}
          style={{ textShadow: `0 0 16px ${color}55` }}
        >
          {trophy.value}
        </div>
        {/* Info bulle inline (desktop hover) */}
        <Tooltip label={trophy.description} side="top">
          <span className="text-[9px] text-muted border border-muted/30 rounded-full px-1.5 py-0.5 cursor-help font-mono">
            ?
          </span>
        </Tooltip>
      </div>
    </TiltCard>
  );
}

// ─── TeamTrophyRow — affichage compact pour la page TeamProfile ────────────────

/**
 * Rangée de badges de trophées pour la page TeamProfile.
 * Affiche uniquement les trophées que CETTE équipe détient.
 */
export function TeamTrophyRow({
  trophies,
  teamId,
}: {
  trophies: TeamTrophyResult[];
  teamId: string;
}) {
  const earned = trophies.filter((t) => t.earned && t.winner?.id === teamId);
  if (earned.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {earned.map((t) => (
        <TeamTrophyBadge key={t.code} trophy={t} size="sm" />
      ))}
    </div>
  );
}
