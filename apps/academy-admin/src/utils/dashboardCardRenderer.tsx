/**
 * DashboardCard Renderer Registry (SSOT 친화)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 파일에만 존재
 */

import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { DashboardCard } from '../types/dashboardCard';
import { StudentTaskCard } from '../components/StudentTaskCard';
import type { StudentTaskCard as StudentTaskCardType } from '@hooks/use-student';
import { useStudentTaskCardAction } from '@hooks/use-student';
import { EmergencyCard } from '../components/dashboard-cards/EmergencyCard';
import { AIBriefingCard } from '../components/dashboard-cards/AIBriefingCard';
import { ClassCard } from '../components/dashboard-cards/ClassCard';
import { StatsCard } from '../components/dashboard-cards/StatsCard';
import { BillingSummaryCard } from '../components/dashboard-cards/BillingSummaryCard';
import { handleCardClick } from './handleCardClick';

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
    return <StudentTaskCardRenderer key={card.id} card={card as StudentTaskCardType} navigate={navigate} />;
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
  if (card.type === 'class') {
    return (
      <ClassCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
      />
    );
  }

  // Stats Card
  if (card.type === 'stats') {
    return (
      <StatsCard
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
  if (card.type === 'billing_summary') {
    return (
      <BillingSummaryCard
        key={card.id}
        card={card}
        onAction={handleCardClick(card, navigate)}
      />
    );
  }

  return null;
}

/**
 * StudentTaskCard 렌더링 컴포넌트
 *
 * Hook 사용을 위해 별도 컴포넌트로 분리
 */
function StudentTaskCardRenderer({ card, navigate }: { card: StudentTaskCardType; navigate: NavigateFunction }) {
  const handleCardAction = useStudentTaskCardAction();

  return (
    <StudentTaskCard
      key={card.id}
      card={card}
      onAction={(card) => {
        // ⚠️ 정본 규칙: 컴포넌트 레벨에서 navigate 호출 (Hook 내부 호출 금지)
        const actionUrl = handleCardAction(card);
        if (actionUrl) {
          navigate(actionUrl);
        }
      }}
    />
  );
}

