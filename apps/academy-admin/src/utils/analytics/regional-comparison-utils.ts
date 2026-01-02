/**
 * 지역 비교 그룹 결정 유틸리티
 *
 * [LAYER: UTIL]
 *
 * [불변 규칙] 아키텍처 문서 3.6.2: Fallback 우선순위 (동→구→시도→권역)
 * [요구사항] QUALITY-1: Fallback 로직 중복 제거
 */

export interface LocationInfo {
  region: string;
  si: string;
  gu: string;
  dong: string;
  location_code: string;
  sigungu_code: string;
  sido_code: string;
}

export interface DailyRegionMetrics {
  region_code: string;
  region_level: 'dong' | 'gu_gun' | 'si' | 'region_zone';
  tenant_count: number;
  avg_attendance_rate?: number;
  attendance_rate_p25?: number;
  attendance_rate_p75?: number;
  student_count?: number;
  avg_arpu?: number;
  student_growth_rate_avg?: number;
  revenue_growth_rate_avg?: number;
  student_growth_rate_p75?: number;
  revenue_growth_rate_p75?: number;
}

export interface ComparisonGroup {
  /** 비교 그룹 유형 */
  group: 'same_dong' | 'same_gu' | 'same_si' | 'same_region_zone';
  /** 지역 레벨 */
  level: 'dong' | 'gu_gun' | 'si' | 'region_zone';
  /** Fallback 사용 여부 */
  usedFallback: boolean;
  /** Fallback된 레벨 (Fallback 사용 시) */
  fallbackLevel?: 'same_gu' | 'same_si' | 'same_region_zone';
  /** 업종 필터 제거 여부 */
  industryFilterRemoved: boolean;
  /** 샘플 수 */
  sampleCount: number;
  /** 지역 코드 */
  regionCode: string;
}

/**
 * 최적 비교 그룹 결정
 *
 * @param locationInfo 위치 정보
 * @param regionMetrics 지역 통계 데이터
 * @param industryType 업종 타입
 * @param minSampleSize 최소 샘플 수 (기본값: 3)
 * @returns 비교 그룹 정보
 */
export function findBestComparisonGroup(
  locationInfo: LocationInfo,
  regionMetrics: DailyRegionMetrics[],
  minSampleSize: number = 3
): ComparisonGroup {
  // 아키텍처 문서 3.6.2: Fallback 우선순위 (동→구→시도→권역)
  const fallbackPriority: Array<{
    group: ComparisonGroup['group'];
    level: ComparisonGroup['level'];
    fallbackLevel?: ComparisonGroup['fallbackLevel'];
    regionCode: string;
  }> = [
    {
      group: 'same_dong',
      level: 'dong',
      regionCode: locationInfo.location_code,
    },
    {
      group: 'same_gu',
      level: 'gu_gun',
      fallbackLevel: 'same_gu',
      regionCode: locationInfo.sigungu_code,
    },
    {
      group: 'same_si',
      level: 'si',
      fallbackLevel: 'same_si',
      regionCode: locationInfo.sido_code,
    },
    // 향후 확장: 권역 단위
    // {
    //   group: 'same_region_zone',
    //   level: 'region_zone',
    //   fallbackLevel: 'same_region_zone',
    //   regionCode: locationInfo.region_zone_code,
    // },
  ];

  // 1차 시도: 동일 업종 필터
  for (const priority of fallbackPriority) {
    if (!priority.regionCode) continue; // 지역 코드가 없으면 스킵

    const metrics = regionMetrics.find(
      (m) =>
        m.region_code === priority.regionCode &&
        m.region_level === priority.level &&
        m.tenant_count >= minSampleSize
    );

    if (metrics) {
      return {
        group: priority.group,
        level: priority.level,
        usedFallback: priority.fallbackLevel !== undefined,
        fallbackLevel: priority.fallbackLevel,
        industryFilterRemoved: false,
        sampleCount: metrics.tenant_count,
        regionCode: priority.regionCode,
      };
    }
  }

  // 2차 시도: 업종 필터 제거 (전체 업종 비교)
  // 아키텍처 문서 3.6.2: 3509-3511줄
  for (const priority of fallbackPriority) {
    if (!priority.regionCode) continue;

    const metrics = regionMetrics.find(
      (m) =>
        m.region_code === priority.regionCode &&
        m.region_level === priority.level &&
        m.tenant_count >= minSampleSize
      // industry_type 필터 제거
    );

    if (metrics) {
      return {
        group: priority.group,
        level: priority.level,
        usedFallback: priority.fallbackLevel !== undefined,
        fallbackLevel: priority.fallbackLevel,
        industryFilterRemoved: true,
        sampleCount: metrics.tenant_count,
        regionCode: priority.regionCode,
      };
    }
  }

  // 3차 시도: 최소 샘플 수 조건 완화 (1개 이상)
  for (const priority of fallbackPriority) {
    if (!priority.regionCode) continue;

    const metrics = regionMetrics.find(
      (m) =>
        m.region_code === priority.regionCode &&
        m.region_level === priority.level &&
        m.tenant_count >= 1
    );

    if (metrics) {
      return {
        group: priority.group,
        level: priority.level,
        usedFallback: priority.fallbackLevel !== undefined,
        fallbackLevel: priority.fallbackLevel,
        industryFilterRemoved: true,
        sampleCount: metrics.tenant_count,
        regionCode: priority.regionCode,
      };
    }
  }

  // 비교 불가
  return {
    group: 'same_dong',
    level: 'dong',
    usedFallback: false,
    industryFilterRemoved: false,
    sampleCount: 0,
    regionCode: locationInfo.location_code,
  };
}

