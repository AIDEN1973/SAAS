/**
 * Student Stats Card 컴포넌트
 *
 * 학생 통계 카드 (전체, 활성, 비활성, 이번 달 신규)
 * [불변 규칙] CSS 변수 사용, 하드코딩 금지
 * [불변 규칙] UI Core Component (NotificationCardLayout) 사용
 * [SSOT] useIndustryTerms로 동적 라벨 사용
 */

import React from 'react';
import { Users } from 'lucide-react';
import { NotificationCardLayout } from '@ui-core/react';
import type { StudentStats } from '@hooks/use-student';
import { useIndustryTerms } from '@hooks/use-industry-terms';

export interface StudentStatsCardProps {
  stats: StudentStats | undefined;
  isLoading?: boolean;
  onAction?: () => void;
}

export function StudentStatsCard({ stats, isLoading, onAction }: StudentStatsCardProps) {
  const terms = useIndustryTerms();
  const isEmpty = !stats || isLoading;

  return (
    <NotificationCardLayout
      title={terms.STATS_TOTAL_COUNT_TITLE}
      value={isEmpty ? '-' : stats.total}
      unit="명"
      isEmpty={isEmpty}
      onClick={onAction}
      icon={<Users style={{ width: '100%', height: '100%' }} />}
    />
  );
}

