import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Lock,
  Check,
  Image as ImageIcon,
  Swords,
  Target,
  Dices,
  Gem,
  ArrowUp,
  ArrowDown,
  PackageOpen,
  Eye,
  ShieldBan,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ProfilePreviewModal } from '../components/shop/ProfilePreviewModal';
import { Panel } from '../components/Panel';
import { CoinCount } from '../components/CoinCount';
import { Skeleton } from '../mobile/primitives/Skeleton';
import { badgeIcon } from '../lib/badgeIcons';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useT } from '../lib/i18n';
import {
  api,
  type InventoryEntry,
  type ShopCategory,
  type ShopItemData,
} from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { RARITY, RARITY_ORDER, resolveRarity, type Rarity } from '../lib/rarity';

/** Critères de tri proposés sous la barre de catégories. */
type SortKey = 'name' | 'price' | 'rarity';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['name', 'price', 'rarity'];

/** Catégories pour lesquelles « équiper » a du sens (titre / bannière actifs). */
const EQUIPPABLE: ShopCategory[] = ['title', 'banner'];

/** Ordre d'affichage stable des catégories dans la barre de filtres. */
const CATEGORY_ORDER: ShopCategory[] = ['title', 'banner', 'consumable', 'mystery_box'];

/** Catégories masquées de la boutique (achat impossible). */
const HIDDEN_CATS: ShopCategory[] = ['badge'];

/** Nombre minimum de cases affichées : la grille est comblée par des cartes
 *  placeholder « Bientôt » pour qu'elle paraisse toujours pleine, même quand le
 *  catalogue réel est vide ou peu fourni. */
const MIN_TILES = 6;
const PLACEHOLDER_CATS: ShopCategory[] = ['banner', 'title', 'badge'];

/* ─────────────────────────────────────────────────────────────────────────
 * Système de rareté — désormais un champ EXPLICITE de l'objet (choisi dans
 * Shop GOD), avec repli sur une déduction par le prix pour les objets antérieurs.
 * Couleurs, halos et libellés sont partagés via `lib/rarity` (source unique).
 * ──────────────────────────────────────────────────────────────────────── */

function CoinAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <img src="/42coin.png" alt="" className="w-4 h-4" />
      {value}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Guide « comment gagner des coins » — 3 méthodes claires, chacune avec son
 * accent de couleur, sa grosse valeur chiffrée et une explication courte.
 * C'est la pièce maîtresse pédagogique de la page.
 * ──────────────────────────────────────────────────────────────────────── */
interface EarnMethod {
  key: 'match' | 'quests' | 'bets';
  icon: LucideIcon;
  /** Valeur mise en avant (chiffre ou ×2). */
  value: string;
  /** Affiche l'icône 42coin avant la valeur (vrai pour des montants de coins). */
  coin: boolean;
  /** Jeu de classes Tailwind statiques propre à la méthode (couleurs figées
   *  pour rester compatibles avec le JIT — pas de classe construite à la volée). */
  ring: string;
  tile: string;
  iconColor: string;
  valueColor: string;
  glow: string;
}

const EARN_METHODS: EarnMethod[] = [
  {
    key: 'match',
    icon: Swords,
    value: '20–50',
    coin: true,
    ring: 'border-gold/30 hover:border-gold/55',
    tile: 'bg-gold/12 border-gold/35',
    iconColor: 'text-gold',
    valueColor: 'text-gold',
    glow: 'from-gold/12',
  },
  {
    key: 'quests',
    icon: Target,
    value: '850',
    coin: true,
    ring: 'border-violet-400/30 hover:border-violet-400/55',
    tile: 'bg-violet-500/14 border-violet-400/35',
    iconColor: 'text-violet-300',
    valueColor: 'text-violet-200',
    glow: 'from-violet-500/12',
  },
  {
    key: 'bets',
    icon: Dices,
    value: '×2',
    coin: false,
    ring: 'border-emerald-400/30 hover:border-emerald-400/55',
    tile: 'bg-emerald-500/14 border-emerald-400/35',
    iconColor: 'text-emerald-300',
    valueColor: 'text-emerald-200',
    glow: 'from-emerald-500/12',
  },
];

