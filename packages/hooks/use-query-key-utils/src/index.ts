/**
 * React Query queryKey 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 queryKey 생성은 이 파일의 함수를 통해서만 수행
 * [불변 규칙] queryKey는 원시값 배열로만 구성 (객체 레퍼런스 사용 금지)
 * [불변 규칙] 파라미터는 훅 내부에서 원시화/정규화하여 queryKey 안정성 보장
 *
 * @see docu/프론트 자동화.md - React Query 키/파라미터 규칙
 */

/**
 * 객체를 안정적인 문자열로 직렬화 (SSOT)
 *
 * JSON.stringify를 사용하되, 키 순서를 정렬하여 일관성 보장
 *
 * @param obj 직렬화할 객체
 * @returns 직렬화된 문자열 (빈 객체는 빈 문자열)
 */
export function serializeFilter(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  if (typeof obj !== 'object') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return JSON.stringify(obj);
  }

  // 객체의 키를 정렬하여 일관성 보장
  const sorted = Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = (obj as Record<string, unknown>)[key];
    return acc;
  }, {} as Record<string, unknown>);

  return JSON.stringify(sorted);
}

/**
 * queryKey 생성 헬퍼 (SSOT)
 *
 * @param baseKey 기본 키 (예: 'students', 'attendance-logs')
 * @param tenantId 테넌트 ID
 * @param filter 필터 객체 (선택적)
 * @param additionalKeys 추가 키 (선택적)
 * @returns queryKey 배열
 *
 * @example
 * ```typescript
 * const queryKey = createQueryKey('students', tenantId, filter);
 * // ['students', tenantId, '{"status":"active"}']
 * ```
 */
export function createQueryKey(
  baseKey: string,
  tenantId: string | null | undefined,
  filter?: unknown,
  ...additionalKeys: unknown[]
): readonly unknown[] {
  const key: unknown[] = [baseKey];

  if (tenantId) {
    key.push(tenantId);
  }

  if (filter !== undefined && filter !== null) {
    key.push(serializeFilter(filter));
  }

  if (additionalKeys.length > 0) {
    key.push(...additionalKeys.map(k =>
      typeof k === 'object' ? serializeFilter(k) : k
    ));
  }

  return key as readonly unknown[];
}

/**
 * queryKey 비교 함수 (SSOT)
 *
 * 두 queryKey가 동일한지 비교
 *
 * @param key1 첫 번째 queryKey
 * @param key2 두 번째 queryKey
 * @returns 동일 여부
 */
export function isQueryKeyEqual(key1: unknown[], key2: unknown[]): boolean {
  if (key1.length !== key2.length) {
    return false;
  }

  for (let i = 0; i < key1.length; i++) {
    if (key1[i] !== key2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * queryKey에서 필터 추출 (SSOT)
 *
 * @param queryKey queryKey 배열
 * @param filterIndex 필터 인덱스 (기본값: 2, baseKey와 tenantId 다음)
 * @returns 필터 객체 또는 null
 */
export function extractFilterFromQueryKey(
  queryKey: unknown[],
  filterIndex = 2
): unknown | null {
  if (filterIndex >= queryKey.length) {
    return null;
  }

  const filterStr = queryKey[filterIndex];
  if (typeof filterStr !== 'string' || filterStr === '') {
    return null;
  }

  try {
    return JSON.parse(filterStr);
  } catch {
    return null;
  }
}

