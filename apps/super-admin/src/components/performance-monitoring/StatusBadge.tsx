/**
 * Status Badge Component
 *
 * [불변 규칙] 성능 지표 상태 배지 공통 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 * [DRY] 여러 컴포넌트에서 사용하는 상태 배지 패턴 추출
 */

import {
  statusStyles,
  performanceStyles,
  type StatusLevel,
  type PerformanceLevel,
} from './statusStyles';

// Re-export types for backward compatibility
export type { StatusLevel, PerformanceLevel };

interface StatusBadgeProps {
  level: StatusLevel | PerformanceLevel;
  customLabel?: string;
  title?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ level, customLabel, title, size = 'md' }: StatusBadgeProps) {
  const isPerformanceLevel = ['excellent', 'good'].includes(level);
  const styles = isPerformanceLevel
    ? performanceStyles[level as PerformanceLevel]
    : statusStyles[level as StatusLevel];

  const padding = size === 'sm' ? 'var(--spacing-xxs) var(--spacing-xs)' : 'var(--spacing-xs) var(--spacing-sm)';
  const fontSize = size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-base)';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        padding,
        borderRadius: 'var(--border-radius-sm)',
        backgroundColor: styles.bgColor,
        border: `var(--border-width-thin) solid ${styles.color}`,
      }}
      title={title}
    >
      <span style={{ color: styles.color, fontSize }}>{styles.icon}</span>
      <span
        style={{
          color: styles.color,
          fontSize,
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        {customLabel || styles.label}
      </span>
    </div>
  );
}
