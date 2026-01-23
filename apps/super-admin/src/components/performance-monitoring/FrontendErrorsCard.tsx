/**
 * Frontend Errors Card
 *
 * [불변 규칙] 프론트엔드 에러 모니터링 카드
 * [불변 규칙] Sentry 에러 트래킹 데이터 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';

interface FrontendError {
  id: string;
  message: string;
  component: string;
  operation: string;
  count: number;
  lastSeen: string;
  level: 'error' | 'warning' | 'info';
}

interface FrontendErrorsCardProps {
  errors: FrontendError[] | undefined;
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

function getOverallStatus(errors: FrontendError[]): StatusLevel {
  const criticalErrors = errors.filter(e => e.level === 'error' && e.count > 10);
  const warningErrors = errors.filter(e => e.level === 'error' && e.count > 5);

  if (criticalErrors.length > 0) return 'critical';
  if (warningErrors.length > 0) return 'warning';
  return 'healthy';
}

function getErrorLevelColor(level: 'error' | 'warning' | 'info'): string {
  if (level === 'error') return 'var(--color-error)';
  if (level === 'warning') return 'var(--color-warning)';
  return 'var(--color-info)';
}

function formatTimeAgo(dateStr: string): string {
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

export function FrontendErrorsCard({ errors, isLoading }: FrontendErrorsCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasErrors = errors && errors.length > 0;
  const overallStatus = hasErrors ? getOverallStatus(errors) : 'healthy';
  const overallStyle = getStatusStyle(overallStatus);

  // 통계 요약
  const totalErrors = hasErrors ? errors.reduce((sum, e) => sum + e.count, 0) : 0;
  const criticalCount = hasErrors ? errors.filter(e => e.level === 'error').length : 0;
  const warningCount = hasErrors ? errors.filter(e => e.level === 'warning').length : 0;

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
            프론트엔드 에러
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Sentry 에러 트래킹 (최근 24시간)
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

      {!hasErrors ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-success-bg)',
            borderRadius: 'var(--border-radius-md)',
            border: 'var(--border-width-thin) solid var(--color-success)',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            ✅ 에러 없음
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            최근 24시간 동안 프론트엔드 에러가 발생하지 않았습니다
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-xs)',
              marginTop: 'var(--spacing-sm)',
            }}
          >
            💡 Sentry DSN이 설정되지 않았거나, 실제로 에러가 없는 상태입니다
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
                {totalErrors.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>총 에러</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: criticalCount > 0 ? 'var(--color-error)' : 'var(--color-success)',
                }}
              >
                {criticalCount.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>심각</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: warningCount > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                }}
              >
                {warningCount.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>경고</p>
            </div>
          </div>

          {/* 에러 목록 */}
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
              {errors.slice(0, 10).map(error => (
                <div
                  key={error.id}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: error.level === 'error' ? 'var(--color-error-bg)' : 'var(--color-gray-50)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: error.level === 'error'
                      ? 'var(--border-width-thin) solid var(--color-error)'
                      : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 'var(--font-weight-medium)',
                            color: getErrorLevelColor(error.level),
                            textTransform: 'uppercase',
                          }}
                        >
                          {error.level}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-family-mono)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {error.component}:{error.operation}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: 'var(--font-size-base)',
                          color: 'var(--color-text)',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        {error.message}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginLeft: 'var(--spacing-md)' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                          {error.count}
                        </p>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>회</p>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatTimeAgo(error.lastSeen)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentry 링크 */}
          <div
            style={{
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-info-bg)',
              borderRadius: 'var(--border-radius-sm)',
              border: 'var(--border-width-thin) solid var(--color-info)',
            }}
          >
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              💡 자세한 정보는 Sentry 대시보드에서 확인하세요
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
