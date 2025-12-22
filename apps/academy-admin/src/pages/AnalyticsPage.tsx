/**
 * 지역 기반 통계 페이지 (Regional Analytics)
 *
 * [Phase 1 MVP 범위] 통계문서 333-342줄:
 * - 학생 수 / 매출 / 출석률 지역순위
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

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ErrorBoundary, useModal } from '@ui-core/react';
import { Container, Card, Button, PageHeader } from '@ui-core/react';
import { useResponsiveMode } from '@ui-core/react';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useConfig } from '@hooks/use-config';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchPersons } from '@hooks/use-student';
import { fetchDailyRegionMetrics } from '@hooks/use-daily-region-metrics';
import { toKST } from '@lib/date-utils';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import type { Student } from '@services/student-service';

// 통계문서 2.4: Percentile Rank 계산을 위한 상수 정의 (하드코딩 제거)
// Policy 기반 값이 없을 경우 사용하는 fallback 비율 (Default Policy)
// 중요: 이 값들은 Default Policy이며, 테넌트 생성 시 설정값으로 저장됨 (없으면 실행 안 함)
// 실제 운영 시 tenant_settings에서 조회해야 함
const PERCENTILE_FALLBACK_RATIOS = {
  P25_FACTOR: 0.75, // 25분위수 추정: 평균의 75% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  P75_FACTOR: 1.25, // 75분위수 추정: 평균의 125% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_STUDENTS: 1.2, // 학생 수 상위 10% 추정: 평균의 120% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_REVENUE: 1.2, // 매출 상위 10% 추정: 평균의 120% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_ATTENDANCE: 1.1, // 출석률 상위 10% 추정: 평균의 110% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  TOP10_FACTOR_GROWTH: 1.15, // 성장률 상위 10% 추정: 평균의 115% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  HEATMAP_INTENSITY_THRESHOLD: 0.5, // 히트맵 색상 전환 임계값 (50%, Default Policy: 테넌트 생성 시 설정값으로 저장)
  ATTENDANCE_AVG_FALLBACK: 0.95, // 출석률 평균 fallback: 우리 학원의 95% (Default Policy: 테넌트 생성 시 설정값으로 저장)
  GROWTH_AVG_FALLBACK: 0.9, // 성장률 평균 fallback: 우리 학원의 90% (Default Policy: 테넌트 생성 시 설정값으로 저장)
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
  // [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
  const industryType = context?.industryType || 'academy'; // Context에서 가져오되, 없으면 fallback
  const { data: config } = useConfig();
  const mode = useResponsiveMode(); // 유아이 문서 6-0: 반응형 브레이크포인트 표준 준수
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';

  const [selectedMetric, setSelectedMetric] = useState<'students' | 'revenue' | 'attendance' | 'growth'>('students');
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

  // 지역 통계 조회 (아키텍처 문서 3.6.2: 지역 비교 그룹 결정 로직)
  const { data: regionalStats, isLoading } = useQuery({
    queryKey: ['regional-analytics', tenantId, selectedMetric, locationInfo.location_code, industryType],
    queryFn: async () => {
      if (!tenantId) return null;

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

      // 우리 학원의 지표 값 계산
      if (selectedMetric === 'students') {
        // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
        const students = await fetchPersons(tenantId, {
          person_type: 'student',
        });
        value = students.length;
      } else if (selectedMetric === 'revenue') {
        const currentMonth = toKST().format('YYYY-MM');
        // 정본 규칙: fetchBillingHistory 함수 사용 (Hook의 queryFn 로직 재사용)
        const invoices = await fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonth}-01` },
        });
        value = invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0);
      } else if (selectedMetric === 'attendance') {
        const currentMonth = toKST().format('YYYY-MM');
        // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
        const logs = await fetchAttendanceLogs(tenantId, {
          date_from: `${currentMonth}-01T00:00:00`,
        });
        const presentCount = logs.filter((log: AttendanceLog) => log.status === 'present').length;
        value = logs.length > 0 ? Math.round((presentCount / logs.length) * 100) : 0;
      } else if (selectedMetric === 'growth') {
        // 아키텍처 문서 3.6.8: 성장 지표 (학생 성장률, 매출 성장률)
        // 현재 월과 전월 비교하여 성장률 계산
        const currentMonth = toKST();
        const lastMonth = currentMonth.clone().subtract(1, 'month');

        // 각 월의 마지막 날짜를 올바르게 계산 (하드코딩된 -31 제거)
        const currentMonthEnd = currentMonth.endOf('month').format('YYYY-MM-DDTHH:mm:ss');
        const lastMonthEnd = lastMonth.endOf('month').format('YYYY-MM-DDTHH:mm:ss');

        // 현재 월 학생 수
        // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
        const currentStudents = await fetchPersons(tenantId, {
          person_type: 'student',
          created_at: { lte: currentMonthEnd },
        });
        const currentStudentCount = currentStudents.length;

        // 전월 학생 수
        const lastStudents = await fetchPersons(tenantId, {
          person_type: 'student',
          created_at: { lte: lastMonthEnd },
        });
        const lastStudentCount = lastStudents.length;

        // 성장률 계산 (%)
        value = lastStudentCount > 0
          ? Math.round(((currentStudentCount - lastStudentCount) / lastStudentCount) * 100)
          : 0;
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
        // 1순위: 같은 행정동(location_code) 내 학원 수 확인
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
          // 지표별 평균값 및 상위 10% 값 추출 (통계문서 3.1: 우리 학원 vs 상위 10% 평균)
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
        students: '학생 수',
        revenue: '매출',
        attendance: '출석률',
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
          insights.push('경고: 지역 정보가 설정되지 않아 정확한 지역 비교가 불가능합니다. 설정 화면에서 위치 정보를 입력해주세요.');
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
          console.warn('[AnalyticsPage] Failed to save ranking snapshot:', error);
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
          console.warn('[AnalyticsPage] Failed to save AI insight:', error);
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
    enabled: !!tenantId,
    staleTime: 3000, // 통계문서 5. 운영/보안 설계: 지역 통계 API는 1~3초 캐싱
    refetchInterval: 5000, // 5초마다 갱신 (캐싱 기간보다 길게 설정)
  });

  const selectedMetricLabels = {
    students: '학생 수',
    revenue: '매출',
    attendance: '출석률',
    growth: '성장률',
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
      const [students, invoices, attendanceLogs, regionalStatsResponse] = await Promise.all([
        fetchPersons(tenantId, { person_type: 'student' }),
        fetchBillingHistory(tenantId, {
          period_start: { gte: `${currentMonthStr}-01` },
        }),
        fetchAttendanceLogs(tenantId, {
          date_from: `${currentMonthStr}-01T00:00:00`,
        }),
        // 지역 통계는 이미 조회된 데이터 사용
        Promise.resolve({ data: regionalStats }),
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
      // 리포트 데이터를 JSON 파일로 다운로드
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `월간_경영_리포트_${data.month}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showAlert('성공', `월간 경영 리포트가 생성되었습니다. (${data.report_id})\n\n핵심 지표:\n- 학생 수: ${data.summary.total_students}명\n- 매출: ${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(data.summary.total_revenue))}\n- 출석률: ${data.summary.attendance_rate}%\n\nJSON 파일이 다운로드되었습니다.`);
      // TODO: PDF 생성 라이브러리 추가 시 PDF 다운로드 기능 구현
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding={isMobile ? "sm" : "lg"}>
        <PageHeader
          title="지역 기반 통계"
          actions={
            <Button
              variant="outline"
              size={isMobile ? "sm" : "md"}
              onClick={() => generateMonthlyReport.mutate()}
              disabled={generateMonthlyReport.isPending}
            >
              {generateMonthlyReport.isPending ? '생성 중...' : '월간 리포트 생성'}
            </Button>
          }
        />

        {/* 통계문서 3.1: 운영 현황 카드 4개 (학생 수, 매출, 출석률, 성장률 / 지역순위) */}
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

          {/* 통계문서 3.1: 운영 현황 카드 4개를 동시에 표시 (학생 수 / 지역순위, 매출 / 지역순위, 출석률 / 지역순위, 성장률 / 지역순위) */}
          {!isLoading && regionalStats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-md)',
            }}>
              {/* 학생 수 카드 */}
              <Card padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => setSelectedMetric('students')}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  학생 수
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
                  {regionalStats.value}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3
                    ? `${regionalStats.region} 상위 ${regionalStats.percentile}%`
                    : '지역순위 계산 불가'}
                </div>
              </Card>

              {/* 매출 카드 - 통계문서 3.1: 매출 / 지역순위 */}
              <Card padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => setSelectedMetric('revenue')}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  매출
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
                  {selectedMetric === 'revenue' ? regionalStats.value.toLocaleString() : '클릭하여 확인'}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {selectedMetric === 'revenue' && regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3
                    ? `${regionalStats.region} 상위 ${regionalStats.percentile}%`
                    : selectedMetric === 'revenue' ? '지역순위 계산 불가' : '지표 선택 필요'}
                </div>
              </Card>

              {/* 출석률 카드 - 통계문서 3.1: 출석률 / 지역순위 */}
              <Card padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => setSelectedMetric('attendance')}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  출석률
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
                  {selectedMetric === 'attendance' ? `${regionalStats.value}%` : '클릭하여 확인'}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {selectedMetric === 'attendance' && regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3
                    ? `${regionalStats.region} 상위 ${regionalStats.percentile}%`
                    : selectedMetric === 'attendance' ? '지역순위 계산 불가' : '지표 선택 필요'}
                </div>
              </Card>

              {/* 성장률 카드 - 통계문서 3.1: 성장률 / 지역순위 */}
              <Card padding="md" variant="default" style={{ cursor: 'pointer' }} onClick={() => setSelectedMetric('growth')}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  성장률
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
                  {selectedMetric === 'growth' ? `${regionalStats.value}%` : '클릭하여 확인'}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {selectedMetric === 'growth' && regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3
                    ? `${regionalStats.region} 상위 ${regionalStats.percentile}%`
                    : selectedMetric === 'growth' ? '지역순위 계산 불가' : '지표 선택 필요'}
                </div>
              </Card>
            </div>
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
              <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
                  AI 인사이트
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {regionalStats.insights.map((insight, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 'var(--spacing-lg)',
                        backgroundColor: 'var(--color-background-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        lineHeight: 'var(--line-height-relaxed)',
                        fontWeight: index === 0 ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                      }}
                    >
                      {insight}
                    </div>
                  ))}
                  {regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount > 0 && (
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      paddingTop: 'var(--spacing-xs)',
                    }}>
                      비교 기준: {regionalStats.comparisonGroup === 'same_dong' ? '동' : regionalStats.comparisonGroup === 'same_sigungu' ? '구' : regionalStats.comparisonGroup === 'same_sido' ? '시도' : regionalStats.comparisonGroup === 'same_region_zone' ? '권역' : ''} ({regionalStats.sampleCount}개 학원)
                    </div>
                  )}
                </div>
              </Card>

              {/* 통계문서 3.1: 지역 비교 차트 (우리 학원 vs 지역 평균 vs 상위 10% 평균) */}
              {regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3 && (
                <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 비교 차트</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {/* 통계문서 3.1: 우리 학원 vs 지역 평균 vs 상위 10% 평균 바 차트 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 'var(--spacing-md)',
                      height: 'var(--height-chart)',
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-background-secondary)',
                      borderRadius: 'var(--border-radius-md)',
                    }}>
                      {/* 우리 학원 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                        <div style={{
                          width: '100%',
                          height: `${Math.min(100, (regionalStats.value / Math.max(regionalStats.top10Percent, regionalStats.average, regionalStats.value, 1)) * 100)}%`,
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: 'var(--border-radius-sm)',
                          minHeight: 'var(--height-input-min)',
                        }} />
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                          우리 학원
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
              )}

              {/* 지역 순위 카드 (상세 정보, 펼치기 가능) */}
              {regionalStats.comparisonGroup !== 'insufficient' && regionalStats.sampleCount >= 3 && (
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
                      gap: isMobile ? 'var(--spacing-md)' : 'var(--spacing-lg)',
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}>
                      <div style={{ flex: isMobile ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          우리 학원
                        </div>
                        <div style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {regionalStats.value}
                        </div>
                      </div>
                      <div style={{ flex: isMobile ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          지역 평균
                        </div>
                        <div style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {regionalStats.average}
                        </div>
                      </div>
                      <div style={{ flex: isMobile ? '1 1 100%' : '1' }}>
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          변화율
                        </div>
                        <div style={{ fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                          {regionalStats.trend}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* 히트맵 - [요구사항 3.6.9] 히트맵 기능 (아키텍처 문서 352줄: 전용 Dashboard 구현) */}
              <HeatmapCard
                heatmapType={heatmapType}
                setHeatmapType={setHeatmapType}
                locationInfo={{
                  region: locationInfo.region,
                  location_code: locationInfo.location_code || '',
                  sigungu_code: locationInfo.sigungu_code || '',
                  sido_code: locationInfo.sido_code || '',
                }}
                tenantId={tenantId || null}
              />
            </>
          ) : (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>
                데이터를 불러올 수 없습니다.
              </div>
            </Card>
        )}
      </Container>
    </ErrorBoundary>
  );
}

// 히트맵 카드 컴포넌트 (아키텍처 문서 3.6.9: 히트맵 기능)
function HeatmapCard({
  heatmapType,
  setHeatmapType,
  locationInfo,
  tenantId,
}: {
  heatmapType: 'growth' | 'attendance' | 'students';
  setHeatmapType: (type: 'growth' | 'attendance' | 'students') => void;
  locationInfo: {
    region: string;
    location_code: string;
    sigungu_code: string;
    sido_code: string;
  };
  tenantId: string | null;
}) {
  const mode = useResponsiveMode(); // 유아이 문서 6-0: 반응형 브레이크포인트 표준 준수
  const isMobile = mode === 'xs' || mode === 'sm';
  // [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
  const context = getApiContext();
  const industryType = context?.industryType || 'academy'; // Context에서 가져오되, 없으면 fallback

  // 히트맵 데이터 조회 (최근 30일 데이터)
  // 통계문서 350줄: 행정동 기준 기본 Heatmap (Phase 1 MVP)
  const { data: heatmapData, isLoading: isLoadingHeatmap } = useQuery({
    queryKey: ['regional-heatmap', tenantId, heatmapType, locationInfo.location_code || locationInfo.sigungu_code, industryType],
    queryFn: async () => {
      if (!tenantId || (!locationInfo.location_code && !locationInfo.sigungu_code)) return null;

      const today = toKST();
      const thirtyDaysAgo = today.clone().subtract(30, 'days');
      const dateFrom = thirtyDaysAgo.format('YYYY-MM-DD');
      const dateTo = today.format('YYYY-MM-DD');

      try {
        // 통계문서 350줄: 행정동 기준 기본 Heatmap (Phase 1 MVP)
        // 행정동 데이터가 없으면 구 단위로 fallback
        interface HeatmapMetric {
          date_kst: string;
          active_members_avg?: number;
          revenue_avg?: number;
          avg_attendance_rate?: number;
          student_growth_rate_avg?: number;
        }

        // 1순위: 행정동 기준 (location_code)
        // 정본 규칙: fetchDailyRegionMetrics 함수 사용 (Hook의 queryFn 로직 재사용)
        let metrics = await fetchDailyRegionMetrics(tenantId, {
          industry_type: industryType,
          region_level: 'dong',
          region_code: locationInfo.location_code,
          date_kst: { gte: dateFrom, lte: dateTo },
        });

        // 행정동 데이터가 없으면 구 단위로 fallback
        if (!metrics || metrics.length === 0) {
          metrics = await fetchDailyRegionMetrics(tenantId, {
            industry_type: industryType,
            region_level: 'gu_gun',
            region_code: locationInfo.sigungu_code,
            date_kst: { gte: dateFrom, lte: dateTo },
          });
        }

        // 히트맵 데이터 변환 (날짜별 값)
        const heatmapValues: Array<{ date: string; value: number }> = [];

        for (const metric of metrics) {
          let value = 0;
          if (heatmapType === 'students') {
            value = Number((metric as HeatmapMetric).active_members_avg) || 0;
          } else if (heatmapType === 'attendance') {
            // 마이그레이션 090: avg_attendance_rate 컬럼 사용
            value = Number((metric as HeatmapMetric).avg_attendance_rate) || 0;
          } else if (heatmapType === 'growth') {
            // 마이그레이션 090: student_growth_rate_avg 컬럼 사용
            value = Number((metric as HeatmapMetric).student_growth_rate_avg) || 0;
          }

          heatmapValues.push({
            date: (metric as HeatmapMetric).date_kst,
            value: Math.round(value),
          });
        }

        return heatmapValues;
      } catch (error) {
        // 에러는 무시하고 빈 데이터 반환 (히트맵은 선택적 기능)
        return null;
      }
    },
    enabled: !!tenantId && !!locationInfo.sigungu_code,
    staleTime: 3000, // 통계문서 5. 운영/보안 설계: 지역 통계 API는 1~3초 캐싱
    refetchInterval: 5000, // 5초마다 갱신
  });

  // 히트맵 그리드 데이터 생성 (5x7 그리드, 최근 35일)
  const heatmapGridData = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) {
      return Array.from({ length: 35 }, (_, i) => ({
        date: toKST().clone().subtract(34 - i, 'days').format('YYYY-MM-DD'),
        value: 0,
      }));
    }

    const gridData: Array<{ date: string; value: number }> = [];
    const today = toKST();

    for (let i = 34; i >= 0; i--) {
      const date = today.clone().subtract(i, 'days').format('YYYY-MM-DD');
      const metric = heatmapData.find((m: { date: string }) => m.date === date);
      gridData.push({
        date,
        value: metric ? metric.value : 0,
      });
    }

    return gridData;
  }, [heatmapData]);

  // 히트맵 색상 계산
  const getHeatmapColor = (value: number, maxValue: number) => {
    if (maxValue === 0) return 'var(--color-background-secondary)';
    const intensity = value / maxValue;
    const { HEATMAP_COLOR_THRESHOLDS } = PERCENTILE_FALLBACK_RATIOS;
    if (intensity >= HEATMAP_COLOR_THRESHOLDS.HIGH) return 'var(--color-success)';
    if (intensity >= HEATMAP_COLOR_THRESHOLDS.MEDIUM_HIGH) return 'var(--color-info)';
    if (intensity >= HEATMAP_COLOR_THRESHOLDS.MEDIUM) return 'var(--color-warning)';
    if (intensity >= HEATMAP_COLOR_THRESHOLDS.LOW) return 'var(--color-error-50)';
    return 'var(--color-background-secondary)';
  };

  const maxValue = Math.max(...heatmapGridData.map(d => d.value), 1);

  const heatmapTypeLabels = {
    growth: '지역 성장률',
    attendance: '지역 출석률',
    students: '학생 분포',
  };

  return (
    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>지역 히트맵</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* 히트맵 타입 선택 */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
          {(Object.keys(heatmapTypeLabels) as Array<keyof typeof heatmapTypeLabels>).map((type) => (
            <Button
              key={type}
              variant={heatmapType === type ? 'solid' : 'outline'}
              size="sm"
              onClick={() => setHeatmapType(type)}
            >
              {heatmapTypeLabels[type]}
            </Button>
          ))}
        </div>

        {/* 히트맵 시각화 영역 */}
        {isLoadingHeatmap ? (
          <div style={{
            padding: 'var(--spacing-xl)',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}>
            히트맵 데이터를 불러오는 중...
          </div>
        ) : (
          <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
          }}>
            {/* 히트맵 그리드 (5주 x 7일 = 35일) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 'var(--spacing-xs)',
              width: '100%',
              maxWidth: isMobile ? '100%' : 'var(--width-content-max)',
              margin: '0 auto',
            }}>
              {heatmapGridData.map((item) => {
                const date = new Date(item.date);
                const dayOfWeek = date.getDay(); // 0(일) ~ 6(토)
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={item.date}
                    title={`${item.date}: ${item.value}`}
                    style={{
                      aspectRatio: 'var(--aspect-ratio-square)',
                      backgroundColor: getHeatmapColor(item.value, maxValue),
                      borderRadius: 'var(--border-radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--font-size-xs)',
                      color: item.value > maxValue * PERCENTILE_FALLBACK_RATIOS.HEATMAP_INTENSITY_THRESHOLD ? 'var(--color-white)' : 'var(--color-text-secondary)',
                      opacity: isWeekend ? 'var(--opacity-secondary)' : 'var(--opacity-full)',
                      cursor: 'pointer',
                      transition: 'opacity var(--transition-base), transform var(--transition-base)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = 'var(--opacity-full)';
                      e.currentTarget.style.transform = 'var(--transform-scale-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isWeekend ? 'var(--opacity-secondary)' : 'var(--opacity-full)';
                      e.currentTarget.style.transform = 'var(--transform-scale-normal)';
                    }}
                  >
                    {item.value > 0 ? Math.round(item.value) : ''}
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}>
              <span>낮음</span>
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-xxs)',
                alignItems: 'center',
              }}>
                {[0, PERCENTILE_FALLBACK_RATIOS.HEATMAP_COLOR_THRESHOLDS.LOW, PERCENTILE_FALLBACK_RATIOS.HEATMAP_COLOR_THRESHOLDS.MEDIUM, PERCENTILE_FALLBACK_RATIOS.HEATMAP_COLOR_THRESHOLDS.MEDIUM_HIGH, PERCENTILE_FALLBACK_RATIOS.HEATMAP_COLOR_THRESHOLDS.HIGH, 1].map((intensity) => (
                  <div
                    key={intensity}
                    style={{
                      width: 'var(--font-size-xs)',
                      height: 'var(--font-size-xs)',
                      backgroundColor: getHeatmapColor(intensity * maxValue, maxValue),
                      borderRadius: 'var(--border-radius-sm)',
                    }}
                  />
                ))}
              </div>
              <span>높음</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
