/**
 * 수납/청구 홈 페이지
 *
 * 아키텍처 문서 3.4.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 *
 * 카드 우선순위 (Billing Home 전용):
 * 1. 결제수단 미등록 카드 (최상단 고정)
 * 2. 긴급 알림 카드
 * 3. 이번달 예상 수납률 카드
 * 4. 자동 청구 진행 현황
 * 5. 결제 현황 요약
 * 6. 미납 알림 진행 현황
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, Badge, PageHeader } from '@ui-core/react';
import { Grid } from '@ui-core/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { fetchBillingHistory } from '@hooks/use-billing';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';

interface BillingHomeCard {
  id: string;
  type: 'no_payment_method' | 'urgent_alert' | 'expected_collection_rate' | 'auto_billing_progress' | 'payment_summary' | 'unpaid_notification_progress';
  title: string;
  message?: string;
  value?: number | string;
  status?: 'ready' | 'in_progress' | 'completed';
  action_url?: string;
  priority: number;
}

export function BillingHomePage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // Billing Home Cards 조회
  const { data: cards, isLoading } = useQuery({
    queryKey: ['billing-home-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: BillingHomeCard[] = [];
      const currentMonth = toKST().format('YYYY-MM');

      // 이번 달 청구서 조회
      // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01` },
      });

      const hasInvoicesThisMonth = invoices && invoices.length > 0;

      if (!hasInvoicesThisMonth) {
        // "준비 중" 상태 처리 (아키텍처 문서 3.4.1 참조)
        return [
          {
            id: 'ready-placeholder',
            type: 'expected_collection_rate' as const,
            title: '이번 달 청구서 준비 중',
            message: '이번 달 청구서가 아직 생성되지 않았습니다.',
            status: 'ready' as const,
            priority: 3,
          },
        ];
      }


      // 1. 결제수단 미등록 체크 (TODO: payment_methods 테이블 구현 후 활성화)
      // const paymentMethodsResponse = await apiClient.get<any>('payment_methods', {});
      // if (!paymentMethodsResponse.error && (!paymentMethodsResponse.data || paymentMethodsResponse.data.length === 0)) {
      //   cards.push({
      //     id: 'no-payment-method',
      //     type: 'no_payment_method',
      //     title: '결제수단 미등록',
      //     message: '결제수단을 등록해주세요.',
      //     action_url: '/billing/settings/payment-methods',
      //     priority: 1,
      //   });
      // }

      // 2. 긴급 알림 (미납 7일 이상)
      // 기술문서 5-2: KST 기준 날짜 처리
      const overdueInvoices = invoices.filter((inv: BillingHistoryItem) => {
        if (inv.status !== 'overdue') return false;
        const dueDateKST = toKST(inv.period_end);
        const nowKST = toKST();
        const daysOverdue = nowKST.diff(dueDateKST, 'days');
        return daysOverdue >= 7;
      });

      if (overdueInvoices.length > 0) {
        cards.push({
          id: 'urgent-alert',
          type: 'urgent_alert',
          title: '긴급 알림',
          message: `미납 7일 이상 청구서가 ${overdueInvoices.length}건 있습니다.`,
          action_url: '/billing/list?status=overdue',
          priority: 2,
        });
      }

      // 3. 이번달 예상 수납률
      const totalAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
      const paidAmount = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
      const expectedCollectionRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

      cards.push({
        id: 'expected-collection-rate',
        type: 'expected_collection_rate',
        title: '이번달 예상 수납률',
        value: expectedCollectionRate,
        action_url: '/billing/list',
        priority: 3,
      });

      // 4. 자동 청구 진행 현황
      const autoBillingInvoices = invoices.filter((inv: BillingHistoryItem & { auto_billing_enabled?: boolean }) => inv.auto_billing_enabled);
      const autoBillingProgress = invoices.length > 0
        ? Math.round((autoBillingInvoices.length / invoices.length) * 100)
        : 0;

      cards.push({
        id: 'auto-billing-progress',
        type: 'auto_billing_progress',
        title: '자동 청구 진행 현황',
        value: `${autoBillingProgress}%`,
        status: autoBillingProgress >= 80 ? 'completed' : 'in_progress',
        action_url: '/billing/list',
        priority: 4,
      });

      // 5. 결제 현황 요약
      const paymentCount = invoices.filter((inv: BillingHistoryItem) => inv.status === 'paid').length;
      cards.push({
        id: 'payment-summary',
        type: 'payment_summary',
        title: '결제 현황 요약',
        value: `${paymentCount}건`,
        action_url: '/billing/list',
        priority: 5,
      });

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
  });

  // 우선순위 정렬
  const sortedCards = React.useMemo(() => {
    if (!cards) return [];
    return [...cards].sort((a, b) => a.priority - b.priority);
  }, [cards]);

  const handleCardClick = (card: BillingHomeCard) => {
    if (card.action_url) {
      navigate(card.action_url);
    }
  };

  const renderCard = (card: BillingHomeCard) => {
    // 결제수단 미등록 카드
    if (card.type === 'no_payment_method') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="elevated"
          style={{
            borderLeft: `var(--border-width-thick) solid var(--color-error)`,
            cursor: card.action_url ? 'pointer' : 'default',
          }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                {card.title}
              </h3>
              {card.message && (
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {card.message}
                </p>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // 예상 수납률 카드
    if (card.type === 'expected_collection_rate') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="default"
          style={{ cursor: card.action_url ? 'pointer' : 'default' }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            {card.title}
          </h3>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
            {typeof card.value === 'number' ? `${card.value}%` : card.value}
          </div>
          <div style={{ color: 'var(--color-text-secondary)' }}>
            이번 달 기준
          </div>
        </Card>
      );
    }

    // 자동 청구 진행 현황 카드
    if (card.type === 'auto_billing_progress') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="default"
          style={{ cursor: card.action_url ? 'pointer' : 'default' }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            {card.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {card.value}
            </div>
            {card.status && (
              <Badge color={card.status === 'completed' ? 'green' : card.status === 'in_progress' ? 'blue' : 'gray'}>
                {card.status === 'completed' ? '완료' : card.status === 'in_progress' ? '진행 중' : '준비 중'}
              </Badge>
            )}
          </div>
        </Card>
      );
    }

    // 결제 현황 요약 카드
    if (card.type === 'payment_summary') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="default"
          style={{ cursor: card.action_url ? 'pointer' : 'default' }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            {card.title}
          </h3>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            {card.value}
          </div>
        </Card>
      );
    }

    // 긴급 알림 카드
    if (card.type === 'urgent_alert') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="elevated"
          style={{
            borderLeft: `var(--border-width-thick) solid var(--color-warning)`,
            cursor: card.action_url ? 'pointer' : 'default',
          }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                {card.title}
              </h3>
              {card.message && (
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {card.message}
                </p>
              )}
            </div>
          </div>
        </Card>
      );
    }

    // 미납 알림 진행 현황 카드
    if (card.type === 'unpaid_notification_progress') {
      return (
        <Card
          key={card.id}
          padding="md"
          variant="default"
          style={{ cursor: card.action_url ? 'pointer' : 'default' }}
          onClick={() => card.action_url && handleCardClick(card)}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
            {card.title}
          </h3>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            {card.value}
          </div>
        </Card>
      );
    }

    return null;
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="수납/청구 홈"
          actions={
            <Button
              variant="outline"
              onClick={() => navigate('/billing/list')}
            >
              전체 청구서 보기
            </Button>
          }
        />

        {/* 로딩 상태 */}
        {isLoading && (
          <Card padding="lg" variant="default">
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              padding: 'var(--spacing-xl)'
            }}>
              카드를 불러오는 중...
            </div>
          </Card>
        )}

        {/* 카드 그리드 */}
        {sortedCards && sortedCards.length > 0 ? (
          <Grid columns={{ xs: 1, sm: 2, md: 3 }} gap="md">
            {sortedCards.map((card) => renderCard(card))}
          </Grid>
        ) : (
          <Card padding="lg" variant="default">
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
                padding: 'var(--spacing-xl)'
              }}>
                <p style={{ marginBottom: 'var(--spacing-md)' }}>
                  표시할 카드가 없습니다.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/billing/list')}
                >
                  전체 청구서 보기
                </Button>
              </div>
            </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}

