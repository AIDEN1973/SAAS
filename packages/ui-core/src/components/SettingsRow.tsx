/**
 * SettingsRow Component
 *
 * 설정 페이지의 개별 설정 항목 행 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 *
 * UI 스타일: Supabase SSL Configuration 참고
 * - 좌측: 제목 + 설명
 * - 우측: 액션 (Switch, Button 등)
 */

import React from 'react';

export interface SettingsRowProps {
  /** 설정 항목 제목 */
  title: string;
  /** 설정 항목 설명 */
  description: string | React.ReactNode;
  /** 우측 액션 영역 (Switch, Button 등) */
  action?: React.ReactNode;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 마지막 항목 여부 (하단 구분선 제거) */
  isLast?: boolean;
  /** 추가 스타일 */
  style?: React.CSSProperties;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  description,
  action,
  disabled = false,
  isLast = false,
  style,
}) => {
  return (
    <div
      className="settings-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--spacing-lg)',
        padding: 'var(--spacing-lg)',
        borderBottom: isLast ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
        opacity: disabled ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
        ...style,
      }}
    >
      {/* 좌측: 제목 + 설명 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            lineHeight: 'var(--line-height)',
          }}
        >
          {description}
        </div>
      </div>

      {/* 우측: 액션 (모바일에서는 아래로 이동) */}
      {action && (
        <div
          className="settings-row-action"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {action}
        </div>
      )}
    </div>
  );
};
