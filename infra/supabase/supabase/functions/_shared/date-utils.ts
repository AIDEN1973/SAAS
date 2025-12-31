/**
 * Edge Functions 전용 날짜 유틸리티
 * Deno 환경에서 KST 날짜 처리를 위한 헬퍼 함수
 *
 * [불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.
 * [불변 규칙] toISOString().split('T')[0] 또는 toISOString().slice(0, 10) 직접 사용 금지
 */

/**
 * KST 기준 날짜 포맷팅
 * @param date - Date 객체 또는 ISO 문자열 (선택, 기본값: 현재 시간)
 * @returns KST 기준 YYYY-MM-DD 형식 문자열
 */
export function toKSTDate(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  // KST는 UTC+9
  const kstOffset = 9 * 60; // 분 단위
  const kstTime = new Date(d.getTime() + kstOffset * 60 * 1000);
  return kstTime.toISOString().slice(0, 10);
}

/**
 * KST 기준 월 포맷팅
 * @param date - Date 객체 또는 ISO 문자열 (선택, 기본값: 현재 시간)
 * @returns KST 기준 YYYY-MM 형식 문자열
 */
export function toKSTMonth(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const kstOffset = 9 * 60;
  const kstTime = new Date(d.getTime() + kstOffset * 60 * 1000);
  return kstTime.toISOString().slice(0, 7);
}

/**
 * KST 기준 Date 객체 생성
 * @param date - Date 객체 또는 ISO 문자열 (선택, 기본값: 현재 시간)
 * @returns KST 기준 Date 객체
 */
export function toKST(date?: Date | string): Date {
  const d = date ? new Date(date) : new Date();
  const kstOffset = 9 * 60;
  return new Date(d.getTime() + kstOffset * 60 * 1000);
}

/**
 * KST 기준 ISO 타임스탬프 생성
 * P2-10: timestamp 컬럼용 함수 (YYYY-MM-DDTHH:MM:SS.sssZ 형식)
 * @param date - Date 객체 또는 ISO 문자열 (선택, 기본값: 현재 시간)
 * @returns KST 기준 ISO 타임스탬프 문자열
 */
export function toKSTISOString(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const kstOffset = 9 * 60;
  const kstTime = new Date(d.getTime() + kstOffset * 60 * 1000);
  return kstTime.toISOString();
}

/**
 * P0-13: KST 날짜 범위 필터용 UTC 타임스탬프 생성
 *
 * Postgres timestamptz 컬럼을 KST 날짜 기준으로 필터링하기 위해
 * KST 00:00:00을 UTC로 변환합니다.
 *
 * @param kstDate - KST 기준 날짜 문자열 (YYYY-MM-DD)
 * @returns UTC 기준 ISO 타임스탬프 (YYYY-MM-DDTHH:MM:SS.sssZ)
 *
 * @example
 * ```typescript
 * // KST 2024-01-15 00:00:00 → UTC 2024-01-14 15:00:00
 * const start = kstDateToUTC('2024-01-15');
 * const end = kstDateToUTC('2024-01-16');
 * query.gte('created_at', start).lt('created_at', end);
 * ```
 */
export function kstDateToUTC(kstDate: string): string {
  // KST YYYY-MM-DD 00:00:00을 UTC로 변환
  const [year, month, day] = kstDate.split('-').map(Number);
  const kstMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // KST는 UTC+9이므로 9시간을 빼서 UTC로 변환
  const utcTime = new Date(kstMidnight.getTime() - 9 * 60 * 60 * 1000);
  return utcTime.toISOString();
}

/**
 * P0-13: 다음 날짜의 KST 00:00:00을 UTC로 변환
 *
 * @param kstDate - KST 기준 날짜 문자열 (YYYY-MM-DD)
 * @returns 다음 날 00:00:00의 UTC ISO 타임스탬프
 */
export function nextKSTDateToUTC(kstDate: string): string {
  const [year, month, day] = kstDate.split('-').map(Number);
  const kstMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // 다음 날 00:00:00 (KST)
  const nextDay = new Date(kstMidnight.getTime() + 24 * 60 * 60 * 1000);

  // UTC로 변환 (9시간 빼기)
  const utcTime = new Date(nextDay.getTime() - 9 * 60 * 60 * 1000);
  return utcTime.toISOString();
}

/**
 * P0-13: 다음 월의 KST 00:00:00을 UTC로 변환
 *
 * @param kstMonth - KST 기준 월 문자열 (YYYY-MM)
 * @returns 다음 월 1일 00:00:00의 UTC ISO 타임스탬프
 */
export function nextKSTMonthToUTC(kstMonth: string): string {
  const [year, month] = kstMonth.split('-').map(Number);

  // 다음 월 1일 00:00:00 (KST)
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextYear++;
    nextMonth = 1;
  }

  const kstFirstDay = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0));

  // UTC로 변환 (9시간 빼기)
  const utcTime = new Date(kstFirstDay.getTime() - 9 * 60 * 60 * 1000);
  return utcTime.toISOString();
}

