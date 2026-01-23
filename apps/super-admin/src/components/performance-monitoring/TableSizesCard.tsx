/**
 * Table Sizes Card
 *
 * [불변 규칙] 테이블 크기 정보 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { TableSize } from '../../hooks/usePerformanceMetrics';

interface TableSizesCardProps {
  tables: TableSize[] | undefined;
  isLoading: boolean;
}

type SizeLevel = 'small' | 'medium' | 'large' | 'huge';

interface SizeIndicator {
  level: SizeLevel;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

function parseSizeToMB(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(bytes?|kB|MB|GB|TB)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'bytes').toLowerCase();

  const multipliers: Record<string, number> = {
    bytes: 1 / (1024 * 1024),
    byte: 1 / (1024 * 1024),
    kb: 1 / 1024,
    mb: 1,
    gb: 1024,
    tb: 1024 * 1024,
  };

  return value * (multipliers[unit] || 0);
}

function getSizeLevel(sizeStr: string): SizeLevel {
  const mb = parseSizeToMB(sizeStr);
  if (mb < 10) return 'small';
  if (mb < 100) return 'medium';
  if (mb < 1000) return 'large';
  return 'huge';
}

function getSizeIndicator(level: SizeLevel): SizeIndicator {
  const indicators: Record<SizeLevel, SizeIndicator> = {
    small: {
      level: 'small',
      label: '소형',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      description: '<10MB - 최적',
    },
    medium: {
      level: 'medium',
      label: '중형',
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      description: '10-100MB - 정상',
    },
    large: {
      level: 'large',
      label: '대형',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      description: '100MB-1GB - 주시 필요',
    },
    huge: {
      level: 'huge',
      label: '초대형',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      description: '>1GB - 파티셔닝 고려',
    },
  };
  return indicators[level];
}

export function TableSizesCard({ tables, isLoading }: TableSizesCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

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
        테이블 크기
      </h3>

      {!tables || tables.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          데이터가 없습니다
        </p>
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
                  총 크기
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  테이블 크기
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  인덱스 크기
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  예상 행 수
                </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table, index) => (
                <tr
                  key={index}
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
                    {table.table_name}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    {(() => {
                      const indicator = getSizeIndicator(getSizeLevel(table.total_size));
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            padding: 'var(--spacing-xxs) var(--spacing-sm)',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: indicator.bgColor,
                          }}
                          title={indicator.description}
                        >
                          <span
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              color: indicator.color,
                              fontWeight: 'var(--font-weight-medium)',
                            }}
                          >
                            {indicator.label}
                          </span>
                          <span
                            style={{
                              fontWeight: 'var(--font-weight-medium)',
                              color: indicator.color,
                            }}
                          >
                            {table.total_size}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    {table.table_size}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    {table.index_size}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                    }}
                  >
                    {table.row_estimate?.toLocaleString() || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
