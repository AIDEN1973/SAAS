/**
 * Billing Home Card 컴포넌트
 *
 * 수납/청구 홈 페이지 전용 카드 컴포넌트
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React from 'react';
import { NotificationCardLayout, Card, Badge } from '@ui-core/react';

export interface BillingHomeCard {
  id: string;
  type: 'no_payment_method' | 'urgent_alert' | 'expected_collection_rate' | 'auto_billing_progress' | 'payment_summary' | 'unpaid_notification_progress';
  title: string;
  message?: string;
  value?: number | string;
  status?: 'ready' | 'in_progress' | 'completed';
  action_url?: string;
  priority: number;
}

export interface BillingHomeCardProps {
  card: BillingHomeCard;
  onAction?: (card: BillingHomeCard) => void;
}

export function BillingHomeCard({ card, onAction }: BillingHomeCardProps) {
  const handleClick = () => {
    if (card.action_url && onAction) {
      onAction(card);
    }
  };

  // 결제수단 미등록 카드
  if (card.type === 'no_payment_method') {
    return (
      <NotificationCardLayout
        key={card.id}
        title={card.title}
        description={card.message}
        onClick={handleClick}
        variant="elevated"
        borderLeftColor="var(--color-error)"
      />
    );
  }

  // 예상 수납률 카드
  if (card.type === 'expected_collection_rate') {
    const valueStr = typeof card.value === 'number' ? card.value.toString() : card.value || '-';
    const hasPercent = typeof card.value === 'number' || (typeof card.value === 'string' && card.value.includes('%'));
    return (
      <NotificationCardLayout
        key={card.id}
        title={card.title}
        value={hasPercent ? valueStr.replace('%', '') : valueStr}
        unit={hasPercent ? '%' : undefined}
        onClick={handleClick}
      />
    );
  }

  // 자동 청구 진행 현황 카드
  if (card.type === 'auto_billing_progress') {
    return (
      <Card
        key={card.id}
        padding="md"
        variant="default"
        style={{ cursor: card.action_url ? 'pointer' : 'default' }}
        onClick={handleClick}
        disableHoverEffect={true}
      >
        <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          {card.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            {card.value}
          </div>
          {card.status && (
            <Badge color={card.status === 'completed' ? 'green' : card.status === 'in_progress' ? 'blue' : 'gray'}>
              {card.status === 'completed' ? '완료' : card.status === 'in_progress' ? '진행 중' : '준비 중'}
            </Badge>
          )}
        </div>
      </Card>
    );
  }

  // 결제 현황 요약 카드
  if (card.type === 'payment_summary') {
    return (
      <NotificationCardLayout
        key={card.id}
        title={card.title}
        value={card.value || '-'}
        onClick={handleClick}
      />
    );
  }

  // 긴급 알림 카드
  if (card.type === 'urgent_alert') {
    return (
      <NotificationCardLayout
        key={card.id}
        title={card.title}
        description={card.message}
        onClick={handleClick}
        variant="elevated"
        borderLeftColor="var(--color-warning)"
      />
    );
  }

  // 미납 알림 진행 현황 카드
  if (card.type === 'unpaid_notification_progress') {
    return (
      <NotificationCardLayout
        key={card.id}
        title={card.title}
        value={card.value || '-'}
        onClick={handleClick}
      />
    );
  }

  return null;
}

