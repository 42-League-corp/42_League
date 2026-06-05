import { useState } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { ProfileHeroCard } from './mobile/ProfileHeroCard';
import { RecentMatchesList } from './mobile/RecentMatchesList';
import { OpsCard } from './mobile/OpsCard';
import { MyTeamsSection } from './mobile/MyTeamsSection';
import { FollowLists } from '../../components/FollowLists';
import { EloChart } from '../../components/EloChart';
import { SectionHeader } from './shared/SectionHeader';
import { RankingScopeToggle } from '../leaderboard/RankingScopeToggle';
import { QuestsPanel } from './QuestsPanel';
import { BetsPanel } from './BetsPanel';
import { useProfilLogic } from './shared/useProfilLogic';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../lib/i18n';
import { haptic } from '../../mobile/feedback/useHaptic';

type ProfilTab = 'profile' | 'quests' | 'bets';

export function ProfilMobile() {
  const { stats, recentMatches, myLogin } = useProfilLogic();
  const { me, matches, locations, refresh } = useLeagueData();
  const { game } = useGameMode();
  const { signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProfilTab>('profile');

  if (!me?.user) {
    return (
      <Panel title={t('panel.profil.title')}>
        <div className="text-center text-muted-2 py-10">{t('profil.unavailable')}</div>
      </Panel>
    );
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      {/* `key={game}` : on remonte proprement tout l'arbre du profil à chaque
          changement d'univers. Évite toute incohérence de réconciliation React
          (hooks/animations) entre deux disciplines dont les sous-arbres diffèrent
          — le remount est masqué par l'overlay de transition d'univers. */}
      <div key={game} className="space-y-5">
        {/* Héro : ELO, stats, badges, autres disciplines — tout dans la carte */}
        <ProfileHeroCard stats={stats} onlineHost={myLogin ? locations.get(myLogin) : undefined} />

        {/* Onglets : profil · quêtes hebdo · paris */}
        <RankingScopeToggle<ProfilTab>
          value={tab}
          onChange={setTab}
          choices={[
            { value: 'profile', label: t('profil.tab.profile') },
            { value: 'quests', label: t('profil.tab.quests') },
            { value: 'bets', label: t('profil.tab.bets') },
          ]}
        />

        {tab === 'quests' && <QuestsPanel />}
        {tab === 'bets' && <BetsPanel />}

        {tab === 'profile' && (
          <>
        {/* ELO evolution chart */}
        {myLogin && (
          <div className="card-hud rounded-2xl px-4 pt-3 pb-4 border-gold/20">
            <SectionHeader title={t('profil.eloEvolution')} />
            <EloChart
              matches={matches}
              myLogin={myLogin}
              currentElo={stats.elo}
              game={game}
              height={150}
            />
          </div>
        )}

        {/* Ops card (urgent rouge) */}
        <OpsCard />

        {/* Following / Followers (style GitHub) */}
        <section>
          <SectionHeader title={t('profil.network')} />
          <FollowLists />
        </section>

        {/* Recent matches */}
        <section>
          <SectionHeader title={t('profil.recent')} badge={stats.total} />
          <RecentMatchesList matches={recentMatches} myLogin={myLogin} />
        </section>

        {/* Mes Équipes 2v2 — uniquement en Babyfoot */}
        {game === 'babyfoot' && myLogin && (
          <section>
            {/* Header avec lien vers la page complète */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
                <span className="font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold text-gold/90">
                  {t('profil.myTeams')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/teams')}
                className="flex items-center gap-1 text-[10px] font-bold text-muted-2 hover:text-gold transition-colors tap-transparent"
              >
                Tout voir
                <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
            <MyTeamsSection myLogin={myLogin} />
          </section>
        )}
          </>
        )}

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
          <span>{t('settings.logout')}</span>
        </button>

      </div>
    </PullToRefresh>
  );
}
