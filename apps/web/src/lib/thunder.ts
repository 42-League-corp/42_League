/**
 * Synthèse d'un « coup de tonnerre » via Web Audio — aucun asset, ~0 ko réseau.
 * On empile : (1) un crack sec = burst de bruit blanc filtré passe-haut avec une
 * attaque quasi instantanée, puis (2) un grondement grave = bruit filtré passe-bas
 * qui décroît lentement, légèrement modulé. Tout est encapsulé et silencieux en
 * cas d'échec (autoplay bloqué, pas de Web Audio…). Doit être appelé depuis un
 * geste utilisateur (clic) pour que le contexte audio démarre.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Crée un buffer de bruit blanc de `seconds` secondes. */
function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playThunder(): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.value = 0.0001;
    master.connect(ac.destination);

    // ── 1. Le crack initial (claquement sec, aigu) ──
    const crack = ac.createBufferSource();
    crack.buffer = noiseBuffer(ac, 0.4);
    const crackHP = ac.createBiquadFilter();
    crackHP.type = 'highpass';
    crackHP.frequency.value = 1400;
    const crackGain = ac.createGain();
    crackGain.gain.setValueAtTime(0.0001, now);
    crackGain.gain.exponentialRampToValueAtTime(0.9, now + 0.008);
    crackGain.gain.exponentialRampToValueAtTime(0.02, now + 0.25);
    crack.connect(crackHP).connect(crackGain).connect(master);

    // ── 2. Le grondement grave qui roule (rumble) ──
    const rumble = ac.createBufferSource();
    rumble.buffer = noiseBuffer(ac, 1.8);
    const rumbleLP = ac.createBiquadFilter();
    rumbleLP.type = 'lowpass';
    rumbleLP.frequency.setValueAtTime(400, now);
    rumbleLP.frequency.exponentialRampToValueAtTime(90, now + 1.6);
    const rumbleGain = ac.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.8, now + 0.06);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
    rumble.connect(rumbleLP).connect(rumbleGain).connect(master);

    // ── 3. Sous-grave sinusoïdal pour le « punch » dans la poitrine ──
    const sub = ac.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.5);
    const subGain = ac.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    sub.connect(subGain).connect(master);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.7, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

    crack.start(now);
    rumble.start(now + 0.02);
    sub.start(now);
    crack.stop(now + 0.4);
    rumble.stop(now + 1.8);
    sub.stop(now + 0.6);
  } catch {
    /* audio indisponible : on ignore, le visuel suffit */
  }
}
