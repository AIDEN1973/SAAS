/**
 * Realtime Stats Card
 *
 * [불변 규칙] Realtime 연결 모니터링 카드
 * [불변 규칙] 비전문가도 이해할 수 있는 상태 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { RealtimeStats } from '../../hooks/usePerformanceMetrics';

interface RealtimeStatsCardProps {
  stats: RealtimeStats | null | undefined;
  isLoading: boolean;
}

type StatusLevel = 'healthy' | 'warning' | 'critical';

interface StatusStyle {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
}

function getStatusStyle(level: StatusLevel): StatusStyle {
  const styles: Record<StatusLevel, StatusStyle> = {
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
  return styles[level];
}

function getOverallStatus(stats: RealtimeStats): StatusLevel {
  if (stats.error_count_24h > 100) return 'critical';
  if (stats.error_count_24h > 20) return 'warning';
  return 'healthy';
}

export function RealtimeStatsCard({ stats, isLoading }: RealtimeStatsCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasStats = stats !== null && stats !== undefined;
  const overallStatus = hasStats ? getOverallStatus(stats) : 'healthy';
  const overallStyle = getStatusStyle(overallStatus);

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
            Realtime
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            실시간 연결 상태
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
            backgroundColor: overallStyle.bgColor,
            border: `var(--border-width-thin) solid ${overallStyle.color}`,
          }}
        >
          <span style={{ color: overallStyle.color, fontSize: 'var(--font-size-xs)' }}>{overallStyle.icon}</span>
          <span
            style={{
              color: overallStyle.color,
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {overallStyle.label}
          </span>
        </div>
      </div>

      {!hasStats ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-gray-50)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
            Realtime 로그 없음
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            Realtime 기능이 사용되지 않았거나 로그가 수집되지 않았습니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* 요약 통계 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--border-radius-md)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-info)',
                }}
              >
                {stats.active_connections.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>활성 연결</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                }}
              >
                {stats.total_messages_24h.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>24시간 메시지</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: stats.error_count_24h > 20 ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                {stats.error_count_24h.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>24시간 에러</p>
            </div>
          </div>

          {/* 채널별 통계 */}
          {stats.channels && stats.channels.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)',
                }}
              >
                채널별 활동
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {stats.channels.map(channel => (
                  <div
                    key={channel.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--spacing-sm)',
                      backgroundColor: 'var(--color-gray-50)',
                      borderRadius: 'var(--border-radius-sm)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-family-mono)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '200px',
                      }}
                    >
                      {channel.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        구독: {channel.subscribers}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-info)' }}>
                        메시지: {channel.messages}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 에러 경고 */}
          {stats.error_count_24h > 0 && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor:
                  stats.error_count_24h > 100 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                borderRadius: 'var(--border-radius-md)',
                border: `var(--border-width-thin) solid ${
                  stats.error_count_24h > 100 ? 'var(--color-error)' : 'var(--color-warning)'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    color: stats.error_count_24h > 100 ? 'var(--color-error)' : 'var(--color-warning)',
                  }}
                >
                  {stats.error_count_24h > 100 ? '■' : '▲'}
                </span>
                <span
                  style={{
                    fontWeight: 'var(--font-weight-bold)',
                    color: stats.error_count_24h > 100 ? 'var(--color-error)' : 'var(--color-warning)',
                  }}
                >
                  {stats.error_count_24h > 100 ? '에러 빈도 높음' : '에러 발생 중'}
                </span>
              </div>
              <p
                style={{
                  marginTop: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text)',
                }}
              >
                최근 24시간 동안 {stats.error_count_24h}건의 Realtime 에러가 발생했습니다.
                {stats.error_count_24h > 100
                  ? ' 네트워크 문제 또는 서버 과부하가 의심됩니다.'
                  : ' 일시적인 연결 문제일 수 있습니다.'}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
