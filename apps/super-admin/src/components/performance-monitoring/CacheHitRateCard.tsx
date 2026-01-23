/**
 * Cache Hit Rate Card
 *
 * [불변 규칙] 캐시 히트율 표시 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { CacheHitRate } from '../../hooks/usePerformanceMetrics';

interface CacheHitRateCardProps {
  cacheRates: CacheHitRate[] | undefined;
  isLoading: boolean;
}

function getStatusColor(ratio: number): string {
  if (ratio >= 99) return 'var(--color-success)';
  if (ratio >= 95) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function getStatusLabel(ratio: number): string {
  if (ratio >= 99) return '우수';
  if (ratio >= 95) return '주의';
  return '개선 필요';
}

export function CacheHitRateCard({ cacheRates, isLoading }: CacheHitRateCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const tableRate = cacheRates?.find((r) => r.name === 'table hit rate');
  const indexRate = cacheRates?.find((r) => r.name === 'index hit rate');

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
        캐시 히트율
      </h3>
      <p
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        99% 이상이면 최적, 95% 미만이면 컴퓨트 업그레이드 고려
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* 테이블 히트율 */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
              테이블 캐시
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: getStatusColor(tableRate?.ratio || 0),
              }}
            >
              {(tableRate?.ratio || 0).toFixed(2)}% ({getStatusLabel(tableRate?.ratio || 0)})
            </span>
          </div>
          <div
            style={{
              height: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-gray-200)',
              borderRadius: 'var(--border-radius-sm)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(tableRate?.ratio || 0, 100)}%`,
                backgroundColor: getStatusColor(tableRate?.ratio || 0),
                transition: 'width var(--transition-base)',
              }}
            />
          </div>
        </div>

        {/* 인덱스 히트율 */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)' }}>
              인덱스 캐시
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: getStatusColor(indexRate?.ratio || 0),
              }}
            >
              {(indexRate?.ratio || 0).toFixed(2)}% ({getStatusLabel(indexRate?.ratio || 0)})
            </span>
          </div>
          <div
            style={{
              height: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-gray-200)',
              borderRadius: 'var(--border-radius-sm)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(indexRate?.ratio || 0, 100)}%`,
                backgroundColor: getStatusColor(indexRate?.ratio || 0),
                transition: 'width var(--transition-base)',
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
