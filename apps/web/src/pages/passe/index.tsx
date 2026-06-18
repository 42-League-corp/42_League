import { useCallback, useEffect, useState } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { TiltCard } from '../../components/TiltCard';
import { Panel } from '../../components/Panel';
import { Skeleton } from '../../mobile/primitives/Skeleton';
import { useFlash } from '../../hooks/useFlash';
import { useT } from '../../lib/i18n';
import { api, type BattlePassResponse, type BattlePassTierView } from '../../lib/api';
import { RARITY, resolveRarity } from '../../lib/rarity';

/** Icône de chaque consommable (mêmes accents que la boutique). */
const CONSUMABLE_ICON: Record<string, LucideIcon> = {
  anti_ops: ShieldBan,
  elo_mult: Zap,
  force_duel: Sparkles,
  mini_ops: ShieldBan,
};

/** Petit montant de coins avec l'icône 42coin. */
function CoinAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <img src="/42coin.webp" alt="" className="w-4 h-4" />
      {value}
    </span>
  );
}

/** Visuel de la récompense d'un palier (item teinté rareté / coins / consommable / rien). */
function RewardVisual({ tier, t }: { tier: BattlePassTierView; t: (k: string) => string }) {
  if (tier.rewardKind === 'item' && tier.item) {
    const rarity = resolveRarity(tier.item);
    const rk = RARITY[rarity];
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center"
          style={{ borderColor: `${rk.hex}55`, background: `${rk.hex}1a` }}
        >
          <Gem className="w-4 h-4" strokeWidth={2.4} style={{ color: rk.hex }} />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: rk.hex }}>
            {rk.label}
          </span>
          <span className="block text-sm font-bold text-text-strong leading-tight truncate">
            {tier.item.name}
          </span>
        </span>
      </div>
    );
  }

  if (tier.rewardKind === 'coins') {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-8 h-8 rounded-lg border border-gold/40 bg-gold/12 flex items-center justify-center">
          <img src="/42coin.webp" alt="" className="w-4.5 h-4.5" />
        </span>
        <span>
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold/80">
            {t('battlepass.reward.coins')}
          </span>
          <CoinAmount
            value={tier.coins ?? 0}
            className="font-gaming text-base font-extrabold text-text-strong"
          />
        </span>
      </div>
    );
  }

  if (tier.rewardKind === 'consumable' && tier.consumableKind) {
    const Icon = CONSUMABLE_ICON[tier.consumableKind] ?? Zap;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 w-8 h-8 rounded-lg border border-teal-400/40 bg-teal-500/12 flex items-center justify-center">
          <Icon className="w-4 h-4 text-teal-300" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-teal-300/80">
            {t('battlepass.reward.consumable')}
          </span>
          <span className="block text-sm font-bold text-text-strong leading-tight truncate">
            {t(`battlepass.consumable.${tier.consumableKind}`)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-muted-2">
      <span className="shrink-0 w-8 h-8 rounded-lg border border-border/50 bg-bg-1/60 flex items-center justify-center">
        <Gem className="w-4 h-4 text-muted/50" strokeWidth={2} />
      </span>
      <span className="text-sm font-bold">{t('battlepass.reward.none')}</span>
    </div>
  );
}

/** Carte d'un palier — dorée/glow si débloqué, grisée si verrouillé. */
function TierCard({ tier, t }: { tier: BattlePassTierView; t: (k: string) => string }) {
  const claimed = !!tier.claimedAt;
  const unlocked = tier.unlocked;
  // Couleur d'accent : doré si débloqué, gris si verrouillé.
  const accentHex = unlocked ? '#ffc94a' : '#5a5346';

  return (
    <TiltCard
      glowHex={accentHex}
      className={`card-hud h-full overflow-hidden rounded-xl flex flex-col transition-opacity ${
        unlocked ? '' : 'opacity-60'
      }`}
      style={{ boxShadow: `0 0 0 1px ${accentHex}22, 0 6px 24px -8px ${accentHex}30` }}
    >
      {/* Liseré supérieur */}
      <div
        className="absolute top-0 inset-x-0 h-[1.5px] pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accentHex}cc, transparent)` }}
      />
      {/* Halo de fond (doré seulement si débloqué) */}
      {unlocked && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accentHex}1c 0%, transparent 70%)` }}
        />
      )}

      <div className="relative flex flex-col gap-3 p-4 h-full">
        {/* En-tête : numéro de palier + état */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border font-display text-base font-extrabold tabular-nums ${
                unlocked
                  ? 'border-gold/45 bg-gold/12 text-gold shadow-gold-glow'
                  : 'border-border/50 bg-bg-1/60 text-muted-2'
              }`}
            >
              {tier.tier}
            </span>
            <div className="min-w-0">
              <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
                {t('battlepass.tier')}
              </div>
              <div className="font-gaming text-[11px] font-bold text-muted-2 tabular-nums flex items-center gap-1">
                <span>{tier.xpRequired}</span>
                <span className="text-gold/70">{t('battlepass.xp')}</span>
              </div>
            </div>
          </div>

          {claimed ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-gold/15 border border-gold/40 text-gold">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
              {t('battlepass.claimed')}
            </span>
          ) : unlocked ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
              {t('battlepass.unlocked')}
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-bg-1/80 border border-border/60 text-muted-2">
              <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
              {t('battlepass.locked')}
            </span>
          )}
        </div>

        {/* Récompense */}
        <div className="mt-auto pt-2 border-t border-white/5">
          <RewardVisual tier={tier} t={t} />
        </div>
      </div>
    </TiltCard>
  );
}

export function PassePage() {
  const t = useT();
  const { show } = useFlash();
  const [data, setData] = useState<BattlePassResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Progression dans le niveau courant (0..1), clampée.
  const pct = data && data.xpForNextLevel > 0
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

      {/* ── Piste des paliers ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !data || data.tiers.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-bg-2/50 p-10 text-center">
          <Sparkles className="w-7 h-7 text-muted/50 mx-auto mb-3" strokeWidth={1.8} />
          <p className="text-sm text-muted-2 font-medium">{t('battlepass.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {data.tiers.map((tier, idx) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(idx, 12) * 0.03 }}
            >
              <TierCard tier={tier} t={t} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
