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
 * Avatar rond — bordure dorée premium, lueur subtile, fallback initiale sur or fondu.
 * Inspiré du portrait central du screenshot 42 League.
 */
export function Avatar({ login, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  const initial = (login[0] ?? '?').toUpperCase();

  return (
    <div
      className={`relative flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-display font-black uppercase ${SIZE[size]} ${className}`}
      style={{
        background:
          'linear-gradient(135deg, #d4a04a 0%, #8a5e10 50%, #c79122 100%)',
        boxShadow:
          '0 0 0 2px #ffc94a, 0 0 0 3px rgba(0,0,0,0.6), 0 0 18px rgba(255, 201, 74, 0.4), inset 0 1px 0 rgba(255, 247, 228, 0.4)',
        color: '#1a1100',
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
