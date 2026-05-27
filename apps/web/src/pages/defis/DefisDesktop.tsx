import { useState, type ReactNode } from 'react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { PlayerLink } from '../../components/PlayerLink';
import { OutcomeButton } from '../../components/OutcomeButton';
import { AbacusSlider } from '../../components/AbacusSlider';
import { ContestModal } from '../../components/ContestModal';
import { api, type Challenge, type PendingMatch } from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useFlash } from '../../hooks/useFlash';
import { useI18n, useT } from '../../lib/i18n';
import { fmtRelative, isoLocalNowPlusMinutes } from '../../lib/format';
import { useDefisLogic } from './shared/useDefisLogic';
import { DeclareGameFlow, WINNING_SCORE, LOSER_SCORE_MIN, LOSER_SCORE_MAX } from './shared/DeclareGameFlow';

type Kind = 'incoming' | 'outgoing' | 'accepted';

/**
 * Vue desktop de la page Défis — reprend l'UX existante en se branchant
 * sur le hook partagé `useDefisLogic` et la `DeclareGameFlow` extraite.
 */
export function DefisDesktop() {
  const t = useT();
  const { lang } = useI18n();
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

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')}>
      <DeclareGameSection
        others={others}
        recentOpponents={recentOpponents}
        opponentCounts={opponentCounts}
        myLogin={myLogin}
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
              <ChallengeCard
                key={u.login}
                login={u.login}
                imageUrl={u.imageUrl}
                elo={u.elo}
                rank={u.rank}
                onSent={refresh}
              />
            ))}
          </div>
        )}
      </Section>
    </Panel>
  );
}

const NOOP = () => {};

// ─── Section "Déclarer une game" — carte animée open/close ───────────────────

interface DeclareGameSectionProps {
  others: ReturnType<typeof useDefisLogic>['others'];
  recentOpponents: ReturnType<typeof useDefisLogic>['recentOpponents'];
  opponentCounts: ReturnType<typeof useDefisLogic>['opponentCounts'];
  myLogin: string | undefined;
  onDone: () => Promise<void>;
}

function DeclareGameSection({
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  onDone,
}: DeclareGameSectionProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shine w-full group flex items-center justify-center gap-2 py-5 rounded-2xl border border-dashed border-gold/30 hover:border-gold hover:bg-gold/8 transition-all duration-300 text-muted-2 hover:text-gold text-xs font-extrabold uppercase tracking-[0.16em] shadow-sm hover:shadow-gold-glow font-gaming"
        >
          <span className="text-lg transition-transform duration-300 group-hover:rotate-90">+</span>
          Déclarer une game passée
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div
        className="relative card-hud border-gold/40 rounded-2xl p-6 min-h-[460px] flex flex-col animate-pop overflow-hidden"
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
            Déclarer une game passée
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="text-muted hover:text-text-strong transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <DeclareGameFlow
          variant="desktop"
          others={others}
          recentOpponents={recentOpponents}
          opponentCounts={opponentCounts}
          myLogin={myLogin}
          onSubmitted={async () => {
            await onDone();
            setOpen(false);
          }}
        />
      </div>
    </div>
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
  login: string;
  imageUrl: string | null;
  elo: number;
  rank: number;
  onSent: () => Promise<void>;
}

function ChallengeCard({ login, imageUrl, elo, rank, onSent }: ChallengeCardProps) {
  const [open, setOpen] = useState(false);
  const flash = useFlash();
  const [when, setWhen] = useState(() => isoLocalNowPlusMinutes(30));
  const [busy, setBusy] = useState(false);

  const sendChallenge = async () => {
    if (!when) return;
    setBusy(true);
    try {
      const scheduledAt = new Date(when).toISOString();
      await api.createChallenge({ opponentLogin: login, scheduledAt });
      flash.show(`Défi envoyé à @${login}`);
      await onSent();
      setOpen(false);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-hud rounded-xl p-3 hover-glow">
      <div className="flex items-center gap-2.5">
        <PlayerLink login={login} className="flex-1 min-w-0">
          <Avatar login={login} imageUrl={imageUrl} size="md" />
          <div className="min-w-0">
            <div className="font-display font-bold truncate text-text-strong">{login}</div>
            <div className="text-[11px] text-muted-2">
              <span className="text-gold font-extrabold font-mono tabular-nums">{elo}</span> ELO · #{rank}
            </div>
          </div>
        </PlayerLink>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>Défier</Button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Date et heure du défi"
            className="flex-1 min-w-[180px] px-3 py-2 bg-bg-0 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
          />
          <Button size="sm" loading={busy} onClick={sendChallenge}>Envoyer</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
        </div>
      )}
    </div>
  );
}
