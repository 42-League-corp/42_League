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

        {/* CTA principal sticky — "Déclarer une game" (style screenshot 42L) */}
        <motion.button
          type="button"
          onClick={() => {
            haptic('medium');
            setDeclareOpen(true);
          }}
          whileTap={{ scale: 0.98 }}
          whileHover={{ y: -2 }}
          className="shine group relative w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl overflow-hidden tap-transparent transition-all border border-gold/30 active:border-gold"
          style={{
            background:
              'linear-gradient(135deg, #2a241c 0%, #1d1914 60%, #15120e 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,215,120,0.10), 0 8px 24px -12px rgba(255,201,74,0.4), 0 1px 0 rgba(255,201,74,0.06)',
          }}
        >
          {/* Filigrane diagonale */}
          <div className="absolute inset-0 hud-diag opacity-50 pointer-events-none" />

          <div className="relative flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center border border-gold/50 group-hover:scale-110 transition-transform"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,201,74,0.25), rgba(255,201,74,0.08))',
                boxShadow:
                  'inset 0 1px 0 rgba(255,247,228,0.2), 0 0 12px rgba(255,201,74,0.25)',
              }}
            >
              <Plus className="w-4 h-4 text-gold" strokeWidth={3} />
            </div>
            <div className="text-left">
              <div className="font-gaming text-sm font-extrabold text-text-strong tracking-wide uppercase">
                Déclarer une game
              </div>
              <div className="text-[10px] text-muted uppercase tracking-[0.16em] font-extrabold">
                Game passée · 2 clics
              </div>
            </div>
          </div>

          {/* Icônes décoratives à droite (banane + carapace, comme le screenshot) */}
          <div className="relative flex items-center gap-1.5 text-base opacity-90">
            <span aria-hidden className="text-gold/80">🍌</span>
            <span aria-hidden className="text-muted-2">🐢</span>
            <span className="text-gold text-lg group-hover:translate-x-1 transition-transform">→</span>
          </div>
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
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative card-hud px-4 py-3 flex items-center gap-3 text-xs hover-glow group"
                >
                  {/* Silhouette trophée à gauche */}
                  <div className="relative flex-shrink-0 w-9 h-9 rounded-lg metal-plate flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 text-gold/70 group-hover:text-gold transition-colors"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M7 4h10v2h3a1 1 0 0 1 1 1v2c0 2.2-1.8 4-4 4h-.3c-.7 1.7-2.1 3-3.7 3.4V19h3v2H8v-2h3v-2.6c-1.6-.4-3-1.7-3.7-3.4H7c-2.2 0-4-1.8-4-4V7a1 1 0 0 1 1-1h3V4Zm0 4H5v1c0 1.1.9 2 2 2V8Zm10 0v3c1.1 0 2-.9 2-2V8h-2Z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-muted-2 uppercase tracking-[0.12em] font-bold">
                      En attente de
                    </div>
                    <div className="font-display font-bold text-text-strong truncate text-sm tracking-wide">
                      {p.opponentLogin}
                    </div>
                  </div>

                  <div className="font-display tabular-nums font-black text-text-strong text-sm flex items-center gap-1">
                    <span className={p.scoreDeclarer === 10 ? 'text-gold' : 'text-muted-2'}>
                      {p.scoreDeclarer}
                    </span>
                    <span className="text-muted mx-0.5">–</span>
                    <span className={p.scoreOpponent === 10 ? 'text-gold' : 'text-red'}>
                      {p.scoreOpponent}
                    </span>
                  </div>
                </motion.div>
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
    tone === 'gold' ? 'text-gold' : tone === 'teal' ? 'text-gold' : 'text-gold/80';
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
      {icon}
      <span className={`font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold ${toneCls}`}>
        {title}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="font-mono text-[10px] text-muted tabular-nums">· {badge}</span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent ml-2" />
    </div>
  );
}
