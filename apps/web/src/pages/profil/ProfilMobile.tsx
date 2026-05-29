import { Link } from 'react-router-dom';
import { Award, History, Info, LogOut, Settings } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { ProfileHeroCard } from './mobile/ProfileHeroCard';
import { RecentMatchesList } from './mobile/RecentMatchesList';
import { OpsCard } from './mobile/OpsCard';
import { EloChart } from '../../components/EloChart';
import { useProfilLogic } from './shared/useProfilLogic';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useAuth } from '../../hooks/useAuth';
import { haptic } from '../../mobile/feedback/useHaptic';

export function ProfilMobile() {
  const { stats, recentMatches, myLogin } = useProfilLogic();
  const { me, matches, refresh } = useLeagueData();
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
          <QuickAction to="/about" Icon={Info} label="Règles" tone="gold" />
          <QuickAction to="/history" Icon={History} label="Historique" tone="teal" />
          <QuickAction to="/settings" Icon={Settings} label="Réglages" tone="muted" />
        </div>

        {/* ELO evolution chart */}
        {myLogin && (
          <div className="card-hud rounded-2xl px-4 pt-3 pb-4 border-gold/20">
            <SectionHeader title="Évolution ELO" />
            <EloChart
              matches={matches}
              myLogin={myLogin}
              currentElo={stats.elo}
              height={96}
            />
          </div>
        )}

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
  gold: 'bg-gradient-to-b from-gold/15 to-gold/5 text-gold border-gold/40 active:bg-gold/20 shadow-[inset_0_1px_0_rgba(255,215,120,0.18)]',
  teal: 'bg-gradient-to-b from-gold/12 to-gold/4 text-gold border-gold/30 active:bg-gold/15',
  red: 'bg-red/10 text-red border-red/30 active:bg-red/15',
  muted: 'metal-plate text-muted-2 active:bg-bg-3',
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
      <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
      <span className="font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold text-gold/90">
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="font-mono text-[10px] text-muted tabular-nums">· {badge}</span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent ml-2" />
    </div>
  );
}
