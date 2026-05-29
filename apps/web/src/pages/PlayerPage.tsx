import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { UserBadge } from '../components/Avatar';
import { Button } from '../components/Button';
import { StatCard } from '../components/StatCard';
import { PlayerLink } from '../components/PlayerLink';
import {
  api,
  type OpsUserResponse,
  type UserProfile,
} from '../lib/api';
import { fmtCountdown, fmtDate } from '../lib/format';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useI18n, useT } from '../lib/i18n';

export function PlayerPage() {
  const { login: rawLogin } = useParams<{ login: string }>();
  const login = rawLogin ?? '';
  const t = useT();
  const { locale } = useI18n();
  const { me, opsMe, refresh } = useLeagueData();
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
      <Panel title={login || 'Joueur'} sub="Profil 42 League">
        <div className="text-center text-muted-2 py-10">Chargement…</div>
      </Panel>
    );
  }
  if (!profile) {
    return (
      <Panel title={login} sub="Profil 42 League">
        <div className="text-center text-muted-2 py-10">
          {login} n'est pas inscrit dans la league.
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

  return (
    <Panel title={p.user.firstName && p.user.lastName ? `${p.user.firstName} ${p.user.lastName}` : p.user.login} sub="Profil 42 League">
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
            <span className="metal-plate-gold px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider font-mono tabular-nums">
              {p.user.elo} ELO
            </span>
          </div>
          {p.user.title && (
            <div className="text-gold italic text-sm mt-1.5">« {p.user.title} »</div>
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
        <StatCard value={String(p.rank ?? '—')} label="Rang" tone="teal" />
        <StatCard value={String(p.user.matchesPlayed)} label="Matchs ELO" tone="teal" />
        <StatCard
          value={`${winRate}%`}
          label="Win rate"
          tone={winRate >= 50 ? 'win' : 'loss'}
        />
        <StatCard
          value={String(p.user.dodgeCount ?? 0)}
          label="Fuites"
          tone={p.user.dodgeCount ? 'loss' : 'neutral'}
        />
      </div>

      <div className="space-y-1.5 mb-6 text-sm card-hud rounded-xl px-4 py-3">
        <div className="flex justify-between border-b border-gold/10 pb-1.5">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">Victoires</span>
          <span className="text-gold font-display font-extrabold tabular-nums">{p.wins}</span>
        </div>
        <div className="flex justify-between border-b border-gold/10 pb-1.5">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">Défaites</span>
          <span className="text-red font-display font-extrabold tabular-nums">{p.losses}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-2 uppercase tracking-wider text-xs font-medium">Inscrit depuis</span>
          <span className="text-text font-mono">
            {new Date(p.user.createdAt).toLocaleDateString(locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {p.recent.length > 0 && (
        <>
          <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-text-strong mb-3 mt-6">
            Derniers matchs
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted">
                  <th className="text-left px-2 sm:px-3 py-2">Date</th>
                  <th className="text-left px-2 sm:px-3 py-2">Adversaire</th>
                  <th className="text-right px-2 sm:px-3 py-2">Score</th>
                  <th className="text-right px-2 sm:px-3 py-2">Résultat</th>
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
                      <td className="px-2 sm:px-3 py-2 text-muted-2 text-xs">
                        {fmtDate(m.playedAt, locale)}
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
                        {won ? 'VICTOIRE' : 'DÉFAITE'}
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
      <div className="text-sm text-text mb-3 leading-relaxed">
        Déclarer {playerLogin} comme ton ops le verrouille pour 1 semaine. Il ne pourra
        pas avoir d'ops pendant ce temps. Cooldown de 1 semaine après.
      </div>
      <Button
        variant="danger"
        size="sm"
        onClick={async () => {
          const ok = await confirm({
            title: `Déclarer ${playerLogin} comme ton ops ?`,
            message: `${playerLogin} sera ton ops pendant 7 jours. Tu seras en cooldown 7 jours après. Action unilatérale, pas d'acceptation requise.`,
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
