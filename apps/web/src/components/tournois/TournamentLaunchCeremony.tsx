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

/**
 * Une « face » du tirage : tant que le duel n'est pas verrouillé, l'avatar défile
 * en boucle parmi tous les inscrits (vrai mélange visuel, façon machine à sous),
 * puis se fige sur le combattant réellement tiré avec un à-coup. Un côté `null`
 * (exempt) ne défile pas.
 */
function ShuffleFace({
  knight, pool, accent, locked,
}: { knight: Knight | null; pool: Knight[]; accent: string; locked: boolean }) {
  const [display, setDisplay] = useState<Knight | null>(knight);
  useEffect(() => {
    if (knight === null || locked || pool.length === 0) {
      setDisplay(knight);
      return;
    }
    const iv = setInterval(() => {
      setDisplay(pool[Math.floor(Math.random() * pool.length)] ?? knight);
    }, 65);
    return () => clearInterval(iv);
  }, [knight, pool, locked]);

  if (knight === null) return <DrawAvatar knight={null} accent={accent} from="left" />;
  const k = display ?? knight;
  const size = 44;
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 64 }}>
      <motion.div
        animate={locked ? { scale: [1.18, 1] } : {}}
        transition={{ type: 'spring', stiffness: 320, damping: 14 }}
        className="rounded-full flex items-center justify-center font-display font-black text-[#0a0a0a] overflow-hidden"
        style={{
          width: size, height: size, fontSize: size * 0.4,
          border: `2px solid ${accent}`,
          boxShadow: locked ? `0 0 18px ${accent}aa` : `0 0 8px ${accent}44`,
          background: k.imageUrl ? undefined : accent,
          filter: locked ? 'none' : 'blur(0.7px)',
          opacity: locked ? 1 : 0.9,
        }}
      >
        {k.imageUrl
          ? <img src={k.imageUrl} alt={k.login} className="w-full h-full object-cover" />
          : k.login[0]?.toUpperCase()}
      </motion.div>
      <span
        className="text-[9px] font-bold text-text-strong/90 max-w-[64px] truncate"
        style={{ opacity: locked ? 1 : 0.55 }}
      >
        {k.login}
      </span>
    </div>
  );
}

/** Un duel du tirage : les deux faces défilent puis se verrouillent à `stopMs`. */
function ShuffleDuel({
  pair, pool, accent, stopMs,
}: { pair: { a: Knight | null; b: Knight | null }; pool: Knight[]; accent: string; stopMs: number }) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLocked(true), stopMs);
    return () => clearTimeout(id);
  }, [stopMs]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-center gap-2 rounded-xl border bg-bg-1/40 px-3 py-2"
      style={{
        borderColor: locked ? `${accent}99` : `${accent}33`,
        boxShadow: locked ? `0 0 16px ${accent}3a` : 'none',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}
    >
      <ShuffleFace knight={pair.a} pool={pool} accent={accent} locked={locked} />
      <motion.span
        animate={locked ? { scale: [1, 1.45, 1], rotate: [0, -12, 0] } : { opacity: 0.5 }}
        transition={{ duration: 0.45 }}
        className="text-base font-black shrink-0"
        style={{ color: accent }}
      >
        ⚔
      </motion.span>
      <ShuffleFace knight={pair.b} pool={pool} accent={accent} locked={locked} />
    </motion.div>
  );
}

function DrawReveal({
  pairings, pool, accent, t,
}: { pairings: { a: Knight | null; b: Knight | null }[]; pool: Knight[]; accent: string; t: (k: string) => string }) {
  return (
    <div className="w-full flex flex-col items-center gap-2.5 max-h-[46vh] overflow-y-auto no-scrollbar px-1 py-1">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.3em]" style={{ color: accent }}>
        {t('tourn.launch.draw')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {pairings.map((p, i) => (
          // Verrouillage échelonné : les duels se figent un par un (effet « tirage »).
          <ShuffleDuel key={i} pair={p} pool={pool} accent={accent} stopMs={700 + i * 420} />
        ))}
      </div>
    </div>
  );
}

// ─── Particules (étincelles autour du titre) ─────────────────────────────────────

