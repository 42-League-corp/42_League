import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { Panel } from '../components/Panel';
import { UserBadge } from '../components/Avatar';
import { OnlineBadge } from '../components/OnlineBadge';
import { Button } from '../components/Button';
import { StatCard } from '../components/StatCard';
import { PlayerLink } from '../components/PlayerLink';
import { BadgesRow } from '../components/Badges';
import { EloChart } from '../components/EloChart';
import {
  api,
  type OpsUserResponse,
  type UserProfile,
} from '../lib/api';
import { fmtCountdown, fmtDatePair } from '../lib/format';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useI18n, useT } from '../lib/i18n';

export function PlayerPage() {
  const { login: rawLogin } = useParams<{ login: string }>();
  const login = rawLogin ?? '';
  const navigate = useNavigate();
  const t = useT();
  const { locale, lang } = useI18n();
  const { me, opsMe, locations, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [opsForPlayer, setOpsForPlayer] = useState<OpsUserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleDraft, setTitleDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ops] = await Promise.all([
        api.userProfile(login),
        api.opsForUser(login).catch(() => null),
      ]);
      setProfile(p);
      setOpsForPlayer(ops);
      setTitleDraft(p.user.title ?? '');
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [login]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Panel title={login || 'Joueur'} sub={t('profil.subtitle')}>
        <div className="text-center text-muted-2 py-10">{t('common.loading')}</div>
      </Panel>
    );
  }
  if (!profile) {
    return (
      <Panel title={login} sub={t('profil.subtitle')}>
        <div className="text-center text-muted-2 py-10">
          {login} {t('profil.notRegistered')}
        </div>
      </Panel>
    );
  }

  const p = profile;
  const winRate =
    p.wins + p.losses === 0
      ? 0
      : Math.round((p.wins / (p.wins + p.losses)) * 100);

  const myLogin = me?.login;
  const isMe = myLogin === p.user.login;
  const onlineHost = locations.get(p.user.login);

  return (
    <Panel title={p.user.firstName && p.user.lastName ? `${p.user.firstName} ${p.user.lastName}` : p.user.login} sub={t('profil.subtitle')}>
      <div className="flex items-center gap-5 mb-6">
        <UserBadge 
          login={p.user.login} 
          imageUrl={p.user.imageUrl} 
          firstName={p.user.firstName}
          lastName={p.user.lastName}
          size="xl" 
        />
        <div className="min-w-0">
          <div className="text-xs text-muted-2 mt-1 flex flex-wrap items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              {t('profil.campus')} · {p.user.campus ?? '—'}
            </span>
            <span className="bg-gold/10 border border-gold/30 text-gold px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider font-mono tabular-nums">
              {p.user.elo} ELO
            </span>
            {onlineHost && <OnlineBadge host={onlineHost} />}
          </div>
          {p.user.title && (
            <div className="text-gold italic text-sm mt-1.5">« {p.user.title} »</div>
          )}
          {p.badges && p.badges.length > 0 && (
            <div className="mt-2">
              <BadgesRow codes={p.badges} />
            </div>
          )}
          {!isMe && myLogin && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() =>
                navigate(`/h2h?a=${encodeURIComponent(myLogin)}&b=${encodeURIComponent(p.user.login)}`)
              }
            >
              <Swords className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
              Voir le Head-to-Head
            </Button>
          )}
        </div>
      </div>

      {me?.isAdmin && (
        <div className="mb-4 p-3 bg-bg-2 border border-border rounded flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
            ★ Admin · Titre
          </span>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            maxLength={40}
            placeholder="ex. Le Maître"
            className="flex-1 min-w-[160px] px-3 py-1.5 bg-bg-0 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
          />
          <Button
            size="sm"
            onClick={async () => {
              try {
                const tval = titleDraft.trim();
                await api.setUserTitle(p.user.login, tval || null);
                flash.show(tval ? `Titre défini : « ${tval} »` : 'Titre retiré');
                await load();
                await refresh();
              } catch (err) {
                flash.show(err instanceof Error ? err.message : String(err), 'error');
              }
            }}
          >
            Enregistrer
          </Button>
          {p.user.title && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await api.setUserTitle(p.user.login, null);
                  flash.show('Titre retiré');
                  await load();
                  await refresh();
                } catch (err) {
                  flash.show(err instanceof Error ? err.message : String(err), 'error');
                }
              }}
            >
              Effacer
            </Button>
          )}
        </div>
      )}

      <DeclareOpsBox
        playerLogin={p.user.login}
        isMe={isMe}
        opsMe={opsMe}
        opsForPlayer={opsForPlayer}
        onDeclared={async () => {
          await load();
          await refresh();
        }}
        confirm={confirm}
        flash={flash}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 mb-4">
        <StatCard value={String(p.rank ?? '—')} label={t('profil.rank')} tone="teal" />
        <StatCard value={String(p.user.matchesPlayed)} label={t('profil.matchesElo')} tone="teal" />
        <StatCard
          value={`${winRate}%`}
          label={t('profil.winRate')}
          tone={winRate >= 50 ? 'win' : 'loss'}
        />
        <StatCard
          value={String(p.user.dodgeCount ?? 0)}
          label={t('profil.dodges')}
          tone={p.user.dodgeCount ? 'loss' : 'neutral'}
        />
      </div>

      <div className="space-y-1.5 mb-6 text-sm card-hud rounded-xl px-4 py-3">
        <div className="flex justify-between border-b border-gold/10 pb-1.5">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">{t('profil.wins')}</span>
          <span className="text-gold font-display font-extrabold tabular-nums">{p.wins}</span>
        </div>
        <div className="flex justify-between border-b border-gold/10 pb-1.5">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">{t('profil.losses')}</span>
          <span className="text-red font-display font-extrabold tabular-nums">{p.losses}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">{t('profil.registeredSince')}</span>
          <span className="text-text font-mono">
            {new Date(p.user.createdAt).toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Courbe d'évolution ELO — comme sur son propre profil */}
      {p.recent.length >= 2 && (
        <div className="mb-6 card-hud rounded-xl px-4 pt-3 pb-4 border-gold/20">
          <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
            {t('profil.eloEvolution')}
            <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
          </div>
          <EloChart
            matches={p.recent}
            myLogin={p.user.login}
            currentElo={p.user.elo}
            height={104}
          />
        </div>
      )}

      {p.recent.length > 0 && (
        <>
          <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-text-strong mb-3 mt-6">
            {t('profil.recent')}
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted">
                  <th className="text-left px-2 sm:px-3 py-2">{t('history.col.date')}</th>
                  <th className="text-left px-2 sm:px-3 py-2">{t('history.col.opp')}</th>
                  <th className="text-right px-2 sm:px-3 py-2">{t('history.col.score')}</th>
                  <th className="text-right px-2 sm:px-3 py-2">{t('history.col.result')}</th>
                </tr>
              </thead>
              <tbody>
                {p.recent.slice(0, 20).map((m) => {
                  const isA = m.playerALogin === p.user.login;
                  const opp = isA ? m.playerBLogin : m.playerALogin;
                  const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
                  const sYou = isA ? m.scoreA : m.scoreB;
                  const sOpp = isA ? m.scoreB : m.scoreA;
                  return (
                    <tr key={m.id} className="border-t border-border/40">
                      <td className="px-2 sm:px-3 py-2 text-muted-2 text-xs whitespace-nowrap">
                        {fmtDatePair(m.playedAt, lang).short}
                        <span className="mx-1 opacity-40">·</span>
                        <span className="text-muted">{fmtDatePair(m.playedAt, lang).long}</span>
                      </td>
                      <td className="px-2 sm:px-3 py-2">
                        <PlayerLink login={opp}>{opp}</PlayerLink>
                      </td>
                      <td className="px-2 sm:px-3 py-2 text-right tabular-nums">
                        {sYou}–{sOpp}
                      </td>
                      <td
                        className={`px-2 sm:px-3 py-2 text-right text-[10px] uppercase font-extrabold ${won ? 'text-gold' : 'text-red'}`}
                      >
                        {won ? t('history.win') : t('history.loss')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

interface DeclareOpsBoxProps {
  playerLogin: string;
  isMe: boolean;
  opsMe: ReturnType<typeof useLeagueData>['opsMe'];
  opsForPlayer: OpsUserResponse | null;
  onDeclared: () => Promise<void>;
  confirm: ReturnType<typeof useConfirm>;
  flash: ReturnType<typeof useFlash>;
}

function DeclareOpsBox({
  playerLogin,
  isMe,
  opsMe,
  opsForPlayer,
  onDeclared,
  confirm,
  flash,
}: DeclareOpsBoxProps) {
  if (isMe) return null;

  // Already this player's ops owner
  if (opsMe?.current && opsMe.current.targetLogin === playerLogin) {
    return (
      <div className="p-3 border border-red/50 bg-red/[0.06] rounded text-red text-sm font-semibold">
        ☠ {playerLogin} est ton ops · {fmtCountdown(opsMe.current.expiresAt)} restants
      </div>
    );
  }

  const reasons: string[] = [];
  if (opsMe?.current) {
    reasons.push(
      `Tu as déjà un ops actif (${opsMe.current.targetLogin}) jusqu'au ${new Date(opsMe.current.expiresAt).toLocaleDateString('fr-FR')}.`,
    );
  } else if (opsMe?.canDeclareAt) {
    reasons.push(`Cooldown actif · prochain ops dispo dans ${fmtCountdown(opsMe.canDeclareAt)}.`);
  }
  if (opsForPlayer?.targetedBy && opsForPlayer.targetedBy.ownerLogin !== undefined) {
    reasons.push(`${playerLogin} est déjà l'ops de ${opsForPlayer.targetedBy.ownerLogin}.`);
  }
  if (opsForPlayer?.owns) {
    reasons.push(`${playerLogin} a actuellement ${opsForPlayer.owns.targetLogin} comme ops.`);
  }

  if (reasons.length > 0) {
    return (
      <div className="p-3 border border-border bg-bg-2/60 rounded text-sm text-muted-2 space-y-1.5">
        <div className="text-red font-extrabold text-[10px] uppercase tracking-wider">
          ☠ OPS — indisponible
        </div>
        {reasons.map((r, i) => (
          <div key={i}>{r}</div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 border border-red/40 bg-red/[0.04] rounded">
      <div className="text-red font-extrabold text-[10px] uppercase tracking-wider mb-2">
        ☠ OPS
      </div>
      <div className="text-sm text-text mb-3 leading-relaxed space-y-1.5">
        <p>
          Déclarer {playerLogin} comme ton ops ouvre une <span className="font-semibold">traque de 24h</span>.
        </p>
        <ul className="space-y-1 pl-3 border-l border-red/30 text-muted-2 text-[13px]">
          <li>Il ne pourra pas refuser tes <span className="text-text font-semibold">3 prochains défis</span>.</li>
          <li>S'il en refuse un, il perd <span className="text-red font-semibold">3× l'ELO d'une défaite</span>.</li>
          <li>Un seul ops à la fois · cooldown d'1 semaine après.</li>
        </ul>
      </div>
      <Button
        variant="danger"
        size="sm"
        onClick={async () => {
          const ok = await confirm({
            title: `Déclarer ${playerLogin} comme ton ops ?`,
            message: `Tu ouvres une traque de 24h sur ${playerLogin}. Il ne pourra pas refuser tes 3 prochains défis — sous peine de perdre 3× l'ELO d'une défaite. Action unilatérale, pas d'acceptation requise. Cooldown d'1 semaine ensuite.`,
          });
          if (!ok) return;
          try {
            await api.declareOps(playerLogin);
            flash.show(`☠ ${playerLogin} est ton ops`);
            await onDeclared();
          } catch (err) {
            flash.show(err instanceof Error ? err.message : String(err), 'error');
          }
        }}
      >
        ☠ Déclarer comme mon ops
      </Button>
    </div>
  );
}
