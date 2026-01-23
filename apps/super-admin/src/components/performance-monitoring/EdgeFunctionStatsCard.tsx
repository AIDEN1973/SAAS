/**
 * Edge Function Stats Card
 *
 * [불변 규칙] Edge Function 성능 모니터링 카드
 * [불변 규칙] 비전문가도 이해할 수 있는 상태 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { EdgeFunctionStats } from '../../hooks/usePerformanceMetrics';

interface EdgeFunctionStatsCardProps {
  stats: EdgeFunctionStats[] | undefined;
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

function getOverallStatus(stats: EdgeFunctionStats[]): StatusLevel {
  const criticalFunctions = stats.filter(s => s.error_rate > 30);
  const warningFunctions = stats.filter(s => s.error_rate > 10);

  if (criticalFunctions.length > 0) return 'critical';
  if (warningFunctions.length > 0) return 'warning';
  return 'healthy';
}

function getFunctionStatus(stat: EdgeFunctionStats): StatusLevel {
  if (stat.error_rate > 30) return 'critical';
  if (stat.error_rate > 10 || stat.avg_execution_time > 5000) return 'warning';
  return 'healthy';
}

function formatExecutionTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return date.toLocaleDateString('ko-KR');
}

export function EdgeFunctionStatsCard({ stats, isLoading }: EdgeFunctionStatsCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasStats = stats && stats.length > 0;
  const overallStatus = hasStats ? getOverallStatus(stats) : 'healthy';
  const overallStyle = getStatusStyle(overallStatus);

  // 통계 요약
  const totalCalls = hasStats ? stats.reduce((sum, s) => sum + Number(s.total_calls), 0) : 0;
  const totalErrors = hasStats ? stats.reduce((sum, s) => sum + Number(s.error_count), 0) : 0;
  const avgErrorRate = hasStats && totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;

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
            Edge Function
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            최근 24시간 ({hasStats ? stats.length : 0}개 함수)
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
            Edge Function 로그 없음
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            최근 24시간 동안 Edge Function 호출 기록이 없습니다
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
              <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                {totalCalls.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>총 호출</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: totalErrors > 0 ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                {totalErrors.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>에러</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: avgErrorRate > 10 ? 'var(--color-error)' : avgErrorRate > 5 ? 'var(--color-warning)' : 'var(--color-success)',
                }}
              >
                {avgErrorRate.toFixed(1)}%
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>에러율</p>
            </div>
          </div>

          {/* 함수별 상세 */}
          <div>
            <h4
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--spacing-sm)',
                color: 'var(--color-text)',
              }}
            >
              함수별 상태
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {stats.slice(0, 10).map(stat => {
                const status = getFunctionStatus(stat);
                const style = getStatusStyle(status);

                return (
                  <div
                    key={stat.function_name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--spacing-sm)',
                      backgroundColor: status !== 'healthy' ? style.bgColor : 'var(--color-gray-50)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: status !== 'healthy' ? `var(--border-width-thin) solid ${style.color}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1 }}>
                      <span style={{ color: style.color, fontSize: 'var(--font-size-xs)' }}>{style.icon}</span>
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
                        {stat.function_name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {Number(stat.total_calls).toLocaleString()}회
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: stat.error_rate > 10 ? 'var(--color-error)' : 'var(--color-text-secondary)',
                          fontWeight: stat.error_rate > 10 ? 'var(--font-weight-bold)' : 'var(--font-weight-normal)',
                        }}
                      >
                        {Number(stat.error_rate).toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {formatExecutionTime(Number(stat.avg_execution_time))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 최근 에러 */}
          {stats.some(s => s.last_error) && (
            <div>
              <h4
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)',
                }}
              >
                최근 에러
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {stats
                  .filter(s => s.last_error)
                  .slice(0, 5)
                  .map(stat => (
                    <div
                      key={stat.function_name + '-error'}
                      style={{
                        padding: 'var(--spacing-sm)',
                        backgroundColor: 'var(--color-error-bg)',
                        borderRadius: 'var(--border-radius-sm)',
                        border: 'var(--border-width-thin) solid var(--color-error)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-family-mono)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-error)',
                            fontWeight: 'var(--font-weight-medium)',
                          }}
                        >
                          {stat.function_name}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {formatTimeAgo(stat.last_error_time)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stat.last_error}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