/**
 * 비교 그룹 라벨 생성
 *
 * @param group 비교 그룹
 * @returns 라벨 문자열
 */
export function getComparisonGroupLabel(group: ComparisonGroup['group']): string {
  const labels: Record<ComparisonGroup['group'], string> = {
    same_dong: '같은 동',
    same_gu: '같은 구/군',
    same_si: '같은 시/도',
    same_region_zone: '같은 권역',
  };

  return labels[group] || '지역';
}

/**
 * Percentile Rank 계산
 *
 * @param value 현재 값
 * @param sampleCount 샘플 수
 * @param metrics 지역 통계 데이터
 * @returns Percentile (0-100)
 */
export function calculatePercentileRank(
  value: number,
  sampleCount: number,
  average: number,
  p25?: number,
  p75?: number
): number {
  // 통계문서 2.4: Percentile Rank 계산
  // P = (number_of_values_below / total) * 100

  if (!p25 || !p75 || p25 === p75) {
    // Fallback: 평균 대비 추정
    if (value >= average) {
      // 평균 이상: 50% ~ 100%
      const ratio = average > 0 ? Math.min((value - average) / average, 1) : 0;
      return 50 + ratio * 50;
    } else {
      // 평균 미만: 0% ~ 50%
      const ratio = average > 0 ? Math.min((average - value) / average, 1) : 0;
      return 50 - ratio * 50;
    }
  }

  // p25, p75 기반 추정
  if (value <= p25) {
    // 하위 25% 이하
    const ratio = p25 > 0 ? Math.min(value / p25, 1) : 0;
    return ratio * 25;
  } else if (value <= average) {
    // 25% ~ 50%
    const range = average - p25;
    const ratio = range > 0 ? Math.min((value - p25) / range, 1) : 0;
    return 25 + ratio * 25;
  } else if (value <= p75) {
    // 50% ~ 75%
    const range = p75 - average;
    const ratio = range > 0 ? Math.min((value - average) / range, 1) : 0;
    return 50 + ratio * 25;
  } else {
    // 상위 25% 이상
    const ratio = p75 > 0 ? Math.min((value - p75) / p75, 1) : 0;
    return 75 + ratio * 25;
  }
}

/**
 * Rank 계산 (Percentile 역산)
 *
 * @param percentile Percentile (0-100)
 * @param sampleCount 샘플 수
 * @returns Rank (1부터 시작)
 */
export function calculateRank(percentile: number, sampleCount: number): number {
  // 통계문서 2.4: Percentile Rank 공식 역산
  // percentile이 높을수록 rank는 낮음 (1위가 상위 1%)
  // rank = (100 - percentile) / 100 * sampleCount + 1

  const numberBelowOrEqual = Math.round(((100 - percentile) / 100) * sampleCount);
  return Math.max(1, numberBelowOrEqual + 1);
}
