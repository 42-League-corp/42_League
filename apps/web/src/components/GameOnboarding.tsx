import { useState } from 'react';
import { Check } from 'lucide-react';
import { api, type Game } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { setGame as setActiveGame } from '../lib/gameMode';
import { TournamentCup } from './TournamentCup';
import { SmashTrophy } from './SmashTrophy';
import { ChessTrophy } from './ChessTrophy';
import { Button } from './Button';

const GAMES: { id: Game; name: string; tagline: string }[] = [
  { id: 'babyfoot', name: 'Babyfoot', tagline: '1 contre 1 · 10 buts · gamelles' },
  { id: 'smash', name: 'Smash Bros', tagline: '1 contre 1 · Bo3/Bo5 · stocks' },
  { id: 'chess', name: 'Échecs', tagline: '1 contre 1 · victoire / défaite' },
  { id: 'streetfighter', name: 'Street Fighter', tagline: '1 contre 1 · Bo3/Bo5 · persos' },
];

function GameTrophy({ game, accent, className }: { game: Game; accent: string; className?: string }) {
  if (game === 'smash' || game === 'streetfighter') return <SmashTrophy accent={accent} className={className} />;
  if (game === 'chess') return <ChessTrophy accent={accent} className={className} />;
  return <TournamentCup accent={accent} className={className} />;
}

const ACCENT: Record<Game, string> = { babyfoot: '#ffc94a', smash: '#ff4d5c', chess: '#56c46e', streetfighter: '#ff7a18' };

/**
 * Onboarding au 1er login : choix des modes de jeu auxquels on adhère. On
 * n'apparaît dans les classements/stats que des modes choisis. Affiché tant que
 * `onboardedAt` est nul.
 */
export function GameOnboarding() {
  const { me, refresh } = useLeagueData();
  const flash = useFlash();
  const [sel, setSel] = useState<Set<Game>>(new Set<Game>(['babyfoot']));
  const [busy, setBusy] = useState(false);

  // Affiché uniquement si le compte existe et n'a pas encore choisi ses modes.
  if (!me?.user || me.user.onboardedAt) return null;

  const toggle = (g: Game) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const submit = async () => {
    const games = [...sel];
    if (games.length === 0) {
      flash.show('Choisis au moins un mode', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.setGames(games);
      // Bascule sur le 1er mode choisi (ordre babyfoot → smash → échecs).
      const order: Game[] = ['babyfoot', 'smash', 'chess', 'streetfighter'];
      const first = order.find((g) => sel.has(g));
      if (first) setActiveGame(first);
      await refresh();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-bg-1 p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="font-display text-2xl font-black text-text-strong">Bienvenue dans la League</div>
          <p className="text-sm text-muted-2 mt-1">
            À quels modes veux-tu participer ? Tu n'apparais dans les classements et stats que des
            modes choisis (modifiable plus tard dans les réglages).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {GAMES.map((g) => {
            const active = sel.has(g.id);
            const accent = ACCENT[g.id];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                style={active ? { borderColor: accent, background: `${accent}1a` } : undefined}
                className={`relative flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  active ? '' : 'border-border bg-bg-2/40 opacity-70 hover:opacity-100'
                }`}
              >
                <GameTrophy game={g.id} accent={accent} className="w-12 h-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-text-strong">{g.name}</div>
                  <div className="text-[11px] text-muted-2">{g.tagline}</div>
                </div>
                <span
                  className="grid place-items-center w-6 h-6 rounded-full border-2"
                  style={
                    active
                      ? { background: accent, borderColor: accent, color: '#06160c' }
                      : { borderColor: '#3a3022', color: 'transparent' }
                  }
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>

        <Button loading={busy} onClick={submit} className="w-full mt-5 py-3" disabled={sel.size === 0}>
          C'est parti
        </Button>
      </div>
    </div>
  );
}
