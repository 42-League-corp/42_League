import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type LiveTournament } from '../lib/api';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/Spinner';
import { useServerEvents } from '../hooks/useServerEvents';
import { reportError } from '../lib/reportError';
import { computeStandings, type Standing } from '../lib/tournamentStandings';
import {
  bracketRounds,
  teamEloMap,
  matchesOfStage,
  phaseInfo,
  pickCurrentTournament,
  pickFeaturedMatch,
  recentResults,
  tightMatches,
  upcomingDuels,
} from '../lib/liveTournament';
import { LiveHeader } from '../components/live/LiveHeader';
import { EnjeuxPanel } from '../components/live/EnjeuxPanel';
import { FeaturedMatch } from '../components/live/FeaturedMatch';
import { RecentResults } from '../components/live/RecentResults';
import { LiveBracket } from '../components/live/LiveBracket';
import { UpcomingDuels } from '../components/live/UpcomingDuels';
import { HypePanel } from '../components/live/HypePanel';
import { LiveDock } from '../components/live/LiveDock';
import { BetsTicker } from '../components/live/BetsTicker';
import { LiveOverlays } from '../components/live/LiveOverlays';

// ─────────────────────────────────────────────────────────────────────────────
// Écran TV plein écran de suivi live d'un tournoi. Sans scroll, tout doit tenir.
// Détecte le tournoi en cours (ou prend l'id d'URL), s'abonne au SSE pour refléter
// toute action admin en temps réel, et conserve la dernière donnée valide en cas de
// coupure réseau (chip discret + remontée Discord), sans jamais afficher de gros bug.
// ─────────────────────────────────────────────────────────────────────────────

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function LiveTournamentPage() {
  const { id } = useParams<{ id?: string }>();
  const [data, setData] = useState<LiveTournament | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stale, setStale] = useState(false);
  const dataRef = useRef<LiveTournament | null>(null);

  const load = useCallback(async () => {
    try {
      let targetId = id ?? null;
      if (!targetId) {
        const list = await api.tournaments('babyfoot');
        targetId = pickCurrentTournament(list)?.id ?? null;
      }
      if (!targetId) {
        if (!dataRef.current) setStatus('empty');
        return;
      }
      const live = await api.tournamentLive(targetId);
      dataRef.current = live;
      setData(live);
      setStatus('ready');
      setStale(false);
    } catch (err) {
      // On garde l'écran sur la dernière donnée valide ; sinon on signale l'échec.
      reportError(err, 'live-tournament:load');
      if (dataRef.current) setStale(true);
      else setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Temps réel : toute mutation tournoi/classement/panneau rafraîchit l'écran.
  useServerEvents(() => void load(), ['tournament:update', 'leaderboard:update', 'panel:update'], {
    debounceMs: 250,
  });

  // Filet de sécurité : refetch lent même si un event SSE est manqué.
  useEffect(() => {
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  // Rattrapage au retour au premier plan : si l'écran TV était en arrière-plan / sans
  // focus (timers ralentis, SSE éventuellement gelé), on recharge immédiatement dès
  // qu'il redevient visible ou reprend le focus — plus besoin de cliquer pour rafraîchir.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  if (status === 'loading') return <FullScreen><Spinner size="md" /></FullScreen>;
  if (status === 'empty')
    return (
      <FullScreen>
        <div className="text-center">
          <div className="text-[6vh] mb-[1vh]">🏆</div>
          <div className="text-[3vh] font-display font-bold text-text-strong">Aucun tournoi en cours</div>
          <div className="text-[1.8vh] text-muted-2 mt-[1vh]">L'écran se mettra à jour dès qu'un tournoi démarre.</div>
        </div>
      </FullScreen>
    );
  if (status === 'error' || !data)
    return (
      <FullScreen>
        <div className="text-center">
          <div className="text-[5vh] mb-[1vh]">📡</div>
          <div className="text-[2.6vh] font-display font-bold text-text-strong">Connexion au tournoi impossible</div>
          <div className="text-[1.8vh] text-muted-2 mt-[1vh]">Nouvelle tentative en cours…</div>
        </div>
      </FullScreen>
    );

  return (
    <ErrorBoundary
      onError={(e, info) => reportError(e, `live-tournament:render ${info.componentStack?.slice(0, 80) ?? ''}`)}
      fallback={
        <FullScreen>
          <div className="text-center text-muted-2 text-[2vh]">Écran live momentanément indisponible — reconnexion…</div>
        </FullScreen>
      }
    >
      <LiveBoard data={data} stale={stale} />
    </ErrorBoundary>
  );
}

function LiveBoard({ data, stale }: { data: LiveTournament; stale: boolean }) {
  const phase = useMemo(() => phaseInfo(data), [data]);
  // ELO d'ÉQUIPE (moyenne de la paire en 2v2) pour des pronostics justes partout.
  const elos = useMemo(() => teamEloMap(data.entries ?? []), [data]);

  // Classement général (goal average) — tous les participants sont listés : ceux qui
  // ont joué d'abord (par résultats), puis le reste par ELO. Garantit un tableau
  // toujours peuplé, même avant le 1er match.
  const standings = useMemo<Standing[]>(() => {
    const leagueMatches = matchesOfStage(data, 'league');
    const base = computeStandings(
      leagueMatches.length ? leagueMatches : data.matches ?? [],
      'league',
    );
    const seen = new Set(base.map((s) => s.login));
    const extras: Standing[] = (data.entries ?? [])
      .filter((e) => !seen.has(e.login))
      .sort((a, b) => (b.user?.elo ?? 0) - (a.user?.elo ?? 0))
      .map((e) => ({ login: e.login, played: 0, wins: 0, draws: 0, goalsFor: 0, goalsAgainst: 0, diff: 0 }));
    return [...base, ...extras];
  }, [data]);

  const featured = useMemo(() => pickFeaturedMatch(data), [data]);
  const bRounds = useMemo(() => bracketRounds(data), [data]);
  const hasBracket = bRounds > 0;
  const recents = useMemo(() => recentResults(data, 5), [data]);
  const upcoming = useMemo(
    () => upcomingDuels(data, featured?.state === 'next' ? featured.match.id : null, 5),
    [data, featured],
  );
  const tight = useMemo(() => tightMatches(data, elos, 3), [data, elos]);

  const isFinished = data.status === 'finished';

  return (
    <div
      data-game={data.game ?? 'babyfoot'}
      className="fixed inset-0 bg-bg-0 text-text overflow-hidden flex flex-col font-sans select-none"
    >
      {/* Cinématiques temps réel (pile-ou-face, écran VERSUS) déclenchées par l'admin. */}
      <LiveOverlays data={data} />

      <LiveHeader tournament={data} phase={phase} />

      <main
        className="flex-1 grid min-h-0 gap-[1vh] p-[1vh]"
        style={{ gridTemplateColumns: '23% 1fr 23%' }}
      >
        {/* Gauche : classement au goal average + enjeux */}
        <EnjeuxPanel standings={standings} tournament={data} matches={data.matches ?? []} />

        {/* Centre : match en avant + (résultats | arbre) */}
        <div className="grid min-h-0 gap-[1vh]" style={{ gridTemplateRows: '1.55fr 1fr' }}>
          <div className="relative min-h-0">
            {isFinished && data.winner ? (
              <WinnerHero tournament={data} />
            ) : featured ? (
              <FeaturedMatch
                match={featured.match}
                state={featured.state}
                tournament={data}
                bracketRounds={bRounds}
              />
            ) : (
              <CenterPlaceholder label="En attente du coup d'envoi" />
            )}
          </div>
          <div className="min-h-0">
            {hasBracket ? (
              <LiveBracket
                matches={matchesOfStage(data, 'bracket')}
                rounds={bRounds}
                tournament={data}
                activeMatchId={data.activeMatchId ?? null}
              />
            ) : (
              <RecentResults matches={recents} tournament={data} />
            )}
          </div>
        </div>

        {/* Droite : prochains duels + matchs serrés */}
        <div className="flex flex-col min-h-0 gap-[1vh]">
          <UpcomingDuels duels={upcoming} tournament={data} />
          <HypePanel tight={tight} tournament={data} />
        </div>
      </main>

      {/* Bandeau défilant de toutes les mises. */}
      <div className="h-[5vh] shrink-0 border-t border-border/60 bg-bg-1/80">
        <BetsTicker bets={data.bets ?? []} />
      </div>

      <LiveDock tournament={data} phase={phase} />

      {stale && (
        <div className="absolute bottom-[9vh] right-[1.5vw] z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-2/90 border border-red/40 text-red text-[1.4vh] shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red animate-pulse" /> Reconnexion…
        </div>
      )}
    </div>
  );
}

function WinnerHero({ tournament }: { tournament: LiveTournament }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full rounded-xl border border-gold/50 bg-gradient-to-b from-gold/10 to-bg-0 overflow-hidden shadow-rivet">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,201,74,0.18),transparent_60%)]" />
      <div className="text-[2vh] uppercase tracking-[0.25em] text-gold/80">Vainqueur du tournoi</div>
      <div className="text-[7vh] my-[1vh]">🏆</div>
      <div className="text-[4.5vh] font-display font-black text-text-strong uppercase">
        {tournament.winner?.login}
      </div>
      <div className="text-[1.8vh] text-muted-2 mt-[1vh]">{tournament.name}</div>
    </div>
  );
}

function CenterPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full rounded-xl border border-border/60 bg-bg-1/70 text-[2.2vh] text-muted-2">
      {label}
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-bg-0 text-text flex items-center justify-center overflow-hidden">
      {children}
    </div>
  );
}
