import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Swords, X } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { PlayerLink } from '../../components/PlayerLink';
import { OutcomeButton } from '../../components/OutcomeButton';
import { AbacusSlider } from '../../components/AbacusSlider';
import { ContestModal } from '../../components/ContestModal';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch } from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useFlash } from '../../hooks/useFlash';
import { useI18n, useT } from '../../lib/i18n';
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
  } = useDefisLogic();

  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const [presetOpp, setPresetOpp] = useState<LeaderboardEntry | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const openChallengeWith = (player: LeaderboardEntry | null) => {
    setPresetOpp(player);
    setOpenCard('challenge');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')}>
      <div ref={topRef} />
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

      {(pendingToConfirm.length > 0 || pendingWaiting.length > 0) && (
        <div className="space-y-4 mb-6">
          {pendingToConfirm.length > 0 && (
            <Section title="À confirmer">
              {pendingToConfirm.map((p) => (
                <PendingConfirmRow key={p.id} match={p} onDone={refresh} />
              ))}
            </Section>
          )}
          {pendingWaiting.length > 0 && (
            <Section title="En attente de confirmation">
              {pendingWaiting.map((p) => (
                <PendingWaitRow key={p.id} match={p} />
              ))}
            </Section>
          )}
        </div>
      )}

      {(incoming.length || outgoing.length || accepted.length) > 0 && (
        <div className="space-y-4 mb-6">
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
        </div>
      )}

      <Section title={t('defis.challenge')}>
        {others.length === 0 ? (
          <div className="text-center text-muted-2 py-6">{t('defis.empty')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((u) => (
              <ChallengeCard key={u.login} player={u} onChallenge={openChallengeWith} />
            ))}
          </div>
        )}
      </Section>
    </Panel>
  );
}

const NOOP = () => {};

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
  declare: { Icon: Plus, label: 'Déclarer une game', sub: 'Game déjà jouée' },
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
      className="relative md:col-span-2 card-hud border-gold/40 rounded-2xl p-6 min-h-[460px] flex flex-col overflow-hidden"
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
  const [confirming, setConfirming] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [busy, setBusy] = useState(false);

  const iWon = match.scoreOpponent === WINNING_SCORE;
  const loserDeclaredScore = iWon ? match.scoreDeclarer : match.scoreOpponent;
  const [loserScore, setLoserScore] = useState(loserDeclaredScore);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const scoreSelf = iWon ? WINNING_SCORE : loserScore;
      const scoreOpp = iWon ? loserScore : WINNING_SCORE;
      await api.confirmMatch(match.id, scoreSelf, scoreOpp);
      flash.show('✓ Match confirmé — ELO mis à jour !');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleContestSubmit = async (
    reason: 'never_played' | 'wrong_score',
    message: string,
  ) => {
    setBusy(true);
    try {
      await api.rejectMatch(match.id, reason, message);
      flash.show('Contestation envoyée.');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
      setContesting(false);
    }
  };

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

        {!confirming ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => setConfirming(true)} className="flex-1">✓ Confirmer</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setContesting(true)}
              className="text-red border-red/30 hover:border-red hover:bg-red/5 hover:text-red"
            >
              Contester
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                iWon
                  ? 'bg-gold/10 text-gold border border-gold/30'
                  : 'bg-red/10 text-red border border-red/30'
              }`}
            >
              <span aria-hidden>{iWon ? '🏆' : '💀'}</span>
              <span>
                Selon {match.declarerLogin}, tu as {iWon ? 'gagné' : 'perdu'} {WINNING_SCORE}–{loserDeclaredScore}
              </span>
            </div>
            <p className="text-[10px] text-muted leading-relaxed">
              Ajuste le score si ta version est différente.
            </p>
            <AbacusSlider
              value={loserScore}
              onChange={setLoserScore}
              min={LOSER_SCORE_MIN}
              max={LOSER_SCORE_MAX}
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" loading={busy} onClick={handleConfirm} className="flex-1">Valider</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Retour</Button>
            </div>
          </div>
        )}
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

function PendingWaitRow({ match }: { match: PendingMatch }) {
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
  lang: 'fr' | 'en';
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
          oppLogin={opponent}
          onDone={() => setRecording(false)}
        />
      )}
    </div>
  );
}

function RecordResultForm({
  challengeId,
  oppLogin,
  onDone,
}: {
  challengeId: string;
  oppLogin: string;
  onDone: () => void;
}) {
  const { refresh } = useLeagueData();
  const flash = useFlash();
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (iWon === null) return;
    const scoreSelf = iWon ? WINNING_SCORE : loserScore;
    const scoreOpp = iWon ? loserScore : WINNING_SCORE;
    setBusy(true);
    try {
      await api.recordChallengeResult(challengeId, scoreSelf, scoreOpp);
      flash.show('Score envoyé — en attente de confirmation');
      await refresh();
      onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

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
        <Button size="sm" loading={busy} onClick={submit} className="flex-1">Envoyer</Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="flex-none">Annuler</Button>
      </div>
    </div>
  );
}

interface ChallengeCardProps {
  player: LeaderboardEntry;
  onChallenge: (player: LeaderboardEntry) => void;
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
