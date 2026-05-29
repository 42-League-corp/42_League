import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PlayerLinkProps {
  login: string;
  children: ReactNode;
  className?: string;
}

export function PlayerLink({ login, children, className = '' }: PlayerLinkProps) {
  return (
    <Link
      to={`/player/${encodeURIComponent(login)}`}
      className={`inline-flex items-center gap-2 text-text hover:text-gold transition-colors duration-200 ${className}`}
    >
      {children}
    </Link>
  );
}
