<<<<<<< Updated upstream
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { ShieldBan, Zap, Swords, Loader2, Check, X, type LucideProps } from 'lucide-react';
=======
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ShieldBan, Flame, Loader2, Check, type LucideProps } from 'lucide-react';
>>>>>>> Stashed changes
import { api, type ConsumablesResponse, type ConsumableKind, type ConsumableState } from '../../lib/api';
import { useFlash } from '../../hooks/useFlash';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useEloBoostRemaining } from '../../components/EloBoost';
import { SectionHeader } from './shared/SectionHeader';

/**
 * Inventaire des consommables du joueur (profil). Affiche le stock, le cap mensuel
 * et un bouton « utiliser » par type, avec gestion du cooldown (anti-OPS) et de
 * l'état « armé » (multiplicateur d'ELO). La « Main du Destin » (force_duel) ouvre
 * un sélecteur de deux joueurs à opposer plutôt qu'un effet immédiat.
 */
const META: Record<ConsumableKind, { label: string; desc: string; Icon: ComponentType<LucideProps>; color: string }> = {
  anti_ops: {
    label: 'Anti-OPS',
    desc: "Annule l'OPS qui te vise. 2 sem. de cooldown entre deux usages.",
    Icon: ShieldBan,
    color: '#2dd4bf',
  },
  elo_mult: {
    label: 'ELO ×2 — EN FEU',
    desc: 'À utiliser quand tu es en feu : 6 h où chaque score compte double (gain ×2, perte ×2). 1 activation / semaine.',
    Icon: Flame,
    color: '#ff7a18',
  },
  force_duel: {
    label: 'Main du Destin',
    desc: 'Désigne deux joueurs et force-les à un duel babyfoot inéluctable.',
    Icon: Swords,
    color: '#b07bff',
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
  const { refresh, leaderboard, me } = useLeagueData();
  const [data, setData] = useState<ConsumablesResponse | null>(null);
  const [busy, setBusy] = useState<ConsumableKind | null>(null);
<<<<<<< Updated upstream
  // Sélecteur « Main du Destin » : null = fermé, sinon les deux logins en cours.
  const [duelPicker, setDuelPicker] = useState<{ p1: string; p2: string } | null>(null);

  const myLogin = me?.login ?? null;
  const others = useMemo(
    () => leaderboard.filter((u) => u.login !== myLogin),
    [leaderboard, myLogin],
  );
=======
  // Fenêtre de boost « EN FEU » en cours (décompte vivant) pour le multiplicateur d'ELO.
  const boost = useEloBoostRemaining(data?.eloMultUntil ?? null);
>>>>>>> Stashed changes

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
        show(kind === 'anti_ops' ? 'OPS annulé !' : 'Tu es EN FEU ! ELO ×2 pendant 6 h.');
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

  const launchDuel = useCallback(async () => {
    if (!duelPicker) return;
    const { p1, p2 } = duelPicker;
    if (!p1 || !p2 || p1 === p2) {
      show('Choisis deux joueurs différents.', 'error');
      return;
    }
    setBusy('force_duel');
    try {
      await api.useConsumable('force_duel', { player1: p1, player2: p2 });
      show(`Le destin a parlé : @${p1} vs @${p2} en babyfoot.`);
      setDuelPicker(null);
      await load();
      void refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : 'Action impossible', 'error');
    } finally {
      setBusy(null);
    }
  }, [duelPicker, show, load, refresh]);

  if (!data) return null;

  return (
    <section>
      <SectionHeader title="Inventaire" />
      <div className="space-y-2.5">
        {data.items.map((c) => {
          const meta = META[c.kind];
          const Icon = meta.Icon;
          const left = cooldownLeft(c);
          const isElo = c.kind === 'elo_mult';
          const boosted = isElo && boost.active;
          const weekTaken = isElo && data.eloMultWeekTaken;
          const empty = c.quantity < 1;
          const disabled = busy === c.kind || empty || left > 0 || boosted || weekTaken;
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
                  <span style={{ color: meta.color }} className="font-bold">
                    {Math.max(0, c.monthlyCap - c.monthlyUsed)}/{c.monthlyCap}
                  </span>{' '}
                  par mois
                  {boosted && <span className="ml-2 font-bold tabular-nums" style={{ color: meta.color }}>· EN FEU {boost.hms}</span>}
                  {!boosted && weekTaken && <span className="ml-2 text-muted font-bold">· activé cette semaine</span>}
                  {left > 0 && <span className="ml-2 text-red font-bold">· cooldown {fmtLeft(left)}</span>}
                </div>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  c.kind === 'force_duel' ? setDuelPicker({ p1: '', p2: '' }) : void use(c.kind)
                }
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all disabled:opacity-40 ${
                  disabled ? 'bg-bg-1 border border-border/60 text-muted' : 'text-bg-0'
                }`}
                style={disabled ? undefined : { background: meta.color }}
              >
                {busy === c.kind ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                ) : boosted ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : null}
                {boosted ? 'En feu' : weekTaken ? 'Cette semaine' : 'Utiliser'}
              </button>
            </div>
          );
        })}
      </div>

      {duelPicker && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => busy !== 'force_duel' && setDuelPicker(null)}
        >
          <div
            className="w-full max-w-sm card-hud rounded-2xl p-5"
            style={{ borderColor: `${META.force_duel.color}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Swords className="w-5 h-5" style={{ color: META.force_duel.color }} strokeWidth={2.2} />
              <h3 className="font-gaming text-base font-extrabold text-text-strong flex-1">Main du Destin</h3>
              <button
                type="button"
                onClick={() => setDuelPicker(null)}
                disabled={busy === 'force_duel'}
                className="text-muted hover:text-text-strong disabled:opacity-40"
              >
                <X className="w-5 h-5" strokeWidth={2.4} />
              </button>
            </div>
            <p className="text-[11px] text-muted-2 leading-snug mb-4">
              Désigne deux joueurs : un duel babyfoot inéluctable apparaîtra dans leurs défis. Ils ne pourront pas le refuser.
            </p>
            <div className="space-y-3">
              {(['p1', 'p2'] as const).map((slot, i) => (
                <label key={slot} className="block">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
                    Joueur {i + 1}
                  </span>
                  <select
                    value={duelPicker[slot]}
                    onChange={(e) => setDuelPicker((d) => (d ? { ...d, [slot]: e.target.value } : d))}
                    className="mt-1 w-full rounded-lg bg-bg-1 border border-border/70 px-3 py-2 text-sm text-text-strong focus:outline-none focus:border-[--c]"
                    style={{ ['--c' as string]: META.force_duel.color }}
                  >
                    <option value="">— choisir —</option>
                    {others.map((u) => (
                      <option key={u.login} value={u.login} disabled={u.login === duelPicker[slot === 'p1' ? 'p2' : 'p1']}>
                        {u.login}
                        {u.firstName ? ` (${u.firstName})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void launchDuel()}
              disabled={busy === 'force_duel' || !duelPicker.p1 || !duelPicker.p2 || duelPicker.p1 === duelPicker.p2}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-extrabold uppercase tracking-wide text-bg-0 transition-all disabled:opacity-40"
              style={{ background: META.force_duel.color }}
            >
              {busy === 'force_duel' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
              ) : (
                <Swords className="w-4 h-4" strokeWidth={2.4} />
              )}
              Sceller le duel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
