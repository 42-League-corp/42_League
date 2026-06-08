import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ShieldBan, Zap, Loader2, Check, type LucideProps } from 'lucide-react';
import { api, type ConsumablesResponse, type ConsumableKind, type ConsumableState } from '../../lib/api';
import { useFlash } from '../../hooks/useFlash';
import { useLeagueData } from '../../hooks/useLeagueData';
import { SectionHeader } from './shared/SectionHeader';

/**
 * Inventaire des consommables du joueur (profil). Affiche le stock, le cap mensuel
 * et un bouton « utiliser » par type, avec gestion du cooldown (anti-OPS) et de
 * l'état « armé » (multiplicateur d'ELO).
 */
const META: Record<ConsumableKind, { label: string; desc: string; Icon: ComponentType<LucideProps>; color: string }> = {
  anti_ops: {
    label: 'Anti-OPS',
    desc: "Annule l'OPS qui te vise. 2 sem. de cooldown entre deux usages.",
    Icon: ShieldBan,
    color: '#2dd4bf',
  },
  elo_mult: {
    label: "Multiplicateur d'ELO",
    desc: 'Ton prochain score validé compte double : gain ×2… et perte ×2 aussi.',
    Icon: Zap,
    color: '#fbbf24',
  },
};

const COOLDOWN_MS: Partial<Record<ConsumableKind, number>> = {
  anti_ops: 14 * 24 * 60 * 60 * 1000,
};

function cooldownLeft(c: ConsumableState): number {
  const cd = COOLDOWN_MS[c.kind];
  if (!cd || !c.lastUsedAt) return 0;
  return Math.max(0, new Date(c.lastUsedAt).getTime() + cd - Date.now());
}

function fmtLeft(ms: number): string {
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days >= 2) return `${days} j`;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `${hours} h`;
}

export function InventoryPanel() {
  const { show } = useFlash();
  const { refresh } = useLeagueData();
  const [data, setData] = useState<ConsumablesResponse | null>(null);
  const [busy, setBusy] = useState<ConsumableKind | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.consumables());
    } catch {
      /* silencieux : l'inventaire n'est pas critique */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const use = useCallback(
    async (kind: ConsumableKind) => {
      setBusy(kind);
      try {
        await api.useConsumable(kind);
        show(kind === 'anti_ops' ? 'OPS annulé !' : 'Multiplicateur armé pour ton prochain score.');
        await load();
        void refresh();
      } catch (err) {
        show(err instanceof Error ? err.message : 'Action impossible', 'error');
      } finally {
        setBusy(null);
      }
    },
    [show, load, refresh],
  );

  if (!data) return null;

  return (
    <section>
      <SectionHeader title="Inventaire" />
      <div className="space-y-2.5">
        {data.items.map((c) => {
          const meta = META[c.kind];
          const Icon = meta.Icon;
          const left = cooldownLeft(c);
          const armed = c.kind === 'elo_mult' && data.eloMultArmed;
          const empty = c.quantity < 1;
          const disabled = busy === c.kind || empty || left > 0 || armed;
          return (
            <div
              key={c.kind}
              className="relative card-hud rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ borderColor: `${meta.color}33` }}
            >
              <div
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border"
                style={{ color: meta.color, background: `${meta.color}14`, borderColor: `${meta.color}40` }}
              >
                <Icon className="w-6 h-6" strokeWidth={2.1} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-gaming text-sm font-extrabold text-text-strong truncate">{meta.label}</span>
                  <span
                    className="shrink-0 font-mono text-[11px] font-extrabold tabular-nums px-1.5 py-0.5 rounded-md"
                    style={{ color: meta.color, background: `${meta.color}1a` }}
                  >
                    ×{c.quantity}
                  </span>
                </div>
                <p className="text-[11px] text-muted-2 leading-snug mt-0.5 line-clamp-2">{meta.desc}</p>
                <div className="text-[10px] text-muted mt-0.5 font-medium tabular-nums">
                  {c.monthlyUsed}/{c.monthlyCap} achetés ce mois
                  {armed && <span className="ml-2 text-gold font-bold">· armé</span>}
                  {left > 0 && <span className="ml-2 text-red font-bold">· cooldown {fmtLeft(left)}</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void use(c.kind)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all disabled:opacity-40 ${
                  disabled ? 'bg-bg-1 border border-border/60 text-muted' : 'text-bg-0'
                }`}
                style={disabled ? undefined : { background: meta.color }}
              >
                {busy === c.kind ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                ) : armed ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : null}
                {armed ? 'Armé' : 'Utiliser'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
