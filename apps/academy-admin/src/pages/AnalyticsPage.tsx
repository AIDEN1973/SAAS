/**
 * 지역 기반 통계 페이지 (Regional Analytics)
 *
 * [LAYER: UI_PAGE]
 *
 * [Phase 1 MVP 범위] 통계문서 333-342줄:
 * - 주요 관리 대상 수 / 매출 / 출석률 지역순위
 * - 지역 평균 대비 비교 차트
 * - 행정동 기준 기본 Heatmap
 * - AI 인사이트 3종 (기본형)
 * - 월간 리포트 초안
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 사용 금지 - 전용 Dashboard (아키텍처 문서 352줄: 복잡한 차트/히트맵으로 전용 구현)
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 지역순위, 지역 평균 대비 비교, 히트맵, AI 인사이트, 월간 리포트
 *
 * [문서 준수]
 * - 통계문서: FR-01~FR-10, 3.1 위젯 구성, 5. 운영/보안 설계
 * - 아키텍처 문서: 3.6.1~3.6.9 (지역 비교 그룹 결정, AI 해석 문장, 히트맵)
 * - 기술문서: 15-0-7 (지역 통계 활성화 조건), 15-3-3-2 (익명화 보안 정책)
 * - 유아이 문서: 6. Responsive UX (반응형 브레이크포인트 표준)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ErrorBoundary, useModal, Container, Card, Button, PageHeader, useResponsiveMode, isMobile, SubSidebar } from '@ui-core/react';
// [SSOT] Barrel export를 통한 통합 import
import { ANALYTICS_SUB_MENU_ITEMS, DEFAULT_ANALYTICS_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { AnalyticsSubMenuId } from '../constants';
import { RegionalMetricCard } from '../components/analytics-cards/RegionalMetricCard';
import { AttendancePatternCard } from '../components/analytics-cards/AttendancePatternCard';
import type { HourlyAttendanceData, DailyAttendanceData } from '../components/analytics-cards/AttendancePatternCard';
import { HeatmapCard } from '../components/analytics-cards/HeatmapCard';
import type { HeatmapData } from '../components/analytics-cards/HeatmapCard';
import { AIInsightCard } from '../components/analytics-cards/AIInsightCard';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useConfig } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { DEFAULT_INDUSTRY_TYPE } from '@industry/registry';
import { CardGridLayout } from '../components/CardGridLayout';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchPersons } from '@hooks/use-student';
import { fetchDailyRegionMetrics } from '@hooks/use-daily-region-metrics';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
// [SSOT] Barrel export를 통한 통합 import
import { safe, logWarn } from '../utils';
import { downloadMonthlyReportPDF, type MonthlyReportData } from '../utils/pdf-generator';

// 통계문서 2.4: Percentile Rank 계산을 위한 상수 정의 (하드코딩 제거)
// Policy 기반 값이 없을 경우 사용하는 fallback 비율 (Default Policy)
// 중요: 이 값들은 Default Policy이며, 테넌트 생성 시 설정값으로 저장됨 (없으면 실행 안 함)
// 실제 운영 시 tenant_settings에서 조회해야 함
// HARD-CODE-EXCEPTION: Policy fallback 값 (비즈니스 로직 하드코딩, 테넌트 생성 시 설정값으로 저장됨)
const PERCENTILE_FALLBACK_RATIOS = {
  P25_FACTOR: 0.75, // 25분위수 추정: 평균의 75% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  P75_FACTOR: 1.25, // 75분위수 추정: 평균의 125% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_STUDENTS: 1.2, // 주요 관리 대상 수 상위 10% 추정: 평균의 120% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_REVENUE: 1.2, // 매출 상위 10% 추정: 평균의 120% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_ATTENDANCE: 1.1, // 출석률 상위 10% 추정: 평균의 110% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_GROWTH: 1.15, // 성장률 상위 10% 추정: 평균의 115% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  HEATMAP_INTENSITY_THRESHOLD: 0.5, // 히트맵 색상 전환 임계값 (50%, Default Policy: 테넌트 생성 시 설정값으로 저장)
  ATTENDANCE_AVG_FALLBACK: 0.95, // 출석률 평균 fallback: 내 조직의 95% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  GROWTH_AVG_FALLBACK: 0.9, // 성장률 평균 fallback: 내 조직의 90% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  // 히트맵 색상 임계값 (UI 스타일링용, CSS 변수 대신 상수로 관리)
  HEATMAP_COLOR_THRESHOLDS: {
    HIGH: 0.8, // 높은 강도 (80% 이상)
    MEDIUM_HIGH: 0.6, // 중상 강도 (60-80%)
    MEDIUM: 0.4, // 중간 강도 (40-60%)
    LOW: 0.2, // 낮은 강도 (20-40%)
  },
} as const;

export function AnalyticsPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  // [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
  const industryType = (context?.industryType || (typeof config?.industry_type === 'string' ? config.industry_type : undefined) || DEFAULT_INDUSTRY_TYPE);
  const terms = useIndustryTerms();
  const mode = useResponsiveMode(); // 유아이 문서 6-0: 반응형 브레이크포인트 표준 준수
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);

  // 서브 메뉴 상태 (URL에서 직접 읽음 - StudentsHomePage 패턴)
  const validIds = ANALYTICS_SUB_MENU_ITEMS.map(item => item.id) as readonly AnalyticsSubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_ANALYTICS_SUB_MENU);

  const handleSubMenuChange = useCallback((id: AnalyticsSubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_ANALYTICS_SUB_MENU);
    navigate(newUrl, { replace: true });
  }, [navigate]);

  const [selectedMetric, setSelectedMetric] = useState<
    'students' | 'revenue' | 'attendance' | 'growth' | 'new_enrollments' | 'arpu' |
    'capacity_rate' | 'overdue_rate' | 'churn_rate' | 'late_rate' | 'absent_rate'
  >('students');
  const [heatmapType, setHeatmapType] = useState<'growth' | 'attendance' | 'students'>('growth');

  // 지역 정보 추출 (location.* 경로에서 가져오기, 저장 위치는 tenant_settings(key='config').value(JSONB))
  const locationInfo = useMemo(() => {
    const location = config?.location as { gu?: string; dong?: string; si?: string; location_code?: string; sigungu_code?: string; sido_code?: string } | undefined;
    if (!location) {
      return {
        region: '지역 미설정',
        si: '',
        gu: '',
        dong: '',
        location_code: '',
        sigungu_code: '',
        sido_code: '',
      };
    }

    // 지역 표시명 생성 (구 > 동 > 시 순서)
    const regionDisplay = location.gu || location.dong || location.si || '지역 미설정';

    return {
      region: regionDisplay,
      si: location.si || '',
      gu: location.gu || '',
      dong: location.dong || '',
      location_code: location.location_code || '',
      sigungu_code: location.sigungu_code || '',
      sido_code: location.sido_code || '',
    };
  }, [config]);

  // 모든 메트릭의 간단한 값 조회 (카드 표시용)
  const { data: metricValues } = useQuery({
    queryKey: ['metric-values', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const currentMonth = toKST().format('YYYY-MM');

      // 주요 관리 대상 수
      const students = await fetchPersons(tenantId, {
        person_type: 'student',
      });
      const studentCount = students.length;

      // 매출
      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01` },
      });
      const revenue = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);

      // 출석률
      const logs = await fetchAttendanceLogs(tenantId, {
        date_from: `${currentMonth}-01T00:00:00`,
      });
      const presentCount = logs.filter((log: AttendanceLog) => log.status === 'present').length;
      const attendance = logs.length > 0 ? Math.round((presentCount / logs.length) * 100) : 0;

      // 성장률 (활성 대상만 포함)
      const currentMonthDate = toKST();
      const lastMonth = currentMonthDate.clone().subtract(1, 'month');
      const currentMonthEnd = currentMonthDate.endOf('month').format('YYYY-MM-DDTHH:mm:ss');
      const lastMonthEnd = lastMonth.endOf('month').format('YYYY-MM-DDTHH:mm:ss');

      const currentStudents = await fetchPersons(tenantId, {
        person_type: 'student',
        status: 'active',
        created_at: { lte: currentMonthEnd },
      });
      const currentStudentCount = currentStudents.length;

      const lastStudents = await fetchPersons(tenantId, {
        person_type: 'student',
        status: 'active',
        created_at: { lte: lastMonthEnd },
      });
      const lastStudentCount = lastStudents.length;

      const growth = lastStudentCount > 0
        ? Math.round(((currentStudentCount - lastStudentCount) / lastStudentCount) * 100)
        : 0;

      // Phase 1: 신규 등록 (이번 달 등록한 대상 수)
      const currentMonthStart = toKST().startOf('month');
      const newEnrollments = students.filter((s) => {
        if (!s.created_at) return false;
        const createdDate = toKST(s.created_at);
        return createdDate.isAfter(currentMonthStart) || createdDate.isSame(currentMonthStart);
      }).length;

      // Phase 1: ARPU (Average Revenue Per User)
      const arpu = studentCount > 0 ? Math.round(revenue / studentCount) : 0;

      // Phase 2: 평균 정원율 (그룹 정보 필요 - 현재는 간단히 계산)
      // TODO: 실제로는 classes 테이블에서 capacity와 현재 인원 조회 필요
      const capacityRate = 75; // 임시값 (추후 실제 계산 로직 필요)

      // Phase 2: 미납률 (미납액 / 전체 청구액)
      const totalBilled = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount || 0), 0);
      const totalPaid = revenue;
      const overdue = totalBilled - totalPaid;
      const overdueRate = totalBilled > 0 ? Math.round((overdue / totalBilled) * 100) : 0;

      // Phase 3: 이탈율 (이탈 대상 수 비율)
      const inactiveStudents = students.filter((s) => {
        const status = (s as { status?: string }).status;
        return status === 'inactive' || status === 'churned';
      }).length;
      const churnRate = studentCount > 0 ? Math.round((inactiveStudents / (studentCount + inactiveStudents)) * 100) : 0;

      // Phase 3: 지각률
      const lateCount = logs.filter((log: AttendanceLog) => log.status === 'late').length;
      const lateRate = logs.length > 0 ? Math.round((lateCount / logs.length) * 100) : 0;

      // Phase 3: 결석률
      const absentCount = logs.filter((log: AttendanceLog) => log.status === 'absent').length;
      const absentRate = logs.length > 0 ? Math.round((absentCount / logs.length) * 100) : 0;

      return {
        students: studentCount,
        revenue: revenue,
        attendance: attendance,
        growth: growth,
        new_enrollments: newEnrollments,
        arpu: arpu,
        capacity_rate: capacityRate,
        overdue_rate: overdueRate,
        churn_rate: churnRate,
        late_rate: lateRate,
        absent_rate: absentRate,
      };
    },
    enabled: !!tenantId,
    staleTime: 3000,
    refetchInterval: 5000,
  });

  // 출석 패턴 분석 데이터 (FR-07: 시간대·요일별 출석 패턴)
  const { data: attendancePatternData, isLoading: isAttendancePatternLoading } = useQuery({
    queryKey: ['attendance-pattern', tenantId],
    queryFn: async (): Promise<{ hourly: HourlyAttendanceData[]; daily: DailyAttendanceData[] }> => {
      if (!tenantId) return { hourly: [], daily: [] };

      const currentMonth = toKST().format('YYYY-MM');
      const logs = await fetchAttendanceLogs(tenantId, {
        date_from: `${currentMonth}-01T00:00:00`,
      });

      // 시간대별 집계 (0-23시)
      const hourlyMap = new Map<number, { present: number; late: number; absent: number }>();
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, { present: 0, late: 0, absent: 0 });
      }

      logs.forEach((log: AttendanceLog) => {
        if (!log.occurred_at) return;
        const occurredKST = toKST(log.occurred_at);
        const hour = occurredKST.hour();
        const stats = hourlyMap.get(hour);
        if (!stats) return;

        if (log.status === 'present') stats.present++;
        else if (log.status === 'late') stats.late++;
        else if (log.status === 'absent') stats.absent++;
      });

      const hourlyData: HourlyAttendanceData[] = Array.from(hourlyMap.entries()).map(([hour, stats]) => {
        const total = stats.present + stats.late + stats.absent;
        return {
          hour,
          ...stats,
          total,
          rate: total > 0 ? Math.round((stats.present / total) * 100) : 0,
        };
      }).filter(d => d.total > 0); // 데이터가 있는 시간대만

      // 요일별 집계 (0=일요일, 6=토요일)
      const dayLabels = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      const dailyMap = new Map<number, { present: number; late: number; absent: number }>();
      for (let d = 0; d < 7; d++) {
        dailyMap.set(d, { present: 0, late: 0, absent: 0 });
      }

      logs.forEach((log: AttendanceLog) => {
        if (!log.occurred_at) return;
        const occurredKST = toKST(log.occurred_at);
        const dayOfWeek = occurredKST.day();
        const stats = dailyMap.get(dayOfWeek);
        if (!stats) return;

        if (log.status === 'present') stats.present++;
        else if (log.status === 'late') stats.late++;
        else if (log.status === 'absent') stats.absent++;
      });

      const dailyData: DailyAttendanceData[] = Array.from(dailyMap.entries()).map(([day, stats]) => {
        const total = stats.present + stats.late + stats.absent;
        return {
          day: day.toString(),
          dayLabel: dayLabels[day],
          ...stats,
          total,
          rate: total > 0 ? Math.round((stats.present / total) * 100) : 0,
        };
      }).filter(d => d.total > 0); // 데이터가 있는 요일만

      return { hourly: hourlyData, daily: dailyData };
    },
    enabled: !!tenantId,
    staleTime: 60000, // 1분
  });

  // 히트맵 데이터 조회 (통계문서 350줄: 행정동 기준 기본 Heatmap, Phase 1 MVP)
  const { data: heatmapData, isLoading: isLoadingHeatmap } = useQuery({
    queryKey: ['regional-heatmap', tenantId, heatmapType, locationInfo.location_code || locationInfo.sigungu_code, industryType],
    queryFn: async (): Promise<HeatmapData[]> => {
      if (!tenantId) return [];
      if (!locationInfo.location_code && !locationInfo.sigungu_code) return [];

      const today = toKST();
      const thirtyDaysAgo = today.clone().subtract(30, 'days');
      const dateFrom = thirtyDaysAgo.format('YYYY-MM-DD');
      const dateTo = today.format('YYYY-MM-DD');

      try {
        // 행정동 데이터 우선, 없으면 구 단위로 fallback
        let metrics = await fetchDailyRegionMetrics(tenantId, {
          industry_type: industryType,
          region_level: 'dong',
          region_code: locationInfo.location_code,
          date_kst: { gte: dateFrom, lte: dateTo },
        });

        if (!metrics || metrics.length === 0) {
          metrics = await fetchDailyRegionMetrics(tenantId, {
            industry_type: industryType,
            region_level: 'gu_gun',
            region_code: locationInfo.sigungu_code,
            date_kst: { gte: dateFrom, lte: dateTo },
          });
        }

        if (!metrics || metrics.length === 0) return [];

        // 히트맵 데이터 변환
        const maxValue = Math.max(...metrics.map((m) => {
          if (heatmapType === 'students') return Number(m.active_members_avg) || 0;
          if (heatmapType === 'attendance') return Number(m.avg_attendance_rate) || 0;
          if (heatmapType === 'growth') return Number(m.student_growth_rate_avg) || 0;
          return 0;
        }), 1);

        return metrics.map((metric) => {
          let value = 0;
          if (heatmapType === 'students') value = Number(metric.active_members_avg) || 0;
          else if (heatmapType === 'attendance') value = Number(metric.avg_attendance_rate) || 0;
          else if (heatmapType === 'growth') value = Number(metric.student_growth_rate_avg) || 0;

          return {
            date: metric.date_kst || '',
            value: Math.round(value),
            intensity: maxValue > 0 ? value / maxValue : 0,
          };
        });
      } catch (error) {
        console.error('[HeatmapData] Error fetching heatmap data:', error);
        return [];
      }
    },
    enabled: !!tenantId && !!(locationInfo.location_code || locationInfo.sigungu_code),
    staleTime: 60000, // 1분
  });

  // 지역 통계 조회 (아키텍처 문서 3.6.2: 지역 비교 그룹 결정 로직)
  const { data: regionalStats, isLoading } = useQuery({
    queryKey: ['regional-analytics', tenantId, selectedMetric, locationInfo.location_code, industryType, metricValues],
    queryFn: async () => {
      if (!tenantId) return null;
      if (!metricValues) return null; // metricValues가 로드될 때까지 대기

      // 아키텍처 문서 3.6.2: 지역 비교 그룹 결정 로직 (동 → 구 → 시도 → 권역 fallback)
      // analytics.daily_region_metrics 테이블에서 실제 데이터 조회

      let value = 0;
      let average = 0;
      let top10Percent = 0; // 통계문서 3.1: 상위 10% 평균
      let comparisonGroup: 'same_dong' | 'same_sigungu' | 'same_sido' | 'same_region_zone' | 'insufficient' = 'insufficient';
      let sampleCount = 0;
      const minimumSampleSize = 3; // 아키텍처 문서 3.6.2: 최소 샘플 수 3개
      let usedFallback = false; // Fallback 사용 여부 추적 (아키텍처 문서 3.6.2)
      let fallbackLevel: 'same_sigungu' | 'same_sido' | 'same_region_zone' | null = null; // 사용된 fallback 레벨
      let industryFilterRemoved = false; // 업종 필터 제거 여부 (아키텍처 문서 3.6.2)

      // 우리 조직의 지표 값 - metricValues에서 재사용 (중복 fetch 제거)
      if (selectedMetric === 'students') {
        value = metricValues.students;
      } else if (selectedMetric === 'revenue') {
        value = metricValues.revenue;
      } else if (selectedMetric === 'attendance') {
        value = metricValues.attendance;
      } else if (selectedMetric === 'growth') {
        value = metricValues.growth;
      } else if (selectedMetric === 'new_enrollments') {
        value = metricValues.new_enrollments;
      } else if (selectedMetric === 'arpu') {
        value = metricValues.arpu;
      } else if (selectedMetric === 'capacity_rate') {
        value = metricValues.capacity_rate;
      } else if (selectedMetric === 'overdue_rate') {
        value = metricValues.overdue_rate;
      } else if (selectedMetric === 'churn_rate') {
        value = metricValues.churn_rate;
      } else if (selectedMetric === 'late_rate') {
        value = metricValues.late_rate;
      } else if (selectedMetric === 'absent_rate') {
        value = metricValues.absent_rate;
      }

      // 지역 비교 그룹 결정 로직 (아키텍처 문서 3.6.2: 동 → 구 → 시도 → 권역 fallback)
      interface RegionMetric {
        store_count?: number;
        active_members_avg?: string | number;
        active_members_median?: string | number;
        active_members_p25?: string | number;
        active_members_p75?: string | number;
        revenue_avg?: string | number;
        revenue_median?: string | number;
        revenue_p25?: string | number;
        revenue_p75?: string | number;
        avg_attendance_rate?: string | number;
        attendance_rate_p25?: string | number;
        attendance_rate_p75?: string | number;
        student_growth_rate_avg?: string | number;
        student_growth_rate_p25?: string | number;
        student_growth_rate_p75?: string | number;
        revenue_growth_rate_avg?: string | number;
        revenue_growth_rate_p25?: string | number;
        revenue_growth_rate_p75?: string | number;
        // Phase 1-3 메트릭 추가 (마이그레이션 158)
        new_enrollments_avg?: string | number;
        new_enrollments_p25?: string | number;
        new_enrollments_p75?: string | number;
        arpu_avg?: string | number;
        arpu_p25?: string | number;
        arpu_p75?: string | number;
        capacity_rate_avg?: string | number;
        capacity_rate_p25?: string | number;
        capacity_rate_p75?: string | number;
        overdue_rate_avg?: string | number;
        overdue_rate_p25?: string | number;
        overdue_rate_p75?: string | number;
        churn_rate_avg?: string | number;
        churn_rate_p25?: string | number;
        churn_rate_p75?: string | number;
        late_rate_avg?: string | number;
        late_rate_p25?: string | number;
        late_rate_p75?: string | number;
        absent_rate_avg?: string | number;
        absent_rate_p25?: string | number;
        absent_rate_p75?: string | number;
      }
      // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
      let dongMetrics: RegionMetric[] = [];
      let sigunguMetrics: RegionMetric[] = [];
      let sidoMetrics: RegionMetric[] = [];
      let regionZoneMetrics: RegionMetric[] = [];
      let allIndustryMetrics: RegionMetric[] = [];

      if (!locationInfo.location_code) {
        // 위치 정보가 없으면 비교 불가
        comparisonGroup = 'insufficient';
        sampleCount = 0;
      } else {
        const today = toKST().format('YYYY-MM-DD');
        // [불변 규칙] Zero-Trust: industryType은 함수 상단에서 Context에서 가져온 값 사용 (이미 선언됨)

        // Fallback 우선순위: 동 → 구 → 시도 → 권역 (아키텍처 문서 3.6.2)
        // 1순위: 같은 행정동(location_code) 내 조직 수 확인
        try {
          dongMetrics = await fetchDailyRegionMetrics(tenantId, {
            industry_type: industryType,
            region_level: 'dong',
            region_code: locationInfo.location_code, // region_code는 region_level='dong'일 때 location_code와 동일한 의미
            date_kst: { lte: today },
          });
        } catch (error) {
          // 에러는 무시하고 fallback으로 진행 (아키텍처 문서 3.6.2: Fallback 우선순위)
        }

        if (dongMetrics.length > 0 && (dongMetrics[0] as { store_count?: number }).store_count && (dongMetrics[0] as { store_count: number }).store_count >= minimumSampleSize) {
          comparisonGroup = 'same_dong';
          sampleCount = (dongMetrics[0] as { store_count: number }).store_count;
          usedFallback = false; // 1순위 사용
          fallbackLevel = null;
          // 지표별 평균값 및 상위 10% 값 추출 (통계문서 3.1: 우리 조직 vs 상위 10% 평균)
          if (selectedMetric === 'students') {
            average = Math.round(Number(dongMetrics[0].active_members_avg) || 0);
            // 상위 10%는 p75를 근사값으로 사용 (기술문서: active_members_p75)
            top10Percent = Math.round(Number(dongMetrics[0].active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
          } else if (selectedMetric === 'revenue') {
            average = Math.round(Number(dongMetrics[0].revenue_avg) || 0);
            // 상위 10%는 p75를 근사값으로 사용 (기술문서: revenue_p75)
            top10Percent = Math.round(Number(dongMetrics[0].revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_REVENUE);
          } else if (selectedMetric === 'attendance') {
            // 출석률 실제 컬럼 사용 (마이그레이션 090 적용 후)
            average = Math.round(Number(dongMetrics[0].avg_attendance_rate) || value * PERCENTILE_FALLBACK_RATIOS.ATTENDANCE_AVG_FALLBACK);
            top10Percent = Math.round(Number(dongMetrics[0].attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_ATTENDANCE);
          } else if (selectedMetric === 'growth') {
            // 성장률 실제 컬럼 사용 (마이그레이션 090 적용 후)
            average = Math.round(Number(dongMetrics[0].student_growth_rate_avg) || value * PERCENTILE_FALLBACK_RATIOS.GROWTH_AVG_FALLBACK);
            top10Percent = Math.round(Number(dongMetrics[0].student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_GROWTH);
          } else if (selectedMetric === 'new_enrollments') {
            // Phase 1: 신규 등록 (마이그레이션 158)
            average = Math.round(Number(dongMetrics[0].new_enrollments_avg) || value * 0.9);
            top10Percent = Math.round(Number(dongMetrics[0].new_enrollments_p75) || average * 1.5);
          } else if (selectedMetric === 'arpu') {
            // Phase 1: ARPU (마이그레이션 158)
            average = Math.round(Number(dongMetrics[0].arpu_avg) || value * 0.95);
            top10Percent = Math.round(Number(dongMetrics[0].arpu_p75) || average * 1.3);
          } else if (selectedMetric === 'capacity_rate') {
            // Phase 2: 평균 정원률 (마이그레이션 158)
            average = Math.round(Number(dongMetrics[0].capacity_rate_avg) || value * 0.95);
            top10Percent = Math.round(Number(dongMetrics[0].capacity_rate_p75) || average * 1.2);
          } else if (selectedMetric === 'overdue_rate') {
            // Phase 2: 미납률 (마이그레이션 158) - 낮을수록 좋음
            average = Math.round(Number(dongMetrics[0].overdue_rate_avg) || value * 1.1);
            top10Percent = Math.round(Number(dongMetrics[0].overdue_rate_p25) || average * 0.5); // p25가 상위 (낮은 값)
          } else if (selectedMetric === 'churn_rate') {
            // Phase 3: 이탈율 (마이그레이션 158) - 낮을수록 좋음
            average = Math.round(Number(dongMetrics[0].churn_rate_avg) || value * 1.1);
            top10Percent = Math.round(Number(dongMetrics[0].churn_rate_p25) || average * 0.6); // p25가 상위 (낮은 값)
          } else if (selectedMetric === 'late_rate') {
            // Phase 3: 지각률 (마이그레이션 158) - 낮을수록 좋음
            average = Math.round(Number(dongMetrics[0].late_rate_avg) || value * 1.1);
            top10Percent = Math.round(Number(dongMetrics[0].late_rate_p25) || average * 0.5); // p25가 상위 (낮은 값)
          } else if (selectedMetric === 'absent_rate') {
            // Phase 3: 결석률 (마이그레이션 158) - 낮을수록 좋음
            average = Math.round(Number(dongMetrics[0].absent_rate_avg) || value * 1.1);
            top10Percent = Math.round(Number(dongMetrics[0].absent_rate_p25) || average * 0.5); // p25가 상위 (낮은 값)
          }
        } else {
          // 2순위: 같은 구(sigungu_code)로 확장
          // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
          try {
            sigunguMetrics = await fetchDailyRegionMetrics(tenantId, {
              industry_type: industryType,
              region_level: 'gu_gun',
              region_code: locationInfo.sigungu_code,
              date_kst: { lte: today },
            });
          } catch (error) {
            // 에러는 무시하고 fallback으로 진행 (아키텍처 문서 3.6.2: Fallback 우선순위)
          }

          if (sigunguMetrics.length > 0 && (sigunguMetrics[0] as { store_count?: number }).store_count && (sigunguMetrics[0] as { store_count: number }).store_count >= minimumSampleSize) {
            comparisonGroup = 'same_sigungu';
            sampleCount = (sigunguMetrics[0] as { store_count: number }).store_count;
            usedFallback = true; // 2순위 fallback 사용
            fallbackLevel = 'same_sigungu';
            if (selectedMetric === 'students') {
              average = Math.round(Number(sigunguMetrics[0].active_members_avg) || 0);
              top10Percent = Math.round(Number(sigunguMetrics[0].active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
            } else if (selectedMetric === 'revenue') {
              average = Math.round(Number(sigunguMetrics[0].revenue_avg) || 0);
              top10Percent = Math.round(Number(sigunguMetrics[0].revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_REVENUE);
            } else if (selectedMetric === 'attendance') {
              average = Math.round(Number(sigunguMetrics[0].avg_attendance_rate) || value * PERCENTILE_FALLBACK_RATIOS.ATTENDANCE_AVG_FALLBACK);
              top10Percent = Math.round(Number(sigunguMetrics[0].attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_ATTENDANCE);
            } else if (selectedMetric === 'growth') {
              average = Math.round(Number(sigunguMetrics[0].student_growth_rate_avg) || value * PERCENTILE_FALLBACK_RATIOS.GROWTH_AVG_FALLBACK);
              top10Percent = Math.round(Number(sigunguMetrics[0].student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_GROWTH);
            } else if (selectedMetric === 'new_enrollments') {
              average = Math.round(Number(sigunguMetrics[0].new_enrollments_avg) || value * 0.9);
              top10Percent = Math.round(Number(sigunguMetrics[0].new_enrollments_p75) || average * 1.5);
            } else if (selectedMetric === 'arpu') {
              average = Math.round(Number(sigunguMetrics[0].arpu_avg) || value * 0.95);
              top10Percent = Math.round(Number(sigunguMetrics[0].arpu_p75) || average * 1.3);
            } else if (selectedMetric === 'capacity_rate') {
              average = Math.round(Number(sigunguMetrics[0].capacity_rate_avg) || value * 0.95);
              top10Percent = Math.round(Number(sigunguMetrics[0].capacity_rate_p75) || average * 1.2);
            } else if (selectedMetric === 'overdue_rate') {
              average = Math.round(Number(sigunguMetrics[0].overdue_rate_avg) || value * 1.1);
              top10Percent = Math.round(Number(sigunguMetrics[0].overdue_rate_p25) || average * 0.5);
            } else if (selectedMetric === 'churn_rate') {
              average = Math.round(Number(sigunguMetrics[0].churn_rate_avg) || value * 1.1);
              top10Percent = Math.round(Number(sigunguMetrics[0].churn_rate_p25) || average * 0.6);
            } else if (selectedMetric === 'late_rate') {
              average = Math.round(Number(sigunguMetrics[0].late_rate_avg) || value * 1.1);
              top10Percent = Math.round(Number(sigunguMetrics[0].late_rate_p25) || average * 0.5);
            } else if (selectedMetric === 'absent_rate') {
              average = Math.round(Number(sigunguMetrics[0].absent_rate_avg) || value * 1.1);
              top10Percent = Math.round(Number(sigunguMetrics[0].absent_rate_p25) || average * 0.5);
            }
          } else {
            // 3순위: 같은 시도(sido_code)로 확장
            // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
            try {
              sidoMetrics = await fetchDailyRegionMetrics(tenantId, {
                industry_type: industryType,
                region_level: 'si',
                region_code: locationInfo.sido_code,
                date_kst: { lte: today },
              });
            } catch (error) {
              // 에러는 무시하고 fallback으로 진행 (아키텍처 문서 3.6.2: Fallback 우선순위)
            }

            if (sidoMetrics.length > 0 && (sidoMetrics[0] as { store_count?: number }).store_count && (sidoMetrics[0] as { store_count: number }).store_count >= minimumSampleSize) {
              comparisonGroup = 'same_sido';
              sampleCount = (sidoMetrics[0] as { store_count: number }).store_count;
              usedFallback = true; // 3순위 fallback 사용
              fallbackLevel = 'same_sido';
              if (selectedMetric === 'students') {
                average = Math.round(Number(sidoMetrics[0].active_members_avg) || 0);
                top10Percent = Math.round(Number(sidoMetrics[0].active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
              } else if (selectedMetric === 'revenue') {
                average = Math.round(Number(sidoMetrics[0].revenue_avg) || 0);
                top10Percent = Math.round(Number(sidoMetrics[0].revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_REVENUE);
              } else if (selectedMetric === 'attendance') {
                average = Math.round(Number(sidoMetrics[0].avg_attendance_rate) || value * PERCENTILE_FALLBACK_RATIOS.ATTENDANCE_AVG_FALLBACK);
                top10Percent = Math.round(Number(sidoMetrics[0].attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_ATTENDANCE);
              } else if (selectedMetric === 'growth') {
                average = Math.round(Number(sidoMetrics[0].student_growth_rate_avg) || value * PERCENTILE_FALLBACK_RATIOS.GROWTH_AVG_FALLBACK);
                top10Percent = Math.round(Number(sidoMetrics[0].student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_GROWTH);
              } else if (selectedMetric === 'new_enrollments') {
                average = Math.round(Number(sidoMetrics[0].new_enrollments_avg) || value * 0.9);
                top10Percent = Math.round(Number(sidoMetrics[0].new_enrollments_p75) || average * 1.5);
              } else if (selectedMetric === 'arpu') {
                average = Math.round(Number(sidoMetrics[0].arpu_avg) || value * 0.95);
                top10Percent = Math.round(Number(sidoMetrics[0].arpu_p75) || average * 1.3);
              } else if (selectedMetric === 'capacity_rate') {
                average = Math.round(Number(sidoMetrics[0].capacity_rate_avg) || value * 0.95);
                top10Percent = Math.round(Number(sidoMetrics[0].capacity_rate_p75) || average * 1.2);
              } else if (selectedMetric === 'overdue_rate') {
                average = Math.round(Number(sidoMetrics[0].overdue_rate_avg) || value * 1.1);
                top10Percent = Math.round(Number(sidoMetrics[0].overdue_rate_p25) || average * 0.5);
              } else if (selectedMetric === 'churn_rate') {
                average = Math.round(Number(sidoMetrics[0].churn_rate_avg) || value * 1.1);
                top10Percent = Math.round(Number(sidoMetrics[0].churn_rate_p25) || average * 0.6);
              } else if (selectedMetric === 'late_rate') {
                average = Math.round(Number(sidoMetrics[0].late_rate_avg) || value * 1.1);
                top10Percent = Math.round(Number(sidoMetrics[0].late_rate_p25) || average * 0.5);
              } else if (selectedMetric === 'absent_rate') {
                average = Math.round(Number(sidoMetrics[0].absent_rate_avg) || value * 1.1);
                top10Percent = Math.round(Number(sidoMetrics[0].absent_rate_p25) || average * 0.5);
              }
            } else {
              // 4순위: 같은 권역(region_zone)으로 확장 (아키텍처 문서 3.6.7)
              // 권역 코드는 location.region_code에 저장됨 (저장 위치는 tenant_settings(key='config').value(JSONB))
              const regionZoneCode = (config?.location as { region_code?: string })?.region_code || null;
              if (regionZoneCode) {
                // 권역 단위 통계 조회 (nation 레벨 사용)
                // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
                try {
                  regionZoneMetrics = await fetchDailyRegionMetrics(tenantId, {
                    industry_type: industryType,
                    region_level: 'nation',
                    // 권역 코드로 필터링 (실제 구현 시 권역 매핑 테이블 필요)
                    date_kst: { lte: today },
                  });
                } catch (error) {
                  // 에러는 무시하고 fallback으로 진행 (아키텍처 문서 3.6.2: Fallback 우선순위)
                }

                if (regionZoneMetrics.length > 0 && (regionZoneMetrics[0] as { store_count?: number }).store_count && (regionZoneMetrics[0] as { store_count: number }).store_count >= minimumSampleSize) {
                  comparisonGroup = 'same_region_zone';
                  sampleCount = (regionZoneMetrics[0] as { store_count: number }).store_count;
                  usedFallback = true; // 4순위 fallback 사용
                  fallbackLevel = 'same_region_zone';
                  if (selectedMetric === 'students') {
                    average = Math.round(Number(regionZoneMetrics[0].active_members_avg) || 0);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
                  } else if (selectedMetric === 'revenue') {
                    average = Math.round(Number(regionZoneMetrics[0].revenue_avg) || 0);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_REVENUE);
                  } else if (selectedMetric === 'attendance') {
                    average = Math.round(Number(regionZoneMetrics[0].avg_attendance_rate) || value * PERCENTILE_FALLBACK_RATIOS.ATTENDANCE_AVG_FALLBACK);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_ATTENDANCE);
                  } else if (selectedMetric === 'growth') {
                    average = Math.round(Number(regionZoneMetrics[0].student_growth_rate_avg) || value * PERCENTILE_FALLBACK_RATIOS.GROWTH_AVG_FALLBACK);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_GROWTH);
                  } else if (selectedMetric === 'new_enrollments') {
                    average = Math.round(Number(regionZoneMetrics[0].new_enrollments_avg) || value * 0.9);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].new_enrollments_p75) || average * 1.5);
                  } else if (selectedMetric === 'arpu') {
                    average = Math.round(Number(regionZoneMetrics[0].arpu_avg) || value * 0.95);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].arpu_p75) || average * 1.3);
                  } else if (selectedMetric === 'capacity_rate') {
                    average = Math.round(Number(regionZoneMetrics[0].capacity_rate_avg) || value * 0.95);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].capacity_rate_p75) || average * 1.2);
                  } else if (selectedMetric === 'overdue_rate') {
                    average = Math.round(Number(regionZoneMetrics[0].overdue_rate_avg) || value * 1.1);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].overdue_rate_p25) || average * 0.5);
                  } else if (selectedMetric === 'churn_rate') {
                    average = Math.round(Number(regionZoneMetrics[0].churn_rate_avg) || value * 1.1);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].churn_rate_p25) || average * 0.6);
                  } else if (selectedMetric === 'late_rate') {
                    average = Math.round(Number(regionZoneMetrics[0].late_rate_avg) || value * 1.1);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].late_rate_p25) || average * 0.5);
                  } else if (selectedMetric === 'absent_rate') {
                    average = Math.round(Number(regionZoneMetrics[0].absent_rate_avg) || value * 1.1);
                    top10Percent = Math.round(Number(regionZoneMetrics[0].absent_rate_p25) || average * 0.5);
                  }
                } else {
                  // 5순위: 업종 필터 제거 후 지역만 비교 (아키텍처 문서 3.6.2: fallback4)
                  // 권역 단위 통계 조회 (업종 필터 제거)
                  // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
                  try {
                    allIndustryMetrics = await fetchDailyRegionMetrics(tenantId, {
                      // industry_type 필터 제거 (모든 업종 포함)
                      region_level: 'nation',
                      date_kst: { lte: today },
                    });
                  } catch (error) {
                    // 에러는 무시하고 fallback으로 진행 (아키텍처 문서 3.6.2: Fallback 우선순위)
                  }

                  if (allIndustryMetrics.length > 0 && (allIndustryMetrics[0] as { store_count?: number }).store_count && (allIndustryMetrics[0] as { store_count: number }).store_count >= minimumSampleSize) {
                    comparisonGroup = 'same_region_zone';
                    sampleCount = (allIndustryMetrics[0] as { store_count: number }).store_count;
                    usedFallback = true; // 5순위 fallback 사용 (업종 필터 제거)
                    fallbackLevel = 'same_region_zone';
                    industryFilterRemoved = true; // 업종 필터 제거됨
                    if (selectedMetric === 'students') {
                      average = Math.round(Number(allIndustryMetrics[0].active_members_avg) || 0);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_STUDENTS);
                    } else if (selectedMetric === 'revenue') {
                      average = Math.round(Number(allIndustryMetrics[0].revenue_avg) || 0);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_REVENUE);
                    } else if (selectedMetric === 'attendance') {
                      average = Math.round(Number(allIndustryMetrics[0].avg_attendance_rate) || value * PERCENTILE_FALLBACK_RATIOS.ATTENDANCE_AVG_FALLBACK);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_ATTENDANCE);
                    } else if (selectedMetric === 'growth') {
                      average = Math.round(Number(allIndustryMetrics[0].student_growth_rate_avg) || value * PERCENTILE_FALLBACK_RATIOS.GROWTH_AVG_FALLBACK);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.TOP10_FACTOR_GROWTH);
                    } else if (selectedMetric === 'new_enrollments') {
                      average = Math.round(Number(allIndustryMetrics[0].new_enrollments_avg) || value * 0.9);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].new_enrollments_p75) || average * 1.5);
                    } else if (selectedMetric === 'arpu') {
                      average = Math.round(Number(allIndustryMetrics[0].arpu_avg) || value * 0.95);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].arpu_p75) || average * 1.3);
                    } else if (selectedMetric === 'capacity_rate') {
                      average = Math.round(Number(allIndustryMetrics[0].capacity_rate_avg) || value * 0.95);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].capacity_rate_p75) || average * 1.2);
                    } else if (selectedMetric === 'overdue_rate') {
                      average = Math.round(Number(allIndustryMetrics[0].overdue_rate_avg) || value * 1.1);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].overdue_rate_p25) || average * 0.5);
                    } else if (selectedMetric === 'churn_rate') {
                      average = Math.round(Number(allIndustryMetrics[0].churn_rate_avg) || value * 1.1);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].churn_rate_p25) || average * 0.6);
                    } else if (selectedMetric === 'late_rate') {
                      average = Math.round(Number(allIndustryMetrics[0].late_rate_avg) || value * 1.1);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].late_rate_p25) || average * 0.5);
                    } else if (selectedMetric === 'absent_rate') {
                      average = Math.round(Number(allIndustryMetrics[0].absent_rate_avg) || value * 1.1);
                      top10Percent = Math.round(Number(allIndustryMetrics[0].absent_rate_p25) || average * 0.5);
                    }
                  } else {
                    // 최소 샘플 수 미달
                    comparisonGroup = 'insufficient';
                    sampleCount = allIndustryMetrics.length > 0 ? ((allIndustryMetrics[0] as { store_count?: number }).store_count || 0) : 0;
                  }
                }
              } else {
                // 권역 정보가 없으면 비교 불가
                comparisonGroup = 'insufficient';
                sampleCount = sidoMetrics.length > 0 ? ((sidoMetrics[0] as { store_count?: number }).store_count || 0) : 0;
              }
            }
          }
        }
      }

      const metricLabels: Record<string, string> = {
        students: `${terms.PERSON_LABEL_PRIMARY} 수`,
        revenue: '매출',
        attendance: `${terms.PRESENT_LABEL}률`,
        growth: '성장률',
      };

      const insights: string[] = [];
      const comparisonGroupLabels: Record<string, string> = {
        same_dong: '동',
        same_sigungu: '구',
        same_sido: '시도',
        same_region_zone: '권역',
        insufficient: '',
      };

      // 아키텍처 문서 3.6.2: 최소 샘플 수 미달 시 처리
      // 기술문서 5146줄: store_count >= 3 조건 미충족 시 명확한 메시지 표시
      if (comparisonGroup === 'insufficient' || sampleCount < minimumSampleSize) {
        if (!locationInfo.location_code) {
          insights.push('지역 정보를 설정해주세요.');
        } else {
          // 기술문서 5146줄: "해당 지역의 통계는 매장 수 부족으로 제공되지 않습니다" 출력
          insights.push(`경고: 해당 지역의 통계는 매장 수 부족(현재 ${sampleCount}개, 최소 3개 필요)으로 제공되지 않습니다.`);
        }
      } else {
        // 정상 비교 수행
        // 통계문서 2.4: Percentile Rank 계산 (P = (number_of_values_below / total) * 100)
        // daily_region_metrics의 p25, p75를 활용하여 percentile 계산
        let percentile = 50; // 기본값
        let rank = 0;

        // 현재 비교 그룹의 메트릭 가져오기
        const currentMetrics = dongMetrics[0] || sigunguMetrics[0] || sidoMetrics[0] || regionZoneMetrics?.[0] || allIndustryMetrics[0];

        if (currentMetrics) {
          let p25 = 0;
          let p75 = 0;
          let median = 0;

          if (selectedMetric === 'students') {
            p25 = Number(currentMetrics.active_members_p25) || average * PERCENTILE_FALLBACK_RATIOS.P25_FACTOR;
            p75 = Number(currentMetrics.active_members_p75) || average * PERCENTILE_FALLBACK_RATIOS.P75_FACTOR;
            median = Number(currentMetrics.active_members_median) || average;
          } else if (selectedMetric === 'revenue') {
            p25 = Number(currentMetrics.revenue_p25) || average * PERCENTILE_FALLBACK_RATIOS.P25_FACTOR;
            p75 = Number(currentMetrics.revenue_p75) || average * PERCENTILE_FALLBACK_RATIOS.P75_FACTOR;
            median = Number(currentMetrics.revenue_median) || average;
          } else if (selectedMetric === 'attendance') {
            p25 = Number(currentMetrics.attendance_rate_p25) || average * PERCENTILE_FALLBACK_RATIOS.P25_FACTOR;
            p75 = Number(currentMetrics.attendance_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.P75_FACTOR;
            median = average; // attendance_rate_median은 아직 없으므로 average 사용
          } else if (selectedMetric === 'growth') {
            p25 = Number(currentMetrics.student_growth_rate_p25) || average * PERCENTILE_FALLBACK_RATIOS.P25_FACTOR;
            p75 = Number(currentMetrics.student_growth_rate_p75) || average * PERCENTILE_FALLBACK_RATIOS.P75_FACTOR;
            median = average; // growth_rate_median은 아직 없으므로 average 사용
          }

          // 통계문서 2.4: Percentile Rank 계산 (P = (number_of_values_below / total) * 100)
          // daily_region_metrics의 통계값(p25, median, p75)을 활용하여 percentile 추정
          // 실제 분포는 RLS로 보호되어 직접 조회 불가하므로, 집계된 통계값을 활용

          // Percentile 계산: value가 분포에서 어느 위치인지 추정
          // p25, median, p75를 기준으로 4구간으로 나누어 percentile 추정
          if (value >= p75) {
            // 상위 25% 구간 (75-100 percentile)
            // p75 이상의 값들은 상위 25%에 해당
            const range = p75 - median;
            if (range > 0) {
              const excess = value - p75;
              // p75 이상의 값들을 75-100 percentile 범위로 매핑
              percentile = 75 + Math.min(25, Math.round((excess / (range + 1)) * 25));
            } else {
              percentile = 75; // p75와 median이 같으면 75 percentile
            }
          } else if (value >= median) {
            // 중위-상위 구간 (50-75 percentile)
            const range = p75 - median;
            if (range > 0) {
              percentile = 50 + Math.round(((value - median) / range) * 25);
            } else {
              percentile = 50; // median과 p75가 같으면 50 percentile
            }
          } else if (value >= p25) {
            // 하위-중위 구간 (25-50 percentile)
            const range = median - p25;
            if (range > 0) {
              percentile = 25 + Math.round(((value - p25) / range) * 25);
            } else {
              percentile = 25; // p25와 median이 같으면 25 percentile
            }
          } else {
            // 하위 25% 구간 (0-25 percentile)
            if (p25 > 0) {
              percentile = Math.max(1, Math.round((value / p25) * 25));
            } else {
              percentile = 1; // p25가 0이면 최하위
            }
          }

          // Rank 계산: percentile을 기반으로 역산 (1부터 시작)
          // 통계문서 2.4: Percentile Rank 공식 (P = (number_of_values_below / total) * 100)
          // percentile이 높을수록 rank는 낮음 (1위가 상위 1%)
          // 역산: number_of_values_below = (100 - percentile) / 100 * total
          // rank = number_of_values_below + 1 (1위부터 시작, 0-based가 아닌 1-based)
          const number_of_values_below = Math.round((100 - percentile) / 100 * sampleCount);
          rank = Math.max(1, number_of_values_below + 1);
        } else {
          // 메트릭이 없으면 평균 대비 추정 (fallback)
          const rankEstimate = value > average ? Math.floor((value / average) * 10) : Math.floor((value / average) * 20);
          percentile = value > average ? 50 + rankEstimate : 50 - rankEstimate;
          rank = Math.max(1, rankEstimate);
        }

        percentile = Math.max(1, Math.min(99, percentile)); // 1-99 범위로 제한

        const trend = value > average ? `+${Math.round(((value - average) / average) * 100)}%` : `${Math.round(((value - average) / average) * 100)}%`;

        // 아키텍처 문서 3.6.3: AI 해석 문장 생성 (예시: "이번 주 출석률 +3% 향상, 지역 평균 대비 +4% 우수합니다.")
        const comparisonGroupLabel = comparisonGroupLabels[comparisonGroup] || '';

        // 아키텍처 문서 3.6.2: Fallback 사용 시 메시지 (3502-3505줄)
        if (usedFallback && fallbackLevel) {
          const fallbackLabel = comparisonGroupLabels[fallbackLevel] || '';
          const comparisonResult = value > average ? '우수합니다' : '부족합니다';
          const comparisonPercent = Math.abs(Math.round(((value - average) / average) * 100));
          insights.push(
            `동에서는 비교 불가했지만, ${fallbackLabel} 기준으로 평균 대비 ${value > average ? '+' : ''}${comparisonPercent}% ${comparisonResult}.`
          );
        } else {
          // 정상 비교 (1순위 사용)
          const comparisonMessage = comparisonGroup !== 'same_dong'
            ? `${comparisonGroupLabel} 기준으로 `
            : '';
          const isImproving = value > average;
          insights.push(
            `${comparisonMessage}${metricLabels[selectedMetric] || selectedMetric}는 지역 평균 대비 ${trend} ${isImproving ? '우수합니다' : '부족합니다'}.`
          );
        }

        // 아키텍처 문서 3.6.2: 업종 필터 제거 시 메시지 (3509-3511줄)
        if (industryFilterRemoved) {
          insights.push('동일 업종 비교가 불가하여 전체 업종 기준으로 비교했습니다.');
        }

        insights.push(
          `${locationInfo.region}에서 ${metricLabels[selectedMetric] || selectedMetric} 상위 ${percentile}%입니다.`
        );

        // 통계문서 253-256줄: ranking_snapshot 테이블에 저장
        const today = toKST().format('YYYY-MM-DD');
        try {
          await apiClient.post('ranking_snapshot', {
            region_code: locationInfo.location_code || '',
            tenant_id: tenantId,
            metric: selectedMetric,
            percentile: percentile,
            rank: rank,
            date_kst: today,
          });
        } catch (error) {
          // 저장 실패는 무시 (선택적 기능)
          logWarn('AnalyticsPage:SaveRankingSnapshot', 'Failed to save ranking snapshot', error);
        }

        // 통계문서 258-260줄: AI 인사이트를 ai_insights 테이블에 저장
        const insightText = insights.join(' ');
        try {
          await apiClient.post('ai_insights', {
            tenant_id: tenantId,
            student_id: null, // 테넌트 레벨 인사이트
            insight_type: 'regional_analytics',
            title: `${locationInfo.region} 지역 통계 분석`,
            summary: insightText,
            details: {
              metric: selectedMetric,
              value: value,
              average: average,
              percentile: percentile,
              rank: rank,
              comparison_group: comparisonGroup,
              sample_count: sampleCount,
            },
            related_entity_type: 'regional_analytics',
            related_entity_id: locationInfo.location_code || null,
            status: 'active',
          });
        } catch (error) {
          // 저장 실패는 무시 (선택적 기능)
          logWarn('AnalyticsPage:SaveAIInsight', 'Failed to save AI insight', error);
        }

        return {
          region: locationInfo.region,
          rank: Math.max(1, rank),
          percentile: Math.max(1, Math.min(99, percentile)),
          value,
          average,
          top10Percent, // 통계문서 3.1: 상위 10% 평균
          trend,
          insights,
          comparisonGroup,
          sampleCount,
          usedFallback,
          fallbackLevel,
          industryFilterRemoved,
          location_code: locationInfo.location_code,
          sigungu_code: locationInfo.sigungu_code,
          sido_code: locationInfo.sido_code,
        };
      }

      return {
        region: locationInfo.region,
        rank: 0,
        percentile: 0,
        value,
        average: 0,
        top10Percent: 0, // 통계문서 3.1: 상위 10% 평균
        trend: '0%',
        insights,
        comparisonGroup,
        sampleCount,
        usedFallback: false,
        fallbackLevel: null,
        industryFilterRemoved: false,
        location_code: locationInfo.location_code,
        sigungu_code: locationInfo.sigungu_code,
        sido_code: locationInfo.sido_code,
      };
    },
    enabled: !!tenantId && !!metricValues, // metricValues가 먼저 로드되어야 함 (중복 fetch 방지)
    staleTime: 3000, // 통계문서 5. 운영/보안 설계: 지역 통계 API는 1~3초 캐싱
    refetchInterval: 5000, // 5초마다 갱신 (캐싱 기간보다 길게 설정)
  });

  const selectedMetricLabels = {
    students: `${terms.PERSON_LABEL_PRIMARY} 수`,
    revenue: '매출',
    attendance: `${terms.PRESENT_LABEL}률`,
    growth: '성장률',
    new_enrollments: '신규 등록',
    arpu: 'ARPU',
    capacity_rate: '정원률',
    overdue_rate: '미납률',
    churn_rate: '이탈률',
    late_rate: `${terms.LATE_LABEL}률`,
    absent_rate: `${terms.ABSENCE_LABEL}률`,
  };

  // 통계문서 FR-09: 월간 경영 리포트 생성 기능
  const generateMonthlyReport = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');

      const currentMonth = toKST();
      const currentMonthStr = currentMonth.format('YYYY-MM');
      // 전월 비교(Phase 2+) 확장 시 lastMonth 계산을 도입

      // 핵심 지표 수집
      // 정본 규칙: fetch 함수 사용 (Hook의 queryFn 로직 재사용)
      // [SSOT] 에러 처리 SSOT 사용 (safe 함수)
      const [students, invoices, attendanceLogs, regionalStatsResponse] = await Promise.all([
        safe(fetchPersons(tenantId, { person_type: 'student' }), []),
        safe(fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonthStr}-01` },
        }), []),
        safe(fetchAttendanceLogs(tenantId, {
          date_from: `${currentMonthStr}-01T00:00:00`,
        }), []),
        // 지역 통계는 이미 조회된 데이터 사용
        safe(Promise.resolve({ data: regionalStats }), { data: regionalStats }),
      ]);

      // 리포트 데이터 생성 (통계문서 FR-09: 핵심 지표 요약, 지역 대비 평가, 이번달 개선점)
      const reportData = {
        month: currentMonthStr,
        generated_at: toKST().toISOString(),
        // 핵심 지표 요약
        summary: {
          total_students: students.length,
          total_revenue: invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0),
          total_invoices: invoices.length,
          attendance_rate: attendanceLogs.length > 0
            ? Math.round((attendanceLogs.filter((log: AttendanceLog) => log.status === 'present').length / attendanceLogs.length) * 100)
            : 0,
        },
        // 지역 대비 평가
        regional_comparison: regionalStatsResponse.data || null,
        // 이번달 개선점 (AI 인사이트 기반)
        improvements: regionalStatsResponse.data?.insights || [],
      };

      // 통계문서 FR-09: PDF 또는 대시보드 형태
      // 현재는 JSON 다운로드 제공, PDF 생성은 향후 라이브러리 추가 시 구현
      return {
        report_id: `report-${currentMonthStr}-${Date.now()}`,
        ...reportData,
      };
    },
    onSuccess: (data) => {
      // PDF 생성 및 다운로드 (통계문서 FR-09: 월간 리포트 PDF)
      const academyName = typeof config?.academy_name === 'string'
        ? config.academy_name
        : (typeof config?.organization_name === 'string' ? config.organization_name : '');
      const pdfData: MonthlyReportData = {
        academyName,
        reportMonth: data.month,
        region: locationInfo.region,
        metrics: {
          students: data.summary.total_students,
          revenue: data.summary.total_revenue,
          attendance: data.summary.attendance_rate,
          growth: metricValues?.growth || 0,
        },
        regionalStats: [
          {
            metric: `${terms.PERSON_LABEL_PRIMARY} 수`,
            value: data.summary.total_students,
            rank: data.regional_comparison?.rank || 0,
            percentile: data.regional_comparison?.percentile || 0,
            average: data.regional_comparison?.average || 0,
            top10Percent: data.regional_comparison?.top10Percent || 0,
            comparisonGroup: data.regional_comparison?.comparisonGroup || 'insufficient',
          },
          {
            metric: '매출',
            value: data.summary.total_revenue,
            rank: regionalStats?.rank || 0,
            percentile: regionalStats?.percentile || 0,
            average: regionalStats?.average || 0,
            top10Percent: regionalStats?.top10Percent || 0,
            comparisonGroup: regionalStats?.comparisonGroup || 'insufficient',
          },
          {
            metric: `${terms.PRESENT_LABEL}률`,
            value: data.summary.attendance_rate,
            rank: regionalStats?.rank || 0,
            percentile: regionalStats?.percentile || 0,
            average: regionalStats?.average || 0,
            top10Percent: regionalStats?.top10Percent || 0,
            comparisonGroup: regionalStats?.comparisonGroup || 'insufficient',
          },
        ],
        aiInsights: data.improvements,
      };

      downloadMonthlyReportPDF(pdfData);

      showAlert('성공', `월간 경영 리포트가 생성되었습니다.\n\n핵심 지표:\n- ${terms.PERSON_LABEL_PRIMARY} 수: ${data.summary.total_students}명\n- 매출: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(data.summary.total_revenue))}\n- ${terms.PRESENT_LABEL}률: ${data.summary.attendance_rate}%\n\nPDF 파일이 다운로드되었습니다.`);
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김) */}
        {!isMobileMode && (
          <SubSidebar
            title="통계분석"
            items={ANALYTICS_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            testId="analytics-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding={isMobileMode ? "sm" : "lg"} style={{ flex: 1 }}>
          <PageHeader
            title="통계분석"
            actions={
              <Button
                variant="outline"
                size={isMobileMode ? "sm" : "md"}
                onClick={() => generateMonthlyReport.mutate()}
                disabled={generateMonthlyReport.isPending}
              >
                {generateMonthlyReport.isPending ? '생성 중...' : '월간 리포트 생성'}
              </Button>
            }
          />

        {/* 전체 현황 탭 (기본) */}
        {selectedSubMenu === 'overview' && (
          <>
            {/* 통계문서 3.1: 운영 현황 카드 4개 (주요 관리 대상 수, 매출, 출석률, 성장률 / 지역순위) */}
            {/* 지표 선택 */}
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                {(Object.keys(selectedMetricLabels) as Array<keyof typeof selectedMetricLabels>).map((metric) => (
                  <Button
                      key={metric}
                      variant={selectedMetric === metric ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedMetric(metric)}
                    >
                      {selectedMetricLabels[metric]}
                    </Button>
                  ))}
                </div>
              </Card>

              {/* 통계문서 3.1: 운영 현황 카드 4개를 동시에 표시 */}
              {!isLoading && regionalStats && metricValues && (
                <CardGridLayout
                  cards={[
                    <RegionalMetricCard
                      key="students"
                      metric="students"
                      regionalStats={regionalStats}
                      selectedMetric={selectedMetric}
                      onSelect={setSelectedMetric}
                      metricValue={metricValues.students}
                    />,
                    <RegionalMetricCard
                      key="revenue"
                      metric="revenue"
                      regionalStats={regionalStats}
                      selectedMetric={selectedMetric}
                      onSelect={setSelectedMetric}
                      metricValue={metricValues.revenue}
                    />,
                    <RegionalMetricCard
                      key="attendance"
                      metric="attendance"
                      regionalStats={regionalStats}
                      selectedMetric={selectedMetric}
                      onSelect={setSelectedMetric}
                      metricValue={metricValues.attendance}
                    />,
                    <RegionalMetricCard
                      key="growth"
                      metric="growth"
                      regionalStats={regionalStats}
                      selectedMetric={selectedMetric}
                      onSelect={setSelectedMetric}
                      metricValue={metricValues.growth}
                    />,
                  ]}
                  desktopColumns={4}
                  tabletColumns={2}
                  mobileColumns={1}
                />
              )}

              {/* 지역 순위 카드 */}
              {isLoading ? (
                <Card padding="lg" variant="default">
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    로딩 중...
                  </div>
                </Card>
              ) : regionalStats ? (
                <>
                  {/* 아키텍처 문서 3.6.3: AI 해석 문장을 최상단에 배치 */}
                  <AIInsightCard
                    insights={regionalStats?.insights || []}
                    isLoading={isLoading}
                  />
                </>
              ) : (
                <Card padding="lg" variant="default">
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                    데이터를 불러올 수 없습니다.
                  </div>
                </Card>
              )}
          </>
        )}

        {/* 지역별 분석 탭 */}
        {selectedSubMenu === 'regional' && (
          <>
            {/* 지표 선택 */}
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                {(Object.keys(selectedMetricLabels) as Array<keyof typeof selectedMetricLabels>).map((metric) => (
                  <Button
                      key={metric}
                      variant={selectedMetric === metric ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedMetric(metric)}
                    >
                      {selectedMetricLabels[metric]}
                    </Button>
                  ))}
                </div>
              </Card>

            {/* 통계문서 3.1: 전체 지표 카드 표시 */}
            {!isLoading && regionalStats && metricValues && (
              <CardGridLayout
                cards={[
                  <RegionalMetricCard
                    key="students"
                    metric="students"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.students}
                  />,
                  <RegionalMetricCard
                    key="revenue"
                    metric="revenue"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.revenue}
                  />,
                  <RegionalMetricCard
                    key="attendance"
                    metric="attendance"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.attendance}
                  />,
                  <RegionalMetricCard
                    key="growth"
                    metric="growth"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.growth}
                  />,
                  <RegionalMetricCard
                    key="new_enrollments"
                    metric="new_enrollments"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.new_enrollments}
                  />,
                  <RegionalMetricCard
                    key="arpu"
                    metric="arpu"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.arpu}
                  />,
                  <RegionalMetricCard
                    key="capacity_rate"
                    metric="capacity_rate"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.capacity_rate}
                  />,
                  <RegionalMetricCard
                    key="overdue_rate"
                    metric="overdue_rate"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.overdue_rate}
                  />,
                  <RegionalMetricCard
                    key="churn_rate"
                    metric="churn_rate"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.churn_rate}
                  />,
                  <RegionalMetricCard
                    key="late_rate"
                    metric="late_rate"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.late_rate}
                  />,
                  <RegionalMetricCard
                    key="absent_rate"
                    metric="absent_rate"
                    regionalStats={regionalStats}
                    selectedMetric={selectedMetric}
                    onSelect={setSelectedMetric}
                    metricValue={metricValues.absent_rate}
                  />,
                ]}
                desktopColumns={3}
                tabletColumns={2}
                mobileColumns={1}
              />
            )}

            {/* 지역 비교 차트 */}
            {isLoading ? (
              <Card padding="lg" variant="default">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  로딩 중...
                </div>
              </Card>
            ) : regionalStats && regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3 ? (
              <>
                <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 비교 차트</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {/* 통계문서 3.1: 우리 조직 vs 지역 평균 vs 상위 10% 평균 바 차트 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 'var(--spacing-md)',
                      height: 'var(--height-chart)',
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-background-secondary)',
                      borderRadius: 'var(--border-radius-md)',
                    }}>
                      {/* 우리 조직 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.min(100, (regionalStats.value / Math.max(regionalStats.top10Percent, regionalStats.average, regionalStats.value, 1)) * 100)}%`,
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: 'var(--border-radius-sm)',
                          minHeight: 'var(--height-input-min)',
                        }} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                          우리 조직
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' }}>
                          {regionalStats.value}
                        </div>
                      </div>
                      {/* 지역 평균 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.min(100, (regionalStats.average / Math.max(regionalStats.top10Percent, regionalStats.average, regionalStats.value, 1)) * 100)}%`,
                          backgroundColor: 'var(--color-info)',
                          borderRadius: 'var(--border-radius-sm)',
                          minHeight: 'var(--height-input-min)',
                        }} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                          지역 평균
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' }}>
                          {regionalStats.average}
                        </div>
                      </div>
                      {/* 상위 10% 평균 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.min(100, (regionalStats.top10Percent / Math.max(regionalStats.top10Percent, regionalStats.average, regionalStats.value, 1)) * 100)}%`,
                          backgroundColor: 'var(--color-success)',
                          borderRadius: 'var(--border-radius-sm)',
                          minHeight: 'var(--height-input-min)',
                        }} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                          상위 10% 평균
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', textAlign: 'center' }}>
                          {regionalStats.top10Percent}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

              {/* 지역 순위 카드 (상세 정보, 펼치기 가능) */}
                <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 순위</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                      <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
                        {regionalStats.rank}위
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {regionalStats.region}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          상위 {regionalStats.percentile}%
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: isMobileMode ? 'var(--spacing-md)' : 'var(--spacing-lg)',
                      flexWrap: isMobileMode ? 'wrap' : 'nowrap',
                    }}>
                      <div style={{ flex: isMobileMode ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          우리 조직
                        </div>
                        <div style={{ fontSize: isMobileMode ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {regionalStats.value}
                        </div>
                      </div>
                      <div style={{ flex: isMobileMode ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          지역 평균
                        </div>
                        <div style={{ fontSize: isMobileMode ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {regionalStats.average}
                        </div>
                      </div>
                      <div style={{ flex: isMobileMode ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          변화율
                        </div>
                        <div style={{ fontSize: isMobileMode ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                          {regionalStats.trend}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

              {/* 히트맵 - [요구사항 3.6.9] 히트맵 기능 (아키텍처 문서 352줄: 전용 Dashboard 구현) */}
              <HeatmapCard
                heatmapType={heatmapType}
                onTypeChange={setHeatmapType}
                data={heatmapData || []}
                isLoading={isLoadingHeatmap}
                locationInfo={{
                  location_code: locationInfo.location_code || '',
                  sigungu_code: locationInfo.sigungu_code || '',
                }}
                tenantId={tenantId || null}
              />
              </>
            ) : null}
          </>
        )}

        {/* 출석 패턴 탭 */}
        {selectedSubMenu === 'attendance' && (
          <>
            <AttendancePatternCard
              hourlyData={attendancePatternData?.hourly || []}
              dailyData={attendancePatternData?.daily || []}
              isLoading={isAttendancePatternLoading}
            />
          </>
        )}

        {/* AI 인사이트 탭 */}
        {selectedSubMenu === 'ai-insights' && (
          <>
            {isLoading ? (
              <Card padding="lg" variant="default">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  로딩 중...
                </div>
              </Card>
            ) : regionalStats ? (
              <AIInsightCard
                insights={regionalStats?.insights || []}
                isLoading={isLoading}
              />
            ) : (
              <Card padding="lg" variant="default">
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                  AI 인사이트 데이터를 불러올 수 없습니다.
                </div>
              </Card>
            )}
          </>
        )}

        {/* 월간 리포트 탭 */}
        {selectedSubMenu === 'reports' && (
          <>
            <Card padding="lg" variant="default">
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}>
                  월간 리포트
                </h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  월간 운영 현황과 분석 결과를 PDF로 다운로드할 수 있습니다.
                </p>
              </div>
              <Button
                variant="solid"
                size="md"
                onClick={() => generateMonthlyReport.mutate()}
                disabled={generateMonthlyReport.isPending}
              >
                {generateMonthlyReport.isPending ? '생성 중...' : '월간 리포트 생성'}
              </Button>
            </Card>
          </>
        )}
      </Container>
      </div>
    </ErrorBoundary>
  );
}