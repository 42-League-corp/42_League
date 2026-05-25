import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
import { api, type Challenge } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useI18n, useT } from '../lib/i18n';
import { fmtRelative, isoLocalNowPlusMinutes } from '../lib/format';

type Kind = 'incoming' | 'outgoing' | 'accepted';

export function DefisPage() {
  const t = useT();
  const { lang } = useI18n();
  const { challenges, leaderboard, me, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

  const myLogin = me?.login;
  const incoming = challenges.filter(
    (c) => c.opponentLogin === myLogin && c.status === 'pending',
  );
  const outgoing = challenges.filter(
    (c) => c.challengerLogin === myLogin && c.status === 'pending',
  );
  const accepted = challenges.filter((c) => c.status === 'accepted');

  const others = leaderboard.filter((u) => u.login !== myLogin);

  const handleAction = async (id: string, action: 'accept' | 'decline') => {
    if (action === 'decline') {
      const ch = challenges.find((c) => c.id === id);
      const iAmChallenger = ch?.challengerLogin === myLogin;
      const opp = ch
        ? iAmChallenger
          ? ch.opponentLogin
          : ch.challengerLogin
        : '';
      const wasAccepted = ch?.status === 'accepted';
      const ok = await confirm({
        title: wasAccepted
          ? 'Fuir ce match ?'
          : iAmChallenger
            ? 'Annuler ce défi ?'
            : 'Refuser ce défi ?',
        message: wasAccepted
          ? `Le match contre ${opp} était accepté par les deux. Si tu annules maintenant, c'est considéré comme une fuite.`
          : iAmChallenger
            ? `Annuler ton défi envoyé à ${opp} ?`
            : `Refuser le défi de ${opp} ?`,
        warning: wasAccepted ? '⚠ Pénalité : -10 ELO + 1 fuite marquée sur ton profil.' : undefined,
        confirmLabel: wasAccepted
          ? 'Confirmer la fuite'
          : iAmChallenger
            ? 'Annuler'
            : 'Refuser',
        cancelLabel: 'Garder',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      if (action === 'accept') {
        await api.acceptChallenge(id);
        flash.show('Défi accepté');
      } else {
        await api.declineChallenge(id);
        flash.show('Défi clos');
      }
      await refresh();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')}>
      {/* Active challenges */}
      {(incoming.length || outgoing.length || accepted.length) > 0 && (
        <div className="space-y-4 mb-6">
          {incoming.length > 0 && (
            <Section title={t('defis.received')}>
              {incoming.map((c) => (
                <ChallengeRow
                  key={c.id}
                  c={c}
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
                  c={c}
                  kind="accepted"
                  myLogin={myLogin}
                  lang={lang}
                  onAccept={() => {}}
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
                  c={c}
                  kind="outgoing"
                  myLogin={myLogin}
                  lang={lang}
                  onAccept={() => {}}
                  onDecline={() => handleAction(c.id, 'decline')}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Challenge form */}
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
                onSent={() => refresh()}
              />
            ))}
          </div>
        )}
      </Section>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ChallengeRowProps {
  c: Challenge;
  kind: Kind;
  myLogin: string | undefined;
  lang: 'fr' | 'en';
  onAccept: () => void;
  onDecline: () => void;
}

function ChallengeRow({ c, kind, myLogin, lang, onAccept, onDecline }: ChallengeRowProps) {
  const opp = c.challengerLogin === myLogin ? c.opponentLogin : c.challengerLogin;
  const r = fmtRelative(c.scheduledAt, lang);
  const [recording, setRecording] = useState(false);

  return (
    <div className="p-3 border border-border bg-bg-2/40 rounded">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base">⚔</span>
        <span className="text-muted-2">
          {kind === 'incoming' ? 'Défi de' : kind === 'outgoing' ? 'Défi à' : 'Match vs'}
        </span>
        <PlayerLink login={opp} className="font-semibold">
          {opp}
        </PlayerLink>
        <span className={`text-xs ${r.late ? 'text-red' : 'text-muted-2'}`}>{r.text}</span>
        <div className="flex-1" />
        {kind === 'incoming' && (
          <>
            <Button size="sm" onClick={onAccept}>
              Accepter
            </Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>
              Refuser
            </Button>
          </>
        )}
        {kind === 'outgoing' && (
          <Button size="sm" variant="ghost" onClick={onDecline}>
            Annuler
          </Button>
        )}
        {kind === 'accepted' && !recording && (
          <>
            <Button size="sm" onClick={() => setRecording(true)}>
              Saisir score
            </Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>
              Annuler
            </Button>
          </>
        )}
      </div>
      {kind === 'accepted' && recording && (
        <RecordResultForm
          challengeId={c.id}
          oppLogin={opp}
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
  const [me, setMe] = useState('');
  const [opp, setOpp] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
      <input
        type="number"
        min={0}
        max={10}
        placeholder="Ton score"
        value={me}
        onChange={(e) => setMe(e.target.value)}
        className="px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
      />
      <input
        type="number"
        min={0}
        max={10}
        placeholder={`Score ${oppLogin}`}
        value={opp}
        onChange={(e) => setOpp(e.target.value)}
        className="px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
      />
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          const a = Number(me);
          const b = Number(opp);
          if (!Number.isFinite(a) || !Number.isFinite(b)) return;
          setBusy(true);
          try {
            await api.recordChallengeResult(challengeId, a, b);
            flash.show('Score envoyé — en attente de confirmation');
            await refresh();
            onDone();
          } catch (err) {
            flash.show(err instanceof Error ? err.message : String(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        Envoyer
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Annuler
      </Button>
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

  return (
    <div className="p-3 border border-border bg-bg-2/40 rounded">
      <div className="flex items-center gap-2.5">
        <PlayerLink login={login} className="flex-1 min-w-0">
          <Avatar login={login} imageUrl={imageUrl} size="md" />
          <div className="min-w-0">
            <div className="font-bold truncate text-text-strong">{login}</div>
            <div className="text-[11px] text-muted-2">
              <span className="text-teal font-bold">{elo}</span> ELO · #{rank}
            </div>
          </div>
        </PlayerLink>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          Défier
        </Button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
          />
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              if (!when) return;
              const iso = new Date(when).toISOString();
              setBusy(true);
              try {
                await api.createChallenge({ opponentLogin: login, scheduledAt: iso });
                flash.show(`Défi envoyé à @${login}`);
                await onSent();
                setOpen(false);
              } catch (err) {
                flash.show(err instanceof Error ? err.message : String(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
