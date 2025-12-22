/**
 * Card Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SpacingToken } from '@design-system/core';

export interface CardProps {
  children: React.ReactNode;
  padding?: SpacingToken;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'outlined';
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  tabIndex?: number;
  'aria-label'?: string;
  /** 롤오버 효과 비활성화 (transform 효과 제거) */
  disableHoverEffect?: boolean;
  /** 카드 내부 타이틀 (타이틀 하단에 구분선 자동 추가) */
  title?: React.ReactNode;
  /** 타이틀 위치 (기본값: 'top-left') */
  titlePosition?: 'top-left' | 'top-right' | 'top-center';
  /** 타이틀 왼쪽에 표시할 아이콘 (루시드 아이콘) */
  titleIcon?: React.ReactNode;
  /** 타이틀 영역 우측에 표시할 컨텐츠 */
  titleRightContent?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'lg',
  className,
  style,
  onClick,
  variant = 'default',
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  tabIndex,
  'aria-label': ariaLabel,
  disableHoverEffect = false,
  title,
  titlePosition = 'top-left',
  titleIcon,
  titleRightContent,
}) => {
  const paddingMap: Record<SpacingToken, string> = {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  };
  const basePadding = paddingMap[padding];

  const variantStyles: Record<'default' | 'elevated' | 'outlined', React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
      boxShadow: 'none',
    },
    elevated: {
      backgroundColor: 'var(--color-white)',
      border: 'none',
      boxShadow: 'none',
    },
    outlined: {
      backgroundColor: 'var(--color-white)',
      border: 'var(--border-width-thin) solid var(--color-gray-200)', // styles.css 준수: border-width 토큰 사용
      boxShadow: 'none',
    },
  };

  const cardStyle: React.CSSProperties = {
    // 요구사항: 카드 라운드 한 단계 축소 (sm -> xs)
    borderRadius: 'var(--border-radius-xs)',
    paddingTop: basePadding,
    paddingRight: basePadding,
    paddingLeft: basePadding,
    // 요구사항: 기본보기/수정폼 모두에서 카드 내부 하단 여백을 한 단계 더 확보
    // (하드코딩 금지: spacing 토큰 사용)
    paddingBottom: `calc(${basePadding} + var(--spacing-sm))`,
    ...variantStyles[variant],
    ...(onClick && !disableHoverEffect && {
      cursor: 'pointer',
      transition: 'var(--transition-all)', // styles.css 준수: transition 토큰 사용
    }),
    ...(onClick && disableHoverEffect && {
      cursor: 'pointer',
      transition: 'none', // 롤오버 효과 비활성화 시 transition 제거
      transform: 'none', // 롤오버 효과 비활성화 시 transform 제거
    }),
    ...style,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick && !disableHoverEffect) {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'var(--transform-lift-hover)'; // styles.css 준수: transform 토큰 사용
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick && !disableHoverEffect) {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'var(--transform-scale-normal)'; // styles.css 준수: transform 토큰 사용
    }
    onMouseLeave?.(e);
  };

  // 타이틀 위치 스타일 계산
  const titlePositionStyles: Record<'top-left' | 'top-right' | 'top-center', React.CSSProperties> = {
    'top-left': {
      textAlign: 'left',
    },
    'top-right': {
      textAlign: 'right',
    },
    'top-center': {
      textAlign: 'center',
    },
  };

  return (
    <div
      className={clsx(className)}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={
        disableHoverEffect
          ? onMouseEnter
          : onClick || onMouseEnter
          ? handleMouseEnter
          : undefined
      }
      onMouseLeave={
        disableHoverEffect
          ? onMouseLeave
          : onClick || onMouseLeave
          ? handleMouseLeave
          : undefined
      }
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
    >
      {title && (
        <>
          <div
            style={{
              marginLeft: `calc(-1 * ${basePadding})`,
              marginRight: `calc(-1 * ${basePadding})`,
              marginTop: `calc(-1 * ${basePadding})`,
              paddingLeft: basePadding,
              paddingRight: basePadding,
              paddingTop: basePadding,
              paddingBottom: basePadding,
              backgroundColor: 'var(--color-gray-50)',
              // 버튼 높이 기준으로 최소 높이 설정 (IconButtonGroup, BadgeSelect 등이 사용하는 --size-pagination-button 기준)
              minHeight: `calc(${basePadding} + var(--size-pagination-button) + ${basePadding})`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: titleRightContent ? 'space-between' : titlePosition === 'top-right' ? 'flex-end' : titlePosition === 'top-center' ? 'center' : 'flex-start',
                gap: 'var(--spacing-sm)',
                // 버튼 높이 기준으로 최소 높이 설정
                minHeight: 'var(--size-pagination-button)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  ...titlePositionStyles[titlePosition],
                }}
              >
                {titleIcon && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--color-text)',
                    }}
                  >
                    {titleIcon}
                  </span>
                )}
                {title}
              </div>
              {titleRightContent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  {titleRightContent}
                </div>
              ) : (
                // titleRightContent가 없을 때도 버튼 높이만큼 공간 확보
                <div style={{ width: 0, height: 'var(--size-pagination-button)', minHeight: 'var(--size-pagination-button)' }} />
              )}
            </div>
          </div>
          <div
            style={{
              marginLeft: `calc(-1 * ${basePadding})`,
              marginRight: `calc(-1 * ${basePadding})`,
              marginBottom: 'var(--spacing-md)',
              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            }}
          />
        </>
      )}
      {children}
    </div>
  );
};
