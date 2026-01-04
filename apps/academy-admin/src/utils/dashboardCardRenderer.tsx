/**
 * DashboardCard Renderer Registry (SSOT 친화)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 파일에만 존재
 * [성능 최적화] Lazy Loading 적용: 카드 컴포넌트를 동적으로 import
 */

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { DashboardCard } from '../types/dashboardCard';
import { StudentTaskCardRenderer } from '../components/StudentTaskCardRenderer';
import { EmergencyCard } from '../components/dashboard-cards/EmergencyCard';
import { AIBriefingCard } from '../components/dashboard-cards/AIBriefingCard';
import { handleCardClick } from './handleCardClick';
import { LazyClassCard, LazyBillingSummaryCard, LazyStatsCard } from '../components/dashboard-cards/LazyDashboardCards';

/**
 * DashboardCard 렌더링 함수
 *
 * 카드 타입에 따라 적절한 컴포넌트를 반환
 *
 * @param card - 렌더링할 카드
 * @param navigate - React Router navigate 함수
 * @param options - 렌더링 옵션 (maxInsights: AI Briefing Card의 최대 insights 개수, 0이면 전체 표시)
 */
export function renderCard(
  card: DashboardCard,
  navigate: NavigateFunction,
  options?: { maxInsights?: number; onChartClick?: (card: DashboardCard) => void }
): React.ReactNode {
  // Student Task Card
  if ('task_type' in card) {
    // Hook은 컴포넌트 내부에서만 사용 가능하므로, 별도 컴포넌트로 처리
    return <StudentTaskCardRenderer key={card.id} card={card} navigate={navigate} />;
  }

  // Emergency Card
  if (card.type === 'emergency') {
    return (
      <EmergencyCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
      />
    );
  }

  // AI Briefing Card
  if (card.type === 'ai_briefing') {
    return (
      <AIBriefingCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
        maxInsights={options?.maxInsights ?? 3} // 기본값 3개, 0이면 전체 표시
      />
    );
  }

  // Class Card
  // [성능 최적화] Lazy Loading 적용
  if (card.type === 'class') {
    return (
      <LazyClassCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
      />
    );
  }

  // Stats Card
  // [성능 최적화] Lazy Loading 적용
  if (card.type === 'stats') {
    return (
      <LazyStatsCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
        onChartClick={(card) => {
          // onChartClick은 HomePage에서 처리 (모달 상태 관리)
          // 이 함수는 renderCard의 options로 전달받아야 함
          if (options?.onChartClick) {
            options.onChartClick(card);
          }
        }}
      />
    );
  }

  // Billing Summary Card
  // [성능 최적화] Lazy Loading 적용
  if (card.type === 'billing_summary') {
    return (
      <LazyBillingSummaryCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
      />
    );
  }

  return null;
}

