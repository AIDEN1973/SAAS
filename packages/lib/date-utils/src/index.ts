/**
 * Date Utilities - KST Timezone Helper
 *
 * [불변 규칙] 모든 시간은 DB에는 UTC로 저장하되, 비즈니스 로직·표시·집계는 KST 기준으로 처리합니다.
 * [불변 규칙] UI·리포트·로그·알람: 항상 KST로 변환해서 표시
 *
 * @see docu/전체 기술문서.txt - 19-1. 타임존(KST) 표준
 * @see docu/rules.md - 5. 시간 & 타임존(KST) 규칙
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Seoul'); // KST

/**
 * KST 타임존으로 변환하는 헬퍼 함수
 *
 * @param d - 변환할 날짜/시간 (string | Date | number | undefined)
 * @returns dayjs.Dayjs 객체 (KST 타임존)
 *
 * @example
 * ```typescript
 * import { toKST } from '@lib/date-utils';
 *
 * // 현재 시간을 KST로 변환
 * const nowKst = toKST();
 *
 * // 특정 날짜를 KST로 변환
 * const dateKst = toKST('2025-01-15T10:00:00Z');
 *
 * // KST 기준 오늘 0시
 * const todayKst = toKST().startOf('day');
 *
 * // KST 기준 내일 0시
 * const tomorrowKst = toKST().add(1, 'day').startOf('day');
 * ```
 */
export const toKST = (d?: string | Date | number): dayjs.Dayjs => {
  if (d === undefined) {
    return dayjs().tz('Asia/Seoul');
  }
  return dayjs(d).tz('Asia/Seoul');
};

/**
 * KST 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD)
 *
 * @returns KST 기준 오늘 날짜 문자열
 */
export const getTodayKST = (): string => {
  return toKST().format('YYYY-MM-DD');
};

/**
 * KST 기준 날짜 범위 반환 (시작일 ~ 종료일)
 *
 * @param days - 며칠 전부터 (기본값: 0, 오늘)
 * @returns { start: string, end: string } KST 기준 날짜 문자열 배열
 */
export const getDateRangeKST = (days: number = 0): { start: string; end: string } => {
  const start = toKST().subtract(days, 'day').startOf('day').format('YYYY-MM-DD');
  const end = toKST().endOf('day').format('YYYY-MM-DD');
  return { start, end };
};

