/**
 * Spinner Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';

export interface SpinnerProps {
  size?: SizeToken;
  color?: ColorToken;
  className?: string;
}

/**
 * Spinner 컴포넌트
 *
 * 로딩 스피너
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
}) => {
  const sizeMap: Record<SizeToken, string> = {
    xs: 'var(--size-spinner-xs)', // styles.css 준수: 스피너 크기 토큰 사용
    sm: 'var(--size-spinner-sm)', // styles.css 준수: 스피너 크기 토큰 사용
    md: 'var(--size-spinner-md)', // styles.css 준수: 스피너 크기 토큰 사용
    lg: 'var(--size-spinner-lg)', // styles.css 준수: 스피너 크기 토큰 사용
    xl: 'var(--size-spinner-xl)', // styles.css 준수: 스피너 크기 토큰 사용
  };

  const colorMap: Record<ColorToken, string> = {
    primary: 'var(--color-primary)',
    secondary: 'var(--color-secondary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  };

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'inline-block',
        width: sizeMap[size],
        height: sizeMap[size],
        border: `var(--border-width-spinner) solid ${colorMap[color]}20`, // styles.css 준수: 스피너 border-width 토큰 사용
        borderTopColor: colorMap[color],
        borderRadius: 'var(--border-radius-full)', // styles.css 준수: border-radius 토큰 사용
        animation: 'spin var(--transition-slow) linear infinite', // styles.css 준수: transition 토큰 사용
      }}
      role="status"
      aria-label="Loading"
    />
  );
};

