/**
 * Section « Trophées d'Équipe (Babyfoot 2v2) »
 *
 * Rendue à deux endroits :
 *   1. `TrophiesSection` (Hall of Fame général) — sous forme de grille de cartes.
 *   2. Pages `TeamProfileMobile` / `TeamProfileDesktop` — avec filtre par équipe.
 *
 * Charge le classement des équipes via `api.teamLeaderboard()`, enrichit les
 * avatars depuis le leaderboard individuel, puis calcule les trophées client-side.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api, type BabyfootTeamEntry } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import {
  computeTeamTrophies,
  type TeamTrophyResult,
  type TeamTrophyWinner,
} from '../lib/trophies2v2';
import { TeamTrophyCard, TeamTrophyRow } from './TeamTrophyBadge';
import { StaggerList, StaggerItem } from '../mobile/motion/StaggerList';

// ─── Fetch + enrich des équipes ───────────────────────────────────────────────

function useEnrichedTeams(): { teams: TeamTrophyWinner[]; loading: boolean } {
  const { leaderboard } = useLeagueData();
  const [raw, setRaw] = useState<BabyfootTeamEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.teamLeaderboard()
      .then((data) => { if (alive) setRaw(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const avatarByLogin = useMemo(
    () => new Map(leaderboard.map((u) => [u.login, u.imageUrl])),
    [leaderboard],
  );

  const teams = useMemo<TeamTrophyWinner[]>(
    () =>
      raw.map((t) => ({
        ...t,
        player1ImageUrl: avatarByLogin.get(t.player1Login) ?? null,
        player2ImageUrl: avatarByLogin.get(t.player2Login) ?? null,
      })),
    [raw, avatarByLogin],
  );

  return { teams, loading };
}

// ─── Version Hall of Fame — grille complète ───────────────────────────────────

/**
 * Grille de trophées d'équipe pour le Hall of Fame général.
 * Utilisée dans `TrophiesSection` quand l'onglet "Équipes 2v2" est actif.
 */
export function TeamTrophiesHallOfFame() {
  const { leaderboard, matches } = useLeagueData();
  const { teams, loading } = useEnrichedTeams();

  const trophies = useMemo<TeamTrophyResult[]>(
    () => (teams.length > 0 ? computeTeamTrophies(teams, leaderboard, matches) : []),
    [teams, leaderboard, matches],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="card-hud rounded-xl h-28 animate-pulse opacity-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-muted-2 leading-relaxed">
        Trophées récompensant les performances exceptionnelles en mode{' '}
        <span className="text-text font-semibold">2v2 Babyfoot</span>.
        Recalculés en temps réel à partir des matchs confirmés.
      </p>

      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" stagger={0.08}>
        {trophies.map((t) => (
          <StaggerItem key={t.code}>
            <TeamTrophyCard trophy={t} />
          </StaggerItem>
        ))}
      </StaggerList>

      {trophies.every((t) => !t.earned) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8 text-sm text-muted-2"
        >
          <div className="text-3xl mb-3 opacity-50">⚽</div>
          Jouez plus de matchs 2v2 pour débloquer ces trophées !
        </motion.div>
      )}
    </div>
  );
}

// ─── Version TeamProfile — badges filtrés par équipe ─────────────────────────

interface TeamTrophiesBadgesProps {
  /** ID de l'équipe dont on veut afficher les trophées. */
  teamId: string;
}

/**
 * Rangée de badges pour une page de profil d'équipe.
 * N'affiche que les trophées détenus par CETTE équipe.
 * Si aucun trophée, ne rend rien (pas de section vide).
 */
export function TeamTrophiesBadges({ teamId }: TeamTrophiesBadgesProps) {
  const { leaderboard, matches } = useLeagueData();
  const { teams, loading } = useEnrichedTeams();

  const trophies = useMemo<TeamTrophyResult[]>(
    () => (teams.length > 0 ? computeTeamTrophies(teams, leaderboard, matches) : []),
    [teams, leaderboard, matches],
  );

  if (loading) return null;

  const earned = trophies.filter((t) => t.earned && t.winner?.id === teamId);
  if (earned.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <TeamTrophyRow trophies={trophies} teamId={teamId} />
    </motion.div>
  );
}

// ─── Section complète pour TeamProfile (badges + explication) ─────────────────

/**
 * Section "Trophées" complète pour les pages TeamProfile mobile et desktop.
 * Affiche les badges gagnés + cartes avec description pour l'équipe donnée.
 */
export function TeamProfileTrophiesSection({ teamId }: { teamId: string }) {
  const { leaderboard, matches } = useLeagueData();
  const { teams, loading } = useEnrichedTeams();

  const trophies = useMemo<TeamTrophyResult[]>(
    () => (teams.length > 0 ? computeTeamTrophies(teams, leaderboard, matches) : []),
    [teams, leaderboard, matches],
  );

  if (loading) return null;

  const earned = trophies.filter((t) => t.earned && t.winner?.id === teamId);
  const locked = trophies.filter((t) => !(t.earned && t.winner?.id === teamId));

  return (
    <div className="space-y-3">
      {earned.length > 0 && (
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" stagger={0.1}>
          {earned.map((t) => (
            <StaggerItem key={t.code}>
              <TeamTrophyCard trophy={t} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {/* Trophées verrouillés — grisés */}
      {locked.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {locked.map((t) => (
            <TeamTrophyCard key={t.code} trophy={{ ...t, earned: false }} />
          ))}
        </div>
      )}

      {earned.length === 0 && locked.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-2 italic">
          Aucun trophée d'équipe disponible pour l'instant.
        </div>
      )}
    </div>
  );
}
