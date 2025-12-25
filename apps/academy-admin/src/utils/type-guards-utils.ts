/**
 * 타입 가드 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 타입 가드는 이 파일의 함수를 통해서만 수행
 * [불변 규칙] 런타임 타입 안정성 보장
 */

/**
 * 문자열 타입 가드 (SSOT)
 *
 * @param value 검증할 값
 * @returns 문자열 여부
 *
 * @example
 * ```typescript
 * if (isString(value)) {
 *   value.localeCompare(other); // 타입 안전
 * }
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 숫자 타입 가드 (SSOT)
 *
 * @param value 검증할 값
 * @returns 유한 숫자 여부
 *
 * @example
 * ```typescript
 * if (isNumber(value)) {
 *   const result = value * 2; // 타입 안전
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 배열 타입 가드 (SSOT)
 *
 * @param value 검증할 값
 * @returns 배열 여부
 *
 * @example
 * ```typescript
 * if (isArray(value)) {
 *   value.forEach(item => ...); // 타입 안전
 * }
 * ```
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 객체 타입 가드 (SSOT)
 *
 * @param value 검증할 값
 * @returns 객체 여부 (배열 제외)
 *
 * @example
 * ```typescript
 * if (isObject(value)) {
 *   const keys = Object.keys(value); // 타입 안전
 * }
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * null/undefined 체크 (SSOT)
 *
 * @param value 검증할 값
 * @returns null/undefined 여부
 *
 * @example
 * ```typescript
 * if (!isNullOrUndefined(value)) {
 *   // value는 null/undefined가 아님
 * }
 * ```
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 문자열이 비어있지 않은지 확인 (SSOT)
 *
 * @param value 검증할 값
 * @returns 비어있지 않은 문자열 여부
 *
 * @example
 * ```typescript
 * if (isNonEmptyString(value)) {
 *   value.trim(); // 타입 안전, 빈 문자열 아님
 * }
 * ```
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 객체에 특정 키가 있는지 확인 (SSOT)
 *
 * @param obj 검증할 객체
 * @param key 검증할 키
 * @returns 키 존재 여부 (프로토타입 체인 제외)
 *
 * @example
 * ```typescript
 * if (hasOwnProperty(obj, 'name')) {
 *   const name = obj.name; // 타입 안전
 * }
 * ```
 */
export function hasOwnProperty(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

