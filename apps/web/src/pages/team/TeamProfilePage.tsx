import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageSkeleton } from '../../mobile/primitives/Skeleton';
import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { TeamProfileMobile } from './TeamProfileMobile';
import { TeamProfileDesktop } from './TeamProfileDesktop';
import { api, type TeamProfile } from '../../lib/api';

/**
 * Page de profil d'une équipe Babyfoot 2v2.
 * Route : /team/:teamId
 *
 * Charge le profil depuis `GET /teams/:teamId` puis delegate au composant
 * adapté selon le viewport (mobile < 420px / desktop ≥ 420px).
 */
export function TeamProfilePage() {
  const { teamId = '' } = useParams<{ teamId: string }>();

  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.teamProfile(teamId);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageSkeleton />;

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 px-4 text-center">
        <div className="text-4xl opacity-50">⚽</div>
        <div className="text-sm font-bold text-text-strong">Équipe introuvable</div>
        <div className="text-xs text-muted-2">{error ?? 'Cette équipe n\'existe pas ou a été supprimée.'}</div>
      </div>
    );
  }

  return (
    <ViewportSwitch
      mobile={<TeamProfileMobile team={profile} onRefresh={load} />}
      desktop={<TeamProfileDesktop team={profile} />}
    />
  );
}
