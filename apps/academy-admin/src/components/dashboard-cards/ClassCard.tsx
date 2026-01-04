/**
 * Class Card 컴포넌트 (공통)
 *
 * [불변 규칙] HomePage와 AllCardsPage에서 공통 사용
 * [불변 규칙] SSOT 원칙 준수: 렌더링 로직은 이 컴포넌트에만 존재
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 */

import React from 'react';
import { GraduationCap } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import type { ClassCard as ClassCardType } from '../../types/dashboardCard';
// [SSOT] Barrel export를 통한 통합 import
import { EMPTY_CARD_ID_PREFIX } from '../../constants';

export interface ClassCardProps {
  card: ClassCardType;
  onAction?: (card: ClassCardType) => void;
}

export function ClassCard({ card, onAction }: ClassCardProps) {
  // [P2-업종중립] 업종별 용어 조회
  const terms = useIndustryTerms();

  // 빈 카드 여부 확인 (ID가 empty-로 시작하는 경우)
  const isEmpty = card.id.startsWith(EMPTY_CARD_ID_PREFIX);

  return (
    <NotificationCardLayout
      key={card.id}
      title={card.class_name}
      description={`${terms.ATTENDANCE_LABEL}: ${card.attendance_count}/${card.student_count}`}
      meta={card.start_time}
      isEmpty={isEmpty}
      onClick={() => !isEmpty && onAction?.(card)}
      icon={<GraduationCap style={{ width: '100%', height: '100%' }} />}
      titleFontWeight="var(--font-weight-bold)"
    />
  );
}

