import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Toast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { LeagueDataProvider, useLeagueData } from './hooks/useLeagueData';
import { LoginPage } from './pages/LoginPage';
import { AuthReturnPage } from './pages/AuthReturnPage';
import { DefisPage } from './pages/DefisPage';
import { TournoisPage } from './pages/TournoisPage';
import { TournoiDetailPage } from './pages/TournoiDetailPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilPage } from './pages/ProfilPage';
import { PlayerPage } from './pages/PlayerPage';
import { HistoriquePage } from './pages/HistoriquePage';
import { ReglagesPage } from './pages/ReglagesPage';

export function App() {
  const { authenticated } = useAuth();

  return (
    <Routes>
      <Route path="/auth/return" element={<AuthReturnPage />} />
      <Route path="/login" element={authenticated ? <Navigate to="/defis" replace /> : <LoginPage />} />
      <Route
        path="*"
        element={
          authenticated ? (
            <LeagueDataProvider>
              <AppShell />
            </LeagueDataProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

function AppShell() {
  const { loading, error } = useLeagueData();

  return (
    <Layout>
      {error && (
        <div className="mb-4 p-3 border border-red/50 bg-red/10 rounded text-red text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-center text-muted-2 py-20">Chargement…</div>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/defis" replace />} />
          <Route path="/defis" element={<DefisPage />} />
          <Route path="/tournois" element={<TournoisPage />} />
          <Route path="/tournois/:id" element={<TournoiDetailPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/trophees" element={<Navigate to="/profil" replace />} />
          <Route path="/profil" element={<ProfilPage />} />
          <Route path="/joueur/:login" element={<PlayerPage />} />
          <Route path="/historique" element={<HistoriquePage />} />
          <Route path="/reglages" element={<ReglagesPage />} />
          <Route path="*" element={<Navigate to="/defis" replace />} />
        </Routes>
      )}
      <Toast />
    </Layout>
  );
}
