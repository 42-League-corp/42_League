import { useState } from 'react';

interface AvatarProps {
  login: string;
  imageUrl: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

/**
 * Avatar rond — design friendly et coloré.
 */
export function Avatar({ login, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  const initial = (login[0] ?? '?').toUpperCase();

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-display font-bold uppercase ${SIZE[size]} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
        boxShadow: '0 2px 10px rgba(255, 154, 158, 0.3)',
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
