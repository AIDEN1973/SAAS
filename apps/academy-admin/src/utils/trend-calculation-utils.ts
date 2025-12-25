/**
 * 트렌드 계산 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 트렌드 계산은 이 파일의 함수를 통해서만 수행
 * [P2-QUALITY-1 수정] 공통 유틸로 분리하여 재사용성 및 발견성 향상
 *
 * 사용 방법:
 * - calculateTrend: count/amount 등 변화율(%) 계산
 * - calculateTrendPercentPoint: 비율 카드(rate) 전용 퍼센트포인트(%p) 계산
 */

/**
 * 트렌드 계산 (변화율 %)
 *
 * 현재 값과 이전 값을 비교하여 변화율을 계산합니다.
 * 예: 100 → 120 = +20%, 100 → 80 = -20%
 *
 * @param current 현재 값
 * @param previous 이전 값
 * @returns 변화율 문자열 (예: "+20%", "-10%") 또는 undefined
 *
 * @example
 * ```typescript
 * const trend = calculateTrend(120, 100); // "+20%"
 * const trend = calculateTrend(80, 100); // "-20%"
 * ```
 */
export function calculateTrend(
  current: number,
  previous: number
): string | undefined {
  if (previous > 0) {
    const change = current - previous;
    const percent = Math.round((change / previous) * 100);
    return `${change > 0 ? '+' : ''}${percent}%`;
  }
  return current > 0 ? '+100%' : undefined;
}

/**
 * 트렌드 계산 (퍼센트포인트 %p)
 *
 * 비율 카드(rate) 전용: 퍼센트포인트 변화를 계산합니다.
 * 예: 95% → 97% = +2%p (변화율이 아닌 절대 차이)
 *
 * [P1-5 수정] 비율 카드(rate)는 %p, count/amount는 변화율(%)로 구분
 *
 * @param current 현재 비율 값
 * @param previous 이전 비율 값
 * @returns 퍼센트포인트 변화 문자열 (예: "+2%p", "-1%p") 또는 undefined
 *
 * @example
 * ```typescript
 * const trend = calculateTrendPercentPoint(97, 95); // "+2%p"
 * const trend = calculateTrendPercentPoint(94, 95); // "-1%p"
 * ```
 */
export function calculateTrendPercentPoint(
  current: number,
  previous: number
): string | undefined {
  if (previous > 0 || current > 0) {
    const change = current - previous;
    return `${change > 0 ? '+' : ''}${Math.round(change)}%p`;
  }
  return undefined;
}

