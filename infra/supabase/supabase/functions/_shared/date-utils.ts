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

