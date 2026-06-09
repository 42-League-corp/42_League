import { useEffect, useRef, useState } from 'react';
import { CoinFlipOverlay } from '../tournois/CoinFlipOverlay';
import { VersusOverlay, type VersusFighter } from '../tournois/VersusOverlay';
import { VictoryOverlay } from '../tournois/VictoryOverlay';
import { useT } from '../../lib/i18n';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, partnerOf } from '../../lib/liveTournament';

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
  const prevTossRef = useRef<Map<string, string>>(new Map()); // matchId → tossAt

  const [versus, setVersus] = useState<{ a: VersusFighter | null; b: VersusFighter | null } | null>(null);
  const [toss, setToss] = useState<TossState | null>(null);

  // Célébration du champion : RESTE affichée tant que le tournoi est « terminé »
  // (jusqu'à ce que l'admin le clôture depuis son panneau → le statut change).
  const championLogin = data.winner?.login ?? null;
  const showVictory = data.status === 'finished' && !!championLogin;
  const partnerLogin = championLogin ? partnerOf(championLogin, data.entries ?? []) : null;

  useEffect(() => {
    const matches = data.matches ?? [];
    const tossNow = new Map<string, string>();
    for (const m of matches) if (m.tossAt) tossNow.set(m.id, m.tossAt);

    // 1er passage : on enregistre l'état courant sans rejouer d'animation passée.
    if (!initedRef.current) {
      initedRef.current = true;
      prevActiveRef.current = data.activeMatchId ?? null;
      prevTossRef.current = tossNow;
      return;
    }

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

  // Déroulé du pile-ou-face : rotation (~1,8 s) → révélation du gagnant → fermeture
  // (~4,6 s). Pilotage AUTO-RÉPARANT : au lieu de deux setTimeout fragiles (qui restent
  // « bloqués » si l'onglet est ralenti en arrière-plan ou perd le focus), on mémorise
  // l'instant d'ouverture et on RE-ÉVALUE l'état à chaque tick d'un intervalle court +
  // au retour au premier plan. Même si un tick saute, le suivant rattrape → l'overlay
  // ne reste JAMAIS figé sur « X gagne le tirage ».
  const tossOpenedAtRef = useRef<number | null>(null);
  const tossMatchId = toss?.matchId ?? null;
  useEffect(() => {
    if (!tossMatchId) {
      tossOpenedAtRef.current = null;
      return;
    }
    if (tossOpenedAtRef.current == null) tossOpenedAtRef.current = Date.now();

    const tick = () => {
      const started = tossOpenedAtRef.current;
      if (started == null) return;
      const elapsed = Date.now() - started;
      if (elapsed >= 4600) {
        setToss(null);
      } else if (elapsed >= 1800) {
        setToss((s) => (s && s.flipping ? { ...s, flipping: false } : s));
      }
    };

    const id = setInterval(tick, 200);
    // Rattrapage immédiat au retour au premier plan (focus / onglet visible) : si le
    // navigateur a gelé l'intervalle, on referme tout de suite ce qui doit l'être.
    const onWake = () => tick();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    tick();

    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [tossMatchId]);

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
        open={showVictory}
        champion={data.winner ?? null}
        partner={
          partnerLogin
            ? { login: partnerLogin, imageUrl: avatars.get(partnerLogin) ?? null }
            : null
        }
        tournamentName={data.name}
        accent={accent}
        persist
        onDone={() => {}}
        t={t}
      />
    </>
  );
}
