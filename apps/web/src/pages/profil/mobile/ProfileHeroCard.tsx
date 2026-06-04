import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Flame, MapPin, TrendingDown, TrendingUp } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { FavoriteCharsRow } from '../../../components/FavoriteCharsRow';
import { FavoriteCharsEditor } from '../../../components/FavoriteCharsEditor';
import { favoritesForGame, type FightingGame } from '../../../lib/chars';
import { RankBadge } from '../../../components/RankBadge';
import { Tooltip } from '../../../components/Tooltip';
import { BadgesRow } from '../../../components/Badges';
import { AnimatedCounter } from '../../../mobile/primitives/AnimatedCounter';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useGameMode } from '../../../hooks/useGameMode';
import { pickRating } from '../../../lib/gameStats';
import { gameColor, GAME_EMOJI, GAME_LOGO_SRC } from '../../../lib/gameVisuals';
import { displayTitle } from '../../../lib/cosmeticTitles';
import { TitlePicker } from '../../../components/TitlePicker';
import { BannerPicker } from '../../../components/BannerPicker';
import { useT } from '../../../lib/i18n';
import type { MeResponse } from '../../../lib/api';
import type { ProfilStats } from '../shared/useProfilLogic';

type HeroUser = NonNullable<MeResponse['user']>;

interface ProfileHeroCardProps {
  stats: ProfilStats;
  /** Joueur affiché. Défaut = utilisateur courant (profil perso). */
  user?: HeroUser;
  /** Badges du joueur affiché. Défaut = badges de l'utilisateur courant. */
  badges?: string[];
  /** true = profil perso → affiche le sélecteur de titre. Défaut true. */
  isMe?: boolean;
  /** Cosmétiques équipés du joueur affiché (sinon ceux de `me` quand isMe). */
  titleColor?: string | null;
  equippedBadge?: MeResponse['equippedBadge'];
  equippedBanner?: string | null;
}

/**
 * Hero card "profil" — variante plus riche que celle de Défis :
 * affiche delta 7j, streak signée, % du top, longest streak.
 * Réutilisée telle quelle pour la fiche d'un autre joueur (`isMe=false`).
 */
