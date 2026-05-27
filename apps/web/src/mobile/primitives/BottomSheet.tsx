import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { haptic } from '../feedback/useHaptic';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Titre optionnel (header de la sheet). */
  title?: ReactNode;
  /** Hauteur en vh — `auto` pour s'adapter au contenu, sinon snap fixe (ex. 50, 90). */
  snap?: 'auto' | number;
  /** Désactive la dismiss par swipe (rare — pour confirmation critique). */
  preventSwipeDismiss?: boolean;
  /** Désactive la dismiss au tap sur le scrim. */
  preventScrimDismiss?: boolean;
  children: ReactNode;
}

const DISMISS_VELOCITY = 500;
const DISMISS_OFFSET_RATIO = 0.35;

/**
 * Bottom Sheet iOS-style :
 * - Monte du bas avec spring physique
 * - Drag handle visible — swipe vers le bas pour fermer
 * - Scrim animé (backdrop opacity)
 * - Lock du scroll body pendant l'affichage
 * - Escape ferme, focus trap léger
 * - Haptique au mount/dismiss
 *
 * Pattern d'usage :
 *   const [open, setOpen] = useState(false);
 *   <BottomSheet open={open} onClose={() => setOpen(false)} title="Choisir">
 *     {content}
 *   </BottomSheet>
 */
export function BottomSheet({
  open,
  onClose,
  title,
  snap = 'auto',
  preventSwipeDismiss = false,
  preventScrimDismiss = false,
  children,
}: BottomSheetProps) {
  const y = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock du scroll body pendant que la sheet est ouverte
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    haptic('selection');
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (preventSwipeDismiss) return;
      const h = sheetRef.current?.offsetHeight ?? 600;
      const shouldClose =
        info.velocity.y > DISMISS_VELOCITY || info.offset.y > h * DISMISS_OFFSET_RATIO;
      if (shouldClose) {
        haptic('light');
        onClose();
      } else {
        // Snap back vers 0 (le spring du motion l'anime)
        y.set(0);
      }
    },
    [onClose, preventSwipeDismiss, y],
  );

  const sheetStyle = useMemo(() => {
    if (snap === 'auto') return undefined;
    return { maxHeight: `${snap}vh` };
  }, [snap]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={preventScrimDismiss ? undefined : onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }}
            drag={preventSwipeDismiss ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            style={{ y, ...sheetStyle }}
            className="fixed bottom-0 left-0 right-0 z-50 glass-strong rounded-t-3xl shadow-sheet border-t border-gold/30 flex flex-col overflow-hidden"
          >
            {/* Reflet doré en haut de la sheet */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent pointer-events-none" />

            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-gradient-to-r from-gold/30 via-gold/60 to-gold/30" />
            </div>

            {title && (
              <div className="px-5 pt-1 pb-3 border-b border-gold/15">
                <div className="font-gaming text-base font-extrabold text-text-strong tracking-wide uppercase">
                  {title}
                </div>
              </div>
            )}

            {/* Contenu scrollable. Padding-bottom inclut safe-area. */}
            <div
              className="overflow-y-auto overscroll-contain scroll-smooth-touch custom-scrollbar"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
