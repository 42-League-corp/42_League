import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Crown } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { StatCard } from '../../components/StatCard';
import { RankedBadge } from '../../components/RankedBadge';
import { BadgesRow } from '../../components/Badges';
import { Palmares } from '../../components/Palmares';
import { EloChart } from '../../components/EloChart';
import { PlayerLink } from '../../components/PlayerLink';
import { FollowLists } from '../../components/FollowLists';
import { TournamentCup } from '../../components/TournamentCup';
import { SmashTrophy } from '../../components/SmashTrophy';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useI18n, useT } from '../../lib/i18n';
import { fmtCountdown } from '../../lib/format';

/**
 * Vue desktop du profil — version dense en infos avec stat cards.
 * Identique à l'ancienne ProfilPage, juste déplacée pour le Split View.
 */
export function ProfilDesktop() {
  const t = useT();
  const { locale } = useI18n();
  const { me, matches, opsMe, leaderboard, tournaments } = useLeagueData();
  const { game, isSmash } = useGameMode();
  const reducedMotion = useReducedMotion();

  const stats = useMemo(() => {
    const meUser = me?.user;
    const myLogin = me?.login;
    const my = matches.filter(
      (m) =>
        (m.game ?? 'babyfoot') === game &&
        (m.playerALogin === myLogin || m.playerBLogin === myLogin),
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
    // Tournois remportés du mode courant (la liste `tournaments` est déjà filtrée
    // par discipline), séparés amicaux / officiels (coupe rouge = officiel).
    let officialTitles = 0;
    let friendlyTitles = 0;
    for (const tour of tournaments) {
      if (tour.status !== 'finished' || tour.winnerLogin !== myLogin) continue;
      if (tour.kind === 'official') officialTitles++;
      else friendlyTitles++;
    }
    return {
      elo: (isSmash ? meUser?.eloSmash : meUser?.elo) ?? 1000,
      matchesPlayed: (isSmash ? meUser?.matchesPlayedSmash : meUser?.matchesPlayed) ?? 0,
      total,
      wins,
      losses: total - wins,
      winRate,
      totalDelta,
      officialTitles,
      friendlyTitles,
    };
  }, [me, matches, tournaments, game, isSmash]);

  if (!me?.user) {
    return (
      <Panel title={t('panel.profil.title')}>
        <div className="text-center text-muted-2 py-10">Profil indisponible.</div>
      </Panel>
    );
  }

  const u = me.user;
  const myEntry = leaderboard.find((x) => x.login === u.login);
  const myRank = myEntry?.rank ?? 0;
  const isTop1 = myRank === 1;
  // Affiche prénom + nom (depuis l'intra) plutôt que le login.
  const fullName =
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
    [myEntry?.firstName, myEntry?.lastName].filter(Boolean).join(' ').trim() ||
    u.login;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <Panel title={t('panel.profil.title')} sub={t('panel.profil.sub')} accent="user">
      {/* Hero : avatar · identité · bloc ELO — fond doré + halo holographique animé. */}
      <div
        className="relative overflow-hidden rounded-2xl mb-6 border border-gold/35"
        style={{
          background: 'linear-gradient(180deg, #2a241c 0%, #15120e 55%, #1d1914 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,215,120,0.15), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 32px -12px rgba(255,201,74,0.25)',
        }}
      >
        {/* Halo conique animé très discret (coupé si prefers-reduced-motion). */}
        {!reducedMotion && (
          <motion.div
            aria-hidden
            className="absolute inset-0 opacity-20 pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 32, ease: 'linear', repeat: Infinity }}
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,201,74,0.35) 60deg, transparent 120deg, rgba(192,138,74,0.22) 200deg, transparent 260deg, rgba(255,201,74,0.22) 340deg, transparent 360deg)',
              filter: 'blur(48px)',
            }}
          />
        )}
        {/* Filet laiton haut */}
        <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent pointer-events-none" />

        <div className="relative z-10 p-5 flex items-center gap-5">
          {/* Avatar + glow */}
          <div className="relative flex-shrink-0">
            <div
              className="absolute -inset-1.5 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,201,74,0.4) 0%, transparent 70%)', filter: 'blur(12px)' }}
            />
            <Avatar
              login={u.login}
              imageUrl={u.imageUrl}
              size="xl"
              className="relative ring-2 ring-gold/45 ring-offset-2 ring-offset-bg-2"
            />
          </div>

          {/* Identité */}
          <div className="flex-1 min-w-0">
            <div className="font-display text-3xl font-black text-text-strong truncate tracking-tight">
              {fullName}
            </div>
            <div className="text-xs text-muted-2 font-mono truncate">@{u.login}</div>
            {u.title && (
              <div className="mt-2 inline-flex items-center gap-1.5 max-w-full">
                <span className="text-gold/70 text-xl leading-none">❝</span>
                <span className="text-gold italic text-lg font-bold truncate">{u.title}</span>
                <span className="text-gold/70 text-xl leading-none">❞</span>
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-2 font-bold uppercase tracking-wider bg-bg-1/60 border border-border/60 rounded-full px-2.5 py-1">
                <MapPin className="w-3 h-3 text-gold/70" strokeWidth={2.5} />
                {u.campus ?? '—'}
              </span>
              {myRank > 0 && (
                <motion.span
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.25 }}
                  className={`inline-flex items-center gap-1 font-mono text-[11px] font-extrabold tabular-nums rounded-full px-2.5 py-1 ${
                    isTop1 ? 'metal-plate-gold shadow-gold-glow' : 'bg-bg-1/60 text-gold border border-gold/40'
                  }`}
                >
                  {isTop1 && <Crown className="w-3 h-3" strokeWidth={2.5} />}#{myRank}
                </motion.span>
              )}
            </div>
            {me.badges && me.badges.length > 0 && (
              <div className="mt-3">
                <BadgesRow codes={me.badges} size="md" />
              </div>
            )}
          </div>

          {/* Bloc ELO mis en valeur — libellé aligné sur le 1er chiffre. */}
          <div className="text-left flex-shrink-0 pl-2">
            <div
              className="font-display text-[2.75rem] leading-none font-black text-gold-emboss tabular-nums"
              style={{ textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,201,74,0.35)' }}
            >
              {stats.elo}
            </div>
            <div className="mt-1.5 flex items-center justify-start gap-1.5 text-[10px] text-muted uppercase tracking-[0.28em] font-extrabold">
              ELO
              <RankedBadge size="xs" />
            </div>
          </div>
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

      <div className="space-y-1.5 card-hud rounded-xl px-4 py-3">
        <KV label={t('profil.wins')} value={String(stats.wins)} tone="win" />
        <KV label={t('profil.losses')} value={String(stats.losses)} tone="loss" />
      </div>

      {/* Tournois remportés — amicaux vs officiels (coupe rouge = officiel). */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <TitlesCard
          label="Tournois officiels remportés"
          value={stats.officialTitles}
          accent="#ff6b6b"
          smash={isSmash}
        />
        <TitlesCard
          label="Tournois amicaux remportés"
          value={stats.friendlyTitles}
          accent={isSmash ? '#ff4d5c' : '#ffc94a'}
          smash={isSmash}
        />
      </div>

      {/* Following / Followers (style GitHub) */}
      <div className="mt-4">
        <FollowLists />
      </div>
      </Panel>

      <Panel title="Évolution & rivalité" sub="ELO · ops">
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
          game={game}
          height={140}
        />
      </div>

      {me.palmares && me.palmares.length > 0 && (
        <div className="mb-6">
          <Palmares entries={me.palmares} />
        </div>
      )}

      <OpsWidget opsMe={opsMe} locale={locale} />
      </Panel>
    </div>
  );
}

function TitlesCard({
  label,
  value,
  accent,
  smash,
}: {
  label: string;
  value: number;
  accent: string;
  smash?: boolean;
}) {
  return (
    <div className="card-hud rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      {smash ? (
        <SmashTrophy accent={accent} className="w-9 h-9 shrink-0" />
      ) : (
        <TournamentCup accent={accent} className="w-9 h-9 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-display text-2xl font-black tabular-nums leading-none" style={{ color: accent }}>
          {value}
        </div>
        <div className="text-[9px] uppercase tracking-wider text-muted-2 font-bold mt-0.5 leading-tight">
          {label}
        </div>
      </div>
    </div>
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
