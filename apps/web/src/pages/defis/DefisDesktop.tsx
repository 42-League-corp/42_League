import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Swords, X } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { StatCard } from '../../components/StatCard';
import { RankedBadge } from '../../components/RankedBadge';
import { Button } from '../../components/Button';
import { PlayerLink } from '../../components/PlayerLink';
import { OutcomeButton } from '../../components/OutcomeButton';
import { AbacusSlider } from '../../components/AbacusSlider';
import { ContestModal } from '../../components/ContestModal';
import {
  api,
  type Challenge,
  type Game,
  type LeaderboardEntry,
  type MatchResultInput,
  type PendingMatch,
} from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useFlash } from '../../hooks/useFlash';
import { useI18n, useT, type Lang } from '../../lib/i18n';
import { fmtRelative } from '../../lib/format';
import { useDefisLogic } from './shared/useDefisLogic';
import { DeclareGameFlow, WINNING_SCORE, LOSER_SCORE_MIN, LOSER_SCORE_MAX } from './shared/DeclareGameFlow';
import { ChallengeFlow } from './shared/ChallengeFlow';

type Kind = 'incoming' | 'outgoing' | 'accepted';
type OpenCard = 'declare' | 'challenge' | null;

/**
 * Vue desktop de la page Défis — reprend l'UX existante en se branchant
 * sur le hook partagé `useDefisLogic` et la `DeclareGameFlow` extraite.
 */
