/**
 * Class Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 */

import React from 'react';
import { Card } from '@ui-core/react';
import type { ClassCard as ClassCardType } from '../../types/dashboardCard';

export interface ClassCardProps {
  card: ClassCardType;
  onAction?: (card: ClassCardType) => void;
}

export function ClassCard({ card, onAction }: ClassCardProps) {
  return (
    <Card
      key={card.id}
      padding="md"
      variant="default"
      style={{ cursor: 'pointer' }}
      onClick={() => onAction?.(card)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-xs)' }}>
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
          {card.class_name}
        </h3>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          {card.start_time}
        </div>
      </div>
      <div style={{ color: 'var(--color-text-secondary)' }}>
        출석: {card.attendance_count}/{card.student_count}
      </div>
    </Card>
  );
}

