/**
 * TournamentLaunchCeremony — cérémonie médiévale plein écran au lancement d'un tournoi.
 *
 * Overlay « joute » : chevaliers + bannières SVG sur les deux bords (JoustingFlanks),
 * titre, sous-titre avec le nombre de chevaliers, puis défilé staggered des avatars
 * des inscrits. Bouton « Passer » et bouton final « Voir le tableau » qui appelle
 * onDone (toujours atteignable). Escape => onDone.
 *
 * Rendu via createPortal (body) pour éviter les conflits avec les transforms des
 * animations de page (même pattern que NewTeamCelebration).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { JoustingFlanks } from './art/JoustingScene';
import { useEscapeKey } from '../../hooks/useEscapeKey';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Knight {
  login: string;
  imageUrl?: string | null;
}

export interface LaunchCeremonyProps {
  tournamentName: string;
  participants: Knight[];
  // Affrontements du 1er tour (tirage au sort) : si fournis, on joue l'animation
  // de « tirage » qui place chaque duel A ⚔ B à sa place, sinon simple défilé.
  // Un côté null = exempt (bye).
  pairings?: { a: Knight | null; b: Knight | null }[];
  accent: string;
  onDone: () => void;
  t: (k: string) => string;
}

// ─── Avatar défilé ──────────────────────────────────────────────────────────────

function ParadeAvatar({
  login, imageUrl, accent, size = 64,
}: { login: string; imageUrl?: string | null; accent: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div
        className="rounded-full flex items-center justify-center font-display font-black text-[#0a0a0a] overflow-hidden"
        style={{
          width: size, height: size, fontSize: size * 0.38,
          border: `2.5px solid ${accent}`,
          boxShadow: `0 0 22px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
          background: imageUrl ? undefined : accent,
        }}
      >
        {imageUrl
          ? <img src={imageUrl} alt={login} className="w-full h-full object-cover" />
          : login[0]?.toUpperCase()}
      </div>
      <span className="text-[10px] font-bold text-text-strong/90 max-w-[72px] truncate">
        {login}
      </span>
    </div>
  );
}

// ─── Tirage au sort (placement des duels du 1er tour) ───────────────────────────

function DrawAvatar({
  knight, accent, from,
}: { knight: Knight | null; accent: string; from: 'left' | 'right' }) {
  const dir = from === 'left' ? -1 : 1;
  const size = 44;
  if (!knight) {
    // Exempt (bye) : place vide.
    return (
      <div
        className="rounded-full border border-dashed flex items-center justify-center text-[10px] text-muted-2 flex-shrink-0"
        style={{ width: size, height: size, borderColor: `${accent}66` }}
      >
        bye
      </div>
    );
  }
  return (
    <motion.div
      initial={{ x: dir * 40, opacity: 0, scale: 0.5 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ width: 64 }}
    >
      <div
        className="rounded-full flex items-center justify-center font-display font-black text-[#0a0a0a] overflow-hidden"
        style={{
          width: size, height: size, fontSize: size * 0.4,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 16px ${accent}55`,
          background: knight.imageUrl ? undefined : accent,
        }}
      >
        {knight.imageUrl
          ? <img src={knight.imageUrl} alt={knight.login} className="w-full h-full object-cover" />
          : knight.login[0]?.toUpperCase()}
      </div>
      <span className="text-[9px] font-bold text-text-strong/90 max-w-[64px] truncate">
        {knight.login}
      </span>
    </motion.div>
  );
}

function DrawReveal({
  pairings, accent, t,
}: { pairings: { a: Knight | null; b: Knight | null }[]; accent: string; t: (k: string) => string }) {
  return (
    <div className="w-full flex flex-col items-center gap-2.5 max-h-[46vh] overflow-y-auto no-scrollbar px-1 py-1">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.3em]" style={{ color: accent }}>
        {t('tourn.launch.draw')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {pairings.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.85, type: 'spring', stiffness: 240, damping: 22 }}
            className="flex items-center justify-center gap-2 rounded-xl border bg-bg-1/40 px-3 py-2"
            style={{ borderColor: `${accent}40` }}
          >
            <DrawAvatar knight={p.a} accent={accent} from="left" />
            <motion.span
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.6 + i * 0.85 + 0.15, type: 'spring', stiffness: 300, damping: 16 }}
              className="text-base font-black shrink-0"
              style={{ color: accent }}
            >
              ⚔
            </motion.span>
            <DrawAvatar knight={p.b} accent={accent} from="right" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Particules (étincelles) ─────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * 2 * Math.PI;
  const dist = 140 + Math.random() * 90;
  return {
    id: i,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    size: 3 + Math.random() * 6,
    delay: Math.random() * 0.4,
  };
});

// ─── Composant principal ──────────────────────────────────────────────────────

export default function TournamentLaunchCeremony({
  tournamentName, participants, pairings, accent, onDone, t,
}: LaunchCeremonyProps) {
  const [dismissed, setDismissed] = useState(false);
  const hasDraw = !!pairings && pairings.length > 0;

  const handleDone = () => {
    if (dismissed) return;
    setDismissed(true);
    // Laisse l'animation de sortie jouer avant de prévenir le parent.
    setTimeout(onDone, 320);
  };

  // Escape => fin de cérémonie (toujours atteignable).
  useEscapeKey(!dismissed, handleDone);

  // Auto-enchaînement temporisé : si l'utilisateur ne fait rien, on révèle le
  // bracket après un délai (onDone reste atteignable manuellement avant). Le
  // tirage est plus long (chaque duel se place tour à tour).
  useEffect(() => {
    const ms = hasDraw ? Math.min(15000, 4500 + pairings!.length * 850) : 9000;
    const id = setTimeout(handleDone, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtitle = t('tourn.launch.subtitle').replace('{n}', String(participants.length));

  const content = (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(18,14,8,0.96) 0%, rgba(5,4,2,0.99) 100%)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleDone(); }}
        >
          {/* Décor de joute aux deux bords (chevaliers + bannières + drapeaux) */}
          <JoustingFlanks accent={accent} />

          {/* Vignette + halo conique tournant */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
            style={{
              background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${accent}26 60deg, transparent 120deg)`,
              filter: 'blur(70px)',
            }}
          />

          {/* Bouton Passer */}
          <button
            type="button"
            onClick={handleDone}
            className="absolute top-4 right-4 px-4 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-2 hover:text-text-strong border border-border/50 hover:border-border bg-bg-1/40 backdrop-blur-sm transition-colors tap-transparent z-20"
          >
            {t('tourn.launch.skip')}
          </button>

          {/* ── Contenu central ── */}
          <div className="relative z-10 flex flex-col items-center gap-7 px-6 max-w-2xl w-full">

            {/* Titre */}
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 20 }}
              className="text-center relative"
            >
              {/* Étincelles autour du titre */}
              {PARTICLES.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                  style={{ width: p.size, height: p.size, background: accent }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0, 1, 0] }}
                  transition={{ delay: 0.4 + p.delay, duration: 1.4, ease: 'easeOut' }}
                />
              ))}

              <div
                className="text-[11px] font-extrabold uppercase tracking-[0.35em] mb-2"
                style={{ color: accent }}
              >
                ⚔ {tournamentName} ⚔
              </div>
              <div
                className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight leading-tight"
                style={{
                  background: `linear-gradient(135deg, #fff7e4 0%, ${accent} 55%, #fff7e4 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: `drop-shadow(0 0 22px ${accent}99)`,
                }}
              >
                {t('tourn.launch.title')}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="mt-2 text-sm font-bold text-muted"
              >
                {subtitle}
              </motion.div>
            </motion.div>

            {/* Tirage au sort (placement des duels) si dispo, sinon défilé. */}
            {hasDraw ? (
              <DrawReveal pairings={pairings!} accent={accent} t={t} />
            ) : (
              <div className="w-full overflow-x-auto no-scrollbar">
                <div className="flex items-start justify-center gap-4 sm:gap-5 px-2 py-3 min-w-max mx-auto">
                  {participants.map((p, i) => (
                    <motion.div
                      key={`${p.login}-${i}`}
                      initial={{ opacity: 0, y: 28, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: 0.6 + i * 0.08,
                        type: 'spring',
                        stiffness: 320,
                        damping: 22,
                      }}
                    >
                      <ParadeAvatar
                        login={p.login}
                        imageUrl={p.imageUrl}
                        accent={accent}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Bouton final */}
            <motion.button
              type="button"
              onClick={handleDone}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + participants.length * 0.08 + 0.2, duration: 0.4 }}
              whileTap={{ scale: 0.96 }}
              className="px-8 py-3.5 rounded-xl font-display font-black uppercase tracking-[0.15em] text-sm text-[#0a0a0a] tap-transparent"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                boxShadow: `0 6px 28px ${accent}66`,
              }}
            >
              {t('tourn.launch.revealBracket')}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
