/**
 * 수업 통계 탭 컴포넌트
 * 수업별 상세 통계를 표시
 *
 * [LAYER: UI_PAGE]
 */

import { useMemo } from 'react';
import { Card } from '@ui-core/react';
import { useClasses } from '@hooks/use-class';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { DAYS_OF_WEEK } from '../constants';
import { StatisticsCards } from './StatisticsCards';
import type { DayOfWeek } from '@services/class-service';

export function ClassStatisticsTab() {
  const terms = useIndustryTerms();
  const { data: allClasses, isLoading } = useClasses({});

  // 상세 통계 계산
  const statistics = useMemo(() => {
    if (!allClasses) return null;

    // 요일별 수업 수
    const byDayOfWeek = DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day.value] = allClasses.filter(c => c.day_of_week === day.value).length;
      return acc;
    }, {} as Record<DayOfWeek, number>);

    // 상태별 수업 수
    const byStatus = {
      active: allClasses.filter(c => c.status === 'active').length,
      inactive: allClasses.filter(c => c.status === 'inactive').length,
    };

    // 정원 대비 현재 인원 비율
    const capacityStats = allClasses.reduce((acc, c) => {
      const ratio = c.current_count / c.capacity;
      if (ratio >= 0.9) acc.full++;
      else if (ratio >= 0.5) acc.medium++;
      else acc.low++;
      return acc;
    }, { full: 0, medium: 0, low: 0 });

    // 전체 통계
    const totalStudents = allClasses.reduce((sum, c) => sum + (c.current_count || 0), 0);
    const totalCapacity = allClasses.reduce((sum, c) => sum + c.capacity, 0);
    const avgCapacityRatio = totalCapacity > 0 ? (totalStudents / totalCapacity * 100) : 0;

    return {
      total: allClasses.length,
      byDayOfWeek,
      byStatus,
      capacityStats,
      totalStudents,
      totalCapacity,
      avgCapacityRatio,
    };
  }, [allClasses]);

  if (isLoading) {
    return (
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
          로딩 중...
        </div>
      </Card>
    );
  }

  if (!statistics) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 기본 통계 카드 */}
      <StatisticsCards />

      {/* 요일별 수업 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          요일별 {terms.GROUP_LABEL} 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--spacing-sm)' }}>
          {DAYS_OF_WEEK.map(day => (
            <div
              key={day.value}
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-md)',
                backgroundColor: statistics.byDayOfWeek[day.value] > 0 ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                {day.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                {statistics.byDayOfWeek[day.value]}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>개</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 정원 충족률 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          정원 충족률 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-md)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.capacityStats.full}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>90% 이상</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-warning-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
              {statistics.capacityStats.medium}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>50~90%</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
              {statistics.capacityStats.low}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>50% 미만</div>
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-md)', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>전체 평균 충족률</span>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {statistics.avgCapacityRatio.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>총 {terms.PERSON_LABEL_PRIMARY} / 총 정원</span>
            <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              {statistics.totalStudents}명 / {statistics.totalCapacity}명
            </span>
          </div>
        </div>
      </Card>

      {/* 상태별 분포 */}
      <Card padding="lg">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-md)' }}>
          상태별 분포
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-success-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
              {statistics.byStatus.active}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>운영 중</div>
          </div>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-secondary)' }}>
              {statistics.byStatus.inactive}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>중단</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