export function DefisDesktop() {
  const t = useT();
  const { lang } = useI18n();
  const { locations } = useLeagueData();
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
    cancelDeclaration,
  } = useDefisLogic();

  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const [presetOpp, setPresetOpp] = useState<LeaderboardEntry | null>(null);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const TARGETS_PREVIEW = 9;

  const openChallengeWith = (player: LeaderboardEntry | null) => {
    setPresetOpp(player);
    setOpenCard('challenge');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasActivity =
    pendingToConfirm.length > 0 ||
    pendingWaiting.length > 0 ||
    incoming.length > 0 ||
    accepted.length > 0 ||
    outgoing.length > 0;

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')} accent="swords">
      <div ref={topRef} />
      <DefisStatsBar />
      <ActionBento
        openCard={openCard}
        presetOpp={presetOpp}
        others={others}
        recentOpponents={recentOpponents}
        opponentCounts={opponentCounts}
        myLogin={myLogin}
        locations={locations}
        onOpen={(c) => {
          if (c === 'challenge') setPresetOpp(null);
          setOpenCard(c);
        }}
        onClose={() => {
          setOpenCard(null);
          setPresetOpp(null);
        }}
        onDone={refresh}
      />

      {/* Command center : à gauche le flux d'activité (à confirmer + défis),
          à droite le roster d'adversaires. Quand il n'y a aucune activité, le
          roster s'étale sur toute la largeur (réagencement « Uber Eats »). */}
      <div className={`grid gap-5 items-stretch lg:min-h-[58vh] ${hasActivity ? 'lg:grid-cols-12' : ''}`}>
        {hasActivity && (
          <div className="lg:col-span-5 space-y-4">
            {pendingToConfirm.length > 0 && (
              <Section title="À confirmer">
                {pendingToConfirm.map((p) => (
                  <PendingConfirmRow key={p.id} match={p} onDone={refresh} />
                ))}
              </Section>
            )}
            {incoming.length > 0 && (
              <Section title={t('defis.received')}>
                {incoming.map((c) => (
                  <ChallengeRow
                    key={c.id}
                    challenge={c}
                    kind="incoming"
                    myLogin={myLogin}
                    lang={lang}
                    onAccept={() => handleAction(c.id, 'accept')}
                    onDecline={() => handleAction(c.id, 'decline')}
                  />
                ))}
              </Section>
            )}
            {accepted.length > 0 && (
              <Section title={t('defis.scheduled')}>
                {accepted.map((c) => (
                  <ChallengeRow
                    key={c.id}
                    challenge={c}
                    kind="accepted"
                    myLogin={myLogin}
                    lang={lang}
                    onAccept={NOOP}
                    onDecline={() => handleAction(c.id, 'decline')}
                  />
                ))}
              </Section>
            )}
            {outgoing.length > 0 && (
              <Section title={t('defis.sent')}>
                {outgoing.map((c) => (
                  <ChallengeRow
                    key={c.id}
                    challenge={c}
                    kind="outgoing"
                    myLogin={myLogin}
                    lang={lang}
                    onAccept={NOOP}
                    onDecline={() => handleAction(c.id, 'decline')}
                  />
                ))}
              </Section>
            )}
            {pendingWaiting.length > 0 && (
              <Section title="En attente de confirmation">
                {pendingWaiting.map((p) => (
                  <PendingWaitRow key={p.id} match={p} onCancel={() => cancelDeclaration(p)} />
                ))}
              </Section>
            )}
          </div>
        )}

        <div className={`flex flex-col ${hasActivity ? 'lg:col-span-7' : ''}`}>
          <Section title={t('defis.challenge')}>
            {others.length === 0 ? (
              <div className="text-center text-muted-2 py-6">{t('defis.empty')}</div>
            ) : (
              <>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${
                    hasActivity ? '' : 'xl:grid-cols-3'
                  }`}
                >
                  {(showAllTargets ? others : others.slice(0, TARGETS_PREVIEW)).map((u) => (
                    <ChallengeCard key={u.login} player={u} onChallenge={openChallengeWith} />
                  ))}
                </div>
                {others.length > TARGETS_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllTargets((v) => !v)}
                    className="mt-3 w-full py-2 rounded-lg border border-gold/30 text-gold/90 text-xs font-gaming font-extrabold uppercase tracking-[0.14em] hover:bg-gold/[0.06] hover:border-gold transition-colors"
                  >
                    {showAllTargets
                      ? '▲ Afficher moins'
                      : `▼ Afficher plus (${others.length - TARGETS_PREVIEW} joueurs)`}
                  </button>
                )}
              </>
            )}
          </Section>

          {/* Espace souple : pousse les stats vers le bas pour que la colonne
              occupe toute la hauteur disponible (au lieu de laisser un grand vide). */}
          <div className="flex-1 min-h-[24px]" />

          <ChallengeStats
            incoming={incoming.length}
            outgoing={outgoing.length}
            accepted={accepted.length}
            pending={pendingToConfirm.length + pendingWaiting.length}
            available={others.length}
          />
        </div>
      </div>
    </Panel>
  );
}

const NOOP = () => {};

// ─── Barre de stats perso (remplit le haut du panneau Défis) ─────────────────

function DefisStatsBar() {
  const { me, matches, leaderboard } = useLeagueData();
  const stats = useMemo(() => {
    const login = me?.login;
    if (!login) return null;
    const mine = matches.filter(
      (m) => m.playerALogin === login || m.playerBLogin === login,
    );
    let wins = 0;
    let losses = 0;
    for (const m of mine) {
      const isA = m.playerALogin === login;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      if (won) wins += 1;
      else losses += 1;
    }
    const recent = [...mine].sort(
      (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
    );
    let streak = 0;
    for (const m of recent) {
      const isA = m.playerALogin === login;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      if (streak === 0) streak = won ? 1 : -1;
      else if (won && streak > 0) streak += 1;
      else if (!won && streak < 0) streak -= 1;
      else break;
    }
    const total = wins + losses;
    return {
      elo: me?.user?.elo ?? 1000,
      rank: leaderboard.find((u) => u.login === login)?.rank ?? null,
      wins,
      losses,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      streak,
    };
  }, [me, matches, leaderboard]);

  if (!stats) return null;

  const streakLabel =
    stats.streak > 0
      ? `${stats.streak} V`
      : stats.streak < 0
        ? `${Math.abs(stats.streak)} D`
        : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
      <StatCard value={stats.rank ? `#${stats.rank}` : '—'} label="Rang" tone="gold" />
      <StatCard
        value={String(stats.elo)}
        label={<>ELO <RankedBadge size="xs" /></>}
        tone="teal"
      />
      <StatCard value={`${stats.wins}-${stats.losses}`} label="Bilan V-D" tone="neutral" />
      <StatCard
        value={`${stats.winRate}%`}
        label="Win rate"
        tone={stats.winRate >= 50 ? 'win' : 'loss'}
      />
      <StatCard value={streakLabel} label="Série" tone={stats.streak >= 0 ? 'win' : 'loss'} />
    </div>
  );
}

// ─── Bento d'actions « Déclarer / Défier » — réagencement selon l'espace ─────

interface ActionBentoProps {
  openCard: OpenCard;
  presetOpp: LeaderboardEntry | null;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  locations: Map<string, string>;
  onOpen: (card: Exclude<OpenCard, null>) => void;
  onClose: () => void;
  onDone: () => Promise<void>;
}

/**
 * Deux cartes d'action côte à côte. Quand l'une s'ouvre, elle prend toute la
 * largeur et l'autre s'efface — layout « Uber Eats » qui se réagence selon
 * l'espace disponible (transitions framer layout).
 */
function ActionBento({
  openCard,
  presetOpp,
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  locations,
  onOpen,
  onClose,
  onDone,
}: ActionBentoProps) {
  const submitAndClose = async () => {
    await onDone();
    onClose();
  };

  return (
    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <AnimatePresence mode="popLayout">
        {(openCard === null || openCard === 'declare') && (
          <ActionCard
            key="declare"
            kind="declare"
            expanded={openCard === 'declare'}
            onOpen={() => onOpen('declare')}
            onClose={onClose}
          >
            <DeclareGameFlow
              variant="desktop"
              others={others}
              recentOpponents={recentOpponents}
              opponentCounts={opponentCounts}
              myLogin={myLogin}
              locations={locations}
              onSubmitted={submitAndClose}
            />
          </ActionCard>
        )}

        {(openCard === null || openCard === 'challenge') && (
          <ActionCard
            key="challenge"
            kind="challenge"
            expanded={openCard === 'challenge'}
            onOpen={() => onOpen('challenge')}
            onClose={onClose}
          >
            <ChallengeFlow
              key={presetOpp?.login ?? 'free'}
              variant="desktop"
              others={others}
              recentOpponents={recentOpponents}
              opponentCounts={opponentCounts}
              myLogin={myLogin}
              locations={locations}
              presetOpponent={presetOpp}
              onSubmitted={submitAndClose}
            />
          </ActionCard>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ActionCardMeta {
  Icon: typeof Plus;
  label: string;
  sub: string;
}

const ACTION_META: Record<Exclude<OpenCard, null>, ActionCardMeta> = {
  declare: { Icon: Plus, label: 'Déclarer une game passée', sub: 'Game déjà jouée' },
  challenge: { Icon: Swords, label: 'Défier un joueur', sub: 'Programmer un duel' },
};

interface ActionCardProps {
  kind: Exclude<OpenCard, null>;
  expanded: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

function ActionCard({ kind, expanded, onOpen, onClose, children }: ActionCardProps) {
  const meta = ACTION_META[kind];
  const Icon = meta.Icon;

  if (!expanded) {
    return (
      <motion.button
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={onOpen}
        className="shine group flex items-center gap-3 py-5 px-5 rounded-2xl border border-dashed border-gold/30 hover:border-gold hover:bg-gold/[0.06] transition-all duration-300 text-left shadow-sm hover:shadow-gold-glow"
      >
        <span
          className="flex items-center justify-center w-10 h-10 rounded-full border border-gold/50 group-hover:scale-110 transition-transform flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,201,74,0.25), rgba(255,201,74,0.08))',
            boxShadow: 'inset 0 1px 0 rgba(255,247,228,0.2), 0 0 12px rgba(255,201,74,0.25)',
          }}
        >
          <Icon className="w-5 h-5 text-gold" strokeWidth={2.5} />
        </span>
        <span className="min-w-0">
          <span className="block font-gaming text-sm font-extrabold uppercase tracking-[0.14em] text-text-strong group-hover:text-gold transition-colors">
            {meta.label}
          </span>
          <span className="block text-[10px] text-muted uppercase tracking-[0.16em] font-extrabold mt-0.5">
            {meta.sub}
          </span>
        </span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="relative md:col-span-2 card-hud border-gold/40 rounded-2xl p-6 min-h-[460px] flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,201,74,0.18), transparent 70%)',
        boxShadow:
          '0 18px 48px rgba(0,0,0,0.5), 0 0 36px rgba(255,201,74,0.15), inset 0 1px 0 rgba(255,215,120,0.1)',
      }}
    >
      <div className="relative flex items-center justify-between mb-6">
        <span className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold flex items-center gap-2">
          <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
          {meta.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted hover:text-text-strong transition-colors leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Largeur de lecture confortable pour le flow */}
      <div className="relative w-full max-w-md mx-auto">{children}</div>
    </motion.div>
  );
}

// ─── Match en attente de confirmation (desktop layout) ───────────────────────

function PendingConfirmRow({
  match,
  onDone,
}: {
  match: PendingMatch;
  onDone: () => Promise<void>;
}) {
  const flash = useFlash();
  const [contesting, setContesting] = useState(false);
  const [busy, setBusy] = useState(false);
  // Une fois tranché (confirmé/contesté), la ligne se retire immédiatement —
  // sans attendre le refresh réseau.
  const [resolved, setResolved] = useState(false);

  // Vainqueur par comparaison de scores (toutes disciplines : 10-x, 1-0, 2-1).
  const iWon = match.scoreOpponent > match.scoreDeclarer;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      // Confirmation directe du score déclaré (point de vue « toi ») — pas de re-saisie.
      await api.confirmMatch(match.id, match.scoreOpponent, match.scoreDeclarer, {
        game: match.game,
        bestOf: match.bestOf as 3 | 5 | undefined,
      });
      flash.show('✓ Match confirmé — ELO mis à jour !');
      setResolved(true);
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  const handleContestSubmit = async (
    reason: 'never_played' | 'wrong_score',
    message: string,
  ) => {
    // Ferme la popup tout de suite et retire la ligne au succès.
    setContesting(false);
    setBusy(true);
    try {
      await api.rejectMatch(match.id, reason, message);
      flash.show('Contestation envoyée.');
      setResolved(true);
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  if (resolved) return null;

  return (
    <>
      <div className="relative card-hud border-gold/50 rounded-xl p-3 animate-pop hover-glow">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span aria-hidden className="text-base">⚡</span>
          <PlayerLink login={match.declarerLogin} className="font-semibold text-gold">
            {match.declarerLogin}
          </PlayerLink>
          <span className="text-muted-2">a déclaré :</span>
          <span className="font-bold tabular-nums text-text-strong text-base">
            {match.scoreDeclarer}
            <span className="text-muted mx-1.5">–</span>
            {match.scoreOpponent}
          </span>
          <span className="text-[10px] text-muted bg-bg-2 px-1.5 py-0.5 rounded">(eux – toi)</span>
        </div>

        <div className="mt-1.5 text-[11px] text-muted-2">
          Selon {match.declarerLogin}, tu as {iWon ? 'gagné' : 'perdu'}. Confirme si c'est exact.
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" loading={busy} onClick={handleConfirm} className="flex-1">✓ Confirmer</Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setContesting(true)}
            className="text-red border-red/30 hover:border-red hover:bg-red/5 hover:text-red"
          >
            Contester
          </Button>
        </div>
      </div>

      {contesting && (
        <ContestModal
          declarerLogin={match.declarerLogin}
          score={`${match.scoreDeclarer}–${match.scoreOpponent}`}
          busy={busy}
          onSubmit={handleContestSubmit}
          onClose={() => setContesting(false)}
        />
      )}
    </>
  );
}

function PendingWaitRow({ match, onCancel }: { match: PendingMatch; onCancel: () => void }) {
  return (
    <div className="card-hud rounded-xl p-3 flex flex-wrap items-center gap-2 text-sm">
      <span aria-hidden className="text-base opacity-50">⏳</span>
      <span className="text-muted-2">En attente de</span>
      <PlayerLink login={match.opponentLogin} className="font-semibold">
        {match.opponentLogin}
      </PlayerLink>
      <span className="font-bold tabular-nums text-text-strong">
        {match.scoreDeclarer}
        <span className="text-muted mx-1">–</span>
        {match.scoreOpponent}
      </span>
      <span className="text-[10px] text-muted">(toi – eux)</span>
      <span className="ml-auto text-[10px] text-muted italic">confirmation en attente…</span>
      <button
        type="button"
        onClick={onCancel}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:text-red hover:bg-red/10 transition-colors"
        title="Annuler ma déclaration"
        aria-label="Annuler ma déclaration"
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-2 flex items-center gap-2">
        <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
        {title}
        <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ChallengeRowProps {
  challenge: Challenge;
  kind: Kind;
  myLogin: string | undefined;
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
}

const KIND_LABEL: Record<Kind, string> = {
  incoming: 'Défi de',
  outgoing: 'Défi à',
  accepted: 'Match vs',
};

function ChallengeRow({ challenge, kind, myLogin, lang, onAccept, onDecline }: ChallengeRowProps) {
  const opponent =
    challenge.challengerLogin === myLogin ? challenge.opponentLogin : challenge.challengerLogin;
  const when = fmtRelative(challenge.scheduledAt, lang);
  const [recording, setRecording] = useState(false);

  return (
    <div className="card-hud rounded-xl p-3 hover-glow">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span aria-hidden className="text-base text-gold">⚔</span>
        <span className="text-muted-2">{KIND_LABEL[kind]}</span>
        <PlayerLink login={opponent} className="font-semibold">
          {opponent}
        </PlayerLink>
        <span className={`text-xs ${when.late ? 'text-red' : 'text-muted-2'}`}>{when.text}</span>
        <div className="flex-1" />

        {kind === 'incoming' && (
          <>
            <Button size="sm" onClick={onAccept}>Accepter</Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>Refuser</Button>
          </>
        )}
        {kind === 'outgoing' && (
          <Button size="sm" variant="ghost" onClick={onDecline}>Annuler</Button>
        )}
        {kind === 'accepted' && !recording && (
          <>
            <Button size="sm" onClick={() => setRecording(true)}>Saisir score</Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>Annuler</Button>
          </>
        )}
      </div>
      {kind === 'accepted' && recording && (
        <RecordResultForm
          challengeId={challenge.id}
          game={challenge.game ?? 'babyfoot'}
          oppLogin={opponent}
          onDone={() => setRecording(false)}
        />
      )}
    </div>
  );
}

function RecordResultForm({
  challengeId,
  game,
  oppLogin,
  onDone,
}: {
  challengeId: string;
  game: Game;
  oppLogin: string;
  onDone: () => void;
}) {
  const { refresh } = useLeagueData();
  const flash = useFlash();
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const send = async (result: MatchResultInput) => {
    setBusy(true);
    try {
      await api.recordChallengeResult(challengeId, result);
      flash.show('Score envoyé — en attente de confirmation');
      await refresh();
      onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  // ── Échecs : résultat binaire, en un seul geste. ──
  if (game === 'chess') {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        <OutcomeButton kind="win" onClick={() => send({ scoreSelf: 1, scoreOpponent: 0, game: 'chess' })}>
          J'ai gagné
        </OutcomeButton>
        <OutcomeButton kind="loss" onClick={() => send({ scoreSelf: 0, scoreOpponent: 1, game: 'chess' })}>
          J'ai perdu
        </OutcomeButton>
      </div>
    );
  }

  // ── Smash : un set demande les persos + les vies → on renvoie vers
  //    « Déclarer une partie », plus complet (et déjà rodé). ──
  if (game === 'smash') {
    return (
      <div className="mt-3 space-y-2 text-center">
        <p className="text-xs text-muted-2 leading-relaxed">
          Pour un set Smash (persos, vies restantes), saisis le résultat via
          <span className="text-text font-semibold"> « Déclarer une partie »</span>.
        </p>
        <Button size="sm" variant="ghost" onClick={onDone} className="w-full">OK</Button>
      </div>
    );
  }

  // ── Babyfoot : abaque du score du perdant. ──
  if (iWon === null) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        <OutcomeButton kind="win" onClick={() => setIWon(true)}>J'ai gagné</OutcomeButton>
        <OutcomeButton kind="loss" onClick={() => setIWon(false)}>J'ai perdu</OutcomeButton>
      </div>
    );
  }

  const loserLabel = iWon ? oppLogin : 'Moi';
  return (
    <div className="mt-3 space-y-3">
      <div className="text-xs text-muted text-center">
        Score de <span className="text-text font-semibold">{loserLabel}</span>
      </div>
      <AbacusSlider
        value={loserScore}
        onChange={setLoserScore}
        min={LOSER_SCORE_MIN}
        max={LOSER_SCORE_MAX}
      />
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => setIWon(null)} className="flex-none">←</Button>
        <Button
          size="sm"
          loading={busy}
          onClick={() =>
            send({
              scoreSelf: iWon ? WINNING_SCORE : loserScore,
              scoreOpponent: iWon ? loserScore : WINNING_SCORE,
              game: 'babyfoot',
            })
          }
          className="flex-1"
        >
          Envoyer
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="flex-none">Annuler</Button>
      </div>
    </div>
  );
}

interface ChallengeCardProps {
  player: LeaderboardEntry;
  onChallenge: (player: LeaderboardEntry) => void;
}

// ─── Stats des défis en cours (comble l'espace sous le roster) ───────────────

function ChallengeStats({
  incoming,
  outgoing,
  accepted,
  pending,
  available,
}: {
  incoming: number;
  outgoing: number;
  accepted: number;
  pending: number;
  available: number;
}) {
  return (
    <div className="mt-6">
      <Section title="Stats des défis">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <StatCard value={String(incoming)} label="Reçus" tone="gold" />
          <StatCard value={String(outgoing)} label="Envoyés" tone="teal" />
          <StatCard value={String(accepted)} label="Programmés" tone="win" />
          <StatCard value={String(pending)} label="À confirmer" tone="loss" />
          <StatCard value={String(available)} label="À défier" tone="neutral" />
        </div>
        <p className="text-[11px] text-muted-2 mt-2 leading-relaxed">
          {pending > 0
            ? `${pending} match${pending > 1 ? 's' : ''} en attente de confirmation — pense à valider tes scores.`
            : accepted > 0
              ? `${accepted} duel${accepted > 1 ? 's' : ''} programmé${accepted > 1 ? 's' : ''} : saisis le score une fois joué.`
              : 'Aucun défi en cours — lance-toi en défiant un joueur ci-dessus !'}
        </p>
      </Section>
    </div>
  );
}

function ChallengeCard({ player, onChallenge }: ChallengeCardProps) {
  return (
    <div className="card-hud rounded-xl p-3 hover-glow">
      <div className="flex items-center gap-2.5">
        <PlayerLink login={player.login} className="flex-1 min-w-0">
          <Avatar login={player.login} imageUrl={player.imageUrl} size="md" />
          <div className="min-w-0">
            <div className="font-display font-bold truncate text-text-strong">{player.login}</div>
            <div className="text-[11px] text-muted-2">
              <span className="text-gold font-extrabold font-mono tabular-nums">{player.elo}</span> ELO · #{player.rank}
            </div>
          </div>
        </PlayerLink>
        <Button size="sm" onClick={() => onChallenge(player)}>Défier</Button>
      </div>
    </div>
  );
}
