/**
 * CoinFlip — pile-ou-face médiéval avec la pièce 42coin en 3D.
 *
 * Tout passe par les props (aucune logique réseau ici) :
 *  - `flipping` true → la pièce est LANCÉE EN L'AIR : elle décrit une parabole
 *    (montée/chute) en tournoyant (rotateX + rotateY) tant que le backend n'a pas
 *    tranché ; `side` la fige sur 'heads'/'tails'.
 *  - tant que `side === null && !flipping` : on montre le bouton « Pile ou face ».
 *  - une fois résolu : la pièce se retire et on dévoile la PP du vainqueur du
 *    tirage avec « {name} gagne le tirage ».
 *
 * La fonction de trad `t` est fournie par le parent (interpolation via replace).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '../Avatar';

export interface CoinFlipProps {
  side: 'heads' | 'tails' | null;
  flipping: boolean;
  winnerName?: string;
  /** Login + photo du vainqueur du tirage, pour révéler sa PP à l'atterrissage. */
  winnerLogin?: string;
  winnerImageUrl?: string | null;
  onFlip?: () => void;
  t: (k: string) => string;
  /** Diamètre de la pièce en px (défaut 96 ; l'overlay l'affiche en grand). */
  size?: number;
}

const COIN = '/42coin.png';

export default function CoinFlip({
  side,
  flipping,
  winnerName,
  winnerLogin,
  winnerImageUrl,
  onFlip,
  t,
  size = 96,
}: CoinFlipProps) {
  const resolved = side !== null && !flipping;
  const big = size >= 140;

  // Angle final : la face « pile » (heads) tombe à 0°, « face » (tails) à 180°.
  const restAngle = side === 'tails' ? 180 : 0;
  // Lancer plein écran : la pièce part du bas de l'écran, sort par le haut, puis
  // retombe au centre. Distances dérivées de la hauteur du viewport.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const throwStart = vh * 0.6; // point de départ, sous l'écran
  const throwTop = -vh * 0.6; // apogée, au-dessus de l'écran (hors champ)

  const faceStyle = {
    backfaceVisibility: 'hidden' as const,
    WebkitBackfaceVisibility: 'hidden' as const,
    filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* Scène du lancer : pièce + ombre projetée au sol. On ne réserve la hauteur
          de vol que pendant le lancer (sinon, au repos, un grand vide au-dessus). */}
      <div
        className="relative flex items-end justify-center"
        style={{ width: size, height: size, perspective: 900 }}
      >
        <AnimatePresence mode="popLayout">
          {resolved && winnerLogin ? (
            // ── Révélation : PP du vainqueur qui jaillit ──
            <motion.div
              key="winner-pp"
              // Ancrée en bas comme la pièce → la PP révélée occupe le même point
              // que la pièce et le texte se cale juste dessous (bien centré).
              className="absolute left-1/2 bottom-0 -translate-x-1/2"
              initial={{ scale: 0.2, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 18 }}
            >
              <Avatar login={winnerLogin} imageUrl={winnerImageUrl ?? null} size={big ? 'xl' : 'lg'} />
            </motion.div>
          ) : (
            // ── Pièce lancée en l'air ──
            <motion.div
              key="coin"
              className="absolute left-1/2 bottom-0 -translate-x-1/2"
              style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
              initial={flipping ? { y: throwStart, scale: 0.7 } : false}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.2 } }}
              animate={
                flipping
                  ? {
                      // Lancer : du bas de l'écran → sort par le haut → retombe au centre,
                      // en tournoyant (rotateX/rotateY en boucle continue).
                      y: [throwStart, throwTop, 0],
                      scale: [0.7, 1.05, 1],
                      rotateY: [0, 360],
                      rotateX: [0, 360],
                    }
                  : { y: 0, rotateY: restAngle, rotateX: 0, scale: 1 }
              }
              transition={
                flipping
                  ? {
                      y: { duration: 1.5, times: [0, 0.4, 1], ease: ['easeOut', 'easeIn'] },
                      scale: { duration: 1.5, times: [0, 0.4, 1] },
                      rotateY: { duration: 0.45, ease: 'linear', repeat: Infinity },
                      rotateX: { duration: 0.8, ease: 'linear', repeat: Infinity },
                    }
                  : { type: 'spring', stiffness: 260, damping: 16 }
              }
            >
              {/* Face avant + face arrière (la pièce reste visible quel que soit l'angle) */}
              <img src={COIN} alt="42coin" draggable={false}
                className="absolute inset-0 w-full h-full object-contain select-none" style={faceStyle} />
              <img src={COIN} alt="" aria-hidden draggable={false}
                className="absolute inset-0 w-full h-full object-contain select-none"
                style={{ ...faceStyle, transform: 'rotateY(180deg)' }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ombre au sol — uniquement au repos (la pièce est en l'air pendant le lancer) */}
        {!resolved && !flipping && (
          <div
            aria-hidden
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[50%]"
            style={{ width: size * 0.7, height: size * 0.16, background: 'rgba(0,0,0,0.45)', filter: 'blur(4px)', opacity: 0.4 }}
          />
        )}
      </div>

      {/* États */}
      {resolved && winnerName ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm font-extrabold uppercase tracking-wider text-gold text-center"
        >
          {t('tourn.duel.tossWinner').replace('{name}', winnerName)}
        </motion.p>
      ) : flipping ? (
        <p className="text-xs uppercase tracking-wider text-muted-2 animate-pulse">
          {t('tourn.duel.tossing')}
        </p>
      ) : (
        <button
          type="button"
          onClick={onFlip}
          className="relative overflow-hidden inline-flex items-center justify-center gap-1.5 font-extrabold uppercase tracking-wider rounded-lg px-5 py-3 text-sm
            shine bg-gradient-to-b from-[#ffa83a] via-[#f08020] to-[#c5520a] text-[#1a0d00]
            border border-[#ffc966]/60
            shadow-[inset_0_1px_0_rgba(255,247,228,0.5),0_4px_14px_rgba(255,128,32,0.4)]
            transition-all duration-200 active:scale-[0.97] hover:brightness-[1.05]"
        >
          {t('tourn.duel.toss')}
        </button>
      )}
    </div>
  );
}
