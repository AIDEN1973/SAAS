/**
 * EmptyState Component
 *
 * [불변 규칙] UI Core Component: 시각/레이아웃/인터랙션 프리미티브
 * [불변 규칙] 비즈니스 규칙 없음, API 호출 없음
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * 빈 상태를 표시하는 공통 컴포넌트
 * 아이콘, 메시지, 액션 버튼을 일관된 스타일로 표시합니다.
 */

import React from 'react';
import { LucideIcon, Database } from 'lucide-react';

export interface EmptyStateProps {
  /** 표시할 아이콘 (Lucide 아이콘 컴포넌트, 기본값: Database) */
  icon?: LucideIcon;
  /** 메시지 텍스트 */
  message?: string;
  /** 추가 설명 (message 아래에 표시) */
  description?: React.ReactNode;
  /** 액션 버튼 영역 */
  actions?: React.ReactNode;
  /** 추가 클래스명 */
  className?: string;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

/**
 * EmptyState 컴포넌트
 *
 * 빈 상태를 일관된 스타일로 표시
 * 아이콘은 항상 48px, weight="thin", 가운데 정렬
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Database,
  message = '데이터가 없습니다',
  description,
  actions,
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-md)',
        paddingTop: 'var(--spacing-lg)',
        paddingBottom: 'var(--spacing-lg)',
        textAlign: 'center',
        minHeight: 'calc(var(--spacing-xl) * 5)', // 최소 높이 보장
        ...style,
      }}
    >
      {/* 아이콘 */}
      <Icon
        size={48}
        strokeWidth={1} // thin에 해당하는 값
        style={{
          color: 'var(--color-text-tertiary)',
          opacity: 'var(--opacity-secondary)',
        }}
      />

      {/* 메시지 */}
      <div
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {message}
      </div>

      {/* 추가 설명 */}
      {description && (
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {description}
        </div>
      )}

      {/* 액션 버튼 */}
      {actions && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          {actions}
        </div>
      )}
    </div>
  );
};
