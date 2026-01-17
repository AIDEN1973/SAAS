/**
 * 학생 통계 SubPage
 *
 * [LAYER: UI_PAGE - SubPage]
 *
 * StudentsPage의 '학생 통계' 탭(statistics)을 담당하는 SubPage 컴포넌트
 * 8개 카테고리의 통계 지표를 시각화
 */

import React, { useMemo, createElement } from 'react';
import { Card, PageHeader, NotificationCardLayout, useResponsiveMode, isDesktop, EmptyState } from '@ui-core/react';
import { Users, UserCheck, Clock, UserX, TrendingUp, TrendingDown, UserPlus, Percent, BarChart3, GraduationCap } from 'lucide-react';
import { DistributionChart, HorizontalBarChart } from '../../../components/stats';
import { CardGridLayout } from '../../../components';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { StatsItem, PeriodFilter } from '../../../components/stats';
import type { Student, StudentConsultation } from '@services/student-service';
import { useStudentStats } from '../hooks/useStudentStats';
import { calculateTrend } from '../../../utils';

export interface StudentStatsSubPageProps {
  // 기간 필터
  statsPeriod: PeriodFilter;
  onStatsPeriodChange: (period: PeriodFilter) => void;

  // UI 설정
  currentSubMenuLabel: string;

  // 업종 중립 라벨
  terms: {
    PERSON_LABEL_PRIMARY: string;
    STAFF_LEAVE?: string;
    STAFF_RESIGNED?: string;
    TAG_LABEL?: string;
    CONSULTATION_LABEL_PLURAL?: string;
    CONSULTATION_TYPE_LABELS?: {
      counseling: string;
      learning: string;
      behavior: string;
      other: string;
    };
  };

  // 데이터 (부모 컴포넌트에서 전달)
  students?: Student[];
  consultations?: StudentConsultation[];
  tags?: Array<{ id: string; name: string; color: string }>;
  tagAssignments?: Array<{ student_id: string; tag_id: string }>;
  isLoading?: boolean;
}

