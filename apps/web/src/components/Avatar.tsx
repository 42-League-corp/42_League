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

export function Avatar({ login, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  const initial = (login[0] ?? '?').toUpperCase();

  return (
    <div
      className={`flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-extrabold uppercase border-2 border-teal bg-gradient-to-br from-teal-deep to-teal text-[#001416] shadow-[0_0_12px_rgba(0,217,220,0.4)] ${SIZE[size]} ${className}`}
    >
      {showImg ? (
        <img
          src={imageUrl}
          alt={login}
          className="w-full h-full object-cover block"
          onError={() => setBroken(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
