/**
 * 수업 통계 카드 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { NotificationCardLayout } from '@ui-core/react';
import { BookOpen, Users, CheckCircle, XCircle } from 'lucide-react';
import { useClasses } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { CardGridLayout } from '../../../components/CardGridLayout';

export function StatisticsCards() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});

  // 통계 계산
  const statistics = useMemo(() => {
    if (!allClasses) return { total: 0, active: 0, inactive: 0, totalStudents: 0 };

    return {
      total: allClasses.length,
      active: allClasses.filter(c => c.status === 'active').length,
      inactive: allClasses.filter(c => c.status !== 'active').length,
      totalStudents: allClasses.reduce((sum, c) => sum + (c.current_count || 0), 0),
    };
  }, [allClasses]);

  return (
    <div style={{ marginBottom: 'var(--spacing-xl)', pointerEvents: isLoading ? 'none' : 'auto', opacity: isLoading ? 'var(--opacity-loading)' : 'var(--opacity-full)' }}>
      <CardGridLayout
        cards={[
          <NotificationCardLayout
            key="total"
            icon={<BookOpen />}
            title={`전체 ${terms.GROUP_LABEL_PLURAL}`}
            value={statistics.total}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-gray-100)"
          />,
          <NotificationCardLayout
            key="active"
            icon={<CheckCircle />}
            title={`활성 ${terms.GROUP_LABEL}`}
            value={statistics.active}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-success-50)"
          />,
          <NotificationCardLayout
            key="inactive"
            icon={<XCircle />}
            title={`비활성 ${terms.GROUP_LABEL}`}
            value={statistics.inactive}
            unit="개"
            layoutMode="stats"
            iconBackgroundColor="var(--color-gray-100)"
          />,
          <NotificationCardLayout
            key="students"
            icon={<Users />}
            title={`전체 ${terms.PERSON_LABEL_PRIMARY} 수`}
            value={statistics.totalStudents}
            unit="명"
            layoutMode="stats"
            iconBackgroundColor="var(--color-primary-50)"
          />,
        ]}
        desktopColumns={4}
        tabletColumns={2}
        mobileColumns={2}
      />
    </div>
  );
}
