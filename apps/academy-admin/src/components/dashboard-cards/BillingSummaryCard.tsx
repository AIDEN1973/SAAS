/**
 * Billing Summary Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import React from 'react';
import { Card } from '@ui-core/react';
import type { BillingSummaryCard as BillingSummaryCardType } from '../../types/dashboardCard';

export interface BillingSummaryCardProps {
  card: BillingSummaryCardType;
  onAction?: (card: BillingSummaryCardType) => void;
}

export function BillingSummaryCard({ card, onAction }: BillingSummaryCardProps) {
  return (
    <Card
      key={card.id}
      padding="md"
      variant="default"
      style={{ cursor: 'pointer' }}
      onClick={() => onAction?.(card)}
    >
      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
        {card.title}
      </h3>
      <div style={{ marginBottom: 'var(--spacing-xs)' }}>
        <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
          예상 수납률
        </div>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
          {card.expected_collection_rate}%
        </div>
      </div>
      {card.unpaid_count > 0 && (
        <div style={{ color: 'var(--color-error)' }}>
          미납 {card.unpaid_count}건
        </div>
      )}
    </Card>
  );
}

