/**
 * System Health Card
 *
 * [불변 규칙] 시스템 상태 요약 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { SystemHealth } from '../../hooks/usePerformanceMetrics';

interface SystemHealthCardProps {
  health: SystemHealth | undefined;
  isLoading: boolean;
}

type QualityLevel = 'excellent' | 'good' | 'warning' | 'critical';

interface QualityIndicator {
  level: QualityLevel;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

function getQualityIndicator(level: QualityLevel): QualityIndicator {
  const indicators: Record<QualityLevel, QualityIndicator> = {
    excellent: {
      level: 'excellent',
      label: '우수',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      icon: '●',
    },
    good: {
      level: 'good',
      label: '양호',
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      icon: '●',
    },
    warning: {
      level: 'warning',
      label: '주의',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      icon: '▲',
    },
    critical: {
      level: 'critical',
      label: '문제',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      icon: '■',
    },
  };
  return indicators[level];
}

function getQueryTimeQuality(ms: number): QualityLevel {
  if (ms < 10) return 'excellent';
  if (ms < 50) return 'good';
  if (ms < 100) return 'warning';
  return 'critical';
}

function getCacheHitQuality(rate: number): QualityLevel {
  if (rate >= 99) return 'excellent';
  if (rate >= 95) return 'good';
  if (rate >= 90) return 'warning';
  return 'critical';
}

function getConnectionQuality(active: number, idle: number): QualityLevel {
  const total = active + idle;
  const activeRatio = active / Math.max(total, 1);

  if (total > 80) return 'critical'; // 연결 풀 포화 임박
  if (total > 50) return 'warning';
  if (activeRatio > 0.8) return 'warning'; // 대부분 활성 = 부하 높음
  return 'good';
}

export function SystemHealthCard({ health, isLoading }: SystemHealthCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const queryTimeQuality = getQualityIndicator(getQueryTimeQuality(health?.avgQueryTime || 0));
  const cacheQuality = getQualityIndicator(getCacheHitQuality(health?.cacheHitRate || 0));
  const connectionQuality = getQualityIndicator(
    getConnectionQuality(health?.activeConnections || 0, health?.idleConnections || 0)
  );

  const metrics = [
    {
      label: '총 쿼리 수',
      value: health?.totalQueries.toLocaleString() || '0',
      color: 'var(--color-primary)',
      quality: null,
      description: '수집된 전체 쿼리 수',
    },
    {
      label: '평균 쿼리 시간',
      value: `${(health?.avgQueryTime || 0).toFixed(2)}ms`,
      color: queryTimeQuality.color,
      quality: queryTimeQuality,
      description: '<10ms 우수 | <50ms 양호 | <100ms 주의 | ≥100ms 문제',
    },
    {
      label: '캐시 히트율',
      value: `${(health?.cacheHitRate || 0).toFixed(1)}%`,
      color: cacheQuality.color,
      quality: cacheQuality,
      description: '≥99% 우수 | ≥95% 양호 | ≥90% 주의 | <90% 문제',
    },
    {
      label: '활성 연결',
      value: health?.activeConnections.toString() || '0',
      color: connectionQuality.color,
      quality: connectionQuality,
      description: '현재 쿼리 실행 중인 연결',
    },
    {
      label: '유휴 연결',
      value: health?.idleConnections.toString() || '0',
      color: 'var(--color-text-secondary)',
      quality: null,
      description: '대기 중인 연결 (풀링)',
    },
  ];

  return (
    <Card padding="md" variant="default">
      <h3
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          marginBottom: 'var(--spacing-md)',
          color: 'var(--color-text)',
        }}
      >
        시스템 상태
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(9.375rem, 1fr))', /* 150px */
          gap: 'var(--spacing-md)',
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-md)',
              backgroundColor: metric.quality ? metric.quality.bgColor : 'var(--color-gray-50)',
              borderRadius: 'var(--border-radius-md)',
              border: metric.quality
                ? `var(--border-width-thin) solid ${metric.quality.color}`
                : 'none',
              position: 'relative',
            }}
            title={metric.description}
          >
            {/* 품질 배지 */}
            {metric.quality && (
              <div
                style={{
                  position: 'absolute',
                  top: 'var(--spacing-xs)',
                  right: 'var(--spacing-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-xs)',
                  color: metric.quality.color,
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                <span>{metric.quality.icon}</span>
                <span>{metric.quality.label}</span>
              </div>
            )}
            <div
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 'var(--font-weight-bold)',
                color: metric.color,
                marginTop: metric.quality ? 'var(--spacing-sm)' : 'var(--spacing-none)',
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text-secondary)',
                marginTop: 'var(--spacing-xs)',
              }}
            >
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
