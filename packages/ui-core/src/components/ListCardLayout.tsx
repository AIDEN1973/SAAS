/**
 * List Card Layout Component
 *
 * [불변 규칙] UI Core Component: 시각/레이아웃/인터랙션 프리미티브
 * [불변 규칙] 비즈니스 규칙 없음, API 호출 없음
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 리스트형 카드의 공통 레이아웃 구조를 제공하는 순수 UI 컴포넌트입니다.
 * ConsultationStatsCard, StudentAlertsCard 등 여러 행을 가진 카드가 동일한 레이아웃을 사용합니다.
 */

import React from 'react';
import { Card } from './Card';

export interface ListCardItem {
  label: React.ReactNode;
  value: React.ReactNode;
  color?: string; // 값의 색상 (예: 'var(--color-error)')
}

export interface ListCardLayoutProps {
  /** 카드 제목 */
  title: React.ReactNode;
  /** 리스트 아이템들 */
  items: ListCardItem[];
  /** 빈 카드 여부 (스타일 조정용) */
  isEmpty?: boolean;
  /** 빈 카드 메시지 */
  emptyMessage?: React.ReactNode;
  /** 카드 클릭 핸들러 */
  onClick?: () => void;
  /** 카드 variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** 추가 컨텐츠 */
  children?: React.ReactNode;
  /** 왼쪽 테두리 강조 (경고/알림 카드용) */
  borderLeftColor?: string;
  /** 우측 상단에 표시할 아이콘 (루시드 아이콘) */
  icon?: React.ReactNode;
}

export function ListCardLayout({
  title,
  items,
  isEmpty = false,
  emptyMessage = '데이터 없음', // [참고] 업종별 컴포넌트에서는 상수 사용 권장 (예: EMPTY_MESSAGES.DATA)
  onClick,
  variant = 'default',
  children,
  borderLeftColor,
  icon,
}: ListCardLayoutProps) {
  return (
    <Card
      variant={variant}
      padding="md"
      style={{
        cursor: onClick && !isEmpty ? 'pointer' : 'default',
        opacity: isEmpty ? 'var(--opacity-inactive)' : 'var(--opacity-full)',
        position: 'relative',
        ...(borderLeftColor && {
          borderLeft: `var(--border-width-thin) solid ${borderLeftColor}`,
        }),
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

      {/* 리스트 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {isEmpty ? (
          <div style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}>
            {emptyMessage}
          </div>
        ) : (
          <>
            {items.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-base)',
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontWeight: 'var(--font-weight-semibold)',
                  color: item.color || 'var(--color-text)',
                  fontSize: 'var(--font-size-base)',
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 추가 컨텐츠 */}
        {children}
      </div>
    </Card>
  );
}