const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * 2 * Math.PI;
  const dist = 150 + Math.random() * 120;
  return {
    id: i,
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    size: 3 + Math.random() * 7,
    delay: Math.random() * 0.4,
  };
});

// ─── Braises ascendantes (ambiance arène) ────────────────────────────────────────

const EMBERS = Array.from({ length: 46 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 5,
  dur: 5 + Math.random() * 5,
  drift: (Math.random() - 0.5) * 90,
}));

/** Pluie de braises dorées qui montent en continu, déphasées. Purement décoratif. */
function EmberField({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {EMBERS.map((e) => (
        <motion.div
          key={e.id}
          className="absolute rounded-full"
          style={{
            left: `${e.left}%`, bottom: -12,
            width: e.size, height: e.size,
            background: accent, boxShadow: `0 0 ${e.size * 2.5}px ${accent}`,
          }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{ y: -1200, x: e.drift, opacity: [0, 0.9, 0.9, 0] }}
          transition={{ delay: e.delay, duration: e.dur, ease: 'linear', repeat: Infinity }}
        />
      ))}
    </div>
  );
}

// ─── Rayons divins (god rays) ────────────────────────────────────────────────────

/** Deux couronnes de rayons contra-rotatives derrière le titre, fondues en bord. */
function GodRays({ accent }: { accent: string }) {
  const mask = 'radial-gradient(closest-side, rgba(0,0,0,1) 10%, rgba(0,0,0,0.5) 45%, transparent 78%)';
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <motion.div
        className="absolute"
        style={{
          width: '200vmax', height: '200vmax',
          background: `repeating-conic-gradient(from 0deg at 50% 50%, ${accent}22 0deg 5deg, transparent 5deg 24deg)`,
          WebkitMaskImage: mask, maskImage: mask, filter: 'blur(2px)',
        }}
        initial={{ rotate: 0, opacity: 0 }}
        animate={{ rotate: 360, opacity: 0.55 }}
        transition={{ rotate: { duration: 60, ease: 'linear', repeat: Infinity }, opacity: { duration: 1.2 } }}
      />
      <motion.div
        className="absolute"
        style={{
          width: '160vmax', height: '160vmax',
          background: `repeating-conic-gradient(from 0deg at 50% 50%, ${accent}14 0deg 3deg, transparent 3deg 30deg)`,
          WebkitMaskImage: mask, maskImage: mask, filter: 'blur(3px)',
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 90, ease: 'linear', repeat: Infinity }}
      />
    </div>
  );
}

// ─── Ondes de choc (impact d'ouverture) ──────────────────────────────────────────

