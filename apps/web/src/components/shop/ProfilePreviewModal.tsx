import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Avatar } from '../Avatar';
import { BadgesRow } from '../Badges';
import { displayTitle } from '../../lib/cosmeticTitles';
import { RARITY, resolveRarity } from '../../lib/rarity';
import { useT } from '../../lib/i18n';
import type { EquippedBadge, MeResponse, ShopItemData } from '../../lib/api';

function payloadOf(item: ShopItemData): Record<string, unknown> {
  return item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
    ? (item.payload as Record<string, unknown>)
    : {};
}

/**
 * Aperçu d'un cosmétique appliqué SUR la carte de profil du joueur — réplique
 * condensée de la carte héro (ProfilDesktop) avec l'objet prévisualisé superposé
 * aux cosmétiques actuellement équipés. Permet de juger le rendu avant l'achat.
 */
export function ProfilePreviewModal({
  item,
  me,
  onClose,
}: {
  item: ShopItemData;
  me: MeResponse;
  onClose: () => void;
}) {
  const t = useT();
  const reducedMotion = useReducedMotion();

  // Échap + blocage du scroll de fond tant que le modal est ouvert.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const u = me.user;
  const p = payloadOf(item);
  const rk = RARITY[resolveRarity(item)];

  const realName =
    u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() : '';

  // Cosmétiques de base = actuellement équipés ; on en remplace UN selon l'objet.
  const isTitle = item.category === 'title';
  const isBanner = item.category === 'banner';
  const isBadge = item.category === 'badge';

  const baseTitle = u ? displayTitle(u.login, u.title, null) : null;
  const titleText = isTitle ? (typeof p.title === 'string' ? p.title : item.name) : baseTitle;
  const isTarnished = !titleText;
  const titleColor = isTitle ? item.color || '#ffc94a' : isTarnished ? null : me.titleColor ?? null;

  const banner = isBanner ? (typeof p.image === 'string' ? p.image : null) : me.equippedBanner ?? null;

  const previewBadge: EquippedBadge | null = isBadge
    ? {
        code: item.id,
        label: typeof p.label === 'string' ? p.label : item.name,
        icon: typeof p.icon === 'string' ? p.icon : 'Award',
        color: item.color,
      }
    : me.equippedBadge ?? null;

  const titleLabel = titleText ?? t('profil.title.tarnished');
  const elo = u?.elo ?? 1000;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="shop-preview"
        role="dialog"
        aria-modal="true"
        aria-label={t('shop.preview.title')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto"
        style={{ background: 'rgba(8,6,3,0.72)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md my-auto rounded-2xl bg-bg-1 border border-gold/30 p-4 sm:p-5"
          style={{ boxShadow: '0 20px 60px -16px rgba(0,0,0,0.7)' }}
        >
          {/* En-tête modal */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="font-gaming text-sm font-extrabold uppercase tracking-[0.14em] text-text-strong">
                {t('shop.preview.title')}
              </div>
              <div className="text-[11px] text-muted-2 truncate" style={{ color: rk.hex }}>
                {item.name}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.back')}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-2 hover:text-text-strong hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </div>

          {/* Carte héro de profil (réplique condensée) */}
          <div
            className="relative overflow-hidden rounded-2xl border border-gold/35"
            style={{
              background: 'linear-gradient(180deg, #2a241c 0%, #15120e 55%, #1d1914 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,215,120,0.15), inset 0 -1px 0 rgba(0,0,0,0.5), 0 12px 32px -12px rgba(255,201,74,0.25)',
            }}
          >
            {/* Bannière équipée (fond) + voile sombre */}
            {banner && (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
                <div aria-hidden className="absolute inset-0 pointer-events-none bg-black/45" />
              </>
            )}

            {/* Halo holographique conique */}
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
            <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent pointer-events-none" />

            {/* Titre équipé (haut, centré) */}
            <div className="relative z-10 pt-3.5 pb-1 flex items-center justify-center px-5">
              <span
                className="inline-flex items-center gap-1.5 max-w-[80%]"
                style={titleColor ? { color: titleColor } : undefined}
              >
                <span className={`text-base leading-none opacity-70 ${isTarnished ? 'text-muted-2' : titleColor ? '' : 'text-gold/70'}`}>❝</span>
                <span className={`italic text-base font-bold tracking-wide truncate ${isTarnished ? 'text-muted-2' : titleColor ? '' : 'text-gold'}`}>
                  {titleLabel}
                </span>
                <span className={`text-base leading-none opacity-70 ${isTarnished ? 'text-muted-2' : titleColor ? '' : 'text-gold/70'}`}>❞</span>
              </span>
            </div>

            {/* Avatar + identité + ELO */}
            <div className="relative z-10 p-5 pt-3 flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div
                  className="absolute -inset-1.5 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(255,201,74,0.4) 0%, transparent 70%)', filter: 'blur(12px)' }}
                />
                <Avatar
                  login={u?.login ?? '?'}
                  imageUrl={u?.imageUrl ?? null}
                  size="lg"
                  className="relative ring-2 ring-gold/45 ring-offset-2 ring-offset-bg-2"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-display text-2xl font-black text-text-strong truncate tracking-tight min-w-0">
                    {realName || <span className="font-mono text-xl font-bold text-muted-2">@{u?.login}</span>}
                  </div>
                  {((me.badges && me.badges.length > 0) || previewBadge) && (
                    <div className="flex-shrink-0">
                      <BadgesRow codes={me.badges ?? []} extra={previewBadge ? [previewBadge] : []} size="md" />
                    </div>
                  )}
                </div>
                {realName && <div className="text-[11px] text-muted-2 font-mono truncate">@{u?.login}</div>}
              </div>

              <div className="text-center flex-shrink-0 pl-1">
                <div className="mb-1 text-[10px] text-muted uppercase tracking-[0.28em] font-extrabold">ELO</div>
                <div
                  className="font-display text-3xl leading-none font-black text-gold-emboss tabular-nums"
                  style={{ textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,201,74,0.35)' }}
                >
                  {elo}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-muted-2 leading-snug text-center">{t('shop.preview.caption')}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
