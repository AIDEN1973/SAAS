/**
 * 출결 요약 통계 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { Users, UserCheck, Clock, UserX } from 'lucide-react';
import { StatsDashboard } from '../../../components/stats/StatsDashboard';
import { useIndustryTerms } from '@hooks/use-industry-terms';

interface AttendanceSummaryStatsProps {
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
  };
  chartData: Array<{ name: string; value: number; color: string }>;
  isLoading: boolean;
}

export function AttendanceSummaryStats({ summary, chartData, isLoading }: AttendanceSummaryStatsProps) {
  const terms = useIndustryTerms();

  return (
    <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
      <div style={{ contain: 'layout style' }}>
        <StatsDashboard
          statsItems={[
            {
              key: 'total',
              icon: Users,
              title: terms.TOTAL_LABEL,
              value: summary.total,
              unit: '명',
              iconBackgroundColor: 'var(--color-gray-100)',
            },
            {
              key: 'present',
              icon: UserCheck,
              title: terms.PRESENT_LABEL,
              value: summary.present,
              unit: '명',
              iconBackgroundColor: 'var(--color-success-50)',
            },
            {
              key: 'late',
              icon: Clock,
              title: terms.LATE_LABEL,
              value: summary.late,
              unit: '명',
              iconBackgroundColor: 'var(--color-warning-50)',
            },
            {
              key: 'absent',
              icon: UserX,
              title: terms.ABSENCE_LABEL,
              value: summary.absent,
              unit: '명',
              iconBackgroundColor: 'var(--color-error-50)',
            },
          ]}
          chartData={chartData}
          hideChart={true}
          showPeriodFilter={false}
          chartType="bar"
          showZeroValues={true}
          desktopColumns={4}
          tabletColumns={2}
          mobileColumns={2}
          chartTooltipUnit="명"
          chartTooltipLabel="등원 학생수"
        />
      </div>
    </div>
  );
}
