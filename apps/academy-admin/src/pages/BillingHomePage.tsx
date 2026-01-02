/**
 * 수납/청구 홈 페이지
 *
 * [LAYER: UI_PAGE]
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

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary, Container, Card, Button, PageHeader } from '@ui-core/react';
import { useQuery } from '@tanstack/react-query';
import { getApiContext } from '@api-sdk/core';
import { fetchBillingHistory } from '@hooks/use-billing';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import { BillingHomeCard } from '../components/dashboard-cards/BillingHomeCard';
import type { BillingHomeCard as BillingHomeCardType } from '../components/dashboard-cards/BillingHomeCard';
import { CardGridLayout } from '../components/CardGridLayout';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES } from '../constants';
import { createSafeNavigate } from '../utils';


export function BillingHomePage() {
  const navigate = useNavigate();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );

  // Billing Home Cards 조회
  const { data: cards, isLoading } = useQuery({
    queryKey: ['billing-home-cards', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const cards: BillingHomeCardType[] = [];
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


      // P3 TODO: 결제수단 미등록 체크 (payment_methods 테이블 구현 후 활성화)
      // 장기 계획: 자동 청구를 위한 결제수단 등록 체크 기능
      // 우선순위: 낮음 (현재는 수동 결제만 지원)

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
          action_url: ROUTES.BILLING_LIST('overdue'),
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
        action_url: ROUTES.BILLING_LIST(),
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
        action_url: ROUTES.BILLING_LIST(),
        priority: 4,
      });

      // 5. 결제 현황 요약
      const paymentCount = invoices.filter((inv: BillingHistoryItem) => inv.status === 'paid').length;
      cards.push({
        id: 'payment-summary',
        type: 'payment_summary',
        title: '결제 현황 요약',
        value: `${paymentCount}건`,
        action_url: ROUTES.BILLING_LIST(),
        priority: 5,
      });

      return cards;
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
  });

  // 우선순위 정렬
  const sortedCards = useMemo(() => {
    if (!cards) return [];
    return [...cards].sort((a, b) => a.priority - b.priority);
  }, [cards]);

  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const handleCardClick = (card: BillingHomeCardType) => {
    if (card.action_url) {
      safeNavigate(card.action_url);
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <PageHeader
          title="수납/청구 홈"
          actions={
            <Button
              variant="outline"
              onClick={() => safeNavigate(ROUTES.BILLING_LIST())}
            >
              전체 청구서 보기
            </Button>
          }
        />

        {/* 로딩 상태 */}
        {isLoading && (
          <Card padding="lg">
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
          <CardGridLayout
            cards={sortedCards.map((card) => (
              <BillingHomeCard key={card.id} card={card} onAction={handleCardClick} />
            ))}
            desktopColumns={3}
            tabletColumns={2}
            mobileColumns={1}
          />
        ) : (
          <Card padding="lg">
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
                  onClick={() => safeNavigate(ROUTES.BILLING_LIST())}
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