/** Anneaux d'énergie qui jaillissent du centre au lancement. */
function Shockwaves({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {[0, 0.18, 0.36].map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ border: `2.5px solid ${accent}`, boxShadow: `0 0 40px ${accent}` }}
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{ width: 1500, height: 1500, opacity: 0 }}
          transition={{ delay: d, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

// ─── Épées croisées (clash) ──────────────────────────────────────────────────────

function Sword({ flip, accent }: { flip?: boolean; accent: string }) {
  return (
    <svg viewBox="0 0 150 26" width="150" height="26" style={{ transform: flip ? 'scaleX(-1)' : undefined, overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={`blade-${flip ? 'r' : 'l'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef4fb" />
          <stop offset="50%" stopColor="#aeb9c7" />
          <stop offset="100%" stopColor="#6b7682" />
        </linearGradient>
      </defs>
      {/* Lame */}
      <polygon points="34,9 132,11 144,13 132,15 34,17" fill={`url(#blade-${flip ? 'r' : 'l'})`} stroke="#8a96a4" strokeWidth="0.6" />
      <line x1="40" y1="13" x2="130" y2="13" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
      {/* Garde */}
      <rect x="26" y="3" width="7" height="20" rx="3" fill="#caa24a" stroke="#8a6534" strokeWidth="0.8" />
      {/* Poignée */}
      <rect x="10" y="10" width="18" height="6" rx="3" fill="#5a3d1c" />
      {/* Pommeau */}
      <circle cx="9" cy="13" r="6" fill="#caa24a" stroke="#8a6534" strokeWidth="0.8" />
      <circle cx="9" cy="13" r="2.4" fill={accent} />
    </svg>
  );
}

/** Deux épées qui foncent et se croisent en X avec une gerbe d'étincelles au clash. */
function CrossedSwords({ accent }: { accent: string }) {
  const [clashed, setClashed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setClashed(true), 520);
    return () => clearTimeout(id);
  }, []);
  const sparks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI;
    return { id: i, x: Math.cos(a) * (50 + Math.random() * 40), y: Math.sin(a) * (50 + Math.random() * 40) };
  });
  return (
    <div className="relative flex items-center justify-center" style={{ height: 60, width: 240 }} aria-hidden>
      <motion.div
        className="absolute"
        initial={{ x: -260, y: -10, rotate: 28, opacity: 0 }}
        animate={{ x: -8, y: 0, rotate: 28, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.18 }}
        style={{ transformOrigin: 'center' }}
      >
        <Sword accent={accent} />
      </motion.div>
      <motion.div
        className="absolute"
        initial={{ x: 260, y: -10, rotate: -28, opacity: 0 }}
        animate={{ x: 8, y: 0, rotate: -28, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.18 }}
        style={{ transformOrigin: 'center' }}
      >
        <Sword flip accent={accent} />
      </motion.div>
      {/* Flash + étincelles au point de contact */}
      {clashed && (
        <>
          <motion.div
            className="absolute rounded-full"
            style={{ background: '#fff', boxShadow: `0 0 50px 20px ${accent}` }}
            initial={{ width: 8, height: 8, opacity: 1 }}
            animate={{ width: 70, height: 70, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {sparks.map((s) => (
            <motion.div
              key={s.id}
              className="absolute rounded-full"
              style={{ width: 3, height: 3, background: accent, boxShadow: `0 0 8px ${accent}` }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: s.x, y: s.y, opacity: 0, scale: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </div>
  );
}

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
            background: 'radial-gradient(ellipse at center, rgba(20,15,8,0.97) 0%, rgba(3,2,1,0.995) 100%)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleDone(); }}
        >
          {/* Rayons divins rotatifs derrière toute la scène */}
          <GodRays accent={accent} />

          {/* Pluie de braises ascendantes */}
          <EmberField accent={accent} />

          {/* Ondes de choc à l'ouverture */}
          <Shockwaves accent={accent} />

          {/* Décor de joute aux deux bords (chevaliers + bannières + drapeaux) */}
          <JoustingFlanks accent={accent} />

          {/* Flash blanc d'impact synchronisé sur le clash des épées */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ delay: 0.52, duration: 0.4, times: [0, 0.15, 1] }}
          />

          {/* Vignette sombre pour concentrer le regard au centre */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.65) 100%)' }}
          />

          {/* Bouton Passer */}
          <button
            type="button"
            onClick={handleDone}
            className="absolute top-4 right-4 px-4 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-[0.2em] text-muted-2 hover:text-text-strong border border-border/50 hover:border-border bg-bg-1/40 backdrop-blur-sm transition-colors tap-transparent z-20"
          >
            {t('tourn.launch.skip')}
          </button>

          {/* ── Contenu central (secousse d'impact au clash) ── */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-2xl w-full"
            animate={{ x: [0, -8, 7, -4, 2, 0], y: [0, 5, -4, 2, -1, 0] }}
            transition={{ delay: 0.52, duration: 0.45, ease: 'easeOut' }}
          >

            {/* Épées qui s'entrechoquent */}
            <CrossedSwords accent={accent} />

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
              <motion.div
                initial={{ scale: 2.7, opacity: 0, filter: 'blur(16px)' }}
                animate={{ scale: 1, opacity: 1, filter: `blur(0px) drop-shadow(0 0 26px ${accent}aa)` }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 280, damping: 17 }}
                className="font-display text-5xl sm:text-7xl font-black uppercase tracking-tight leading-[0.95]"
                style={{
                  background: `linear-gradient(135deg, #fff7e4 0%, ${accent} 55%, #fff7e4 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t('tourn.launch.title')}
              </motion.div>
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
              <DrawReveal pairings={pairings!} pool={participants} accent={accent} t={t} />
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
