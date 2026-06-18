import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Lock,
  Check,
  Gem,
  Zap,
  ShieldBan,
  Trophy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Panel } from '../../components/Panel';
import { Skeleton } from '../../mobile/primitives/Skeleton';
import { useFlash } from '../../hooks/useFlash';
import { useT } from '../../lib/i18n';
import { api, type BattlePassResponse, type BattlePassTierView } from '../../lib/api';
import { RARITY, resolveRarity } from '../../lib/rarity';

const BLUE = '#38bdf8';

/** Icône de chaque consommable (mêmes accents que la boutique). */
const CONSUMABLE_ICON: Record<string, LucideIcon> = {
  anti_ops: ShieldBan,
  elo_mult: Zap,
  force_duel: Sparkles,
  mini_ops: ShieldBan,
};

/** Métadonnées d'affichage de la récompense d'un palier (icône + libellé + couleur). */
function rewardView(tier: BattlePassTierView, t: (k: string) => string) {
  if (tier.rewardKind === 'item' && tier.item) {
    const rk = RARITY[resolveRarity(tier.item)];
    return {
      hex: rk.hex,
      name: tier.item.name,
      icon: <Gem className="w-5 h-5" strokeWidth={2.4} style={{ color: rk.hex }} />,
    };
  }
  if (tier.rewardKind === 'coins') {
    return {
      hex: '#ffc94a',
      name: `${tier.coins ?? 0}`,
      icon: <img src="/42coin.webp" alt="" className="w-5 h-5" />,
    };
  }
  if (tier.rewardKind === 'consumable' && tier.consumableKind) {
    const Icon = CONSUMABLE_ICON[tier.consumableKind] ?? Zap;
    return {
      hex: '#5eead4',
      name: t(`battlepass.consumable.${tier.consumableKind}`),
      icon: <Icon className="w-5 h-5 text-teal-300" strokeWidth={2.2} />,
    };
  }
  return {
    hex: '#6b6453',
    name: t('battlepass.reward.none'),
    icon: <Gem className="w-5 h-5 text-muted/50" strokeWidth={2} />,
  };
}

/**
 * Une colonne de la frise (= un palier) : récompense en haut, nœud sur le rail
 * au centre, XP requise + état en bas. Le rail est rempli en bleu jusqu'au
 * niveau courant (segment de ligne par colonne, jointif entre voisins).
 */
function TierColumn({
  tier,
  t,
  isCurrent,
  colRef,
}: {
  tier: BattlePassTierView;
  t: (k: string) => string;
  isCurrent: boolean;
  colRef?: (el: HTMLDivElement | null) => void;
}) {
  const claimed = !!tier.claimedAt;
  const unlocked = tier.unlocked;
  const rw = rewardView(tier, t);

  return (
    <div ref={colRef} className="relative shrink-0 w-[120px] snap-center flex flex-col items-center pt-1">
      {/* Récompense (au-dessus du rail) */}
      <div className="w-full px-1.5">
        <div
          className={`rounded-xl border p-2.5 flex flex-col items-center gap-1.5 text-center min-h-[92px] justify-center transition-all ${
            unlocked ? '' : 'opacity-55'
          }`}
          style={{
            borderColor: `${rw.hex}55`,
            background: `${rw.hex}14`,
            boxShadow: unlocked ? `0 0 16px -6px ${rw.hex}` : 'none',
          }}
        >
          <span
            className="w-10 h-10 rounded-lg flex items-center justify-center border"
            style={{ borderColor: `${rw.hex}55`, background: `${rw.hex}1f` }}
          >
            {rw.icon}
          </span>
          <span className="text-[10.5px] font-bold text-text-strong leading-tight line-clamp-2">
            {rw.name}
          </span>
        </div>
      </div>

      {/* Rail + nœud */}
      <div className="relative w-full h-12 flex items-center justify-center my-0.5">
        {/* Segment de ligne (jointif d'une colonne à l'autre) */}
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px]"
          style={{ background: unlocked ? BLUE : 'rgba(125,115,95,0.22)' }}
        />
        {/* Halo pulsé sur le palier courant */}
        {isCurrent && (
          <motion.span
            className="absolute z-0 w-9 h-9 rounded-full border-2"
            style={{ borderColor: BLUE }}
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        {/* Nœud */}
        <span
          className="relative z-10 inline-flex items-center justify-center w-9 h-9 rounded-full border-2 font-display text-sm font-extrabold tabular-nums"
          style={
            unlocked
              ? {
                  borderColor: BLUE,
                  background: 'rgba(56,189,248,0.18)',
                  color: '#bae6fd',
                  boxShadow: '0 0 14px rgba(56,189,248,0.55)',
                }
              : {
                  borderColor: 'rgba(125,115,95,0.4)',
                  background: 'rgba(20,18,14,0.85)',
                  color: '#a89880',
                }
          }
        >
          {claimed ? <Check className="w-4 h-4" strokeWidth={3} /> : tier.tier}
        </span>
      </div>

      {/* XP requise + état */}
      <div className="flex flex-col items-center gap-1 pb-1">
        <span className="font-gaming text-[10px] text-muted-2 tabular-nums">
          {tier.xpRequired} <span className="text-[#7dd3fc]/70">{t('battlepass.xp')}</span>
        </span>
        {claimed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wide bg-gold/15 border border-gold/40 text-gold">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
            {t('battlepass.claimed')}
          </span>
        ) : unlocked ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wide bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
            {t('battlepass.unlocked')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wide bg-bg-1/80 border border-border/60 text-muted-2">
            <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
            {t('battlepass.locked')}
          </span>
        )}
      </div>
    </div>
  );
}

