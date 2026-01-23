/**
 * Status Style Utilities
 *
 * [불변 규칙] 성능 모니터링 상태 스타일 유틸리티
 * [SSOT] 모든 상태 스타일의 단일 진실 공급원
 * [DRY] 여러 컴포넌트에서 중복되는 상태 로직 통합
 */

export type HealthStatus = 'healthy' | 'warning' | 'critical';
export type PerformanceLevel = 'excellent' | 'good' | 'warning' | 'critical';
export type SeverityLevel = 'normal' | 'warning' | 'critical';
export type QualityLevel = 'excellent' | 'good' | 'warning' | 'critical';

export interface StatusStyle {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  emoji?: string;
}

/**
 * 기본 상태 스타일 (healthy/warning/critical)
 */
export const healthStatusStyles: Record<HealthStatus, StatusStyle> = {
  healthy: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-bg)',
    label: '정상',
    icon: '●',
    emoji: '✅',
  },
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'var(--color-warning-bg)',
    label: '주의',
    icon: '▲',
    emoji: '⚠️',
  },
  critical: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-bg)',
    label: '문제',
    icon: '■',
    emoji: '🔴',
  },
};

/**
 * 성능 레벨 스타일 (excellent/good/warning/critical)
 */
export const performanceLevelStyles: Record<PerformanceLevel, StatusStyle> = {
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

/**
 * 품질 레벨 스타일 (excellent/good/warning/critical)
 * 성능과 동일하지만 레이블이 다름
 */
export const qualityLevelStyles: Record<QualityLevel, StatusStyle> = {
  excellent: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-bg)',
    label: '우수',
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

/**
 * 심각도 레벨 스타일 (normal/warning/critical)
 */
export const severityLevelStyles: Record<SeverityLevel, StatusStyle> = {
  normal: {
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-bg)',
    label: '정상',
    icon: '●',
  },
  warning: {
    color: 'var(--color-warning)',
    bgColor: 'var(--color-warning-bg)',
    label: '경고',
    icon: '▲',
  },
  critical: {
    color: 'var(--color-error)',
    bgColor: 'var(--color-error-bg)',
    label: '심각',
    icon: '■',
  },
};

/**
 * 헬퍼 함수: 상태 스타일 가져오기
 */
export function getHealthStatusStyle(status: HealthStatus): StatusStyle {
  return healthStatusStyles[status];
}

export function getPerformanceLevelStyle(level: PerformanceLevel): StatusStyle {
  return performanceLevelStyles[level];
}

export function getQualityLevelStyle(level: QualityLevel): StatusStyle {
  return qualityLevelStyles[level];
}

export function getSeverityLevelStyle(level: SeverityLevel): StatusStyle {
  return severityLevelStyles[level];
}

/**
 * 헬퍼 함수: 쿼리 시간 기반 성능 레벨 계산
 */
export function getQueryTimePerformanceLevel(ms: number): PerformanceLevel {
  if (ms < 10) return 'excellent';
  if (ms < 50) return 'good';
  if (ms < 100) return 'warning';
  return 'critical';
}

export function getMaxTimePerformanceLevel(ms: number): PerformanceLevel {
  if (ms < 100) return 'excellent';
  if (ms < 500) return 'good';
  if (ms < 1000) return 'warning';
  return 'critical';
}

/**
 * 헬퍼 함수: 캐시 히트율 기반 품질 레벨 계산
 */
export function getCacheHitQualityLevel(rate: number): QualityLevel {
  if (rate >= 99) return 'excellent';
  if (rate >= 95) return 'good';
  if (rate >= 90) return 'warning';
  return 'critical';
}

/**
 * 헬퍼 함수: 연결 수 기반 품질 레벨 계산
 */
export function getConnectionQualityLevel(active: number, idle: number): QualityLevel {
  const total = active + idle;
  const activeRatio = active / Math.max(total, 1);

  if (total > 80) return 'critical'; // 연결 풀 포화 임박
  if (total > 50) return 'warning';
  if (activeRatio > 0.8) return 'warning'; // 대부분 활성 = 부하 높음
  return 'good';
}

/**
 * 헬퍼 함수: 테이블 크기 기반 레벨 계산
 */
export function getTableSizeLevel(sizeInMB: number): PerformanceLevel {
  if (sizeInMB < 100) return 'excellent';
  if (sizeInMB < 500) return 'good';
  if (sizeInMB < 1000) return 'warning';
  return 'critical';
}

/**
 * 헬퍼 함수: 장기 실행 쿼리 심각도 계산
 */
export function getLongRunningQuerySeverity(seconds: number): SeverityLevel {
  if (seconds < 30) return 'normal';
  if (seconds < 60) return 'warning';
  return 'critical';
}
