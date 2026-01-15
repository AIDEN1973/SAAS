/**
 * Analytics 설정 훅 (Policy 기반)
 *
 * [불변 규칙] Analytics 관련 Policy는 이 훅을 통해 조회
 * [불변 규칙] Fail Closed: Policy가 없으면 fallback 값 사용
 *
 * P1-2 개선: Policy 하드코딩 제거
 * - AnalyticsPage의 PERCENTILE_FALLBACK_RATIOS를 Policy로 마이그레이션
 * - tenant_settings.config.analytics.* 경로로 조회
 *
 * @see docu/프론트 자동화.md - Policy Key v2 (Purpose-Based) — SSOT
 */

import { useConfig } from '@hooks/use-config';
import { getPolicyValueFromConfig } from '../utils';

/**
 * Analytics Percentile 계산을 위한 Factor 타입
 */
export interface AnalyticsPercentileFactors {
  /** 25분위수 추정: 평균의 N% */
  P25_FACTOR: number;
  /** 75분위수 추정: 평균의 N% */
  P75_FACTOR: number;
  /** 주요 관리 대상 수 상위 10% 추정: 평균의 N% */
  TOP10_FACTOR_STUDENTS: number;
  /** 매출 상위 10% 추정: 평균의 N% */
  TOP10_FACTOR_REVENUE: number;
  /** 출석률 상위 10% 추정: 평균의 N% */
  TOP10_FACTOR_ATTENDANCE: number;
  /** 성장률 상위 10% 추정: 평균의 N% */
  TOP10_FACTOR_GROWTH: number;
  /** 히트맵 색상 전환 임계값 (N%) */
  HEATMAP_INTENSITY_THRESHOLD: number;
  /** 출석률 평균 fallback: 내 조직의 N% */
  ATTENDANCE_AVG_FALLBACK: number;
  /** 성장률 평균 fallback: 내 조직의 N% */
  GROWTH_AVG_FALLBACK: number;
  /** 히트맵 색상 임계값 (UI 스타일링용) */
  HEATMAP_COLOR_THRESHOLDS: {
    HIGH: number; // 높은 강도 (N% 이상)
    MEDIUM_HIGH: number; // 중상 강도 (N-M%)
    MEDIUM: number; // 중간 강도 (N-M%)
    LOW: number; // 낮은 강도 (N-M%)
  };
}

/**
 * Default Percentile Factors (Fallback 값)
 *
 * Policy가 없을 경우 사용하는 기본값
 * 테넌트 생성 시 이 값들이 tenant_settings.config에 저장되어야 함
 */
const DEFAULT_PERCENTILE_FACTORS: AnalyticsPercentileFactors = {
  P25_FACTOR: 0.75, // 25분위수 추정: 평균의 75%
  P75_FACTOR: 1.25, // 75분위수 추정: 평균의 125%
  TOP10_FACTOR_STUDENTS: 1.2, // 주요 관리 대상 수 상위 10% 추정: 평균의 120%
  TOP10_FACTOR_REVENUE: 1.2, // 매출 상위 10% 추정: 평균의 120%
  TOP10_FACTOR_ATTENDANCE: 1.1, // 출석률 상위 10% 추정: 평균의 110%
  TOP10_FACTOR_GROWTH: 1.15, // 성장률 상위 10% 추정: 평균의 115%
  HEATMAP_INTENSITY_THRESHOLD: 0.5, // 히트맵 색상 전환 임계값 (50%)
  ATTENDANCE_AVG_FALLBACK: 0.95, // 출석률 평균 fallback: 내 조직의 95%
  GROWTH_AVG_FALLBACK: 0.9, // 성장률 평균 fallback: 내 조직의 90%
  HEATMAP_COLOR_THRESHOLDS: {
    HIGH: 0.8, // 높은 강도 (80% 이상)
    MEDIUM_HIGH: 0.6, // 중상 강도 (60-80%)
    MEDIUM: 0.4, // 중간 강도 (40-60%)
    LOW: 0.2, // 낮은 강도 (20-40%)
  },
};

/**
 * Analytics 설정 조회 훅
 *
 * @returns Analytics Percentile Factors
 *
 * @example
 * const { percentileFactors } = useAnalyticsConfig();
 * const p25 = mean * percentileFactors.P25_FACTOR;
 */
export function useAnalyticsConfig() {
  const { data: config } = useConfig();

  // Policy 경로: analytics.percentile_factors
  const percentileFactorsFromPolicy = getPolicyValueFromConfig<AnalyticsPercentileFactors>(
    config ?? null,
    'analytics.percentile_factors'
  );

  // Policy가 없으면 fallback 값 사용 (Fail Closed with Default)
  const percentileFactors = percentileFactorsFromPolicy || DEFAULT_PERCENTILE_FACTORS;

  return {
    percentileFactors,
  };
}
