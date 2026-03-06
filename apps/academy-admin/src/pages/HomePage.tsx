/**
 * 홈 대시보드 페이지
 *
 * [LAYER: UI_PAGE]
 *
 * 아키텍처 문서 3.7.1 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [P0-1 수정] 가드 컴포넌트 패턴: getApiContext() 실패 시 조기 return으로 인한 React Hooks 규칙 위반 방지
 *
 * 카드 우선순위:
 * 1. Emergency (긴급 알림)
 * 2. AI Briefing
 * 3. Student Tasks
 * 4. Classes
 * 5. Stats
 * 6. Billing Summary
 *
 * 실제 그룹 순서: EMERGENCY > AI_BRIEFING > TASKS > CLASSES > STATS > BILLING
 */

import React from 'react';
import { ErrorBoundary, Container, PageHeader } from '@ui-core/react';
import { getApiContext } from '@api-sdk/core';
import { logError } from '../utils';
import { useHomePageData } from './home/hooks/useHomePageData';
import { DashboardHeader } from './home/components/DashboardHeader';
import { DashboardCardGroups } from './home/components/DashboardCardGroups';

// [P0-1 수정] 가드 컴포넌트 패턴
export function HomePage() {
  let tenantId: string | null = null;

  try {
    tenantId = getApiContext().tenantId ?? null;
  } catch (error) {
    logError('HomePage:Guard:getApiContext', error);
    tenantId = null;
  }

  if (!tenantId) {
    return (
      <ErrorBoundary>
        <Container maxWidth="xl" padding="lg">
          <PageHeader title="대시보드" />
          <div style={{
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}>
            <p>시스템 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.</p>
          </div>
        </Container>
      </ErrorBoundary>
    );
  }

  return <HomePageInner tenantId={tenantId} />;
}

function HomePageInner({ tenantId }: { tenantId: string }) {
  const {
    safeNavigate,
    isSafeInternalTarget,
    chartModalOpen,
    setChartModalOpen,
    dailyStoreMetrics,
    adaptiveNav,
    sortedCards,
    groupedCards,
  } = useHomePageData(tenantId);

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding="lg">
        <DashboardHeader
          adaptiveNav={adaptiveNav}
          isSafeInternalTarget={isSafeInternalTarget}
          safeNavigate={safeNavigate}
        />

        <DashboardCardGroups
          groupedCards={groupedCards}
          sortedCards={sortedCards}
          safeNavigate={safeNavigate}
          chartModalOpen={chartModalOpen}
          setChartModalOpen={setChartModalOpen}
          dailyStoreMetrics={dailyStoreMetrics}
        />
      </Container>
    </ErrorBoundary>
  );
}
