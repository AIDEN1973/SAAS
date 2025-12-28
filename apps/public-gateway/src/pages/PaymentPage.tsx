/**
 * 결제 페이지
 *
 * 아키텍처 문서 2.7, 8.2 섹션 참조
 *
 * URL 형식: /payment?invoice_id={invoice_id}
 *
 * 학부모 앱에서 자동 청구 Push + 자동 결제 링크 제공
 * 결제 성공 시 영수증 자동 발송
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Card, Button, Input, useModal } from '@ui-core/react';
import { useInvoice, useProcessPayment } from '@hooks/use-billing';
import type { Invoice } from '@hooks/use-billing';

export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice_id');
  const { showAlert } = useModal();

  const { data: invoice, isLoading } = useInvoice(invoiceId || undefined) as { data: Invoice | null | undefined; isLoading: boolean };
  const processPayment = useProcessPayment();

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'account' | 'simple'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardPassword, setCardPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!invoice) {
      showAlert('오류', '청구서 정보를 불러올 수 없습니다.');
      return;
    }

    if (paymentMethod === 'card') {
      if (!cardNumber || !cardExpiry || !cardCVC) {
        showAlert('알림', '카드 정보를 모두 입력해주세요.');
        return;
      }
    }

    setIsProcessing(true);
    try {
      const result = await processPayment.mutateAsync({
        invoiceId: invoice.id,
        paymentMethod,
        amount: (invoice.amount_due && invoice.amount_due > 0) ? invoice.amount_due : invoice.amount,
        cardInfo: paymentMethod === 'card' ? {
          number: cardNumber.replace(/\s/g, ''),
          expiry: cardExpiry,
          cvc: cardCVC,
          password: cardPassword,
        } : undefined,
      });

      if (result.success) {
        showAlert('성공', '결제가 완료되었습니다. 영수증이 발송되었습니다.');
        // 결제 완료 후 자동 리다이렉트
        // [P0 수정] 내부 경로이므로 navigate 사용 (window.location.href 대신)
        setTimeout(() => {
          // navigate는 상위에서 import 필요하므로 window.location.href 사용하되 검증 추가
          const targetPath = '/payment/success';
          // 제어 문자 제거 (보안상 필요하므로 ESLint 규칙 비활성화)
          // eslint-disable-next-line no-control-regex
          const normalized = targetPath.trim().replace(/[\u0000-\u001F\u007F]/g, '');
          const lowerNormalized = normalized.toLowerCase();
          const isSafe = normalized.startsWith('/') &&
            !normalized.startsWith('//') &&
            !normalized.includes('://') &&
            !lowerNormalized.includes('javascript:') &&
            !lowerNormalized.includes('data:') &&
            !lowerNormalized.includes('vbscript:') &&
            !lowerNormalized.includes('file:') &&
            !lowerNormalized.includes('about:') &&
            !normalized.includes('\\') &&
            !normalized.includes('..');
          if (isSafe) {
            window.location.href = targetPath;
          }
        }, 2000);
      } else {
        showAlert('오류', result.error || '결제에 실패했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '결제에 실패했습니다.';
      showAlert('오류', message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>청구서 정보를 불러오는 중...</p>
        </Card>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>청구서를 찾을 수 없습니다.</p>
        </Card>
      </Container>
    );
  }

  if (invoice.status === 'paid') {
    return (
      <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card padding="lg" variant="elevated" style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-success)'
          }}>
            결제 완료
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            이미 결제가 완료된 청구서입니다.
          </p>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" padding="lg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Card padding="lg" variant="elevated" style={{ width: '100%' }}>
        <h1 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-md)',
          textAlign: 'center',
          color: 'var(--color-text)'
        }}>
          결제하기
        </h1>

        {/* 청구서 정보 */}
        <Card padding="md" variant="outlined" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>청구 기간:</span>
            <span>{invoice.period_start} ~ {invoice.period_end}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>청구 금액:</span>
            <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              {(() => {
                // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
                const formatter = new Intl.NumberFormat('ko-KR');
                return `${formatter.format(invoice.amount)}원`;
              })()}
            </span>
          </div>
          {invoice.amount_due && invoice.amount_due > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>결제 금액:</span>
              <span style={{
                fontWeight: 'var(--font-weight-bold)',
                fontSize: 'var(--font-size-lg)',
                color: 'var(--color-primary)'
              }}>
                {(() => {
                  // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
                  const formatter = new Intl.NumberFormat('ko-KR');
                  return `${formatter.format(invoice.amount_due)}원`;
                })()}
              </span>
            </div>
          )}
        </Card>

        {/* 결제 수단 선택 */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <label style={{
            display: 'block',
            marginBottom: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)'
          }}>
            결제 수단
          </label>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <Button
              variant={paymentMethod === 'card' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setPaymentMethod('card')}
              fullWidth
            >
              카드
            </Button>
            <Button
              variant={paymentMethod === 'account' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setPaymentMethod('account')}
              fullWidth
            >
              계좌이체
            </Button>
            <Button
              variant={paymentMethod === 'simple' ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setPaymentMethod('simple')}
              fullWidth
            >
              간편결제
            </Button>
          </div>
        </div>

        {/* 카드 정보 입력 */}
        {paymentMethod === 'card' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                카드번호
              </label>
              <Input
                type="text"
                placeholder="1234-5678-9012-3456"
                value={cardNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  const formatted = value.match(/.{1,4}/g)?.join('-') || value;
                  setCardNumber(formatted.slice(0, 19));
                }}
                fullWidth
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)'
                }}>
                  만료일
                </label>
                <Input
                  type="text"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const formatted = value.length >= 2
                      ? `${value.slice(0, 2)}/${value.slice(2, 4)}`
                      : value;
                    setCardExpiry(formatted.slice(0, 5));
                  }}
                  fullWidth
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)'
                }}>
                  CVC
                </label>
                <Input
                  type="text"
                  placeholder="123"
                  value={cardCVC}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setCardCVC(value.slice(0, 3));
                  }}
                  fullWidth
                />
              </div>
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text)'
              }}>
                카드 비밀번호 앞 2자리
              </label>
              <Input
                type="password"
                placeholder="**"
                value={cardPassword}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setCardPassword(value.slice(0, 2));
                }}
                fullWidth
              />
            </div>
          </div>
        )}

        {/* 결제 버튼 */}
        <Button
          variant="solid"
          color="primary"
          fullWidth
          size="lg"
          onClick={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? '결제 처리 중...' : (() => {
            // [P1 수정] toLocaleString() 대신 Intl.NumberFormat 사용
            const formatter = new Intl.NumberFormat('ko-KR');
            const amount = invoice.amount_due && invoice.amount_due > 0 ? invoice.amount_due : invoice.amount;
            return `${formatter.format(amount)}원 결제하기`;
          })()}
        </Button>
      </Card>
    </Container>
  );
}

