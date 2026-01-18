/**
 * Badge Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ColorToken, SizeToken } from '@design-system/core';
import { createBadgeColorMap } from '../hooks/useCssVariable';

export interface BadgeProps {
  children: React.ReactNode;
  color?: ColorToken | 'blue' | 'gray' | 'green' | 'yellow';
  size?: SizeToken;
  variant?: 'solid' | 'outline' | 'soft';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// [성능 최적화] 컴포넌트 외부에서 한 번만 생성 (모든 Badge 인스턴스가 공유)
const BADGE_COLOR_MAP = createBadgeColorMap();

/**
 * Badge 컴포넌트
 *
 * 태그, 상태 표시 등에 사용
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  color = 'primary',
  size = 'md',
  variant = 'solid',
  className,
  style,
  onClick,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  // [SSOT] 색상 맵은 컴포넌트 외부에서 생성된 BADGE_COLOR_MAP 사용
  const colorVars = BADGE_COLOR_MAP[color || 'primary'];

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      padding: 'var(--spacing-xs) var(--spacing-sm)', // 패딩 축소
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-xs)', // 폰트 크기 xs
    },
    sm: {
      padding: 'var(--spacing-xs) var(--spacing-sm)', // 패딩 축소
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-xs)', // 폰트 크기 xs (한 포인트 작게)
    },
    md: {
      padding: 'var(--spacing-xs) var(--spacing-md)', // 좌우 여백 1포인트 늘림 (sm → md)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-sm)', // 폰트 크기 sm
    },
    lg: {
      padding: 'var(--spacing-sm) var(--spacing-lg)', // 좌우 여백 1포인트 늘림 (md → lg)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-base)', // 폰트 크기 base
    },
    xl: {
      padding: 'var(--spacing-sm) var(--spacing-lg)', // 좌우 여백 1포인트 늘림 (md → lg)
      lineHeight: 'var(--line-height)', // styles.css 준수: line-height 토큰 사용
      fontSize: 'var(--font-size-lg)', // 폰트 크기 lg
    },
  };

  const variantStyles: Record<'solid' | 'outline' | 'soft', React.CSSProperties> = {
    solid: {
      backgroundColor: colorVars.main || 'var(--color-white)', // 배경색 메인 색상 사용
      color: 'var(--color-white)', // 폰트 색상 화이트
      border: 'none',
    },
    outline: {
      backgroundColor: 'var(--color-white)', // 배경색 화이트
      color: colorVars.main || 'var(--color-text)',
      border: `var(--border-width-thin) solid ${colorVars.main || 'var(--color-border)'}`, // styles.css 준수: border-width 토큰 사용
    },
    soft: {
      backgroundColor: colorVars.bg50 || 'var(--color-white)', // 연한 배경색, 없으면 화이트
      color: colorVars.dark || 'var(--color-text)', // 폰트 색상
      border: 'none',
    },
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--border-radius-lg)', // 라운드 lg 적용
    fontWeight: 'var(--font-weight-medium)',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(onClick && {
      cursor: 'pointer',
      transition: 'var(--transition-all)',
      opacity: isHovered ? 0.8 : 1,
    }),
    ...style,
  };

  return onClick ? (
    <button
      type="button"
      className={clsx(className)}
      style={badgeStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  ) : (
    <span className={clsx(className)} style={badgeStyle}>
      {children}
    </span>
  );
};

