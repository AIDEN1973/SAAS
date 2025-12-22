/**
 * Emergency Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import React from 'react';
import { Card } from '@ui-core/react';
import type { EmergencyCard as EmergencyCardType } from '../../types/dashboardCard';

export interface EmergencyCardProps {
  card: EmergencyCardType;
  onAction?: (card: EmergencyCardType) => void;
}

export function EmergencyCard({ card, onAction }: EmergencyCardProps) {
  return (
    <Card
      key={card.id}
      padding="md"
      variant="elevated"
      style={{
        borderLeft: `var(--border-width-thick) solid var(--color-error)`,
        cursor: card.action_url ? 'pointer' : 'default',
      }}
      onClick={() => card.action_url && onAction?.(card)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
            {card.title}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {card.message}
          </p>
        </div>
      </div>
    </Card>
  );
}

