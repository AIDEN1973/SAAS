/**
 * 결제 성공 페이지
 *
 * 결제 완료 후 표시되는 페이지입니다.
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Container, Card, Button } from '@ui-core/react';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get('payment_id');
  const invoiceId = searchParams.get('invoice_id');

  useEffect(() => {
    // 5초 후 자동으로 학부모 앱으로 리다이렉트
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-green-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--spacing-md)',
          }}>
            <svg style={{ width: '32px', height: '32px', color: 'var(--color-green-600)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-sm)',
            color: 'var(--color-text)'
          }}>
            결제가 완료되었습니다
          </h1>
          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            영수증이 이메일로 발송되었습니다.
          </p>
          {paymentId && (
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              결제 번호: {paymentId}
            </p>
          )}
        </div>
        <Button
          variant="solid"
          color="primary"
          fullWidth
          onClick={() => navigate('/')}
        >
          확인
        </Button>
      </Card>
    </Container>
  );
}

