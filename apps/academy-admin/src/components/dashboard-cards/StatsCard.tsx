/**
 * Stats Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import React from 'react';
import { Card } from '@ui-core/react';
import type { StatsCard as StatsCardType } from '../../types/dashboardCard';

export interface StatsCardProps {
  card: StatsCardType;
  onAction?: (card: StatsCardType) => void;
}

export function StatsCard({ card, onAction }: StatsCardProps) {
  return (
    <Card
      key={card.id}
      padding="md"
      variant="default"
      style={{ cursor: card.action_url ? 'pointer' : 'default' }}
      onClick={() => card.action_url && onAction?.(card)}
    >
      <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
        {card.title}
      </h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-xs)' }}>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
          {card.value}
        </div>
        {card.trend && (
          <div style={{ color: card.trend.startsWith('+') ? 'var(--color-success)' : 'var(--color-error)' }}>
            {card.trend}
          </div>
        )}
      </div>
    </Card>
  );
}

