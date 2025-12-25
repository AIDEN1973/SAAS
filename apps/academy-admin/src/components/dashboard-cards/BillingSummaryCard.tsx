/**
 * Billing Summary Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React from 'react';
import { Receipt } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { BillingSummaryCard as BillingSummaryCardType } from '../../types/dashboardCard';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_CARD_ID_PREFIX, DEFAULT_VALUES, CARD_LABELS } from '../../constants';

export interface BillingSummaryCardProps {
  card: BillingSummaryCardType;
  onAction?: (card: BillingSummaryCardType) => void;
}

export function BillingSummaryCard({ card, onAction }: BillingSummaryCardProps) {
  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);

  return (
    <NotificationCardLayout
      key={card.id}
      title={card.title}
      value={card.expected_collection_rate}
      unit="%"
      isEmpty={isEmpty}
      onClick={() => !isEmpty && onAction?.(card)}
      icon={<Receipt style={{ width: '100%', height: '100%' }} />}
    >
      {card.unpaid_count > DEFAULT_VALUES.ZERO && (
        <div style={{ color: 'var(--color-error)', marginTop: 'var(--spacing-sm)' }}>
          {CARD_LABELS.UNPAID_PREFIX} {card.unpaid_count}{CARD_LABELS.UNPAID_SUFFIX}
        </div>
      )}
    </NotificationCardLayout>
  );
}
