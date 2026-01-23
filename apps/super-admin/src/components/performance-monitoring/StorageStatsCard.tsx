/**
 * Storage Stats Card
 *
 * [불변 규칙] Storage 사용량 모니터링 카드
 * [불변 규칙] 비전문가도 이해할 수 있는 상태 표시
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { StorageStats } from '../../hooks/usePerformanceMetrics';

interface StorageStatsCardProps {
  stats: StorageStats | null | undefined;
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
      label: '용량 부족',
      icon: '■',
    },
  };
  return styles[level];
}

function getOverallStatus(stats: StorageStats): StatusLevel {
  if (stats.usage_percentage > 90) return 'critical';
  if (stats.usage_percentage > 70) return 'warning';
  return 'healthy';
}

function getUsageBarColor(percentage: number): string {
  if (percentage > 90) return 'var(--color-error)';
  if (percentage > 70) return 'var(--color-warning)';
  return 'var(--color-success)';
}

export function StorageStatsCard({ stats, isLoading }: StorageStatsCardProps) {
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
            파일 스토리지
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Supabase Storage 사용량
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
            스토리지 정보 없음
          </p>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              marginTop: 'var(--spacing-xs)',
            }}
          >
            스토리지 사용량 정보를 수집 중이거나 버킷이 없습니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {/* 전체 사용량 바 */}
          <div
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--border-radius-md)',
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
              <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>전체 사용량</span>
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: getUsageBarColor(stats.usage_percentage),
                }}
              >
                {stats.usage_percentage.toFixed(1)}%
              </span>
            </div>
            {/* 프로그레스 바 */}
            <div
              style={{
                height: 'var(--spacing-md)',
                backgroundColor: 'var(--color-gray-200)',
                borderRadius: 'var(--border-radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(stats.usage_percentage, 100)}%`,
                  backgroundColor: getUsageBarColor(stats.usage_percentage),
                  borderRadius: 'var(--border-radius-sm)',
                  transition: 'width var(--transition-smooth)',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>{stats.total_usage_formatted} 사용 중</span>
              <span>
                {(stats.limit_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB 제한
              </span>
            </div>
          </div>

          {/* 요약 통계 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--spacing-md)',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                }}
              >
                {stats.total_usage_formatted}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>총 사용량</p>
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                }}
              >
                {stats.total_files.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>총 파일 수</p>
            </div>
          </div>

          {/* 버킷별 사용량 */}
          {stats.buckets && stats.buckets.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)',
                }}
              >
                버킷별 사용량
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {stats.buckets.map(bucket => {
                  const bucketPercentage = stats.total_usage_bytes > 0
                    ? (bucket.total_size_bytes / stats.total_usage_bytes) * 100
                    : 0;

                  return (
                    <div
                      key={bucket.bucket_name}
                      style={{
                        padding: 'var(--spacing-sm)',
                        backgroundColor: 'var(--color-gray-50)',
                        borderRadius: 'var(--border-radius-sm)',
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
                            color: 'var(--color-text)',
                          }}
                        >
                          {bucket.bucket_name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {bucket.file_count.toLocaleString()}개
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 'var(--font-weight-medium)',
                              color: 'var(--color-text)',
                            }}
                          >
                            {bucket.total_size_formatted}
                          </span>
                        </div>
                      </div>
                      {/* 미니 프로그레스 바 */}
                      <div
                        style={{
                          height: 'var(--spacing-xs)',
                          backgroundColor: 'var(--color-gray-200)',
                          borderRadius: 'var(--border-radius-sm)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${bucketPercentage}%`,
                            backgroundColor: 'var(--color-info)',
                            borderRadius: 'var(--border-radius-sm)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 용량 경고 */}
          {stats.usage_percentage > 70 && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor:
                  stats.usage_percentage > 90 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)',
                borderRadius: 'var(--border-radius-md)',
                border: `var(--border-width-thin) solid ${
                  stats.usage_percentage > 90 ? 'var(--color-error)' : 'var(--color-warning)'
                }`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    color: stats.usage_percentage > 90 ? 'var(--color-error)' : 'var(--color-warning)',
                  }}
                >
                  {stats.usage_percentage > 90 ? '■' : '▲'}
                </span>
                <span
                  style={{
                    fontWeight: 'var(--font-weight-bold)',
                    color: stats.usage_percentage > 90 ? 'var(--color-error)' : 'var(--color-warning)',
                  }}
                >
                  {stats.usage_percentage > 90 ? '스토리지 용량 거의 가득 참' : '스토리지 용량 주의'}
                </span>
              </div>
              <p
                style={{
                  marginTop: 'var(--spacing-sm)',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text)',
                }}
              >
                {stats.usage_percentage > 90
                  ? '스토리지 용량이 90%를 초과했습니다. 즉시 불필요한 파일을 삭제하거나 플랜 업그레이드를 검토하세요.'
                  : '스토리지 용량이 70%를 초과했습니다. 용량 관리에 주의가 필요합니다.'}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
