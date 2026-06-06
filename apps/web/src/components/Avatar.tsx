import { useState } from 'react';
import { useAvatarRingColor } from '../hooks/useAvatarRing';

interface AvatarProps {
  login: string;
  imageUrl: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Grise la photo (saisons passées : classement figé, plus "live"). */
  grayscale?: boolean;
  /**
   * Désactive l'anneau de grade (couleur du palier du joueur dans le mode
   * courant). Par défaut l'anneau est affiché dès qu'un grade est connu.
   */
  noRing?: boolean;
  /**
   * Ajoute un reflet diagonal sur le placeholder (sans photo). Le disque uni
   * tourne déjà en 3D sur les podiums, mais sans surface à suivre du regard la
   * rotation se lit mal ; le reflet donne le repère qui manque → la pièce ronde
   * "flippe" comme une photo. Sans effet quand une photo est affichée.
   */
  coin?: boolean;
}

const SIZE = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

/** Épaisseur de l'anneau de grade (px) selon la taille de l'avatar. */
const RING_W = { xs: 1.5, sm: 2, md: 2, lg: 2.5, xl: 3 };

/**
 * Avatar rond — design friendly et coloré.
 */
export function Avatar({ login, imageUrl, size = 'md', className = '', grayscale = false, coin = false, noRing = false }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  const initial = (login[0] ?? '?').toUpperCase();
  // Reflet diagonal posé sur le placeholder pour rendre la rotation 3D lisible.
  const sheen = coin && !showImg
    ? 'linear-gradient(115deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 64%), '
    : '';

  // Anneau de grade (couleur du palier du joueur dans le mode courant). Désactivé
  // en grayscale (saisons figées) ou via `noRing`. Tracé en `box-shadow` outset :
  // pas d'impact sur la mise en page (avatars empilés) ni rogné par overflow-hidden.
  const ringColor = useAvatarRingColor(login);
  const ring = !noRing && !grayscale ? ringColor : null;
  const ringW = RING_W[size];
  const boxShadow = ring
    ? `0 0 0 ${ringW}px ${ring}, 0 0 10px ${ring}66, 0 2px 8px rgba(0,0,0,0.35)`
    : '0 2px 10px rgba(255, 154, 158, 0.3)';

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-display font-bold uppercase ${SIZE[size]} ${grayscale ? 'grayscale opacity-80' : ''} ${className}`}
      style={{
        background: `${sheen}linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)`,
        boxShadow,
        color: '#fff',
      }}
    >
      {showImg ? (
        <img
          src={imageUrl}
          alt={login}
          className="w-full h-full object-cover block"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="relative z-10">{initial}</span>
      )}
    </div>
  );
}

export interface UserBadgeProps extends AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Force l'affichage du username (ex: pour la recherche) */
  showUsername?: boolean;
  /** Masque le texte et n'affiche que l'avatar */
  avatarOnly?: boolean;
}

/**
 * Composant universel pour afficher un utilisateur.
 * Affiche par défaut "Prénom Nom" si disponible, sinon le username.
 */
export function UserBadge({ firstName, lastName, showUsername, avatarOnly, ...avatarProps }: UserBadgeProps) {
  const displayName = firstName && lastName && !showUsername 
    ? `${firstName} ${lastName}` 
    : avatarProps.login;

  if (avatarOnly) {
    return <Avatar {...avatarProps} />;
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar {...avatarProps} />
      <div className="flex flex-col">
        <span className="font-bold text-text-strong leading-tight">{displayName}</span>
        {firstName && lastName && !showUsername && (
          <span className="text-[10px] text-muted-2 leading-tight">@{avatarProps.login}</span>
        )}
      </div>
    </div>
  );
}
