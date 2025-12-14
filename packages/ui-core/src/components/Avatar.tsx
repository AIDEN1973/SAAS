/**
 * Avatar Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
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
 * 프로필 이미지가 없는 경우 이니셜 표시
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
      width: 'var(--size-avatar-xs)', // styles.css 준수: 아바타 크기 토큰 사용
      height: 'var(--size-avatar-xs)', // styles.css 준수: 아바타 크기 토큰 사용
    },
    sm: {
      width: 'var(--size-avatar-sm)', // styles.css 준수: 아바타 크기 토큰 사용
      height: 'var(--size-avatar-sm)', // styles.css 준수: 아바타 크기 토큰 사용
    },
    md: {
      width: 'var(--size-avatar-md)', // styles.css 준수: 아바타 크기 토큰 사용
      height: 'var(--size-avatar-md)', // styles.css 준수: 아바타 크기 토큰 사용
    },
    lg: {
      width: 'var(--size-avatar-lg)', // styles.css 준수: 아바타 크기 토큰 사용
      height: 'var(--size-avatar-lg)', // styles.css 준수: 아바타 크기 토큰 사용
    },
    xl: {
      width: 'var(--size-avatar-xl)', // styles.css 준수: 아바타 크기 토큰 사용
      height: 'var(--size-avatar-xl)', // styles.css 준수: 아바타 크기 토큰 사용
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

