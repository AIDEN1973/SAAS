/**
 * 에러 처리 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 Promise 에러 처리는 이 파일의 함수를 통해서만 수행
 * [불변 규칙] Fail Closed: 에러 발생 시 기본값 반환
 *
 * @see docu/프론트 자동화.md - queryFn 부분 실패 처리 (Fail Closed 패턴)
 */

/**
 * Promise를 안전하게 실행하고 실패 시 기본값 반환 (SSOT)
 *
 * queryFn 내부에서 부분 실패 시에도 전체 그룹이 사라지지 않도록 보장
 *
 * @param promise 실행할 Promise
 * @param fallback 실패 시 반환할 기본값
 * @returns Promise 결과 또는 기본값
 *
 * @example
 * ```typescript
 * const [students, lastMonthStudents] = await Promise.all([
 *   safe(fetchPersons(tenantId, { person_type: 'student' }), []),
 *   safe(fetchPersons(tenantId, { person_type: 'student', created_at: { lte: lastMonthEnd } }), []),
 * ]);
 * ```
 */
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/**
 * 여러 Promise를 안전하게 실행하고 실패 시 기본값 반환 (SSOT)
 *
 * @param promises 실행할 Promise 배열
 * @param fallbacks 실패 시 반환할 기본값 배열 (순서 대응)
 * @returns Promise 결과 배열 또는 기본값 배열
 *
 * @example
 * ```typescript
 * const [students, stats] = await safeAll([
 *   fetchPersons(tenantId, { person_type: 'student' }),
 *   fetchStudentStats(tenantId),
 * ], [[], { total: 0, active: 0 }]);
 * ```
 */
export async function safeAll<T extends readonly unknown[]>(
  promises: [...{ [K in keyof T]: Promise<T[K]> }],
  fallbacks: T
): Promise<T> {
  const results = await Promise.allSettled(promises);
  // 타입 안전성: results와 fallbacks의 길이가 동일하고, 인덱스가 일치하므로 타입 단언이 안전함
  // TypeScript가 map의 반환 타입을 정확히 추론하지 못하므로 unknown을 거쳐서 캐스팅
  // 런타임 검증: 길이 불일치 시 명시적 오류 (방어적 프로그래밍)
  if (results.length !== fallbacks.length) {
    throw new Error(`[safeAll] promises length (${results.length}) !== fallbacks length (${fallbacks.length})`);
  }
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return fallbacks[index];
  }) as unknown as T;
}

/**
 * 배열 반환 보장 (SSOT)
 *
 * API 응답이 배열이 아닐 경우 빈 배열로 정규화
 *
 * @param data API 응답 데이터
 * @returns 배열 (빈 배열 또는 원본 배열)
 *
 * @example
 * ```typescript
 * const payments = ensureArray(await fetchPayments(tenantId, { status: 'failed' }));
 * ```
 */
export function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/**
 * 숫자 반환 보장 (SSOT)
 *
 * @param value 숫자 또는 undefined/null
 * @param defaultValue 기본값 (기본값: 0)
 * @returns 숫자
 *
 * @example
 * ```typescript
 * const count = ensureNumber(data.count, 0);
 * ```
 */
export function ensureNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return defaultValue;
}

/**
 * 문자열 반환 보장 (SSOT)
 *
 * @param value 문자열 또는 undefined/null
 * @param defaultValue 기본값 (기본값: '')
 * @returns 문자열
 *
 * @example
 * ```typescript
 * const name = ensureString(data.name, '');
 * ```
 */
export function ensureString(value: unknown, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

