/**
 * AI Briefing Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] AI OFF 시에도 메시지로 표시(숨김 금지)
 */

import React from 'react';
import { Card } from '@ui-core/react';
import type { AIBriefingCard as AIBriefingCardType } from '../../types/dashboardCard';

export interface AIBriefingCardProps {
  card: AIBriefingCardType;
  onAction?: (card: AIBriefingCardType) => void;
  maxInsights?: number; // 최대 표시할 insights 개수 (기본값: 3, AllCardsPage에서는 전체 표시)
}

export function AIBriefingCard({ card, onAction, maxInsights = 3 }: AIBriefingCardProps) {
  const displayInsights = maxInsights > 0 ? card.insights.slice(0, maxInsights) : card.insights;

  return (
    <Card
      key={card.id}
      padding="md"
      variant="elevated"
      style={{ cursor: card.action_url ? 'pointer' : 'default' }}
      onClick={() => card.action_url && onAction?.(card)}
    >
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
            {card.title}
          </h3>
        </div>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {card.summary}
        </p>
      </div>
      {displayInsights && displayInsights.length > 0 && (
        <ul style={{ marginTop: 'var(--spacing-sm)', paddingLeft: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}>
          {displayInsights.map((insight, idx) => (
            <li key={idx} style={{ marginBottom: 'var(--spacing-xs)' }}>{insight}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

