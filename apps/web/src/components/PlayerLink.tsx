import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PlayerHoverCard } from './PlayerHoverCard';

interface PlayerLinkProps {
  login: string;
  children: ReactNode;
  className?: string;
  /** Désactive la hover-card (ex. contextes où elle gênerait). */
  noHoverCard?: boolean;
}

// La hover-card est une affordance desktop : on ne l'active que si le pointeur
// supporte le survol (évite de parasiter le tap → navigation sur mobile).
const HOVER_CAPABLE =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover)').matches;

const HOVER_DELAY_MS = 200;

export function PlayerLink({ login, children, className = '', noHoverCard }: PlayerLinkProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLAnchorElement>(null);
  const enabled = HOVER_CAPABLE && !noHoverCard;

  const open = () => {
    if (!enabled) return;
    timer.current = window.setTimeout(() => {
      if (ref.current) setRect(ref.current.getBoundingClientRect());
    }, HOVER_DELAY_MS);
  };
  const close = () => {
    window.clearTimeout(timer.current);
    setRect(null); // disparition immédiate
  };

  return (
    <>
      <Link
        ref={ref}
        to={`/player/${encodeURIComponent(login)}`}
        onMouseEnter={open}
        onMouseLeave={close}
        onBlur={close}
        className={`inline-flex items-center gap-2 text-text hover:text-gold transition-colors duration-200 ${className}`}
      >
        {children}
      </Link>
      {rect && <PlayerHoverCard login={login} anchorRect={rect} />}
    </>
  );
}
