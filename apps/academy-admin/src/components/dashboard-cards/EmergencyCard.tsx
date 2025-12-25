/**
 * Emergency Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React, { useMemo } from 'react';
import { AlertTriangle, AlertCircle, UserX, MessageSquare, CreditCard } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { EmergencyCard as EmergencyCardType } from '../../types/dashboardCard';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_CARD_ID_PREFIX, TEXT_LINE_LIMITS } from '../../constants';

export interface EmergencyCardProps {
  card: EmergencyCardType;
  onAction?: (card: EmergencyCardType) => void;
}

export function EmergencyCard({ card, onAction }: EmergencyCardProps) {
  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);

  // 카드 ID에 따라 적절한 아이콘 선택
  const getIcon = useMemo(() => {
    if (isEmpty) return <AlertTriangle />;

    if (card.id === 'payment-failed-emergency') {
      return <CreditCard />;
    }
    if (card.id === 'attendance-error-emergency') {
      return <AlertCircle />;
    }
    if (card.id === 'ai-risk-emergency') {
      return <AlertTriangle />;
    }
    if (card.id === 'emergency-risk-students') {
      return <UserX />;
    }
    if (card.id === 'emergency-absent-students') {
      return <UserX />;
    }
    if (card.id === 'emergency-consultation-pending') {
      return <MessageSquare />;
    }

    // 기본 아이콘
    return <AlertTriangle />;
  }, [card.id, isEmpty]);

  return (
    <NotificationCardLayout
      key={card.id}
      isEmpty={isEmpty}
      onClick={() => !isEmpty && card.action_url && onAction?.(card)}
      icon={getIcon}
      title={card.title}
      description={card.message}
      variant="default"
      maxTitleLines={TEXT_LINE_LIMITS.TITLE}
      maxDescriptionLines={TEXT_LINE_LIMITS.DESCRIPTION}
      iconBackgroundColor={!isEmpty ? 'var(--color-error-50)' : undefined}
      titleFontWeight="var(--font-weight-bold)"
    />
  );
}

