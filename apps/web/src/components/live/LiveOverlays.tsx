import { useEffect, useRef, useState } from 'react';
import { CoinFlipOverlay } from '../tournois/CoinFlipOverlay';
import { VersusOverlay, type VersusFighter } from '../tournois/VersusOverlay';
import { VictoryOverlay } from '../tournois/VictoryOverlay';
import { useT } from '../../lib/i18n';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap } from '../../lib/liveTournament';

// Cinématiques de l'écran TV pilotées par le diff SSE : quand l'admin lance le
// pile-ou-face (tossAt) ou désigne le match suivant (activeMatchId) depuis la page de
// contrôle, l'écran live rejoue l'animation correspondante. La TV ne reçoit que le
// RÉSULTAT du toss → on simule la rotation (~1.8 s) puis on révèle le gagnant.

const GAME_ACCENT: Record<string, string> = {
  babyfoot: '#ffc94a',
  smash: '#ff4d5c',
  chess: '#56c46e',
  streetfighter: '#ff7a18',
  flechettes: '#14b8a6',
};

interface TossState {
  matchId: string;
  side: 'heads' | 'tails' | null;
  winnerLogin: string;
  winnerImageUrl: string | null;
  flipping: boolean;
}

export function LiveOverlays({ data }: { data: LiveTournament }) {
  const t = useT();
  const accent = GAME_ACCENT[data.game ?? 'babyfoot'] ?? '#ffc94a';
  const avatars = avatarMap(data.entries ?? []);

  // ── Détection des transitions ───────────────────────────────────────────────
  const initedRef = useRef(false);
  const prevActiveRef = useRef<string | null>(null);
  const prevStatusRef = useRef<LiveTournament['status'] | null>(null);
  const prevTossRef = useRef<Map<string, string>>(new Map()); // matchId → tossAt

  const [versus, setVersus] = useState<{ a: VersusFighter | null; b: VersusFighter | null } | null>(null);
  const [toss, setToss] = useState<TossState | null>(null);
  const [victory, setVictory] = useState(false);

  useEffect(() => {
    const matches = data.matches ?? [];
    const tossNow = new Map<string, string>();
    for (const m of matches) if (m.tossAt) tossNow.set(m.id, m.tossAt);

    // 1er passage : on enregistre l'état courant sans rejouer d'animation passée.
    if (!initedRef.current) {
      initedRef.current = true;
      prevActiveRef.current = data.activeMatchId ?? null;
      prevStatusRef.current = data.status;
      prevTossRef.current = tossNow;
      return;
    }

    // Fin du tournoi : célébration du champion (une fois, en live).
    if (prevStatusRef.current === 'in_progress' && data.status === 'finished' && data.winner) {
      setVictory(true);
    }
    prevStatusRef.current = data.status;

    // Nouveau pile-ou-face : un match dont le tossAt vient d'apparaître/changer.
    let freshToss: TournamentMatch | null = null;
    for (const m of matches) {
      if (!m.tossAt || !m.tossWinnerLogin) continue;
      if (prevTossRef.current.get(m.id) !== m.tossAt) freshToss = m;
    }
    prevTossRef.current = tossNow;
    if (freshToss && freshToss.tossWinnerLogin) {
      setToss({
        matchId: freshToss.id,
        side: freshToss.tossSide ?? null,
        winnerLogin: freshToss.tossWinnerLogin,
        winnerImageUrl: avatars.get(freshToss.tossWinnerLogin) ?? null,
        flipping: true,
      });
    }

    // Match suivant désigné : activeMatchId change vers un nouveau match.
    const nextActive = data.activeMatchId ?? null;
    if (nextActive && nextActive !== prevActiveRef.current) {
      const m = matches.find((x) => x.id === nextActive);
      if (m) {
        setVersus({
          a: m.playerALogin ? { login: m.playerALogin, imageUrl: avatars.get(m.playerALogin) ?? null } : null,
          b: m.playerBLogin ? { login: m.playerBLogin, imageUrl: avatars.get(m.playerBLogin) ?? null } : null,
        });
      }
    }
    prevActiveRef.current = nextActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Déroulé du pile-ou-face : rotation puis révélation puis fermeture.
  useEffect(() => {
    if (!toss || !toss.flipping) return;
    const reveal = setTimeout(() => setToss((s) => (s ? { ...s, flipping: false } : null)), 1800);
    const close = setTimeout(() => setToss(null), 4600);
    return () => {
      clearTimeout(reveal);
      clearTimeout(close);
    };
  }, [toss]);

  return (
    <>
      <VersusOverlay
        open={!!versus}
        a={versus?.a ?? null}
        b={versus?.b ?? null}
        accent={accent}
        onDone={() => setVersus(null)}
        t={t}
      />
      <CoinFlipOverlay
        open={!!toss}
        side={toss?.side ?? null}
        flipping={toss?.flipping ?? false}
        winnerName={toss && !toss.flipping ? toss.winnerLogin : undefined}
        winnerLogin={toss && !toss.flipping ? toss.winnerLogin : undefined}
        winnerImageUrl={toss?.winnerImageUrl ?? null}
        t={t}
      />
      <VictoryOverlay
        open={victory}
        champion={data.winner ?? null}
        tournamentName={data.name}
        accent={accent}
        onDone={() => setVictory(false)}
        t={t}
      />
    </>
  );
}
