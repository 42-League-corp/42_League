/**
 * CoinFlip — pile-ou-face médiéval avec la pièce 42coin en 3D.
 *
 * Tout passe par les props (aucune logique réseau ici) :
 *  - `flipping` true → la pièce tourne en boucle (rotateY) tant que le backend
 *    n'a pas tranché ; `side` la fige sur 'heads'/'tails'.
 *  - tant que `side === null && !flipping` : on montre le bouton « Pile ou face ».
 *  - une fois résolu : « {name} gagne le tirage ».
 *
 * La fonction de trad `t` est fournie par le parent (interpolation via replace).
 */
import { motion } from 'framer-motion';

export interface CoinFlipProps {
  side: 'heads' | 'tails' | null;
  flipping: boolean;
  winnerName?: string;
  onFlip?: () => void;
  t: (k: string) => string;
  /** Diamètre de la pièce en px (défaut 96 ; l'overlay l'affiche en grand). */
  size?: number;
}

const COIN = '/42coin.png';

export default function CoinFlip({ side, flipping, winnerName, onFlip, t, size = 96 }: CoinFlipProps) {
  const resolved = side !== null && !flipping;

  // Angle final : la face « pile » (heads) tombe à 0°, « face » (tails) à 180°.
  // Pendant le flip on enchaîne des tours complets ; à l'arrêt on cale dessus.
  const restAngle = side === 'tails' ? 180 : 0;

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Pièce en perspective 3D */}
      <div style={{ perspective: 800 }}>
        <motion.div
          className="relative"
          style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
          animate={
            flipping
              ? { rotateY: [0, 360, 720, 1080] }
              : { rotateY: restAngle }
          }
          transition={
            flipping
              ? { duration: 0.7, ease: 'linear', repeat: Infinity }
              : { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }
          }
        >
          <img
            src={COIN}
            alt="42coin"
            draggable={false}
            className="w-full h-full object-contain select-none"
            style={{
              backfaceVisibility: 'hidden',
              filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
            }}
          />
        </motion.div>
      </div>

      {/* États */}
      {resolved && winnerName ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
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
