import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lock, Check, Image as ImageIcon } from 'lucide-react';
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

/** Catégories pour lesquelles « équiper » a du sens (titre / bannière / badge actifs). */
const EQUIPPABLE: ShopCategory[] = ['title', 'banner', 'badge'];

/** Nombre minimum de cases affichées : la grille est comblée par des cartes
 *  placeholder « Bientôt » pour qu'elle paraisse toujours pleine, même quand le
 *  catalogue réel est vide ou peu fourni. */
const MIN_TILES = 6;
const PLACEHOLDER_CATS: ShopCategory[] = ['banner', 'title', 'cosmetic'];

function CoinAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <img src="/42coin.png" alt="" className="w-4 h-4" />
      {value}
    </span>
  );
}

/** Lit le payload d'un item de façon sûre (objet simple, jamais un tableau). */
function payloadOf(item: ShopItemData): Record<string, unknown> {
  return item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
    ? (item.payload as Record<string, unknown>)
    : {};
}

/** Aperçu visuel de ce qu'on achète, selon la catégorie (bannière = image,
 *  titre = texte coloré, badge = icône+label coloré, cosmétique = générique).
 *  Hauteur fixe pour garder la grille de cartes alignée. */
function ShopItemVisual({ item }: { item: ShopItemData }) {
  const p = payloadOf(item);
  const color = item.color || '#ffc94a';
  const image = typeof p.image === 'string' ? p.image : null;
  const titleText = typeof p.title === 'string' ? p.title : item.name;
  const badgeLabel = typeof p.label === 'string' ? p.label : item.name;
  const Icon = badgeIcon(typeof p.icon === 'string' ? p.icon : null);

  return (
    <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-bg-1 to-bg-0 flex items-center justify-center px-3">
      <div className="absolute inset-0 hud-diag pointer-events-none opacity-20" />

      {item.category === 'banner' &&
        (image ? (
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <ImageIcon className="relative w-6 h-6 text-muted-2" strokeWidth={1.8} />
        ))}

      {item.category === 'title' && (
        <span className="relative inline-flex items-center gap-1.5 text-center">
          <span style={{ color }} className="opacity-70 leading-none">❝</span>
          <span style={{ color }} className="italic font-bold tracking-wide line-clamp-2">
            {titleText}
          </span>
          <span style={{ color }} className="opacity-70 leading-none">❞</span>
        </span>
      )}

      {item.category === 'badge' && (
        <span
          className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border"
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

      {item.category === 'cosmetic' && (
        <Sparkles className="relative w-7 h-7 text-violet-300" strokeWidth={1.6} />
      )}
    </div>
  );
}

/** Carte « à venir » : emplacement vide et verrouillé, juste pour montrer la
 *  mise en page tant qu'aucun cosmétique réel n'est en boutique. */
function PlaceholderCard({ category, label, soon }: { category: ShopCategory; label: string; soon: string }) {
  return (
    <div className="relative card-hud overflow-hidden rounded-2xl p-4 flex flex-col gap-3 opacity-60 select-none">
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
      <div className="relative h-24 w-full shrink-0 rounded-xl border border-border/40 bg-bg-1/40 flex items-center justify-center">
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

export function ShopPage() {
  const t = useT();
  const { show } = useFlash();
  const { me, refresh } = useLeagueData();

  const [coins, setCoins] = useState<number>(me?.coins ?? 0);
  const [items, setItems] = useState<ShopItemData[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [shop, inventory] = await Promise.all([
        api.shop(),
        api.inventory().catch(() => [] as InventoryEntry[]),
      ]);
      setCoins(shop.coins ?? 0);
      setItems(shop.items ?? []);
      setOwned(new Set(shop.owned ?? []));
      setEquipped(new Set(inventory.filter((e) => e.equipped).map((e) => e.itemId)));
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

  return (
    <div className="space-y-5">
      {/* ── En-tête + carte solde ──────────────────────────────────────── */}
      <Panel title={t('shop.title')} sub={t('shop.sub')}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 card-hud overflow-hidden rounded-2xl p-5 flex items-center gap-4 bg-gradient-to-br from-violet-500/10 via-bg-1 to-bg-0 border border-violet-400/25">
            <div className="absolute inset-0 hud-diag pointer-events-none opacity-40" />
            <div className="relative shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/20 to-violet-500/10 border border-gold/30 flex items-center justify-center shadow-gold-glow">
              <img src="/42coin.png" alt="League Coin" className="w-9 h-9" />
            </div>
            <div className="relative min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-muted">
                {t('shop.balance')}
              </div>
              <div className="font-gaming text-3xl font-extrabold text-text-strong tabular-nums leading-tight flex items-center gap-1.5">
                <CoinCount login={me?.login} value={coins} />
                <span className="text-sm text-violet-300 font-bold">League Coin</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Carte « comment gagner des coins » (bientôt) ───────────────── */}
      <section className="relative card-hud overflow-hidden rounded-2xl p-5 border border-gold/20">
        <div className="absolute inset-0 hud-diag pointer-events-none opacity-40" />
        <div className="relative flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-gold" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-gaming text-sm font-extrabold uppercase tracking-[0.14em] text-text-strong">
                {t('shop.howToEarn.title')}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/40 text-[9px] font-extrabold uppercase tracking-[0.14em] text-violet-200">
                {t('shop.howToEarn.soon')}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">
              {t('shop.howToEarn.body')}
            </p>
          </div>
        </div>
      </section>

      {/* ── Catalogue ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => {
            const isOwned = owned.has(item.id);
            const canAfford = coins >= item.price;
            const isEquipped = equipped.has(item.id);
            const showEquip = isOwned && EQUIPPABLE.includes(item.category);
            const itemBusy = busy === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="relative card-hud overflow-hidden rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="absolute inset-0 hud-diag pointer-events-none opacity-30" />
                <div className="relative flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-gaming text-sm font-extrabold text-text-strong truncate">
                      {item.name}
                    </div>
                    {item.description && (
                      <p className="mt-1 text-xs text-muted leading-snug line-clamp-3">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/25 text-[9px] font-extrabold uppercase tracking-[0.12em] text-gold">
                    {catLabel(item.category)}
                  </span>
                </div>

                {/* Aperçu visuel de l'item acheté */}
                <ShopItemVisual item={item} />

                <div className="relative mt-auto flex items-center justify-between gap-2 pt-1">
                  <CoinAmount
                    value={item.price}
                    className="font-gaming text-base font-extrabold text-text-strong"
                  />

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
                      disabled={!canAfford || itemBusy}
                      onClick={() => void buy(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-colors ${
                        canAfford
                          ? 'bg-gold text-bg-0 hover:bg-gold-dim shadow-gold-glow'
                          : 'bg-bg-1 border border-border/60 text-muted cursor-not-allowed'
                      } disabled:opacity-70`}
                    >
                      {!canAfford && <Lock className="w-3.5 h-3.5" strokeWidth={2.5} />}
                      {itemBusy
                        ? t('shop.buying')
                        : canAfford
                          ? t('shop.buy')
                          : t('shop.insufficient')}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          {Array.from({ length: Math.max(0, MIN_TILES - items.length) }).map((_, i) => {
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
    </div>
  );
}
