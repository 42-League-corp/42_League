import { useState } from 'react';
import { api, type Game } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';

const GAMES: { id: Game; name: string }[] = [
  { id: 'babyfoot', name: 'Babyfoot' },
  { id: 'smash', name: 'Smash Bros' },
];

/**
 * Réglage « modes de jeu » : ajouter / retirer les disciplines auxquelles on
 * adhère. On ne peut pas tout retirer (au moins un mode actif).
 */
export function GameModesSettings() {
  const { me, refresh } = useLeagueData();
  const flash = useFlash();
  const current = new Set<Game>((me?.user?.games as Game[] | undefined) ?? ['babyfoot']);
  const [busy, setBusy] = useState<Game | null>(null);

  const apply = async (next: Game[]) => {
    if (next.length === 0) {
      flash.show('Au moins un mode doit rester actif', 'error');
      return;
    }
    try {
      await api.setGames(next);
      await refresh();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const toggle = async (g: Game) => {
    const next = new Set(current);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setBusy(g);
    await apply([...next]);
    setBusy(null);
  };

  return (
    <div className="border-t border-gold/20 pt-5">
      <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-1 flex items-center gap-2">
        <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
        Modes de jeu
      </div>
      <p className="text-[11px] text-muted-2 mb-3">
        Tu apparais dans les classements et stats des modes activés.
      </p>
      <div className="flex flex-col gap-2">
        {GAMES.map((g) => {
          const active = current.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              disabled={busy === g.id}
              onClick={() => toggle(g.id)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all disabled:opacity-50 ${
                active
                  ? g.id === 'smash'
                    ? 'border-red bg-red/10 text-red'
                    : 'border-gold bg-gold/10 text-gold'
                  : 'border-border bg-bg-2/40 text-muted-2'
              }`}
            >
              <span className="text-sm font-extrabold uppercase tracking-wide">{g.name}</span>
              <span
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  active ? (g.id === 'smash' ? 'bg-red/70' : 'bg-gold/70') : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    active ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
