/**
 * Avatar Component
 * 
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: SizeToken;
  className?: string;
  onClick?: () => void;
}

/**
 * Avatar 컴포넌트
 * 
 * 프로필 이미지 또는 이니셜 표시
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = 'md',
  className,
  onClick,
}) => {
  const sizeMap: Record<SizeToken, React.CSSProperties> = {
    xs: {
      width: '24px',
      height: '24px',
      fontSize: 'var(--font-size-xs)',
    },
    sm: {
      width: '32px',
      height: '32px',
      fontSize: 'var(--font-size-sm)',
    },
    md: {
      width: '40px',
      height: '40px',
      fontSize: 'var(--font-size-base)',
    },
    lg: {
      width: '48px',
      height: '48px',
      fontSize: 'var(--font-size-lg)',
    },
    xl: {
      width: '64px',
      height: '64px',
      fontSize: 'var(--font-size-xl)',
    },
  };

  const sizeStyle = sizeMap[size];
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div
      className={clsx(className)}
      style={{
        ...sizeStyle,
        borderRadius: '50%',
        backgroundColor: 'var(--color-gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text)',
        flexShrink: 0,
      }}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

