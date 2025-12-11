/**
 * 출결 알림 페이지
 *
 * 자녀의 출결 알림을 조회할 수 있습니다.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBoundary, Container, Card } from '@ui-core/react';
import { useChildren } from '@hooks/use-parent';
import { useAttendanceNotifications } from '@hooks/use-attendance';

export function AttendanceNotificationsPage() {
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('child_id');
  const { data: children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childId || (children && children.length > 0 ? children[0].id : null));
  const { data: notificationsData, isLoading } = useAttendanceNotifications(selectedChildId || undefined);
  const notifications = notificationsData || [];

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-lg)',
            color: 'var(--color-text)'
          }}>
            출결 알림
          </h1>

          {children && children.length > 1 && (
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', borderBottom: '2px solid var(--color-gray-200)' }}>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    style={{
                      padding: 'var(--spacing-md) var(--spacing-lg)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: selectedChildId === child.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      borderBottom: selectedChildId === child.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: selectedChildId === child.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                로딩 중...
              </div>
            </Card>
          )}

          {notifications && notifications.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {notifications.map((notification) => (
                <Card key={notification.id} padding="md" variant="elevated">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-semibold)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {notification.title}
                      </h3>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {notification.message}
                      </p>
                      <p style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)'
                      }}>
                        {new Date(notification.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {notifications && notifications.length === 0 && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>출결 알림이 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

