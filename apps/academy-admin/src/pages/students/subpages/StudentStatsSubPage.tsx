/**
 * 학생 통계 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '학생 통계' 탭(statistics)을 담당하는 SubPage 컴포넌트
 * 현재는 준비 중 상태 표시
 */

import React from 'react';
import { EmptyState } from '@ui-core/react';
import { Users } from 'lucide-react';
import { StatsTableLayout } from '../../../components';
import type { PeriodFilter } from '../../../components/stats';

export interface StudentStatsSubPageProps {
  // 기간 필터
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;

  // UI 설정
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    PERSON_LABEL_PRIMARY: string;
  };
}

export function StudentStatsSubPage({
  statsPeriod,
  onStatsPeriodChange,
  currentSubMenuLabel,
  terms,
}: StudentStatsSubPageProps) {
  return (
    <StatsTableLayout
      title={currentSubMenuLabel}
      entityName={`${terms.PERSON_LABEL_PRIMARY}통계`}
      statsItems={[]}
      chartData={[]}
      period={statsPeriod}
      onPeriodChange={onStatsPeriodChange}
      sectionOrderKey="students-section-order-statistics"
      showTitle={true}
      hideStats={true}
      tableContent={
        <EmptyState
          icon={Users}
          message={`${terms.PERSON_LABEL_PRIMARY} 통계 기능은 준비 중입니다.`}
        />
      }
    />
  );
}