export function PassePage() {
  const t = useT();
  const { show } = useFlash();
  const [data, setData] = useState<BattlePassResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.battlePass();
      setData(res);
    } catch (err) {
      show(err instanceof Error ? err.message : t('battlepass.title'), 'error');
    } finally {
      setLoading(false);
    }
  }, [show, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-centrage de la frise sur le palier courant une fois les données prêtes.
  useEffect(() => {
    const sc = scrollerRef.current;
    const nd = currentRef.current;
    if (!loading && sc && nd) {
      const target = nd.offsetLeft - sc.clientWidth / 2 + nd.offsetWidth / 2;
      sc.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
  }, [loading, data]);

  // Progression dans le niveau courant (0..1), clampée.
  const pct =
    data && data.xpForNextLevel > 0
      ? Math.min(1, Math.max(0, data.xpIntoLevel / data.xpForNextLevel))
      : 0;

  return (
    <div className="space-y-5">
      {/* ── En-tête : barre d'XP ────────────────────────────────────────── */}
      <Panel title={t('battlepass.title')}>
        <div className="relative overflow-hidden rounded-2xl p-5 border border-gold/30 bg-gradient-to-br from-violet-500/20 via-bg-2 to-bg-1">
          <div className="absolute inset-0 hud-diag pointer-events-none opacity-30" />
          <div className="absolute -left-8 -top-10 w-40 h-40 rounded-full bg-gold/18 blur-3xl pointer-events-none" />
          <div className="absolute right-0 -bottom-12 w-44 h-44 rounded-full bg-violet-500/18 blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-4">
            {/* Médaillon niveau */}
            <div className="relative shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/35 to-violet-500/15 border border-gold/45 flex flex-col items-center justify-center shadow-gold-glow overflow-hidden">
              <Crown className="w-5 h-5 text-gold drop-shadow" strokeWidth={2.2} />
              <span className="font-display text-xl font-extrabold text-text-strong tabular-nums leading-none">
                {loading ? '–' : data?.level ?? 1}
              </span>
              <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-white/20 blur-md animate-gold-sweep pointer-events-none" />
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-2">
                  {t('battlepass.level')} {loading ? '' : data?.level ?? 1}
                </div>
                {!loading && data && (
                  <div className="text-[11px] font-bold text-muted-2 tabular-nums">
                    <span className="text-[#7dd3fc]">{data.xpIntoLevel}</span> / {data.xpForNextLevel}{' '}
                    <span className="uppercase tracking-wide text-[#7dd3fc]/70">{t('battlepass.xp')}</span>
                  </div>
                )}
              </div>

              {/* Barre de progression bleu clair */}
              <div className="mt-2 h-3 w-full rounded-full bg-bg-1/80 border border-[#7dd3fc]/20 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #38bdf8 0%, #7dd3fc 55%, #bae6fd 100%)',
                    boxShadow: '0 0 12px rgba(56,189,248,0.55)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>

              {!loading && data && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-2 font-medium">
                  <Trophy className="w-3 h-3 text-gold/70" strokeWidth={2.4} />
                  <span className="tabular-nums">{data.totalXp}</span>
                  <span className="uppercase tracking-wide text-[10px]">{t('battlepass.xp')}</span>
                  <span className="opacity-60">·</span>
                  <span>{t('battlepass.xpToNext')}: </span>
                  <span className="tabular-nums text-text">
                    {Math.max(0, data.xpForNextLevel - data.xpIntoLevel)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Frise des paliers (scroll horizontal, façon passe de combat) ──── */}
      {loading ? (
        <div className="card-hud rounded-2xl p-3 overflow-hidden">
          <div className="flex gap-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] px-1.5">
                <Skeleton className="h-[92px] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : !data || data.tiers.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-bg-2/50 p-10 text-center">
          <Sparkles className="w-7 h-7 text-muted/50 mx-auto mb-3" strokeWidth={1.8} />
          <p className="text-sm text-muted-2 font-medium">{t('battlepass.empty')}</p>
        </div>
      ) : (
        <div className="card-hud rounded-2xl p-3 pt-2">
          <div className="relative">
            {/* Fondus + indicateurs de défilement sur les bords */}
            <div className="pointer-events-none absolute left-0 inset-y-0 w-10 z-10 bg-gradient-to-r from-bg-1 to-transparent flex items-center">
              <ChevronLeft className="w-5 h-5 text-muted-2/70" strokeWidth={2.5} />
            </div>
            <div className="pointer-events-none absolute right-0 inset-y-0 w-10 z-10 bg-gradient-to-l from-bg-1 to-transparent flex items-center justify-end">
              <ChevronRight className="w-5 h-5 text-muted-2/70" strokeWidth={2.5} />
            </div>

            <div
              ref={scrollerRef}
              className="relative overflow-x-auto overflow-y-hidden snap-x scroll-px-6 px-1 pb-1"
            >
              <div className="flex min-w-max">
                {data.tiers.map((tier) => {
                  const isCurrent = tier.tier === data.level;
                  return (
                    <TierColumn
                      key={tier.tier}
                      tier={tier}
                      t={t}
                      isCurrent={isCurrent}
                      colRef={isCurrent ? (el) => (currentRef.current = el) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
