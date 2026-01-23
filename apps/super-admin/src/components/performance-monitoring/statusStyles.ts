/**
 * Status Styles Constants
 *
 * [불변 규칙] 성능 지표 상태 배지 스타일 정의
 * [DRY] StatusBadge 컴포넌트에서 사용하는 스타일 상수
 */

export type StatusLevel = 'healthy' | 'warning' | 'critical';
export type PerformanceLevel = 'excellent' | 'good' | 'warning' | 'critical';

interface StatusStyle {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
}

export const statusStyles: Record<StatusLevel, StatusStyle> = {
  healthy: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-bg)',
    label: '정상',
    icon: '●',
  },
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'var(--color-warning-bg)',
    label: '주의',
    icon: '▲',
  },
  critical: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-bg)',
    label: '문제',
    icon: '■',
  },
};

export const performanceStyles: Record<PerformanceLevel, StatusStyle> = {
  excellent: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-bg)',
    label: '빠름',
    icon: '●',
  },
  good: {
    color: 'var(--color-info)',
    bgColor: 'var(--color-info-bg)',
    label: '양호',
    icon: '●',
  },
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'var(--color-warning-bg)',
    label: '느림',
    icon: '▲',
  },
  critical: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-bg)',
    label: '심각',
    icon: '■',
  },
};
