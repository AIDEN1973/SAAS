/**
 * Overall Health Summary
 *
 * [불변 규칙] 종합 시스템 상태 요약 카드
 * [불변 규칙] 비전문가도 이해할 수 있는 단순화된 상태 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { OverallHealth } from '../../hooks/usePerformanceMetrics';
import type { TabType } from '../../types/performance';

interface OverallHealthSummaryProps {
  health: OverallHealth | undefined;
  isLoading: boolean;
  onNavigateToTab?: (tab: TabType) => void;
}

type HealthStatus = 'healthy' | 'warning' | 'critical';

interface StatusStyle {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  emoji: string;
}

function getStatusStyle(status: HealthStatus): StatusStyle {
  const styles: Record<HealthStatus, StatusStyle> = {
    healthy: {
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      label: '정상',
      icon: '●',
      emoji: '',
    },
    warning: {
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      label: '주의',
      icon: '▲',
      emoji: '',
    },
    critical: {
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      label: '문제',
      icon: '■',
      emoji: '',
    },
  };
  return styles[status];
}

const categoryLabels: Record<keyof Omit<OverallHealth, 'overall' | 'issues'>, { label: string; tab: TabType }> = {
  database: { label: '데이터베이스', tab: 'database' },
  cache: { label: '캐시', tab: 'storage' },
  connections: { label: '연결', tab: 'database' },
  security: { label: '보안', tab: 'auth' },
  storage: { label: '스토리지', tab: 'storage' },
  edgeFunctions: { label: 'Edge Functions', tab: 'edge-functions' },
  realtime: { label: 'Realtime', tab: 'realtime' },
};

export function OverallHealthSummary({ health, isLoading, onNavigateToTab }: OverallHealthSummaryProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>시스템 상태 분석 중...</p>
        </div>
      </Card>
    );
  }

  if (!health) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>상태 정보를 불러올 수 없습니다</p>
        </div>
      </Card>
    );
  }

  const overallStyle = getStatusStyle(health.overall);
  const categories = ['database', 'cache', 'connections', 'security', 'storage', 'edgeFunctions', 'realtime'] as const;

  return (
    <Card padding="md" variant="default">
      {/* 전체 상태 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          backgroundColor: overallStyle.bgColor,
          borderRadius: 'var(--border-radius-md)',
          border: `var(--border-width-thin) solid ${overallStyle.color}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <span style={{ fontSize: 'var(--font-size-2xl)' }}>{overallStyle.emoji}</span>
          <div>
            <h3
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              시스템 상태
            </h3>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
              전체 시스템 상태 요약
            </p>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'white',
            borderRadius: 'var(--border-radius-md)',
            border: `2px solid ${overallStyle.color}`,
          }}
        >
          <span style={{ color: overallStyle.color, fontSize: 'var(--font-size-lg)' }}>{overallStyle.icon}</span>
          <span
            style={{
              color: overallStyle.color,
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
            }}
          >
            {overallStyle.label}
          </span>
        </div>
      </div>

      {/* 카테고리별 상태 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(var(--width-metric-card-min), 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: health.issues.length > 0 ? 'var(--spacing-lg)' : 'var(--spacing-none)',
        }}
      >
        {categories.map(category => {
          const status = health[category];
          const style = getStatusStyle(status);
          const info = categoryLabels[category];

          return (
            <div
              key={category}
              onClick={() => onNavigateToTab?.(info.tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-md)',
                backgroundColor: style.bgColor,
                borderRadius: 'var(--border-radius-md)',
                border: `var(--border-width-thin) solid ${style.color}`,
                cursor: onNavigateToTab ? 'pointer' : 'default',
                transition: 'transform 0.1s ease-in-out',
              }}
              onMouseEnter={e => {
                if (onNavigateToTab) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>{info.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <span style={{ color: style.color, fontSize: 'var(--font-size-xs)' }}>{style.icon}</span>
                <span style={{ color: style.color, fontWeight: 'var(--font-weight-medium)' }}>{style.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 이슈 목록 */}
      {health.issues.length > 0 && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <h4
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
              marginBottom: 'var(--spacing-sm)',
              color: 'var(--color-text)',
            }}
          >
            발견된 이슈
          </h4>
          <ul
            style={{
              paddingLeft: 'var(--spacing-lg)',
              margin: 'var(--spacing-none)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-xs)',
            }}
          >
            {health.issues.map((issue, index) => (
              <li
                key={index}
                style={{
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
