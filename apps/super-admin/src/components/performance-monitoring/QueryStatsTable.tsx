/**
 * Query Stats Table
 *
 * [불변 규칙] 쿼리 통계 테이블
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { useState } from 'react';
import { Card, Button } from '@ui-core/react';
import type { QueryStats } from '../../hooks/usePerformanceMetrics';

interface QueryStatsTableProps {
  title: string;
  description?: string;
  queries: QueryStats[] | undefined;
  isLoading: boolean;
}

type PerformanceLevel = 'excellent' | 'good' | 'warning' | 'critical';

interface PerformanceIndicator {
  level: PerformanceLevel;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

function getPerformanceIndicator(level: PerformanceLevel): PerformanceIndicator {
  const indicators: Record<PerformanceLevel, PerformanceIndicator> = {
    excellent: {
      level: 'excellent',
      label: '빠름',
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
      icon: '●',
    },
    good: {
      level: 'good',
      label: '양호',
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
      icon: '●',
    },
    warning: {
      level: 'warning',
      label: '느림',
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
      icon: '▲',
    },
    critical: {
      level: 'critical',
      label: '심각',
      color: 'var(--color-error)',
      bgColor: 'var(--color-error-bg)',
      icon: '■',
    },
  };
  return indicators[level];
}

function getMeanTimeLevel(ms: number): PerformanceLevel {
  if (ms < 10) return 'excellent';
  if (ms < 50) return 'good';
  if (ms < 100) return 'warning';
  return 'critical';
}

function getMaxTimeLevel(ms: number): PerformanceLevel {
  if (ms < 100) return 'excellent';
  if (ms < 500) return 'good';
  if (ms < 1000) return 'warning';
  return 'critical';
}

function formatTime(ms: number): string {
  if (ms >= 1000 * 60) {
    return `${(ms / 1000 / 60).toFixed(2)}m`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(2)}ms`;
}

function truncateQuery(query: string, maxLength = 100): string {
  if (query.length <= maxLength) return query;
  return query.slice(0, maxLength) + '...';
}

export function QueryStatsTable({ title, description, queries, isLoading }: QueryStatsTableProps) {
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

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
          marginBottom: 'var(--spacing-xs)',
          color: 'var(--color-text)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          {description}
        </p>
      )}

      {!queries || queries.length === 0 ? (
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
                  쿼리
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  호출 수
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  총 시간
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  평균 시간
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  최대 시간
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--spacing-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  비율
                </th>
              </tr>
            </thead>
            <tbody>
              {queries.map((query, index) => (
                <tr
                  key={index}
                  style={{
                    borderBottom: 'var(--border-width-thin) solid var(--color-gray-100)',
                  }}
                >
                  <td
                    style={{
                      padding: 'var(--spacing-sm)',
                      maxWidth: 'var(--width-query-cell-max)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                      <code
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontFamily: 'var(--font-family-mono)',
                          backgroundColor: 'var(--color-gray-50)',
                          padding: 'var(--spacing-xs)',
                          borderRadius: 'var(--border-radius-sm)',
                          display: 'block',
                          whiteSpace: expandedQuery === index ? 'pre-wrap' : 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {expandedQuery === index ? query.query : truncateQuery(query.query)}
                      </code>
                      {query.query.length > 100 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedQuery(expandedQuery === index ? null : index)}
                          style={{ alignSelf: 'flex-start', padding: 'var(--spacing-none)', height: 'auto' }}
                        >
                          {expandedQuery === index ? '접기' : '펼치기'}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {query.calls.toLocaleString()}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatTime(query.total_time)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(() => {
                      const indicator = getPerformanceIndicator(getMeanTimeLevel(query.mean_time));
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            padding: 'var(--spacing-xxs) var(--spacing-xs)',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: indicator.bgColor,
                          }}
                          title={`평균 시간: ${indicator.label} (<10ms 빠름 | <50ms 양호 | <100ms 느림 | ≥100ms 심각)`}
                        >
                          <span style={{ color: indicator.color, fontSize: 'var(--font-size-xs)' }}>
                            {indicator.icon}
                          </span>
                          <span style={{ color: indicator.color, fontWeight: 'var(--font-weight-medium)' }}>
                            {formatTime(query.mean_time)}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(() => {
                      const indicator = getPerformanceIndicator(getMaxTimeLevel(query.max_time));
                      return (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            padding: 'var(--spacing-xxs) var(--spacing-xs)',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: indicator.bgColor,
                          }}
                          title={`최대 시간: ${indicator.label} (<100ms 빠름 | <500ms 양호 | <1s 느림 | ≥1s 심각)`}
                        >
                          <span style={{ color: indicator.color, fontSize: 'var(--font-size-xs)' }}>
                            {indicator.icon}
                          </span>
                          <span style={{ color: indicator.color, fontWeight: 'var(--font-weight-medium)' }}>
                            {formatTime(query.max_time)}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: 'var(--spacing-sm)',
                      whiteSpace: 'nowrap',
                      fontWeight: 'var(--font-weight-medium)',
                    }}
                  >
                    {query.prop_total_time}
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
