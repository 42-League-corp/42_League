import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FAB } from '../../mobile/primitives/FAB';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { SegmentedControl, type SegmentChoice } from '../../mobile/primitives/SegmentedControl';
import { HeroPlayerCard } from './mobile/HeroPlayerCard';
import { DeclareGameSheet } from './mobile/DeclareGameSheet';
import { OpponentBubble } from './mobile/OpponentBubble';
import { PendingMatchCard } from './mobile/PendingMatchCard';
import { ChallengeMobileCard } from './mobile/ChallengeMobileCard';
import { useDefisLogic } from './shared/useDefisLogic';
import { useLeagueData } from '../../hooks/useLeagueData';
import { haptic } from '../../mobile/feedback/useHaptic';

type Filter = 'all' | 'received' | 'scheduled' | 'sent';

export function DefisMobile() {
  const {
    myLogin,
    incoming,
    outgoing,
    accepted,
    pendingToConfirm,
    pendingWaiting,
    others,
    recentOpponents,
    opponentCounts,
    refresh,
    handleAction,
  } = useDefisLogic();
  const { leaderboard } = useLeagueData();
  const navigate = useNavigate();

  const [declareOpen, setDeclareOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // Map login → imageUrl pour les cartes de défis
  const imgByLogin = new Map(leaderboard.map((u) => [u.login, u.imageUrl] as const));

  // Filtres dynamiques
  const filterChoices: SegmentChoice<Filter>[] = [
    { value: 'all', label: 'Tous', badge: incoming.length + accepted.length + outgoing.length },
    { value: 'received', label: 'Reçus', badge: incoming.length },
    { value: 'scheduled', label: 'Prévus', badge: accepted.length },
    { value: 'sent', label: 'Envoyés', badge: outgoing.length },
  ];

  const showIncoming = filter === 'all' || filter === 'received';
  const showAccepted = filter === 'all' || filter === 'scheduled';
  const showOutgoing = filter === 'all' || filter === 'sent';

  const totalChallenges = incoming.length + accepted.length + outgoing.length;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        {/* Hero player card */}
        <HeroPlayerCard />

        {/* CTA principal sticky — "Déclarer une game" */}
        <motion.button
          type="button"
          onClick={() => {
            haptic('medium');
            setDeclareOpen(true);
          }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-br from-bg-1 to-bg-2 border border-teal/30 active:border-teal active:bg-teal/5 transition-all tap-transparent"
          style={{ boxShadow: '0 8px 24px -12px rgba(0,217,220,0.4)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal/15 flex items-center justify-center">
              <Plus className="w-4 h-4 text-teal" strokeWidth={3} />
            </div>
            <div className="text-left">
              <div className="text-sm font-extrabold text-text-strong tracking-wide">
                Déclarer une game
              </div>
              <div className="text-[10px] text-muted uppercase tracking-wider font-bold">
                Game passée · 2 clics
              </div>
            </div>
          </div>
          <div className="text-teal text-lg">→</div>
        </motion.button>

        {/* Pending — à confirmer (CTA urgent) */}
        {pendingToConfirm.length > 0 && (
          <section>
            <SectionHeader
              icon={<Zap className="w-3.5 h-3.5 text-gold" strokeWidth={2.5} />}
              title="À confirmer"
              badge={pendingToConfirm.length}
              tone="gold"
            />
            <div className="space-y-2.5">
              {pendingToConfirm.map((p) => (
                <PendingMatchCard key={p.id} match={p} onDone={refresh} />
              ))}
            </div>
          </section>
        )}

        {pendingWaiting.length > 0 && (
          <section>
            <SectionHeader title="En attente de confirmation" />
            <div className="space-y-2">
              {pendingWaiting.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 rounded-xl border border-border bg-bg-2/40 flex items-center gap-2.5 text-xs"
                >
                  <span aria-hidden className="text-base opacity-50">⏳</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-muted-2">En attente de</div>
                    <div className="font-bold text-text-strong truncate">{p.opponentLogin}</div>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-text-strong">
                    {p.scoreDeclarer}<span className="text-muted mx-1">–</span>{p.scoreOpponent}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Adversaires récents — strip horizontal */}
        {recentOpponents.length > 0 && (
          <section>
            <SectionHeader
              icon={<Users className="w-3.5 h-3.5 text-teal" strokeWidth={2.5} />}
              title="Adversaires récents"
            />
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-none scroll-smooth-touch">
              <div className="flex gap-3 pb-1 min-w-min">
                {recentOpponents.slice(0, 12).map((p) => (
                  <OpponentBubble
                    key={p.login}
                    player={p}
                    count={opponentCounts[p.login]}
                    onClick={() => navigate(`/joueur/${p.login}`)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Défis — section avec segmented control */}
        {totalChallenges > 0 && (
          <section>
            <SectionHeader title="Défis" />
            <div className="mb-3">
              <SegmentedControl<Filter>
                value={filter}
                onChange={setFilter}
                choices={filterChoices.filter((c) => c.value === 'all' || (c.badge ?? 0) > 0)}
              />
            </div>
            <AnimatePresence mode="popLayout">
              <div className="space-y-2.5">
                {showIncoming &&
                  incoming.map((c) => (
                    <ChallengeMobileCard
                      key={c.id}
                      challenge={c}
                      kind="incoming"
                      myLogin={myLogin}
                      imageUrl={imgByLogin.get(c.challengerLogin)}
                      onAccept={() => handleAction(c.id, 'accept')}
                      onDecline={() => handleAction(c.id, 'decline')}
                    />
                  ))}
                {showAccepted &&
                  accepted.map((c) => (
                    <ChallengeMobileCard
                      key={c.id}
                      challenge={c}
                      kind="accepted"
                      myLogin={myLogin}
                      imageUrl={imgByLogin.get(
                        c.challengerLogin === myLogin ? c.opponentLogin : c.challengerLogin,
                      )}
                      onAccept={() => navigate(`/defis?record=${c.id}`)}
                      onDecline={() => handleAction(c.id, 'decline')}
                    />
                  ))}
                {showOutgoing &&
                  outgoing.map((c) => (
                    <ChallengeMobileCard
                      key={c.id}
                      challenge={c}
                      kind="outgoing"
                      myLogin={myLogin}
                      imageUrl={imgByLogin.get(c.opponentLogin)}
                      onAccept={() => {}}
                      onDecline={() => handleAction(c.id, 'decline')}
                    />
                  ))}
              </div>
            </AnimatePresence>
          </section>
        )}

        {/* Empty state si rien de tout cela */}
        {totalChallenges === 0 &&
          pendingToConfirm.length === 0 &&
          pendingWaiting.length === 0 && (
            <div className="text-center py-10 px-4">
              <div className="text-4xl mb-3 opacity-60">⚔</div>
              <div className="text-sm text-muted-2 font-medium">
                Aucun défi en cours.<br />
                <span className="text-xs text-muted">
                  Va défier quelqu'un dans le classement.
                </span>
              </div>
            </div>
          )}

        {/* Espace pour le FAB */}
        <div className="h-4" />
      </div>

      {/* FAB → ouvre la BottomSheet de déclaration */}
      <FAB
        Icon={Plus}
        label="Game"
        onClick={() => setDeclareOpen(true)}
        pulse={pendingToConfirm.length === 0 && totalChallenges === 0}
      />

      {/* Sheet de déclaration */}
      <DeclareGameSheet
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
        others={others}
        recentOpponents={recentOpponents}
        opponentCounts={opponentCounts}
        myLogin={myLogin}
        onDone={refresh}
      />
    </PullToRefresh>
  );
}

// ─── Helpers locaux ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  badge?: number;
  tone?: 'teal' | 'gold' | 'muted';
}

function SectionHeader({ title, icon, badge, tone = 'muted' }: SectionHeaderProps) {
  const toneCls =
    tone === 'gold' ? 'text-gold' : tone === 'teal' ? 'text-teal' : 'text-muted';
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      {icon}
      <span className={`text-[10px] uppercase tracking-[0.18em] font-extrabold ${toneCls}`}>
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="font-mono text-[10px] text-muted tabular-nums">· {badge}</span>
      )}
      <div className="flex-1 h-px bg-border/40 ml-2" />
    </div>
  );
}
