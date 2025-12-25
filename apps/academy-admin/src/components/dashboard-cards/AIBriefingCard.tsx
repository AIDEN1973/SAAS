/**
 * AI Briefing Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] AI OFF 시에도 메시지로 표시(숨김 금지)
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React, { useMemo } from 'react';
import { Sparkles, Calendar, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { AIBriefingCard as AIBriefingCardType } from '../../types/dashboardCard';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_CARD_ID_PREFIX, DEFAULT_VALUES, TEXT_LINE_LIMITS } from '../../constants';

export interface AIBriefingCardProps {
  card: AIBriefingCardType;
  onAction?: (card: AIBriefingCardType) => void;
  maxInsights?: number; // 최대 표시할 insights 개수 (기본값: DEFAULT_VALUES.MAX_INSIGHTS, AllCardsPage에서는 전체 표시)
}

export function AIBriefingCard({ card, onAction, maxInsights = DEFAULT_VALUES.MAX_INSIGHTS }: AIBriefingCardProps) {
  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);
  const displayInsights = maxInsights > DEFAULT_VALUES.ZERO ? card.insights.slice(0, maxInsights) : card.insights;

  // 카드 ID에 따라 적절한 아이콘 선택
  const getIcon = useMemo(() => {
    if (isEmpty) return <Sparkles />;

    if (card.id === 'briefing-consultations') {
      return <Calendar />;
    }
    if (card.id === 'briefing-billing') {
      return <DollarSign />;
    }
    if (card.id === 'briefing-attendance') {
      return <TrendingUp />;
    }
    if (card.id === 'briefing-risk') {
      return <AlertTriangle />;
    }

    // 기본 아이콘
    return <Sparkles />;
  }, [card.id, isEmpty]);

  // 인사이트 리스트
  const insightsContent = displayInsights && displayInsights.length > DEFAULT_VALUES.ZERO ? (
    <ul style={{
      marginTop: 'var(--spacing-sm)',
      paddingLeft: 'var(--spacing-md)',
      fontSize: 'var(--font-size-base)',
      color: 'var(--color-text-secondary)',
    }}>
      {displayInsights.map((insight, idx) => (
        <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{insight}</li>
      ))}
    </ul>
  ) : null;

  return (
    <NotificationCardLayout
      key={card.id}
      isEmpty={isEmpty}
      onClick={() => !isEmpty && card.action_url && onAction?.(card)}
      icon={getIcon}
      title={card.title}
      description={card.summary}
      variant="default"
      maxTitleLines={TEXT_LINE_LIMITS.TITLE}
      maxDescriptionLines={TEXT_LINE_LIMITS.DESCRIPTION}
      titleFontWeight="var(--font-weight-bold)"
    >
      {insightsContent}
    </NotificationCardLayout>
  );
}