export function StudentStatsSubPage({
  statsPeriod,
  onStatsPeriodChange,
  currentSubMenuLabel,
  terms,
  students = [],
  consultations = [],
  tags = [],
  tagAssignments = [],
  isLoading = false,
}: StudentStatsSubPageProps) {
  // 반응형 모드
  const mode = useResponsiveMode();
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isDesktopMode = isDesktop(modeUpper);

  // 통계 계산
  const {
    statusStats,
    lastMonthStatusStats,
    gradeDistribution,
    genderDistribution,
    tagDistribution,
    consultationTypeDistribution,
    kpiStats,
    chartData,
  } = useStudentStats({
    students,
    consultations,
    tags,
    tagAssignments,
    period: statsPeriod,
  });

  // 상단 통계 카드 데이터
  const statsItems: StatsItem[] = useMemo(() => {
    return [
      {
        key: 'total',
        icon: Users,
        title: `전체 ${terms.PERSON_LABEL_PRIMARY}`,
        value: statusStats.total,
        unit: '명',
        iconBackgroundColor: 'var(--color-primary-50)',
        trend: calculateTrend(statusStats.total, lastMonthStatusStats.total),
      },
      {
        key: 'active',
        icon: UserCheck,
        title: '재원',
        value: statusStats.active,
        unit: '명',
        iconBackgroundColor: 'var(--color-success-50)',
        trend: calculateTrend(statusStats.active, lastMonthStatusStats.active),
      },
      {
        key: 'onLeave',
        icon: Clock,
        title: terms.STAFF_LEAVE === '휴직' ? '휴원' : '휴회',
        value: statusStats.onLeave,
        unit: '명',
        iconBackgroundColor: 'var(--color-warning-50)',
        trend: calculateTrend(statusStats.onLeave, lastMonthStatusStats.onLeave),
      },
      {
        key: 'graduated',
        icon: GraduationCap,
        title: '졸업',
        value: statusStats.graduated,
        unit: '명',
        iconBackgroundColor: 'var(--color-info-50)',
        trend: calculateTrend(statusStats.graduated, lastMonthStatusStats.graduated),
      },
      {
        key: 'withdrawn',
        icon: UserX,
        title: terms.STAFF_RESIGNED === '퇴직' ? '퇴원' : '탈퇴',
        value: statusStats.withdrawn,
        unit: '명',
        iconBackgroundColor: 'var(--color-error-50)',
        trend: calculateTrend(statusStats.withdrawn, lastMonthStatusStats.withdrawn),
      },
    ];
  }, [statusStats, lastMonthStatusStats, terms.PERSON_LABEL_PRIMARY, terms.STAFF_LEAVE, terms.STAFF_RESIGNED]);

  // 통계 카드 컴포넌트 메모이제이션
  const statsCards = useMemo(
    () =>
      statsItems.map((item) => (
        <NotificationCardLayout
          key={item.key}
          icon={createElement(item.icon)}
          title={item.title}
          value={item.value}
          unit={item.unit}
          trend={statsPeriod === 'thisMonth' ? item.trend : undefined}
          layoutMode="stats"
          iconBackgroundColor={item.iconBackgroundColor}
        />
      )),
    [statsItems, statsPeriod]
  );

  // KPI 카드 데이터
  const kpiItems = useMemo(() => {
    return [
      {
        key: 'retentionRate',
        icon: Percent,
        title: '유지율',
        value: kpiStats.retentionRate,
        unit: '%',
        iconBackgroundColor: 'var(--color-success-50)',
        description: '재원 / 전체',
      },
      {
        key: 'monthlyGrowthRate',
        icon: kpiStats.monthlyGrowthRate >= 0 ? TrendingUp : TrendingDown,
        title: '월간 성장률',
        value: kpiStats.monthlyGrowthRate,
        unit: '%',
        iconBackgroundColor: kpiStats.monthlyGrowthRate >= 0 ? 'var(--color-success-50)' : 'var(--color-error-50)',
        description: '전월 대비',
      },
      {
        key: 'weeklyNewStudents',
        icon: UserPlus,
        title: '주간 신규',
        value: kpiStats.weeklyNewStudents,
        unit: '명',
        iconBackgroundColor: 'var(--color-primary-50)',
        description: '최근 7일',
      },
    ];
  }, [kpiStats]);

  // KPI 카드 컴포넌트 메모이제이션
  const kpiCards = useMemo(
    () =>
      kpiItems.map((item) => (
        <NotificationCardLayout
          key={item.key}
          icon={createElement(item.icon)}
          title={item.title}
          value={item.value}
          unit={item.unit}
          layoutMode="stats"
          iconBackgroundColor={item.iconBackgroundColor}
        />
      )),
    [kpiItems]
  );

  // 상담 유형 라벨 매핑
  const consultationDistributionWithLabels = useMemo(() => {
    if (!terms.CONSULTATION_TYPE_LABELS) return consultationTypeDistribution;

    const labels = terms.CONSULTATION_TYPE_LABELS;
    return consultationTypeDistribution.map((item) => ({
      ...item,
      name: labels[item.type as keyof typeof labels] || item.name,
    }));
  }, [consultationTypeDistribution, terms.CONSULTATION_TYPE_LABELS]);

  // 로딩 상태
  if (isLoading) {
    return (
      <>
        <PageHeader title={currentSubMenuLabel} style={{ marginBottom: 'var(--spacing-xl)' }} />
        <Card padding="lg" variant="default">
          <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            통계 데이터를 불러오는 중...
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {/* 타이틀 */}
      <PageHeader title={currentSubMenuLabel} style={{ marginBottom: 'var(--spacing-xl)' }} />

      {/* 섹션 1: 학생 현황 통계 카드 + 멀티라인 Area Chart */}
      <div style={{ marginBottom: 'calc(var(--spacing-xl) * 2)' }}>
        {/* 기간 필터 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            {[
              { value: 'thisMonth', label: '이번달' },
              { value: 'lastMonth', label: '지난달' },
              { value: '1month', label: '1m' },
              { value: '3months', label: '3m' },
              { value: '6months', label: '6m' },
              { value: '1year', label: '12m' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => onStatsPeriodChange(option.value as PeriodFilter)}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  backgroundColor: statsPeriod === option.value ? 'var(--color-primary)' : 'var(--color-white)',
                  color: statsPeriod === option.value ? 'var(--color-white)' : 'var(--color-text-secondary)',
                  border: statsPeriod === option.value ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                  borderRadius: 'var(--border-radius-xs)',
                  cursor: 'pointer',
                  transition: 'var(--transition-all)',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 통계 카드 */}
        <CardGridLayout
          cards={statsCards}
          desktopColumns={5}
          tabletColumns={3}
          mobileColumns={1}
        />

        {/* 멀티라인 Area Chart */}
        <div style={{ marginTop: 'var(--spacing-2xl)' }}>
          <Card padding="lg" variant="default">
            <div style={{ width: '100%', height: 380 }}>
              <style>
                {`
                  .recharts-wrapper,
                  .recharts-wrapper *,
                  .recharts-surface,
                  .recharts-surface * {
                    outline: none !important;
                  }
                `}
              </style>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={chartData} margin={{ left: 10, right: 40, top: 30, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                      tickFormatter={(value: number) => (value === 0 ? '' : value.toString())}
                      tickMargin={8}
                      width={30}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'var(--color-white)',
                        border: 'var(--border-width-thin) solid var(--color-gray-200)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: 'var(--spacing-sm)',
                      }}
                      formatter={(value, name) => {
                        const labels: Record<string, string> = {
                          total: `전체 ${terms.PERSON_LABEL_PRIMARY}`,
                          active: '재원',
                          onLeave: terms.STAFF_LEAVE === '휴직' ? '휴원' : '휴회',
                          graduated: '졸업',
                          withdrawn: terms.STAFF_RESIGNED === '퇴직' ? '퇴원' : '탈퇴',
                        };
                        return [`${String(value ?? 0)}명`, labels[String(name)] || String(name)];
                      }}
                      labelFormatter={(label) => `날짜: ${label}`}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 32 }}
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          total: `전체 ${terms.PERSON_LABEL_PRIMARY}`,
                          active: '재원',
                          onLeave: terms.STAFF_LEAVE === '휴직' ? '휴원' : '휴회',
                          graduated: '졸업',
                          withdrawn: terms.STAFF_RESIGNED === '퇴직' ? '퇴원' : '탈퇴',
                        };
                        return labels[value] || value;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="var(--color-primary-50)"
                      fillOpacity={0.3}
                      dot={{ fill: 'var(--color-primary)', r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="active"
                      stroke="var(--color-success)"
                      strokeWidth={2}
                      fill="var(--color-success-50)"
                      fillOpacity={0.3}
                      dot={{ fill: 'var(--color-success)', r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="onLeave"
                      stroke="var(--color-warning)"
                      strokeWidth={2}
                      fill="var(--color-warning-50)"
                      fillOpacity={0.3}
                      dot={{ fill: 'var(--color-warning)', r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="graduated"
                      stroke="var(--color-info)"
                      strokeWidth={2}
                      fill="var(--color-info-50)"
                      fillOpacity={0.3}
                      dot={{ fill: 'var(--color-info)', r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="withdrawn"
                      stroke="var(--color-error)"
                      strokeWidth={2}
                      fill="var(--color-error-50)"
                      fillOpacity={0.3}
                      dot={{ fill: 'var(--color-error)', r: 3 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon={BarChart3} message="표시할 데이터가 없습니다" />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* 섹션 2: 학년별/성별 분포 (2열 그리드) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktopMode ? '1fr 1fr' : '1fr',
          gap: 'var(--spacing-lg)',
          marginBottom: 'calc(var(--spacing-xl) * 2)',
        }}
      >
        <DistributionChart
          title="학년별 분포"
          data={gradeDistribution}
          unit="명"
          emptyMessage="학년 정보가 없습니다"
        />
        <DistributionChart
          title="성별 분포"
          data={genderDistribution}
          unit="명"
          emptyMessage="성별 정보가 없습니다"
        />
      </div>

      {/* 섹션 3: 태그별/상담 유형별 분포 (2열 그리드) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktopMode ? '1fr 1fr' : '1fr',
          gap: 'var(--spacing-lg)',
          marginBottom: 'calc(var(--spacing-xl) * 2)',
        }}
      >
        <HorizontalBarChart
          title={`${terms.TAG_LABEL || '태그'}별 ${terms.PERSON_LABEL_PRIMARY} 현황`}
          data={tagDistribution}
          unit="명"
          emptyMessage={`${terms.TAG_LABEL || '태그'} 정보가 없습니다`}
          maxItems={5}
        />
        <HorizontalBarChart
          title={`${terms.CONSULTATION_LABEL_PLURAL || '상담'} 유형별 현황`}
          data={consultationDistributionWithLabels}
          unit="건"
          emptyMessage={`${terms.CONSULTATION_LABEL_PLURAL || '상담'} 기록이 없습니다`}
          maxItems={5}
        />
      </div>

      {/* 섹션 4: 핵심 KPI 지표 (3열) */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          핵심 지표
        </div>
        <CardGridLayout
          cards={kpiCards}
          desktopColumns={3}
          tabletColumns={3}
          mobileColumns={1}
        />
      </div>
    </>
  );
}
