import { useMemo } from 'react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { StatCard } from '../../components/StatCard';
import { EloChart } from '../../components/EloChart';
import { PlayerLink } from '../../components/PlayerLink';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useI18n, useT } from '../../lib/i18n';
import { fmtCountdown } from '../../lib/format';

/**
 * Vue desktop du profil — version dense en infos avec stat cards.
 * Identique à l'ancienne ProfilPage, juste déplacée pour le Split View.
 */
export function ProfilDesktop() {
  const t = useT();
  const { locale } = useI18n();
  const { me, matches, opsMe } = useLeagueData();

  const stats = useMemo(() => {
    const meUser = me?.user;
    const myLogin = me?.login;
    const my = matches.filter(
      (m) => m.playerALogin === myLogin || m.playerBLogin === myLogin,
    );
    const wins = my.filter((m) => {
      const youAreA = m.playerALogin === myLogin;
      return (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
    }).length;
    const total = my.length;
    const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
    const moves = my
      .filter((m) => m.countedForElo)
      .map((m) => (m.playerALogin === myLogin ? m.deltaA : m.deltaB));
    const totalDelta = moves.reduce((s, d) => s + d, 0);
    return {
      elo: meUser?.elo ?? 1000,
      matchesPlayed: meUser?.matchesPlayed ?? 0,
      total,
      wins,
      losses: total - wins,
      winRate,
      totalDelta,
    };
  }, [me, matches]);

  if (!me?.user) {
    return (
      <Panel title={t('panel.profil.title')}>
        <div className="text-center text-muted-2 py-10">Profil indisponible.</div>
      </Panel>
    );
  }

  const u = me.user;

  return (
    <Panel title={t('panel.profil.title')} sub={t('panel.profil.sub')}>
      <div className="flex items-center gap-5 mb-6">
        <Avatar login={u.login} imageUrl={u.imageUrl} size="xl" />
        <div className="min-w-0">
          <div className="font-display text-3xl font-black text-text-strong truncate tracking-tight">
            {u.login}
          </div>
          <div className="text-xs text-muted-2 mt-1 flex flex-wrap items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px]">
              {t('profil.campus')} · {u.campus ?? '—'}
            </span>
            <span className="metal-plate-gold px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider font-mono tabular-nums">
              {stats.elo} ELO
            </span>
          </div>
          {u.title && (
            <div className="text-gold italic text-sm mt-1.5">« {u.title} »</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCard value={String(stats.elo)} label={t('profil.elo')} tone="teal" />
        <StatCard value={String(stats.matchesPlayed)} label={t('profil.matchesElo')} tone="teal" />
        <StatCard
          value={`${stats.winRate}%`}
          label={t('profil.winRate')}
          tone={stats.winRate >= 50 ? 'win' : 'loss'}
        />
        <StatCard
          value={`${stats.totalDelta >= 0 ? '+' : ''}${stats.totalDelta}`}
          label={t('profil.delta')}
          tone={stats.totalDelta >= 0 ? 'win' : 'loss'}
        />
      </div>

      <div className="space-y-1.5 mb-6 card-hud rounded-xl px-4 py-3">
        <KV label={t('profil.wins')} value={String(stats.wins)} tone="win" />
        <KV label={t('profil.losses')} value={String(stats.losses)} tone="loss" />
      </div>

      {/* ELO progression chart */}
      <div className="mb-6 card-hud rounded-xl px-4 pt-3 pb-4 border-gold/20">
        <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-3 flex items-center gap-2">
          <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold/80 to-gold-dim/80 rounded-sm" />
          Évolution ELO
          <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent ml-1" />
        </div>
        <EloChart
          matches={matches}
          myLogin={u.login}
          currentElo={stats.elo}
          height={80}
          maxPoints={25}
        />
      </div>

      <OpsWidget opsMe={opsMe} locale={locale} />
    </Panel>
  );
}

function KV({ label, value, tone }: { label: string; value: string; tone: 'win' | 'loss' }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-gold/10 last:border-0 pb-1.5 last:pb-0">
      <span className="text-muted-2 font-medium uppercase tracking-wider text-xs">{label}</span>
      <span className={`font-display font-extrabold tabular-nums ${tone === 'win' ? 'text-gold' : 'text-red'}`}>
        {value}
      </span>
    </div>
  );
}

interface OpsWidgetProps {
  opsMe: ReturnType<typeof useLeagueData>['opsMe'];
  locale: string;
}

function OpsWidget({ opsMe, locale }: OpsWidgetProps) {
  return (
    <div className="mt-4 card-hud rounded-xl p-4 border-red/45">
      <div className="font-gaming flex items-center gap-2 mb-3 text-red font-extrabold text-xs uppercase tracking-[0.16em]">
        <span className="inline-block w-1 h-3 bg-red rounded-sm" />
        <span className="text-base">☠</span>
        <span>OPS · ton ennemi juré</span>
      </div>

      {!opsMe && (
        <div className="text-sm text-muted-2">
          Va sur la fiche d'un joueur (depuis le classement) pour le déclarer comme ton ops.
        </div>
      )}

      {opsMe?.current && (
        <PlayerLink login={opsMe.current.targetLogin} className="block">
          <div className="flex items-center gap-3">
            <Avatar
              login={opsMe.current.target?.login ?? opsMe.current.targetLogin}
              imageUrl={opsMe.current.target?.imageUrl ?? null}
              size="md"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-text-strong">{opsMe.current.targetLogin}</div>
              <div className="text-[11px] text-muted-2">
                traque jusqu'au{' '}
                {new Date(opsMe.current.expiresAt).toLocaleDateString(locale)} ·{' '}
                {fmtCountdown(opsMe.current.expiresAt)} restant
              </div>
            </div>
          </div>
        </PlayerLink>
      )}

      {!opsMe?.current && opsMe?.canDeclareAt && (
        <div className="text-sm text-muted-2">
          ⏳ Cooldown actif · prochain ops dispo dans {fmtCountdown(opsMe.canDeclareAt)}
        </div>
      )}

      {opsMe?.targetedBy && (
        <>
          <div className="text-[10px] text-muted-2 uppercase tracking-wider mt-3 mb-1.5">
            Tu es la cible de :
          </div>
          <PlayerLink login={opsMe.targetedBy.ownerLogin} className="block">
            <div className="flex items-center gap-3">
              <Avatar
                login={opsMe.targetedBy.owner?.login ?? opsMe.targetedBy.ownerLogin}
                imageUrl={opsMe.targetedBy.owner?.imageUrl ?? null}
                size="md"
              />
              <div className="min-w-0">
                <div className="font-extrabold text-text-strong">{opsMe.targetedBy.ownerLogin}</div>
                <div className="text-[11px] text-muted-2">
                  te traque · libère dans {fmtCountdown(opsMe.targetedBy.expiresAt)}
                </div>
              </div>
            </div>
          </PlayerLink>
        </>
      )}
    </div>
  );
}
