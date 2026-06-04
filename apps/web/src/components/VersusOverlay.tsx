import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { useT } from '../lib/i18n';
import { GAME_META } from '../lib/gameMeta';
import type { Game } from '../lib/api';

export interface VersusPlayer {
  login: string;
  imageUrl: string | null;
  /** Nom affiché (ex. « Prénom Nom »), sinon fallback sur le login. */
  name?: string | null;
}

interface VersusOverlayProps {
  me: VersusPlayer;
  opponent: VersusPlayer;
  game?: Game;
  /** Appelé au tap du fond, du bouton « Continuer », ou après ~3.5s. */
  onDone: () => void;
}

const AUTO_DISMISS_MS = 3500;

/**
 * Overlay plein écran « VERSUS » : ton avatar entre par la gauche, celui de
 * l'adversaire par la droite, et un grand « VS » apparaît au centre (spring).
 * On-brand (or / rouge). Tap n'importe où ou « Continuer » → onDone.
 */
export function VersusOverlay({ me, opponent, game, onDone }: VersusOverlayProps) {
  const t = useT();

  useEffect(() => {
    const id = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  const meName = me.name || me.login;
  const oppName = opponent.name || opponent.login;
  const gm = game ? GAME_META[game] : null;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop sombre + lueur centrale or/rouge */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(255,83,102,0.18), rgba(0,0,0,0.92) 60%), rgba(8,6,4,0.95)',
        }}
      />

      {/* Bandeau « Adversaire trouvé ! » */}
      <motion.div
        className="relative z-10 mb-3 font-display font-black uppercase tracking-[0.18em] text-gold text-sm md:text-base"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 18 }}
      >
        {t('defis.versus.found')}
      </motion.div>

      {/* Logo + nom du mode où l'appariement a eu lieu (utile quand on cherchait
          sur plusieurs modes à la fois). */}
      {gm && (
        <motion.div
          className="relative z-10 mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md"
          style={{ border: `1.5px solid ${gm.borderColor}`, background: gm.bgColor, boxShadow: `0 0 18px -6px ${gm.glowColor}` }}
          initial={{ y: -12, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.28, type: 'spring', stiffness: 260, damping: 18 }}
        >
          <span className="grid h-5 w-5 place-items-center" style={{ color: gm.color }}>
            {gm.icon(true)}
          </span>
          <span className="font-display text-xs font-extrabold uppercase tracking-wider" style={{ color: gm.color }}>
            {gm.label}
          </span>
        </motion.div>
      )}

      <div className="relative z-10 flex items-center justify-center gap-4 md:gap-10 px-6 w-full max-w-3xl">
        {/* Toi — entre par la gauche */}
        <motion.div
          className="flex flex-col items-center flex-1 min-w-0"
          initial={{ x: '-120%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 }}
        >
          <div className="rounded-full ring-4 ring-teal/70 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Avatar login={me.login} imageUrl={me.imageUrl} size="xl" />
          </div>
          <span className="mt-3 font-display font-bold text-text-strong text-sm md:text-lg truncate max-w-full">
            {meName}
          </span>
          <span className="text-[10px] md:text-xs text-teal uppercase tracking-wider">{t('defis.you')}</span>
        </motion.div>

        {/* VS central — spring scale */}
        <motion.div
          className="relative z-20 flex-shrink-0"
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 12, delay: 0.45 }}
        >
          <span
            className="font-display font-black italic text-5xl md:text-7xl"
            style={{
              background: 'linear-gradient(180deg, #ffd87a 0%, #f0a020 50%, #c5520a 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 10px rgba(255,128,32,0.5))',
            }}
          >
            VS
          </span>
        </motion.div>

        {/* Adversaire — entre par la droite */}
        <motion.div
          className="flex flex-col items-center flex-1 min-w-0"
          initial={{ x: '120%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.1 }}
        >
          <div className="rounded-full ring-4 ring-red/70 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Avatar login={opponent.login} imageUrl={opponent.imageUrl} size="xl" />
          </div>
          <span className="mt-3 font-display font-bold text-text-strong text-sm md:text-lg truncate max-w-full">
            {oppName}
          </span>
          <span className="text-[10px] md:text-xs text-red uppercase tracking-wider">{t('defis.opponent')}</span>
        </motion.div>
      </div>

      {/* Bouton « Continuer » */}
      <motion.button
        type="button"
        className="relative z-10 mt-12 px-6 py-2.5 rounded-lg font-extrabold uppercase tracking-wider text-xs text-[#1a0d00]
                   bg-gradient-to-b from-[#ffd87a] via-[#f0a020] to-[#c5520a] border border-[#ffc966]/60
                   shadow-[0_4px_14px_rgba(255,128,32,0.4)] active:scale-95"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        {t('defis.versus.continue')}
      </motion.button>
    </motion.div>
  );
}