export function ProfileHeroCard({
  stats,
  user: userProp,
  badges: badgesProp,
  isMe = true,
  titleColor: titleColorProp,
  equippedBadge: equippedBadgeProp,
  equippedBanner: equippedBannerProp,
}: ProfileHeroCardProps) {
  const { me, leaderboard, refresh } = useLeagueData();
  const { game } = useGameMode();
  const t = useT();
  const reducedMotion = useReducedMotion();
  const [editGame, setEditGame] = useState<FightingGame | null>(null);
  // Cosmétiques équipés : props (autre joueur) sinon ceux de `me` (profil perso).
  const titleColor = titleColorProp ?? (isMe ? me?.titleColor : null) ?? null;
  const equippedBadge = equippedBadgeProp ?? (isMe ? me?.equippedBadge : null) ?? null;
  const equippedBanner = equippedBannerProp ?? (isMe ? me?.equippedBanner : null) ?? null;
  const user = userProp ?? me?.user;
  const badges = badgesProp ?? me?.badges;
  if (!user) return null;

  // Jeux de combat où ce joueur est inscrit → afficher ses persos favoris.
  const fightingGames = (['smash', 'streetfighter'] as const).filter((g) =>
    (user.games ?? ['babyfoot']).includes(g),
  );
  const titlesWon = pickRating(user, game).tournamentsWon;

  // Titre équipé : null si aucun (ni override cosmétique, ni titre réel) → on
  // affiche « sans éclat. » GRISÉ (pas en or, pas de couleur custom), comme l'état
  // NONE du sélecteur.
  const equippedTitle = displayTitle(user.login, user.title, null);
  const isTarnished = !equippedTitle;
  const titleLabel = equippedTitle ?? t('profil.title.tarnished');
  const effectiveTitleColor = isTarnished ? null : titleColor;

  // Badges cross-jeux : toutes les disciplines où ce joueur est INSCRIT
  // (même sans match joué), hormis le mode courant déjà affiché en grand.
  const crossGameBadges = (['babyfoot', 'smash', 'chess', 'streetfighter'] as const)
    .filter((g) => g !== game && (user.games ?? ['babyfoot']).includes(g))
    .map((g) => {
      const r = pickRating(user, g);
      return { g, elo: r.elo };
    });

  const myEntry = leaderboard.find((u) => u.login === user.login);
  const myRank = myEntry?.rank ?? 0;
  // Affiche prénom + nom (depuis l'intra) plutôt que le login (évite la
  // répétition avec le @login juste en dessous). Fallback login si absent.
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    [myEntry?.firstName, myEntry?.lastName].filter(Boolean).join(' ').trim() ||
    user.login;
  const isTop1 = myRank === 1;
  const isTop3 = myRank > 0 && myRank <= 3;
  const isTop10 = myRank > 0 && myRank <= 10;
  const topPercent =
    leaderboard.length > 0 && myRank > 0
      ? Math.max(1, Math.round((myRank / leaderboard.length) * 100))
      : 0;

  const streakAbs = Math.abs(stats.currentStreak);
  const onWinStreak = stats.currentStreak > 0;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl no-select gpu"
      style={{
        background:
          'linear-gradient(180deg, #2a241c 0%, #1d1914 18%, #15120e 50%, #1d1914 82%, #2a241c 100%)',
        border: '1px solid rgba(255, 201, 74, 0.4)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 215, 120, 0.18), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 36px -8px rgba(255, 201, 74, 0.22)',
      }}
    >
      {/* Bannière équipée (boutique) = fond de la carte, par-dessus le dégradé.
          Voile sombre pour garder la lisibilité du contenu. */}
      {equippedBanner && (
        <>
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: `url(${equippedBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div aria-hidden className="absolute inset-0 pointer-events-none bg-black/45" />
        </>
      )}
      {/* Tubes laiton décoratifs */}
      <div className="absolute top-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-3 right-3 h-[2px] brass-pipe rounded-full pointer-events-none" />
      {/* Holographic conic — gated on prefers-reduced-motion (perf + a11y + batterie) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-25 pointer-events-none gpu"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255,201,74,0.35) 60deg, transparent 120deg, rgba(192,138,74,0.25) 200deg, transparent 260deg, rgba(255,201,74,0.25) 340deg, transparent 360deg)',
            filter: 'blur(50px)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Grille cyber */}
      <div
        aria-hidden
        className="absolute inset-0 hud-grid opacity-50 pointer-events-none"
      />

      <div className="relative z-10 px-5 pt-5 pb-5">
        {/* Titre équipé — bannière dorée centrée en HAUT de la carte. Par défaut
            « sans éclat. » quand aucun titre n'est équipé. Le sélecteur (sur SON
            profil) est une flèche qui suit immédiatement la fin du titre. */}
        <div className="relative flex items-center justify-center gap-1.5 mb-4">
          <span
            className="inline-flex items-center gap-1.5 max-w-[80%] min-w-0"
            style={effectiveTitleColor ? { color: effectiveTitleColor } : undefined}
          >
            <span className={`text-base leading-none opacity-70 ${isTarnished ? 'text-muted-2' : effectiveTitleColor ? '' : 'text-gold/70'}`}>❝</span>
            <span className={`italic text-base font-bold tracking-wide truncate ${isTarnished ? 'text-muted-2' : effectiveTitleColor ? '' : 'text-gold'}`}>
              {titleLabel}
            </span>
            <span className={`text-base leading-none opacity-70 ${isTarnished ? 'text-muted-2' : effectiveTitleColor ? '' : 'text-gold/70'}`}>❞</span>
          </span>
          {isMe && <TitlePicker className="shrink-0" />}
          {isMe && <BannerPicker className="absolute left-0" />}
        </div>

        {/* Header row : avatar + identity à gauche, rank badge à droite */}
        <div className="flex items-start gap-4 mb-5">
          <div className="relative flex-shrink-0">
            <div
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,201,74,0.4) 0%, transparent 70%)',
                filter: 'blur(10px)',
              }}
            />
            <Avatar
              login={user.login}
              imageUrl={user.imageUrl}
              size="lg"
              className="relative"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-xl font-extrabold text-text-strong tracking-tight truncate min-w-0">
                {fullName}
              </h2>
              {((badges && badges.length > 0) || equippedBadge) && (
                <div className="flex-shrink-0">
                  <BadgesRow codes={badges ?? []} extra={equippedBadge ? [equippedBadge] : []} size="md" />
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-2 font-mono truncate">@{user.login}</div>
            {user.campus && (
              <div className="inline-flex items-center gap-1 text-[10px] text-muted mt-1 font-medium uppercase tracking-wider">
                <MapPin className="w-3 h-3" strokeWidth={2.5} />
                <span>{user.campus}</span>
              </div>
            )}
          </div>

          {myRank > 0 && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.3 }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-extrabold tabular-nums tracking-wide flex-shrink-0 ${
                isTop1
                  ? 'metal-plate-gold shadow-gold-glow'
                  : isTop3
                    ? 'bg-bg-1/80 text-gold border border-gold/50'
                    : isTop10
                      ? 'bg-bg-1/80 text-gold border border-gold/30'
                      : 'bg-bg-1/80 text-muted-2 border border-border'
              }`}
            >
              {isTop1 && <Crown className="w-3 h-3" strokeWidth={2.5} />}
              <span>#{myRank}</span>
            </motion.div>
          )}
        </div>

        {/* ELO bloc */}
        <div className="flex items-end justify-between gap-4 mb-2 px-1">
          <div>
            <div className="ml-1.5 mb-0.5 text-[10px] text-muted uppercase tracking-[0.32em] font-extrabold flex items-center gap-1.5">
              ELO
              <RankBadge elo={stats.elo} size="xs" />
            </div>
            <div className="font-display text-[clamp(2.75rem,13vw,3.5rem)] font-black leading-none tabular-nums tracking-tighter text-gold-emboss">
              <AnimatedCounter value={stats.elo} duration={1.4} />
            </div>
          </div>

          {/* Delta 7j */}
          {stats.delta7d !== 0 && (
            <div
              className={`flex flex-col items-end ${stats.delta7d > 0 ? 'text-gold' : 'text-red'}`}
            >
              <div className="flex items-center gap-1 font-mono text-lg font-extrabold tabular-nums">
                {stats.delta7d > 0 ? (
                  <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <TrendingDown className="w-4 h-4" strokeWidth={2.5} />
                )}
                <span>
                  {stats.delta7d > 0 ? '+' : ''}
                  {stats.delta7d}
                </span>
              </div>
              <div className="text-[9px] text-muted uppercase tracking-wider font-bold">
                {t('profil.last7days')}
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <StatPill label={t('lb.abbr.win')} value={stats.wins} tone="teal" />
          <StatPill label={t('lb.abbr.loss')} value={stats.losses} tone="red" />
          <StatPill label="WR" value={`${stats.winRate}%`} tone="gold" />
          <StatPill
            label="STREAK"
            value={`${stats.currentStreak > 0 ? '+' : ''}${stats.currentStreak}`}
            tone={onWinStreak && streakAbs >= 3 ? 'fire' : onWinStreak ? 'teal' : 'red'}
            icon={onWinStreak && streakAbs >= 3 ? <Flame className="w-3 h-3" strokeWidth={2.5} /> : undefined}
          />
        </div>

        {/* Solde League Coin — sur SON profil. Bandeau lisible avec libellé. */}
        {isMe && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 bg-violet-500/10 border border-violet-400/25">
            <img src="/42coin.png" alt="" className="w-5 h-5 shrink-0" />
            <span className="text-[11px] uppercase tracking-[0.16em] font-extrabold text-violet-200/90">
              League Coins
            </span>
            <span className="ml-auto font-display text-xl font-black tabular-nums text-violet-100">
              {me?.coins ?? 0}
            </span>
          </div>
        )}

        {/* Autres disciplines — section lisible, intégrée dans la carte héro */}
        {crossGameBadges.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <div className="text-[8px] uppercase tracking-[0.20em] font-extrabold text-muted-2 mb-2">
              {t('profil.alsoActiveOn')}
            </div>
            <div className="flex items-center gap-2">
              {crossGameBadges.map(({ g, elo }) => {
                const c = gameColor(g);
                return (
                  <div
                    key={g}
                    className="flex-1 rounded-xl px-2 py-2.5 flex flex-col items-center gap-1"
                    style={{
                      background: `linear-gradient(180deg, ${c}1f 0%, rgba(255,255,255,0.03) 100%)`,
                      border: `1px solid ${c}59`,
                    }}
                  >
                    {/* Pastille colorée — logo du mode bien visible */}
                    <span
                      className="flex items-center justify-center w-10 h-10 rounded-full"
                      style={{
                        background: `radial-gradient(circle at 50% 35%, ${c}3d 0%, ${c}14 70%, transparent 100%)`,
                        border: `1.5px solid ${c}`,
                        boxShadow: `0 0 12px -2px ${c}80`,
                      }}
                    >
                      {GAME_LOGO_SRC[g] ? (
                        <img
                          src={GAME_LOGO_SRC[g]}
                          alt=""
                          aria-hidden
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <span className="text-2xl leading-none">{GAME_EMOJI[g]}</span>
                      )}
                    </span>
                    <span
                      className="font-display font-black tabular-nums text-base leading-none"
                      style={{ color: c, textShadow: `0 0 10px ${c}66` }}
                    >
                      {elo}
                    </span>
                    <span
                      className="text-[8px] uppercase tracking-[0.08em] font-extrabold text-center leading-tight"
                      style={{ color: `${c}b3` }}
                    >
                      {t(`game.${g}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Persos favoris — un gros rond logo par jeu de combat (clic = sélecteur). */}
        {fightingGames.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.07]">
            <div className="text-[8px] uppercase tracking-[0.20em] font-extrabold text-muted-2 mb-2">
              {t('favorites.label')}
            </div>
            <div className="flex items-center justify-center gap-5">
              {fightingGames.map((g) => (
                <FavoriteCharsRow
                  key={g}
                  game={g}
                  ids={favoritesForGame(user, g)}
                  onEdit={isMe ? () => setEditGame(g) : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer stats */}
        {/* Footer stats — le nombre de colonnes suit le nombre de stats réellement
            affichées (2 ou 3) → reste centré quelle que soit la largeur (ex.
            « best streak » centré même sans % du top ni dodges). */}
        {(() => {
          const footStats: React.ReactNode[] = [
            <FooterStat key="titles" label={t('profil.titlesWon')} value={titlesWon} tone="gold" />,
            <FooterStat
              key="streak"
              label={t('profil.bestStreak')}
              value={stats.longestWinStreak}
              suffix="W"
              tooltip={
                stats.longestWinStreak === 0
                  ? undefined
                  : stats.streakBrokenBy
                    ? `${t('profil.streakBrokenBy')} @${stats.streakBrokenBy}`
                    : t('profil.streakOngoing')
              }
            />,
          ];
          if (topPercent > 0)
            footStats.push(<FooterStat key="top" label={t('profil.fromTop')} value={`${topPercent}%`} tone="teal" />);
          else if (user.dodgeCount > 0)
            footStats.push(<FooterStat key="dodge" label={t('profil.dodges')} value={user.dodgeCount} tone="red" />);
          return (
            <div
              className="mt-4 pt-3 border-t border-border/40 grid gap-3 text-center"
              style={{ gridTemplateColumns: `repeat(${footStats.length}, minmax(0, 1fr))` }}
            >
              {footStats}
            </div>
          );
        })()}
      </div>
    </motion.div>
    {isMe && editGame && (
      <FavoriteCharsEditor
        games={[editGame]}
        initial={{ [editGame]: favoritesForGame(user, editGame) }}
        onClose={() => setEditGame(null)}
        onSaved={refresh}
      />
    )}
    </>
  );
}

interface StatPillProps {
  label: string;
  value: number | string;
  tone: 'teal' | 'red' | 'gold' | 'fire';
  icon?: React.ReactNode;
}

const TONE_PILL: Record<StatPillProps['tone'], string> = {
  teal: 'text-teal',
  red: 'text-red',
  gold: 'text-gold',
  fire: 'text-gold',
};

function StatPill({ label, value, tone, icon }: StatPillProps) {
  return (
    <div className="relative metal-plate rounded-lg px-1 py-2 flex flex-col items-center gap-0.5">
      <div
        className={`relative z-10 font-display text-base font-black tabular-nums leading-none flex items-center gap-1 ${TONE_PILL[tone]}`}
        style={{ textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 10px currentColor' }}
      >
        {icon}
        <span>{value}</span>
      </div>
      <div className="relative z-10 text-[9px] text-muted-2 uppercase tracking-[0.16em] font-extrabold leading-none">
        {label}
      </div>
    </div>
  );
}

interface FooterStatProps {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: 'gold' | 'teal' | 'red' | 'default';
  /** Si présent, affiche une bulle au survol de la stat. */
  tooltip?: React.ReactNode;
}

const TONE_FOOTER: Record<NonNullable<FooterStatProps['tone']>, string> = {
  gold: 'text-gold',
  teal: 'text-teal',
  red: 'text-red',
  default: 'text-text-strong',
};

function FooterStat({ label, value, suffix, tone = 'default', tooltip }: FooterStatProps) {
  const body = (
    <>
      <div className={`text-sm font-extrabold font-mono tabular-nums ${TONE_FOOTER[tone]}`}>
        {value}
        {suffix && <span className="text-[10px] ml-0.5 opacity-70">{suffix}</span>}
      </div>
      <div className="text-[9px] text-muted uppercase tracking-wider font-bold">{label}</div>
    </>
  );
  // Même conteneur bloc (flex colonne centrée) dans les deux cas : sinon la stat
  // avec tooltip (Tooltip = inline-flex) s'aligne sur la baseline et son chiffre
  // se retrouve décalé verticalement par rapport aux <div> des autres stats.
  return (
    <div className="flex flex-col items-center justify-center">
      {tooltip ? (
        <Tooltip label={tooltip} className="cursor-help">
          <span className="flex flex-col items-center">{body}</span>
        </Tooltip>
      ) : (
        body
      )}
    </div>
  );
}
