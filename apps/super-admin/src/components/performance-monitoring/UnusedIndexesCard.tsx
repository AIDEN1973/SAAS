/**
 * Unused Indexes Card
 *
 * [불변 규칙] 미사용 인덱스 표시 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { UnusedIndex } from '../../hooks/usePerformanceMetrics';

interface UnusedIndexesCardProps {
  indexes: UnusedIndex[] | undefined;
  isLoading: boolean;
}

export function UnusedIndexesCard({ indexes, isLoading }: UnusedIndexesCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasUnused = indexes && indexes.length > 0;

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
            미사용 인덱스
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            스캔 횟수가 0인 인덱스 - 삭제 고려
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
            backgroundColor: hasUnused ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
            border: `var(--border-width-thin) solid ${hasUnused ? 'var(--color-warning)' : 'var(--color-success)'}`,
          }}
        >
          <span
            style={{
              color: hasUnused ? 'var(--color-warning)' : 'var(--color-success)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {hasUnused ? '▲' : '●'}
          </span>
          <span
            style={{
              color: hasUnused ? 'var(--color-warning)' : 'var(--color-success)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {hasUnused ? `${indexes.length}개 발견` : '최적'}
          </span>
        </div>
      </div>

      {!hasUnused ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-success-bg-subtle)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            미사용 인덱스 없음
          </p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-xs)' }}>
            모든 인덱스가 활용되고 있습니다
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: 'var(--width-full)',
              borderCollapse: 'collapse',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  인덱스
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  테이블
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  크기
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  권장
                </th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: 'var(--border-width-thin) solid var(--color-gray-100)',
                  }}
                >
                  <td
                    style={{
                      padding: 'var(--spacing-sm)',
                      fontFamily: 'var(--font-family-mono)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    {idx.index_name}
                  </td>
                  <td
                    style={{
                      padding: 'var(--spacing-sm)',
                      fontSize: 'var(--font-size-base)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {idx.schema_name}.{idx.table_name}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-warning)',
                    }}
                  >
                    {idx.index_size}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: 'var(--spacing-xxs) var(--spacing-xs)',
                        backgroundColor: 'var(--color-warning-bg)',
                        color: 'var(--color-warning)',
                        borderRadius: 'var(--border-radius-sm)',
                      }}
                    >
                      삭제 검토
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-gray-50)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            ⚠️ 인덱스 삭제 전 해당 인덱스가 정말 사용되지 않는지 확인하세요. 통계 수집 후 충분한 시간이 경과해야 정확한
            판단이 가능합니다.
          </p>
        </div>
      )}
    </Card>
  );
}