function EarnGuide() {
  const t = useT();
  return (
    <section className="relative overflow-hidden rounded-2xl p-5 border border-gold/25 bg-gradient-to-br from-bg-3/80 via-bg-2/70 to-bg-1/80">
      <div className="absolute inset-0 hud-diag pointer-events-none opacity-40" />
      {/* Lueur supérieure douce pour décoller du fond sombre */}
      <div className="absolute -top-16 left-1/4 w-80 h-32 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

      {/* En-tête du guide */}
      <header className="relative flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center shadow-gold-glow">
          <Sparkles className="w-5 h-5 text-gold" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h3 className="font-gaming text-sm font-extrabold uppercase tracking-[0.14em] text-text-strong leading-tight">
            {t('shop.howToEarn.title')}
          </h3>
          <p className="text-[11px] text-muted-2 font-medium tracking-wide">
            {t('shop.howToEarn.subtitle')}
          </p>
        </div>
      </header>

      {/* Trois méthodes */}
      <div className="relative mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {EARN_METHODS.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={m.key}
              className={`group relative overflow-hidden rounded-2xl border bg-bg-2/70 p-4 flex flex-col gap-3 transition-colors ${m.ring}`}
            >
              {/* Lueur de fond propre à la méthode */}
              <div
                className={`absolute -inset-px bg-gradient-to-br ${m.glow} via-transparent to-transparent opacity-70 pointer-events-none`}
              />
              {/* Numéro d'étape */}
              <span className="absolute top-3 right-3 font-display text-2xl font-extrabold leading-none text-white/5 select-none">
                {i + 1}
              </span>

              <div
                className={`relative shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${m.tile}`}
              >
                <Icon className={`w-6 h-6 ${m.iconColor}`} strokeWidth={2.1} />
              </div>

              <div className="relative">
                <div className="font-gaming text-[13px] font-extrabold uppercase tracking-wide text-text-strong leading-tight">
                  {t(`shop.earn.${m.key}.title`)}
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span
                    className={`font-display text-2xl font-extrabold tabular-nums leading-none flex items-center gap-1 ${m.valueColor}`}
                  >
                    {m.coin && <img src="/42coin.png" alt="" className="w-5 h-5" />}
                    {m.value}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-2">
                    {t(`shop.earn.${m.key}.unit`)}
                  </span>
                </div>
              </div>

              <p className="relative text-[11.5px] text-muted-2 leading-relaxed">
                {t(`shop.earn.${m.key}.desc`)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Lit le payload d'un item de façon sûre (objet simple, jamais un tableau). */
function payloadOf(item: ShopItemData): Record<string, unknown> {
  return item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
    ? (item.payload as Record<string, unknown>)
    : {};
}

/** Aperçu visuel de ce qu'on achète, selon la catégorie (bannière = image,
 *  titre = texte coloré, badge = icône+label coloré).
 *  Hauteur fixe, fond clair teinté par la rareté pour un rendu « vitrine ». */
function ShopItemVisual({ item, rarityHex }: { item: ShopItemData; rarityHex: string }) {
  const p = payloadOf(item);
  const color = item.color || '#ffc94a';
  const image = typeof p.image === 'string' ? p.image : null;
  const titleText = typeof p.title === 'string' ? p.title : item.name;
  const badgeLabel = typeof p.label === 'string' ? p.label : item.name;
  const Icon = badgeIcon(typeof p.icon === 'string' ? p.icon : null);

  return (
    <div
      className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl border flex items-center justify-center px-3"
      style={{
        borderColor: `${rarityHex}4a`,
        background: `linear-gradient(160deg, ${rarityHex}33 0%, rgba(72,63,50,0.62) 45%, rgba(48,42,33,0.7) 100%)`,
      }}
    >
      {/* Halo de rareté derrière l'aperçu */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 35%, ${rarityHex}2e, transparent 70%)` }}
      />
      <div className="absolute inset-0 hud-diag pointer-events-none opacity-20" />

      {item.category === 'banner' &&
        (image ? (
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <ImageIcon className="relative w-7 h-7 text-muted-2" strokeWidth={1.8} />
        ))}

      {item.category === 'title' && (
        <span className="relative inline-flex items-center gap-1.5 text-center text-[15px]">
          <span style={{ color }} className="opacity-70 leading-none">❝</span>
          <span style={{ color }} className="italic font-bold tracking-wide line-clamp-2 drop-shadow">
            {titleText}
          </span>
          <span style={{ color }} className="opacity-70 leading-none">❞</span>
        </span>
      )}

      {item.category === 'badge' && (
        <span
          className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border shadow-lg"
          style={{
            color,
            borderColor: `${color}55`,
            background: `linear-gradient(110deg, ${color}14 0%, ${color}33 45%, ${color}14 70%)`,
          }}
        >
          <Icon className="w-4 h-4" strokeWidth={2.5} />
          {badgeLabel}
        </span>
      )}

      {item.category === 'mystery_box' && (
        <div className="relative flex flex-col items-center gap-2">
          <PackageOpen className="w-10 h-10 text-purple-300 drop-shadow" strokeWidth={1.6} />
        </div>
      )}

      {item.category === 'consumable' && (
        <div className="relative flex flex-col items-center gap-2">
          {p.kind === 'anti_ops' ? (
            <ShieldBan className="w-10 h-10 text-teal-300 drop-shadow" strokeWidth={1.6} />
          ) : (
            <Zap className="w-10 h-10 text-teal-300 drop-shadow" strokeWidth={1.6} />
          )}
        </div>
      )}
    </div>
  );
}

/** Carte « à venir » : emplacement vide et verrouillé, juste pour montrer la
 *  mise en page tant qu'aucun cosmétique réel n'est en boutique. */
function PlaceholderCard({ category, label, soon }: { category: ShopCategory; label: string; soon: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 opacity-55 select-none border border-border/50 bg-gradient-to-br from-bg-2/60 to-bg-1/70">
      <div className="absolute inset-0 hud-diag pointer-events-none opacity-30" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-muted/15" />
          <div className="h-2.5 w-full rounded bg-muted/10" />
          <div className="h-2.5 w-1/2 rounded bg-muted/10" />
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-muted/10 border border-border/50 text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-2">
          {label}
        </span>
      </div>
      {/* Emplacement visuel (vide tant qu'aucun item réel) */}
      <div className="relative h-28 w-full shrink-0 rounded-xl border border-border/40 bg-bg-1/40 flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-muted/40" strokeWidth={1.8} />
      </div>
      <div className="relative mt-auto flex items-center justify-between gap-2 pt-1">
        <CoinAmount value={0} className="font-gaming text-base font-extrabold text-muted-2 blur-[1.5px]" />
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide bg-bg-1 border border-border/60 text-muted-2">
          <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />
          {soon}
        </span>
      </div>
      {/* Catégorie cachée mais conservée pour clarté du code / futurs styles. */}
      <span className="sr-only">{category}</span>
    </div>
  );
}

/**
 * Cache mémoire (durée de vie du module) du dernier état chargé de la boutique.
 * Sert à un affichage *instantané* à la réouverture : on réhydrate l'UI depuis
 * ce snapshot puis on rafraîchit en arrière-plan (stale-while-revalidate), au
 * lieu de repartir d'un skeleton à chaque visite. Mis à jour à chaque `load()`.
 */
type ShopSnapshot = {
  coins: number;
  items: ShopItemData[];
  owned: string[];
  equipped: string[];
  monthly: Record<string, { used: number; cap: number }>;
};
let shopCache: ShopSnapshot | null = null;

export function ShopPage() {
  const t = useT();
  const { show } = useFlash();
  const { me, refresh } = useLeagueData();

  const [coins, setCoins] = useState<number>(shopCache?.coins ?? me?.coins ?? 0);
  const [items, setItems] = useState<ShopItemData[]>(shopCache?.items ?? []);
  const [owned, setOwned] = useState<Set<string>>(new Set(shopCache?.owned ?? []));
  const [equipped, setEquipped] = useState<Set<string>>(new Set(shopCache?.equipped ?? []));
  // Skeleton uniquement au tout premier chargement (cache vide). Si on a déjà un
  // snapshot, on affiche le catalogue connu immédiatement, sans clignotement.
  const [loading, setLoading] = useState(!shopCache);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<ShopCategory | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rarity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // Objet en cours de prévisualisation sur la carte de profil (modal).
  const [preview, setPreview] = useState<ShopItemData | null>(null);
  // État mensuel des consommables (kind → achats restants ce mois). Décrémente à
  // l'achat (rechargé après chaque buy), reset au 1er du mois (clé mois côté serveur).
  const [monthly, setMonthly] = useState<Record<string, { used: number; cap: number }>>(
    shopCache?.monthly ?? {},
  );

  /** Clic sur un critère de tri : si déjà actif, on inverse le sens ; sinon on
   *  bascule sur ce critère avec un sens par défaut (rareté/prix décroissants,
   *  nom croissant — l'ordre le plus naturel pour chacun). */
  const onSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [shop, inventory, consumables] = await Promise.all([
        api.shop(),
        api.inventory().catch(() => [] as InventoryEntry[]),
        api.consumables().catch(() => null),
      ]);
      const snap: ShopSnapshot = {
        coins: shop.coins ?? 0,
        items: shop.items ?? [],
        owned: shop.owned ?? [],
        equipped: inventory.filter((e) => e.equipped).map((e) => e.itemId),
        monthly: Object.fromEntries(
          (consumables?.items ?? []).map((c) => [c.kind, { used: c.monthlyUsed, cap: c.monthlyCap }]),
        ),
      };
      shopCache = snap;
      setCoins(snap.coins);
      setItems(snap.items);
      setOwned(new Set(snap.owned));
      setEquipped(new Set(snap.equipped));
      setMonthly(snap.monthly);
    } catch (err) {
      show(err instanceof Error ? err.message : t('shop.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [show, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = useCallback(
    async (item: ShopItemData) => {
      setBusy(item.id);
      try {
        const res = await api.buyShopItem(item.id);
        setCoins(res.coins);
        setOwned((prev) => new Set(prev).add(item.id));
        trackEvent('shop.buy');
        show(t('shop.bought'));
        void refresh();
        void load();
      } catch (err) {
        show(err instanceof Error ? err.message : t('shop.error'), 'error');
      } finally {
        setBusy(null);
      }
    },
    [show, t, refresh, load],
  );

  const toggleEquip = useCallback(
    async (item: ShopItemData) => {
      const next = !equipped.has(item.id);
      setBusy(item.id);
      try {
        await api.equipItem(item.id, next);
        setEquipped((prev) => {
          const s = new Set(prev);
          if (next) s.add(item.id);
          else s.delete(item.id);
          return s;
        });
        show(next ? t('shop.equipDone') : t('shop.unequipDone'));
        void refresh();
      } catch (err) {
        show(err instanceof Error ? err.message : t('shop.error'), 'error');
      } finally {
        setBusy(null);
      }
    },
    [equipped, show, t, refresh],
  );

  const catLabel = (c: ShopCategory) => t(`shop.cat.${c}`);
  const rarityLabel = (r: Rarity) => t(`shop.rarity.${r}`);

  const visibleItems = items.filter((it) => !HIDDEN_CATS.includes(it.category));

  /** Catégories réellement présentes dans le catalogue, dans un ordre stable,
   *  pour ne proposer comme filtre que des onglets non vides. */
  const presentCats = CATEGORY_ORDER.filter((c) => visibleItems.some((it) => it.category === c));
  const filteredItems =
    activeCat === 'all' ? visibleItems : visibleItems.filter((it) => it.category === activeCat);

  /** Tri appliqué au catalogue filtré. La comparaison se fait toujours en ordre
   *  croissant « naturel », puis on inverse selon `sortDir`. */
  const sortedItems = [...filteredItems].sort((a, b) => {
    let cmp: number;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'price') cmp = a.price - b.price;
    else cmp = RARITY_ORDER.indexOf(resolveRarity(a)) - RARITY_ORDER.indexOf(resolveRarity(b));
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const sortLabel = (k: SortKey) => t(`shop.sort.${k}`);

  return (
    <div className="space-y-5">
      {/* ── En-tête + carte solde ──────────────────────────────────────── */}
      <Panel title={t('shop.title')} sub={t('shop.sub')}>
        <div className="relative overflow-hidden rounded-2xl p-5 flex items-center gap-4 border border-gold/30 bg-gradient-to-br from-violet-500/20 via-bg-2 to-bg-1">
          <div className="absolute inset-0 hud-diag pointer-events-none opacity-30" />
          {/* Lueurs colorées pour réchauffer et éclaircir le bandeau */}
          <div className="absolute -left-8 -top-10 w-40 h-40 rounded-full bg-gold/18 blur-3xl pointer-events-none" />
          <div className="absolute right-0 -bottom-12 w-44 h-44 rounded-full bg-violet-500/18 blur-3xl pointer-events-none" />
          {/* Pièce avec reflet doré qui balaie */}
          <div className="relative shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/35 to-violet-500/15 border border-gold/45 flex items-center justify-center shadow-gold-glow overflow-hidden">
            <img src="/42coin.png" alt="League Coin" className="relative w-10 h-10 drop-shadow" />
            <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-white/25 blur-md animate-gold-sweep pointer-events-none" />
          </div>
          <div className="relative min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-muted-2">
              {t('shop.balance')}
            </div>
            <div className="font-display text-[2.1rem] font-extrabold text-text-strong tabular-nums leading-tight flex items-baseline gap-2">
              <CoinCount login={me?.login} value={coins} />
              <span className="text-sm text-violet-200 font-bold tracking-wide">League Coin</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Guide « comment gagner des coins » ─────────────────────────── */}
      <EarnGuide />

      {/* ── Barres de filtres : catégorie + tri ────────────────────────── */}
      {!loading && visibleItems.length > 0 && (
        <div className="space-y-2.5">
          {/* Filtres par catégorie */}
          {presentCats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {(['all', ...presentCats] as const).map((c) => {
                const active = activeCat === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCat(c)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-[0.12em] border transition-colors ${
                      active
                        ? 'bg-gradient-to-r from-gold to-gold-dim border-gold/50 text-bg-0 shadow-gold-glow'
                        : 'bg-bg-2 border-border/70 text-muted-2 hover:text-text hover:border-gold/30'
                    }`}
                  >
                    {c === 'all' ? t('shop.cat.all') : catLabel(c)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tri : un re-clic sur le critère actif inverse le sens. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
              {t('shop.sort.label')}
            </span>
            {SORT_KEYS.map((k) => {
              const active = sortKey === k;
              const Arrow = sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onSort(k)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-[0.12em] border transition-colors ${
                    active
                      ? 'bg-violet-500/20 border-violet-400/50 text-violet-100'
                      : 'bg-bg-2 border-border/70 text-muted-2 hover:text-text hover:border-violet-400/30'
                  }`}
                >
                  {sortLabel(k)}
                  {active && <Arrow className="w-3.5 h-3.5" strokeWidth={2.8} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Catalogue ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sortedItems.map((item) => {
            const isOwned = owned.has(item.id);
            const canAfford = coins >= item.price;
            const isEquipped = equipped.has(item.id);
            const showEquip = isOwned && EQUIPPABLE.includes(item.category);
            const itemBusy = busy === item.id;
            // Consommable : achats restants ce mois (cap mensuel).
            const consKind =
              item.category === 'consumable' && typeof payloadOf(item).kind === 'string'
                ? (payloadOf(item).kind as string)
                : null;
            const consMonthly = consKind ? monthly[consKind] : undefined;
            const consRemaining = consMonthly ? Math.max(0, consMonthly.cap - consMonthly.used) : null;
            const consExhausted = consRemaining !== null && consRemaining <= 0;
            const rarity = resolveRarity(item);
            const rk = RARITY[rarity];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ y: -3 }}
                className="group relative rounded-2xl p-px transition-shadow"
                style={{
                  background: `linear-gradient(150deg, ${rk.border} 0%, ${rk.hex}33 38%, rgba(96,84,64,0.55) 100%)`,
                }}
              >
                {/* Surface intérieure — nettement plus claire que le fond global */}
                <div
                  className="relative h-full overflow-hidden rounded-[15px] p-4 flex flex-col gap-3"
                  style={{
                    background: `linear-gradient(165deg, ${rk.hex}33 0%, rgba(72,63,50,0.96) 45%, rgba(54,47,37,0.97) 100%)`,
                  }}
                >
                  <div className="absolute inset-0 hud-diag pointer-events-none opacity-25" />
                  {/* Liseré supérieur de rareté */}
                  <div
                    className="absolute top-0 inset-x-0 h-px pointer-events-none"
                    style={{ background: `linear-gradient(90deg, transparent, ${rk.hex}, transparent)` }}
                  />

                  <div className="relative flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-gaming text-sm font-extrabold text-text-strong truncate">
                        {item.name}
                      </div>
                      {/* Étiquette de rareté */}
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.14em]"
                        style={{ color: rk.hex }}
                      >
                        <Gem className="w-3 h-3" strokeWidth={2.5} />
                        {rarityLabel(rarity)}
                      </span>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-2 leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase tracking-[0.12em]"
                      style={{
                        color: rk.hex,
                        borderColor: `${rk.hex}55`,
                        background: `${rk.hex}26`,
                      }}
                    >
                      {catLabel(item.category)}
                    </span>
                  </div>

                  {/* Aperçu visuel de l'item acheté */}
                  <ShopItemVisual item={item} rarityHex={rk.hex} />

                  {/* Consommable : achats restants ce mois (décrémente à l'achat, reset le 1er du mois) */}
                  {consRemaining !== null && (
                    <div className="relative -mb-0.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide tabular-nums">
                      <span className={consExhausted ? 'text-red' : 'text-teal-300'}>
                        {consRemaining}/{consMonthly!.cap}
                      </span>
                      <span className="text-muted-2">par mois</span>
                    </div>
                  )}

                  <div className="relative mt-auto flex items-center justify-between gap-2 pt-1">
                    <CoinAmount
                      value={item.price}
                      className="font-gaming text-lg font-extrabold text-text-strong"
                    />

                    <div className="flex items-center gap-1.5">
                    {/* Aperçu : uniquement pour les cosmétiques visibles sur le profil */}
                    {EQUIPPABLE.includes(item.category) && (
                      <button
                        type="button"
                        onClick={() => setPreview(item)}
                        title={t('shop.preview.title')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide border border-border/60 bg-bg-1 text-muted-2 hover:text-gold hover:border-gold/40 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <span className="hidden sm:inline">{t('shop.preview')}</span>
                      </button>
                    )}

                    {isOwned ? (
                      showEquip ? (
                        <button
                          type="button"
                          disabled={itemBusy}
                          onClick={() => void toggleEquip(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                            isEquipped
                              ? 'bg-gold/15 border border-gold/40 text-gold'
                              : 'bg-bg-1 border border-border/60 text-muted-2 hover:text-text'
                          }`}
                        >
                          {isEquipped && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          {isEquipped ? t('shop.equipped') : t('shop.equip')}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide bg-gold/10 border border-gold/30 text-gold">
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          {t('shop.owned')}
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford || itemBusy || consExhausted}
                        onClick={() => void buy(item)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all ${
                          canAfford && !consExhausted
                            ? 'bg-gradient-to-r from-gold to-gold-dim text-bg-0 hover:shadow-gold-glow hover:brightness-110'
                            : 'bg-bg-1 border border-border/60 text-muted cursor-not-allowed'
                        } disabled:opacity-70`}
                      >
                        {(!canAfford || consExhausted) && <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />}
                        {itemBusy
                          ? t('shop.buying')
                          : consExhausted
                            ? 'Épuisé ce mois'
                            : canAfford
                              ? t('shop.buy')
                              : t('shop.insufficient')}
                      </button>
                    )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {activeCat === 'all' &&
            Array.from({ length: Math.max(0, MIN_TILES - visibleItems.length) }).map((_, i) => {
            const cat = PLACEHOLDER_CATS[i % PLACEHOLDER_CATS.length]!;
            return (
              <PlaceholderCard
                key={`ph-${i}`}
                category={cat}
                label={catLabel(cat)}
                soon={t('shop.howToEarn.soon')}
              />
            );
          })}
        </div>
      )}

      {/* Aperçu du cosmétique appliqué sur la carte de profil */}
      {preview && me && (
        <ProfilePreviewModal item={preview} me={me} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
