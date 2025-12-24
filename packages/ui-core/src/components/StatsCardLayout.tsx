/**
 * Stats Card Layout Component
 *
 * [불변 규칙] UI Core Component: 시각/레이아웃/인터랙션 프리미티브
 * [불변 규칙] 비즈니스 규칙 없음, API 호출 없음
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 통계 카드의 공통 레이아웃 구조를 제공하는 순수 UI 컴포넌트입니다.
 * StudentStatsCard, AttendanceStatsCard, StatsCard 등 모든 통계 카드가 동일한 레이아웃을 사용합니다.
 */

import React from 'react';
import { Card } from './Card';

export interface StatsCardLayoutProps {
  /** 카드 제목 */
  title: React.ReactNode;
  /** 메인 값 (큰 숫자) */
  value: React.ReactNode;
  /** 값 옆에 표시할 단위/추가 정보 */
  unit?: React.ReactNode;
  /** 트렌드 표시 (예: "+10%", "-5%") */
  trend?: React.ReactNode;
  /** 보조 정보 (하단에 표시) */
  subtitle?: React.ReactNode;
  /** 빈 카드 여부 (스타일 조정용) */
  isEmpty?: boolean;
  /** 카드 클릭 핸들러 */
  onClick?: () => void;
  /** 카드 variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** 추가 컨텐츠 (커스텀 영역) */
  children?: React.ReactNode;
  /** 우측 상단에 표시할 아이콘 (루시드 아이콘) */
  icon?: React.ReactNode;
}

export function StatsCardLayout({
  title,
  value,
  unit,
  trend,
  subtitle,
  isEmpty = false,
  onClick,
  variant = 'default',
  children,
  icon,
}: StatsCardLayoutProps) {
  return (
    <Card
      variant={variant}
      padding="md"
      style={{
        cursor: onClick && !isEmpty ? 'pointer' : 'default',
        opacity: isEmpty ? 'var(--opacity-inactive)' : 'var(--opacity-full)',
        position: 'relative',
      }}
      onClick={isEmpty ? undefined : onClick}
      disableHoverEffect={true}
    >
      {/* 우측 상단 고정 아이콘 */}
      {icon && (
        <div
          style={{
            position: 'absolute',
            top: 'var(--spacing-md)',
            right: 'var(--spacing-md)',
            width: 'var(--size-icon-base)',
            height: 'var(--size-icon-base)',
            color: 'var(--color-text-secondary)',
            opacity: 'var(--opacity-secondary)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}
      {/* 제목 */}
      <h3 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)',
        marginBottom: 'var(--spacing-md)',
        color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)',
      }}>
        {title}
      </h3>

      {/* 메인 값 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)' }}>
          <div style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: isEmpty ? 'var(--color-text-secondary)' : 'var(--color-text)',
          }}>
            {value}
          </div>
          {unit && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {unit}
            </div>
          )}
          {trend && (
            <div style={{
              color: typeof trend === 'string' && trend.startsWith('+')
                ? 'var(--color-success)'
                : 'var(--color-error)'
            }}>
              {trend}
            </div>
          )}
        </div>

        {/* 보조 정보 */}
        {subtitle && (
          <div style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)'
          }}>
            {subtitle}
          </div>
        )}

        {/* 추가 컨텐츠 */}
        {children}
      </div>
    </Card>
  );
}

