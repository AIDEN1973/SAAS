/**
 * Connection Stats Card
 *
 * [불변 규칙] 연결 통계 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { ConnectionStats } from '../../hooks/usePerformanceMetrics';

interface ConnectionStatsCardProps {
  connections: ConnectionStats[] | undefined;
  isLoading: boolean;
}

type ConnectionLevel = 'healthy' | 'moderate' | 'high' | 'critical';

interface ConnectionIndicator {
  level: ConnectionLevel;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}

function getConnectionIndicator(level: ConnectionLevel): ConnectionIndicator {
  const indicators: Record<ConnectionLevel, ConnectionIndicator> = {
    healthy: {
      level: 'healthy',
      label: '정상',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      icon: '●',
      description: '연결 풀 상태 양호',
    },
    moderate: {
      level: 'moderate',
      label: '보통',
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      icon: '●',
      description: '연결 사용량 적정',
    },
    high: {
      level: 'high',
      label: '높음',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      icon: '▲',
      description: '연결 풀 50% 이상 사용 - 모니터링 필요',
    },
    critical: {
      level: 'critical',
      label: '포화',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      icon: '■',
      description: '연결 풀 80% 이상 - 즉시 대응 필요',
    },
  };
  return indicators[level];
}

function getTotalConnectionLevel(total: number): ConnectionLevel {
  // Supabase 기본 max_connections 기준 (보통 60-100)
  if (total < 20) return 'healthy';
  if (total < 50) return 'moderate';
  if (total < 80) return 'high';
  return 'critical';
}

function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    active: '활성',
    idle: '유휴',
    'idle in transaction': '트랜잭션 대기',
    'idle in transaction (aborted)': '트랜잭션 중단',
    'fastpath function call': '함수 호출',
    disabled: '비활성',
    unknown: '알 수 없음',
  };
  return labels[state] || state;
}

function getStateColor(state: string): string {
  const colors: Record<string, string> = {
    active: 'var(--color-success)',
    idle: 'var(--color-gray-400)',
    'idle in transaction': 'var(--color-warning)',
    'idle in transaction (aborted)': 'var(--color-error)',
    'fastpath function call': 'var(--color-info)',
    disabled: 'var(--color-gray-300)',
    unknown: 'var(--color-gray-400)',
  };
  return colors[state] || 'var(--color-gray-400)';
}

export function ConnectionStatsCard({ connections, isLoading }: ConnectionStatsCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const totalConnections = connections?.reduce((sum, c) => sum + c.count, 0) || 0;
  const connectionIndicator = getConnectionIndicator(getTotalConnectionLevel(totalConnections));

  return (
    <Card padding="md" variant="default">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-semibold)',
              marginBottom: 'var(--spacing-xs)',
              color: 'var(--color-text)',
            }}
          >
            연결 상태
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            총 {totalConnections}개 연결
          </p>
        </div>
        {/* 연결 상태 배지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: connectionIndicator.bgColor,
            border: `var(--border-width-thin) solid ${connectionIndicator.color}`,
          }}
          title={connectionIndicator.description}
        >
          <span style={{ color: connectionIndicator.color, fontSize: 'var(--font-size-xs)' }}>
            {connectionIndicator.icon}
          </span>
          <span
            style={{
              color: connectionIndicator.color,
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {connectionIndicator.label}
          </span>
        </div>
      </div>

      {!connections || connections.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          데이터가 없습니다
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {connections.map((conn) => (
            <div
              key={conn.state}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <div
                  style={{
                    width: 'var(--spacing-sm)',
                    height: 'var(--spacing-sm)',
                    borderRadius: 'var(--border-radius-full)',
                    backgroundColor: getStateColor(conn.state),
                  }}
                />
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
                  {getStateLabel(conn.state)}
                </span>
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: getStateColor(conn.state),
                }}
              >
                {conn.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
