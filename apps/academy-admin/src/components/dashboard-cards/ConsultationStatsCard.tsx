/**
 * Consultation Stats Card 컴포넌트
 *
 * 상담 통계 카드 (이번 달 상담 건수, 대기 중인 상담 건수, 긴급 상담 건수)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { ConsultationStats } from '@hooks/use-student';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_MESSAGES } from '../../constants';

export interface ConsultationStatsCardProps {
  stats: ConsultationStats | undefined;
  isLoading?: boolean;
  onAction?: () => void;
}

export function ConsultationStatsCard({ stats, isLoading, onAction }: ConsultationStatsCardProps) {
  const isEmpty = !stats || isLoading;

  const items = !isEmpty ? [
    {
      label: '이번 달',
      value: `${stats.this_month_count}건`,
    },
    {
      label: '대기 중',
      value: `${stats.pending_count}건`,
      color: stats.pending_count > 0 ? 'var(--color-warning)' : undefined,
    },
    ...(stats.urgent_count > 0 ? [{
      label: '긴급',
      value: `${stats.urgent_count}건`,
      color: 'var(--color-error)',
    }] : []),
  ] : [];

  const listContent = isEmpty ? (
    <div style={{
      color: 'var(--color-text-secondary)',
      fontSize: 'var(--font-size-base)',
    }}>
      {EMPTY_MESSAGES.DATA}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}>
            {item.label}
          </div>
          <div style={{
            fontWeight: 'var(--font-weight-semibold)',
            color: item.color || 'var(--color-text)',
            fontSize: 'var(--font-size-base)',
          }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <NotificationCardLayout
      title="상담 통계"
      isEmpty={isEmpty}
      onClick={onAction}
      icon={<MessageSquare style={{ width: '100%', height: '100%' }} />}
    >
      {listContent}
    </NotificationCardLayout>
  );
}

