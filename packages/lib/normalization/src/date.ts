/**
 * 날짜 정규화 유틸리티
 *
 * [불변 규칙] 모든 날짜 입력은 이 함수를 통해 정규화되어야 함
 * [불변 규칙] 저장 형식: YYYY-MM-DD
 */

/**
 * 다양한 생년월일 입력 형식을 YYYY-MM-DD로 정규화
 *
 * @param input 생년월일 입력 (다양한 형식 허용)
 * @returns YYYY-MM-DD 형식의 날짜 또는 null
 *
 * @example
 * ```typescript
 * parseBirthDate('070826') // → '2007-08-26'
 * parseBirthDate('20070826') // → '2007-08-26'
 * parseBirthDate('07-08-26') // → '2007-08-26'
 * parseBirthDate('07.08.26') // → '2007-08-26'
 * parseBirthDate('2007-08-26') // → '2007-08-26'
 * parseBirthDate('') // → null
 * ```
 *
 * @remarks
 * 지원 형식:
 * - 6자리: YYMMDD (070826 → 2007-08-26)
 * - 8자리: YYYYMMDD (20070826 → 2007-08-26)
 * - 구분자 포함: YY-MM-DD, YY.MM.DD, YYYY-MM-DD, YYYY.MM.DD
 * - 2자리 년도는 2000년대로 해석 (00-99 → 2000-2099)
 */
export function parseBirthDate(input: string | null | undefined): string | null {
  if (!input) return null;

  // 공백 제거
  let cleaned = input.trim();
  if (!cleaned) return null;

  // 이미 YYYY-MM-DD 형식인 경우
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // 숫자와 구분자만 추출
  const digitsOnly = cleaned.replace(/[^\d]/g, '');

  // 6자리: YYMMDD
  if (digitsOnly.length === 6) {
    const yy = digitsOnly.substring(0, 2);
    const mm = digitsOnly.substring(2, 4);
    const dd = digitsOnly.substring(4, 6);

    // 2자리 년도를 4자리로 변환 (2000년대로 해석)
    const yyyy = `20${yy}`;

    // 날짜 유효성 검증
    if (isValidDate(yyyy, mm, dd)) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // 8자리: YYYYMMDD
  if (digitsOnly.length === 8) {
    const yyyy = digitsOnly.substring(0, 4);
    const mm = digitsOnly.substring(4, 6);
    const dd = digitsOnly.substring(6, 8);

    // 날짜 유효성 검증
    if (isValidDate(yyyy, mm, dd)) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  // 구분자가 있는 경우 (YY-MM-DD 또는 YYYY-MM-DD 등)
  const parts = cleaned.split(/[-./]/);
  if (parts.length === 3) {
    let [year, month, day] = parts;

    // 2자리 년도를 4자리로 변환
    if (year.length === 2) {
      year = `20${year}`;
    }

    // 월/일이 1자리인 경우 앞에 0 추가
    month = month.padStart(2, '0');
    day = day.padStart(2, '0');

    // 날짜 유효성 검증
    if (isValidDate(year, month, day)) {
      return `${year}-${month}-${day}`;
    }
  }

  // 파싱 실패
  return null;
}

/**
 * 날짜 유효성 검증
 *
 * @param year 년도 (4자리 문자열)
 * @param month 월 (2자리 문자열)
 * @param day 일 (2자리 문자열)
 * @returns 유효한 날짜 여부
 */
function isValidDate(year: string, month: string, day: string): boolean {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  // 기본 범위 검증
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // JavaScript Date 객체로 실제 날짜 유효성 검증
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/**
 * 날짜 입력 중 자동 하이픈 삽입
 *
 * @param input 사용자가 입력한 문자열
 * @returns 하이픈이 자동 삽입된 문자열
 *
 * @example
 * ```typescript
 * formatDateInput('2007') // → '2007'
 * formatDateInput('200708') // → '2007-08'
 * formatDateInput('20070826') // → '2007-08-26'
 * formatDateInput('070826') // → '07-08-26'
 * ```
 */
export function formatDateInput(input: string): string {
  // 숫자만 추출
  const digits = input.replace(/[^\d]/g, '');

  if (!digits) return '';

  // 6자리: YY-MM-DD
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  }

  // 8자리: YYYY-MM-DD
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
