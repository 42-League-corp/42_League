import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Globe2, User, TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useI18n, useT } from '../../lib/i18n';
import { useHistoriqueLogic } from './shared/useHistoriqueLogic';
import { GlobalMatchCard, MyMatchCard } from './shared/MatchCards';

/**
 * Vue desktop de l'Historique — pensée « dashboard esport » : on n'enferme plus
 * la liste dans une colonne étroite, on scinde l'écran en DEUX panneaux côte à
 * côte qui occupent toute la largeur :
 *   • à gauche, l'historique GLOBAL du babyfoot (toutes les games de la league) ;
 *   • à droite, MON historique perso, surmonté d'un bandeau de stats (W/L, WR, ELO net).
 * Chaque panneau scrolle indépendamment → la page reste compacte, jamais un long
 * ruban vertical.
 */
export function HistoriqueDesktop() {
  const t = useT();
  const { lang } = useI18n();
  const data = useHistoriqueLogic();
  const { leaderboard } = useLeagueData();

  const imgByLogin = useMemo(
    () => new Map(leaderboard.map((u) => [u.login, u.imageUrl] as const)),
    [leaderboard],
  );

  // Stats perso agrégées sur les games affichées.
  const stats = useMemo(() => {
    const total = data.mine.length;
    const wins = data.mine.filter((s) => s.won).length;
    const netElo = data.mine.reduce((acc, s) => acc + s.delta, 0);
    return {
      total,
      wins,
      losses: total - wins,
      wr: total ? Math.round((wins / total) * 100) : 0,
      netElo,
    };
  }, [data.mine]);

  return (
    <Panel title={t('panel.history.title')} sub={t('history.global.sub')}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ─── Colonne GLOBALE ─────────────────────────────────────────── */}
        <HistoColumn
          Icon={Globe2}
          title={t('history.tab.global')}
          count={data.global.length}
        >
          {data.global.length === 0 ? (
            <EmptyState text={t('history.empty')} />
          ) : (
            data.global
              .slice(0, 80)
              .map((m, i) => (
                <GlobalMatchCard
                  key={m.id}
                  match={m}
                  lang={lang}
                  imgByLogin={imgByLogin}
                  delay={Math.min(i, 10) * 0.015}
                />
              ))
          )}
        </HistoColumn>

        {/* ─── Colonne PERSO ───────────────────────────────────────────── */}
        <HistoColumn
          Icon={User}
          title={t('history.tab.mine')}
          count={data.mine.length}
          header={data.mine.length > 0 ? <MyStatsStrip {...stats} /> : undefined}
        >
          {data.mine.length === 0 ? (
            <EmptyState text={t('history.empty.mine')} />
          ) : (
            data.mine
              .slice(0, 80)
              .map((s, i) => (
                <MyMatchCard
                  key={s.match.id}
                  stat={s}
                  lang={lang}
                  imageUrl={imgByLogin.get(s.opponent)}
                  delay={Math.min(i, 10) * 0.015}
                />
              ))
          )}
        </HistoColumn>
      </div>
    </Panel>
  );
}

// ─── Panneau scrollable avec en-tête ──────────────────────────────────────────

interface HistoColumnProps {
  Icon: typeof Globe2;
  title: string;
  count: number;
  /** En-tête optionnel (bandeau de stats), affiché sous le titre. */
  header?: ReactNode;
  children: ReactNode;
}

function HistoColumn({ Icon, title, count, header, children }: HistoColumnProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-bg-1/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-2/40">
        <Icon className="w-4 h-4 text-gold" strokeWidth={2.5} />
        <h3 className="font-gaming text-xs font-extrabold uppercase tracking-[0.16em] text-text-strong">
          {title}
        </h3>
        <span className="ml-auto text-[10px] font-mono tabular-nums text-muted-2 bg-bg-2/60 px-2 py-0.5 rounded-md border border-border">
          {count}
        </span>
      </div>
      {header && <div className="px-3 pt-3">{header}</div>}
      <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar lg:max-h-[68vh]">
        {children}
      </div>
    </div>
  );
}

// ─── Bandeau de stats perso ───────────────────────────────────────────────────

interface MyStatsStripProps {
  total: number;
  wins: number;
  losses: number;
  wr: number;
  netElo: number;
}

function MyStatsStrip({ total, wins, losses, wr, netElo }: MyStatsStripProps) {
  const eloUp = netElo > 0;
  const EloIcon = eloUp ? TrendingUp : TrendingDown;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-3 gap-2 mb-1"
    >
      <Stat label="Games" value={String(total)} sub={`${wins}V · ${losses}D`} />
      <Stat label="Win rate" value={`${wr}%`} accent={wr >= 50 ? 'accent' : 'red'} />
      <Stat
        label="ELO net"
        value={`${netElo > 0 ? '+' : ''}${netElo}`}
        accent={netElo === 0 ? 'muted' : eloUp ? 'accent' : 'red'}
        Icon={netElo !== 0 ? EloIcon : undefined}
      />
    </motion.div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = 'gold',
  Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'gold' | 'accent' | 'red' | 'muted';
  Icon?: typeof TrendingUp;
}) {
  const color =
    accent === 'accent'
      ? 'text-accent'
      : accent === 'red'
        ? 'text-red'
        : accent === 'muted'
          ? 'text-muted-2'
          : 'text-gold';
  return (
    <div className="rounded-xl border border-border bg-bg-2/40 px-3 py-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted font-extrabold mb-0.5">
        {label}
      </div>
      <div
        className={`font-display font-black tabular-nums text-lg leading-none flex items-center justify-center gap-1 ${color}`}
      >
        {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={2.75} />}
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-2 font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3 opacity-50">🏓</div>
      <div className="text-sm text-muted-2 font-medium">{text}</div>
    </div>
  );
}
