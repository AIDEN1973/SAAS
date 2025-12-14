/**
 * Skeleton Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Skeleton 컴포넌트
 *
 * 로딩 스켈레톤
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'rectangular',
  className,
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-gray-200)',
    borderRadius: variant === 'circular'
      ? 'var(--border-radius-full)' // styles.css 준수: border-radius 토큰 사용
      : variant === 'text'
      ? 'var(--spacing-xxs)' // styles.css 준수: spacing 토큰 사용 (4px)
      : 'var(--border-radius-sm)', // styles.css 준수: border-radius 토큰 사용
    animation: 'pulse var(--transition-slow) ease-in-out infinite', // styles.css 준수: transition 토큰 사용
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
    ...style,
  };

  if (variant === 'text') {
    return (
      <div
        className={clsx(className)}
        style={{
          ...baseStyle,
          height: height || '1em',
          width: width || '100%',
        }}
      />
    );
  }

  return (
    <div
      className={clsx(className)}
      style={baseStyle}
    />
  );
};

