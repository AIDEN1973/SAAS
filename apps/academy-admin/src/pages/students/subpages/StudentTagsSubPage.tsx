/**
 * 태그 관리 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '태그 관리' 탭(tags)을 담당하는 SubPage 컴포넌트
 * 현재는 준비 중 상태 표시
 */

import React from 'react';
import { EmptyState } from '@ui-core/react';
import { Users } from 'lucide-react';
import { StatsTableLayout } from '../../../components';
import type { PeriodFilter } from '../../../components/stats';

export interface StudentTagsSubPageProps {
  // 기간 필터
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;

  // UI 설정
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    TAG_LABEL: string;
  };
}

export function StudentTagsSubPage({
  statsPeriod,
  onStatsPeriodChange,
  currentSubMenuLabel,
  terms,
}: StudentTagsSubPageProps) {
  return (
    <StatsTableLayout
      title={currentSubMenuLabel}
      entityName={`${terms.TAG_LABEL}목록`}
      statsItems={[]}
      chartData={[]}
      period={statsPeriod}
      onPeriodChange={onStatsPeriodChange}
      sectionOrderKey="students-section-order-tags"
      showTitle={true}
      hideStats={true}
      tableContent={
        <EmptyState
          icon={Users}
          message={`${terms.TAG_LABEL} 관리 기능은 준비 중입니다.`}
        />
      }
    />
  );
}
