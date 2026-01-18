/**
 * 데이터 정규화 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 데이터 정규화는 이 파일의 함수를 통해서만 수행
 * [불변 규칙] 서버가 "삭제는 null" 규칙을 따르므로, 빈 문자열은 null로 변환
 *
 * @see docu/디어쌤 아키텍처.md - 데이터 정규화 규칙
 */

// [불변 규칙] 전화번호 정규화는 shared lib에서 import (SSOT)
export { normalizePhoneNumber } from '@lib/normalization';

/**
 * 빈 문자열을 null로 변환 (SSOT)
 *
 * 서버가 "삭제는 null" 규칙을 따르므로, 빈 문자열은 null로 정규화
 *
 * @param value 변환할 값
 * @returns 변환된 값 (빈 문자열 → null, undefined → undefined, 그 외 → 원본)
 *
 * @example
 * ```typescript
 * const updateData = {
 *   name: data.name ?? student.name,
 *   birth_date: toNullable(data.birth_date),
 *   phone: toNullable(data.phone),
 * };
 * ```
 */
export function toNullable(value: unknown): unknown {
  if (value === undefined) return undefined; // 미변경
  if (value === null) return null; // 명시적 제거
  if (typeof value === 'string' && value.trim() === '') return null; // 빈칸 제거
  return value;
}

/**
 * 객체의 모든 필드를 toNullable로 정규화 (SSOT)
 *
 * @param data 정규화할 객체
 * @param fields 정규화할 필드명 배열 (선택적, 없으면 모든 필드)
 * @returns 정규화된 객체
 *
 * @example
 * ```typescript
 * const normalized = normalizeNullableFields(data, ['birth_date', 'phone', 'email']);
 * ```
 */
export function normalizeNullableFields<T extends Record<string, unknown>>(
  data: T,
  fields?: (keyof T)[]
): T {
  const targetFields = fields || (Object.keys(data) as (keyof T)[]);
  const normalized = { ...data };

  for (const field of targetFields) {
    normalized[field] = toNullable(normalized[field]) as T[keyof T];
  }

  return normalized;
}

/**
 * 숫자 정규화 (NaN/Infinity → null)
 *
 * @param value 변환할 값
 * @returns 숫자 또는 null
 *
 * @example
 * ```typescript
 * const amount = normalizeNumber(data.amount); // NaN → null
 * ```
 */
export function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    return null; // NaN, Infinity → null
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * 날짜 문자열 정규화 (빈 문자열 → null)
 *
 * @param value 변환할 값
 * @returns 날짜 문자열 또는 null
 *
 * @example
 * ```typescript
 * const date = normalizeDateString(data.birth_date); // '' → null
 * ```
 */
export function normalizeDateString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return null;
}

/**
 * 불린 정규화 (문자열/숫자 → 불린)
 *
 * @param value 변환할 값
 * @returns 불린 또는 null
 *
 * @example
 * ```typescript
 * const enabled = normalizeBoolean(data.enabled); // 'true' → true, 1 → true
 * ```
 */
export function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

/**
 * 태그 입력값 실시간 처리 (SSOT)
 *
 * 태그 입력값에서 띄어쓰기를 제거하되, 쉼표 다음 띄어쓰기는 허용합니다.
 * 이 함수는 사용자가 입력하는 동안 실시간으로 호출되어 입력값을 정규화합니다.
 *
 * @param inputValue 사용자가 입력한 원본 문자열
 * @returns 정규화된 문자열
 *
 * @example
 * ```typescript
 * // 단일 태그: 모든 띄어쓰기 제거
 * processTagInput('태 그 1') // → '태그1'
 *
 * // 여러 태그: 쉼표 다음 띄어쓰기 1개만 허용
 * processTagInput('태그1, 태 그2') // → '태그1, 태그2'
 * processTagInput('태그1,  태그2') // → '태그1, 태그2'
 * ```
 *
 * @remarks
 * - onChange에서 정규화하면 커서 위치가 튈 수 있음 (React controlled input의 제약)
 * - 개선 옵션: onBlur에서 정규화 또는 selectionStart/End를 유지하는 방식
 */
export function processTagInput(inputValue: string): string {
  const parts = inputValue.split(',');

  return parts
    .map((part, index) => {
      if (index === 0) {
        // 첫 번째 부분: 모든 띄어쓰기 제거
        return part.replace(/\s+/g, '');
      } else {
        // 쉼표 다음 부분: 앞의 띄어쓰기 하나만 허용, 나머지 제거
        const trimmed = part.trimStart();
        const withoutSpaces = trimmed.replace(/\s+/g, '');
        return part.startsWith(' ') ? ' ' + withoutSpaces : withoutSpaces;
      }
    })
    .join(',');
}


