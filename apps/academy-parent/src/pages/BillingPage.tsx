/**
 * 결제 내역 페이지
 *
 * 자녀별 결제 내역을 조회하고 결제할 수 있습니다.
 * 아키텍처 문서 2.7 섹션 참조
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button } from '@ui-core/react';
import { useChildren } from '@hooks/use-parent';
import { useBillingHistory } from '@hooks/use-billing';

export function BillingPage() {
  const [searchParams] = useSearchParams();
  const childId = searchParams.get('child_id');
  const { data: children } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childId || (children && children.length > 0 ? children[0].id : null));
  const { data: billingHistoryData, isLoading } = useBillingHistory(selectedChildId || undefined);
  const billingHistory = billingHistoryData || [];

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
            결제 내역
          </h1>

          {children && children.length > 1 && (
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', borderBottom: 'var(--border-width-base) solid var(--color-gray-200)' }}>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChildId(child.id)}
                    style={{
                      padding: 'var(--spacing-md) var(--spacing-lg)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: selectedChildId === child.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      borderBottom: selectedChildId === child.id ? 'var(--border-width-base) solid var(--color-primary)' : 'var(--border-width-base) solid transparent',
                      cursor: 'pointer',
                      fontWeight: selectedChildId === child.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                      transition: 'var(--transition-all)',
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

          {billingHistory && billingHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {billingHistory.map((item) => (
                <Card key={item.id} padding="md" variant="elevated">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-semibold)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        {item.title || '청구서'}
                      </h3>
                      <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-xs)'
                      }}>
                        기간: {item.period_start} ~ {item.period_end}
                      </p>
                      <p style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-text)'
                      }}>
                        금액: {item.amount?.toLocaleString()}원
                      </p>
                      {item.amount_due && item.amount_due > 0 && (
                        <p style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-error)',
                          marginTop: 'var(--spacing-xs)'
                        }}>
                          미납: {item.amount_due.toLocaleString()}원
                        </p>
                      )}
                    </div>
                    {item.status === 'pending' && item.amount_due && item.amount_due > 0 && (
                      <Button
                        variant="solid"
                        color="primary"
                        onClick={() => {
                          // 결제 페이지로 이동 (public-gateway)
                          window.location.href = `/payment?invoice_id=${item.id}`;
                        }}
                      >
                        결제하기
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {billingHistory && billingHistory.length === 0 && (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>결제 내역이 없습니다.</p>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </ErrorBoundary>
  );
}

