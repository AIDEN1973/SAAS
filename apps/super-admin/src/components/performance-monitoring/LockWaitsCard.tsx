/**
 * Lock Waits Card
 *
 * [불변 규칙] 락 대기 상황 표시 카드
 * [불변 규칙] 모든 스타일은 design-system 토큰 사용
 */

import { Card } from '@ui-core/react';
import type { LockWait } from '../../hooks/usePerformanceMetrics';

interface LockWaitsCardProps {
  lockWaits: LockWait[] | undefined;
  isLoading: boolean;
}

export function LockWaitsCard({ lockWaits, isLoading }: LockWaitsCardProps) {
  if (isLoading) {
    return (
      <Card padding="md" variant="default">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>로딩 중...</p>
        </div>
      </Card>
    );
  }

  const hasLocks = lockWaits && lockWaits.length > 0;

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
            락 대기 현황
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--color-text-secondary)',
            }}
          >
            현재 다른 쿼리에 의해 대기 중인 작업
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
            backgroundColor: hasLocks ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
            border: `var(--border-width-thin) solid ${hasLocks ? 'var(--color-error)' : 'var(--color-success)'}`,
          }}
        >
          <span
            style={{
              color: hasLocks ? 'var(--color-error)' : 'var(--color-success)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            {hasLocks ? '■' : '●'}
          </span>
          <span
            style={{
              color: hasLocks ? 'var(--color-error)' : 'var(--color-success)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {hasLocks ? `${lockWaits.length}개 대기` : '정상'}
          </span>
        </div>
      </div>

      {!hasLocks ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-success-bg-subtle)',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>
            현재 락 대기 없음
          </p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-xs)' }}>
            모든 쿼리가 정상적으로 실행 중입니다
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {lockWaits.map((lock, index) => (
            <div
              key={index}
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-error-bg-subtle)',
                borderRadius: 'var(--border-radius-md)',
                border: 'var(--border-width-thin) solid var(--color-error)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-error)' }}>
                  PID {lock.blocked_pid} 대기 중
                </span>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
                  {lock.blocked_duration}
                </span>
              </div>
              <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>대기 중인 쿼리:</p>
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
                  {lock.blocked_query}
                </code>
              </div>
              <div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  차단 중인 쿼리 (PID {lock.blocking_pid}, {lock.blocking_user}):
                </p>
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
                  {lock.blocking_query}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
