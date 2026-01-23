/**
 * Long Running Queries Card
 *
 * [불변 규칙] 장기 실행 쿼리 표시 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { LongRunningQuery } from '../../hooks/usePerformanceMetrics';

interface LongRunningQueriesCardProps {
  queries: LongRunningQuery[] | undefined;
  isLoading: boolean;
}

type SeverityLevel = 'normal' | 'warning' | 'critical';

function getSeverity(seconds: number): SeverityLevel {
  if (seconds < 10) return 'normal';
  if (seconds < 30) return 'warning';
  return 'critical';
}

function getSeverityStyle(level: SeverityLevel) {
  const styles: Record<SeverityLevel, { color: string; bgColor: string; label: string; icon: string }> = {
    normal: {
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      label: '실행 중',
      icon: '●',
    },
    warning: {
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      label: '장시간',
      icon: '▲',
    },
    critical: {
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      label: '매우 느림',
      icon: '■',
    },
  };
  return styles[level];
}

function formatDuration(duration: string): string {
  // PostgreSQL interval을 간단한 형식으로 변환
  const match = duration.match(/(\d+):(\d+):(\d+\.?\d*)/);
  if (!match) return duration;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseFloat(match[3]);

  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${Math.floor(seconds)}초`;
  return `${seconds.toFixed(1)}초`;
}

export function LongRunningQueriesCard({ queries, isLoading }: LongRunningQueriesCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasQueries = queries && queries.length > 0;
  const criticalCount = queries?.filter((q) => getSeverity(q.duration_seconds) === 'critical').length || 0;

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
            장기 실행 쿼리
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            5초 이상 실행 중인 쿼리 ({hasQueries ? queries.length : 0}개)
          </p>
        </div>
        {/* 상태 배지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: criticalCount > 0 ? 'var(--color-error-bg)' : hasQueries ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
            border: `var(--border-width-thin) solid ${criticalCount > 0 ? 'var(--color-error)' : hasQueries ? 'var(--color-warning)' : 'var(--color-success)'}`,
          }}
        >
          <span
            style={{
              color: criticalCount > 0 ? 'var(--color-error)' : hasQueries ? 'var(--color-warning)' : 'var(--color-success)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {criticalCount > 0 ? '■' : hasQueries ? '▲' : '●'}
          </span>
          <span
            style={{
              color: criticalCount > 0 ? 'var(--color-error)' : hasQueries ? 'var(--color-warning)' : 'var(--color-success)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {criticalCount > 0 ? `${criticalCount}개 심각` : hasQueries ? '모니터링 필요' : '정상'}
          </span>
        </div>
      </div>

      {!hasQueries ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-success-bg-subtle)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            장기 실행 쿼리 없음
          </p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-xs)' }}>
            모든 쿼리가 5초 이내에 완료되고 있습니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {queries.map((query) => {
            const severity = getSeverity(query.duration_seconds);
            const style = getSeverityStyle(severity);

            return (
              <div
                key={query.pid}
                style={{
                  padding: 'var(--spacing-md)',
                  backgroundColor: style.bgColor,
                  borderRadius: 'var(--border-radius-md)',
                  border: `var(--border-width-thin) solid ${style.color}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{ color: style.color, fontSize: 'var(--font-size-xs)' }}>{style.icon}</span>
                    <span style={{ fontWeight: 'var(--font-weight-medium)', color: style.color }}>
                      PID {query.pid}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: 'var(--spacing-xxs) var(--spacing-xs)',
                        backgroundColor: 'var(--color-gray-100)',
                        borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {query.state}
                    </span>
                  </div>
                  <span style={{ fontWeight: 'var(--font-weight-bold)', color: style.color }}>
                    {formatDuration(query.duration)}
                  </span>
                </div>
                <div style={{ marginBottom: 'var(--spacing-xs)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {query.user} @ {query.database}
                    {query.wait_event && ` • 대기: ${query.wait_event}`}
                  </span>
                </div>
                <code
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family-mono)',
                    backgroundColor: 'var(--color-gray-100)',
                    padding: 'var(--spacing-xs)',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {query.query}
                </code>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
