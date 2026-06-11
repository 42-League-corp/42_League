import { useEffect, useState } from 'react';
import type { LiveTournament } from '../../lib/api';
import type { PhaseInfo } from '../../lib/liveTournament';

// Bandeau supérieur de l'écran TV : marque à gauche, titre « EN DIRECT » au centre,
// chrono d'épreuve à droite (temps écoulé depuis le coup d'envoi).

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveHeader({ tournament, phase }: { tournament: LiveTournament; phase: PhaseInfo }) {
  const startedAt = tournament.startedAt ? new Date(tournament.startedAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const kindLabel = tournament.kind === 'official' ? 'TOURNOI OFFICIEL' : 'TOURNOI';

  return (
    <header className="relative flex items-center justify-between px-[2vw] py-[1vh] border-b border-border/60 bg-gradient-to-b from-bg-1 to-bg-0">
      {/* Marque */}
      <div className="flex items-center gap-[1vw] min-w-0">
        <img
          src="/logo-wordmark.webp"
          alt="42 League"
          className="h-[5vh] w-auto object-contain drop-shadow-[0_0_18px_rgba(255,201,74,0.35)]"
        />
        <div className="hidden xl:flex flex-col leading-none min-w-0">
          <span className="text-[1.3vh] uppercase tracking-[0.2em] text-muted">{phase.label}</span>
          <span className="text-[2vh] font-gaming font-bold text-text-strong truncate max-w-[16vw]">
            {tournament.name}
          </span>
        </div>
      </div>

      {/* Titre live */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-[0.8vw]">
        <span className="relative flex h-[1.4vh] w-[1.4vh]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-70" />
          <span className="relative inline-flex h-full w-full rounded-full bg-red shadow-[0_0_10px_rgba(255,83,102,0.9)]" />
        </span>
        <h1 className="font-display font-black tracking-[0.12em] text-[3.4vh] bg-gradient-to-b from-text-strong to-gold bg-clip-text text-transparent uppercase whitespace-nowrap">
          {kindLabel} — EN DIRECT
        </h1>
      </div>

      {/* Chrono */}
      <div className="flex items-center gap-[0.6vw]">
        <span className="text-[1.6vh] uppercase tracking-[0.2em] text-muted">Temps</span>
        <span className="font-mono font-bold text-[3.2vh] text-gold tabular-nums drop-shadow-[0_0_12px_rgba(255,201,74,0.4)]">
          {startedAt != null ? formatElapsed(now - startedAt) : '--:--'}
        </span>
      </div>
    </header>
  );
}
