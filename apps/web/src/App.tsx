import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { Toast } from './components/Toast';
import { PageSkeleton } from './mobile/primitives/Skeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { LeagueDataProvider, useLeagueData } from './hooks/useLeagueData';
import { LoginPage } from './pages/LoginPage';
import { AuthReturnPage } from './pages/AuthReturnPage';
import { GODPage } from './pages/GODPage';
import { AboutPage } from './pages/AboutPage';
import { ConsentGate } from './components/ConsentGate';
import { StagingGate } from './components/StagingGate';
import { IS_STAGING } from './lib/config';

/**
 * Préchargement eager de tous les chunks de routes secondaires.
 * Déclenché après le chargement initial des données → Suspense ne suspend jamais
 * pendant la navigation, ce qui garantit la compatibilité avec AnimatePresence.
 */
function prefetchRouteChunks() {
  void import('./pages/leaderboard');
  void import('./pages/profil');
  void import('./pages/tournois');
  void import('./pages/TropheesPage');
  void import('./pages/HistoriquePage');
  void import('./pages/ReglagesPage');
  void import('./pages/PlayerPage');
  void import('./pages/TournoiDetailPage');
}

// ─── Routes paresseuses ──────────────────────────────────────────────────────
// Code-splitting par page → bundle initial allégé (~50%+).
// Chaque chunk est chargé à la demande au premier accès à la route.
// La pré-loading peut être déclenchée au hover sur la TabBar plus tard.
const DefisPage = lazy(() =>
  import('./pages/defis').then((m) => ({ default: m.DefisPage })),
);
const TournoisPage = lazy(() =>
  import('./pages/tournois').then((m) => ({ default: m.TournoisPage })),
);
const TournoiDetailPage = lazy(() =>
  import('./pages/TournoiDetailPage').then((m) => ({ default: m.TournoiDetailPage })),
);
const LeaderboardPage = lazy(() =>
  import('./pages/leaderboard').then((m) => ({ default: m.LeaderboardPage })),
);
const GoatPage = lazy(() =>
  import('./pages/GoatPage').then((m) => ({ default: m.GoatPage })),
);
const ProfilPage = lazy(() =>
  import('./pages/profil').then((m) => ({ default: m.ProfilPage })),
);
const PlayerPage = lazy(() =>
  import('./pages/PlayerPage').then((m) => ({ default: m.PlayerPage })),
);
const HistoriquePage = lazy(() =>
  import('./pages/HistoriquePage').then((m) => ({ default: m.HistoriquePage })),
);
const ReglagesPage = lazy(() =>
  import('./pages/ReglagesPage').then((m) => ({ default: m.ReglagesPage })),
);
const TropheesPage = lazy(() =>
  import('./pages/TropheesPage').then((m) => ({ default: m.TropheesPage })),
);
const H2HPage = lazy(() =>
  import('./pages/H2HPage').then((m) => ({ default: m.H2HPage })),
);

export function App() {
  const { authenticated } = useAuth();

  return (
    <Routes>
      <Route path="/auth/return" element={<AuthReturnPage />} />
      {/* /about accessible sans auth (politique de confidentialité RGPD Art. 13).
          Une fois authentifié, /about est rendu dans le shell (cf. AuthenticatedShell)
          pour conserver la tab bar en continuité des autres pages. */}
      {!authenticated && <Route path="/about" element={<AboutPage />} />}
      <Route path="/login" element={authenticated ? <Navigate to="/challenges" replace /> : <LoginPage />} />
      <Route path="/GOD" element={authenticated ? <GODPage /> : <Navigate to="/login" replace />} />
      <Route
        path="*"
        element={
          authenticated ? (
            <LeagueDataProvider>
              <AuthenticatedShell />
            </LeagueDataProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function AuthenticatedShell() {
  const { loading, error, me, refresh } = useLeagueData();

  // Précharger tous les chunks de routes en arrière-plan dès que les données sont prêtes.
  // Évite toute suspension Suspense pendant la navigation → transitions AnimatePresence stables.
  useEffect(() => {
    if (!loading && !me?.consentRequired) {
      prefetchRouteChunks();
    }
  }, [loading, me?.consentRequired]);

  // Barrière de consentement RGPD : tant que l'utilisateur n'a pas consenti, on
  // n'affiche QUE la modale (le serveur refuse de toute façon le reste des données).
  if (!loading && me?.consentRequired) {
    return <ConsentGate login={me.login} onAccepted={() => void refresh()} />;
  }

  // Staging : accès réservé aux superadmins. Un utilisateur connecté non-superadmin
  // voit un écran dédié plutôt que l'app (le backend refuse de toute façon ses données).
  if (!loading && IS_STAGING && me && me.role !== 'SUPERADMIN') {
    return <StagingGate login={me.login} />;
  }

  return (
    <AppShell>
      {error && (
        <div className="mb-4 p-3 border border-red/50 bg-red/10 rounded text-red text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <PageSkeleton />
      ) : (
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/challenges" replace />} />
              <Route path="/challenges" element={<DefisPage />} />
              <Route path="/tournaments" element={<TournoisPage />} />
              <Route path="/tournaments/:id" element={<TournoiDetailPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/goat" element={<GoatPage />} />
              <Route path="/trophies" element={<TropheesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/profile" element={<ProfilPage />} />
              <Route path="/player/:login" element={<PlayerPage />} />
              <Route path="/h2h" element={<H2HPage />} />
              <Route path="/history" element={<HistoriquePage />} />
              <Route path="/settings" element={<ReglagesPage />} />
              <Route path="*" element={<Navigate to="/challenges" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      )}
      <Toast />
    </AppShell>
  );
}
