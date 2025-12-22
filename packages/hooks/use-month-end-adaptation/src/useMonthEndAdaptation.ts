/**
 * useMonthEndAdaptation Hook
 *
 * 월말 감지 및 청구 카드 우선순위 조정
 *
 * 아키텍처 문서 요구사항:
 * - 월말 → 청구 요약 카드가 자동 상단에 노출
 */

import { useMemo } from 'react';
import { toKST } from '@lib/date-utils';
import { useConfig } from '@hooks/use-config';

export interface UseMonthEndAdaptationReturn {
  isMonthEnd: boolean;
  shouldPrioritizeBilling: boolean;
  daysUntilMonthEnd: number;
}

/**
 * 월말 적응 Hook
 *
 * 현재 날짜가 월말인지 감지하고, 청구 카드 우선순위를 조정
 */
export function useMonthEndAdaptation(): UseMonthEndAdaptationReturn {
  const currentDate = toKST();
  const date = currentDate.date();
  const daysInMonth = currentDate.daysInMonth();

  // Policy에서 월말 판단 기준 조회 (하드코딩 금지)
  const { data: config } = useConfig();
  const monthEndThresholdDay = useMemo(() => {
    // SSOT 경로: billing.month_end_threshold_day (저장 위치는 tenant_settings(key='config').value(JSONB))
    // Policy가 없으면 실행하지 않음 (Fail Closed) - 기본값으로 25 사용하지 않음
    const billing = (config as Record<string, unknown>)?.billing as Record<string, unknown> | undefined;
    const threshold = billing?.month_end_threshold_day;
    // Policy가 없으면 undefined 반환 (Fail Closed 원칙)
    return typeof threshold === 'number' ? threshold : undefined;
  }, [config]);

  // 중요: Policy에서 조회한 값만 사용 (하드코딩 금지)
  // Policy가 없으면 isMonthEnd는 false (Fail Closed 원칙)
  const isMonthEnd = useMemo(() => {
    return monthEndThresholdDay !== undefined && date >= monthEndThresholdDay;
  }, [date, monthEndThresholdDay]);

  // 월말까지 남은 일수
  const daysUntilMonthEnd = useMemo(() => {
    return daysInMonth - date;
  }, [daysInMonth, date]);

  // 청구 카드 우선순위 조정 여부
  const shouldPrioritizeBilling = useMemo(() => {
    return isMonthEnd;
  }, [isMonthEnd]);

  return {
    isMonthEnd,
    shouldPrioritizeBilling,
    daysUntilMonthEnd,
  };
}

