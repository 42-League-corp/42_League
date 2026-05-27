import { Link } from 'react-router-dom';
import { Award, History, LogOut, Settings } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { ProfileHeroCard } from './mobile/ProfileHeroCard';
import { RecentMatchesList } from './mobile/RecentMatchesList';
import { OpsCard } from './mobile/OpsCard';
import { useProfilLogic } from './shared/useProfilLogic';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useAuth } from '../../hooks/useAuth';
import { haptic } from '../../mobile/feedback/useHaptic';

export function ProfilMobile() {
  const { stats, recentMatches, myLogin } = useProfilLogic();
  const { me, refresh } = useLeagueData();
  const { signOut } = useAuth();

  if (!me?.user) {
    return (
      <Panel title="Profil">
        <div className="text-center text-muted-2 py-10">Profil indisponible.</div>
      </Panel>
    );
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        <ProfileHeroCard stats={stats} />

        {/* Quick actions row */}
        <div className="grid grid-cols-3 gap-2.5">
          <QuickAction to="/trophees" Icon={Award} label="Trophées" tone="gold" />
          <QuickAction to="/historique" Icon={History} label="Historique" tone="teal" />
          <QuickAction to="/reglages" Icon={Settings} label="Réglages" tone="muted" />
        </div>

        {/* Ops card (urgent rouge) */}
        <OpsCard />

        {/* Recent matches */}
        <section>
          <SectionHeader title="Derniers matches" badge={stats.total} />
          <RecentMatchesList matches={recentMatches} myLogin={myLogin} />
        </section>

        {/* Sign out button */}
        <button
          type="button"
          onClick={() => {
            haptic('warning');
            signOut();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl border border-red/30 bg-red/5 active:bg-red/10 text-red text-xs font-extrabold uppercase tracking-[0.18em] tap-transparent transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2.5} />
          <span>Se déconnecter</span>
        </button>

        <div className="h-2" />
      </div>
    </PullToRefresh>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface QuickActionProps {
  to: string;
  Icon: typeof Award;
  label: string;
  tone: 'gold' | 'teal' | 'red' | 'muted';
}

const TONE_BG: Record<QuickActionProps['tone'], string> = {
  gold: 'bg-gold/10 text-gold border-gold/20 active:bg-gold/15',
  teal: 'bg-teal/10 text-teal border-teal/20 active:bg-teal/15',
  red: 'bg-red/10 text-red border-red/20 active:bg-red/15',
  muted: 'bg-bg-2 text-muted-2 border-border active:bg-bg-3',
};

function QuickAction({ to, Icon, label, tone }: QuickActionProps) {
  return (
    <Link
      to={to}
      onClick={() => haptic('selection')}
      className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border tap-transparent transition-colors ${TONE_BG[tone]}`}
    >
      <Icon className="w-5 h-5" strokeWidth={2.5} />
      <span className="text-[10px] font-extrabold uppercase tracking-wider leading-none">
        {label}
      </span>
    </Link>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-muted">
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="font-mono text-[10px] text-muted tabular-nums">· {badge}</span>
      )}
      <div className="flex-1 h-px bg-border/40 ml-2" />
    </div>
  );
}
