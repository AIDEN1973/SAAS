// LAYER: EDGE_FUNCTION_SHARED
/**
 * 안정적인 JSON 직렬화 유틸리티
 *
 * [P0-IDEM-1] 중첩 객체의 키 순서를 안정화하여 동일한 의미의 객체가
 * 항상 동일한 문자열로 직렬화되도록 보장합니다.
 *
 * 사용 목적:
 * - dedup_key 계산 시 안정성 보장
 * - 멱등성 검증 시 동일한 params가 동일한 해시를 생성하도록 보장
 */

/**
 * 안정적인 JSON 직렬화 (재귀적 키 정렬)
 *
 * @param obj 직렬화할 객체
 * @returns 직렬화된 문자열 (키 순서가 정렬됨)
 *
 * 규칙:
 * 1. 객체의 키를 알파벳 순으로 정렬
 * 2. 배열은 순서 유지 (정렬하지 않음)
 * 3. undefined 값은 제거 (null로 변환하지 않음)
 * 4. 중첩 객체도 재귀적으로 정렬
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(null);
  }

  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    // 배열은 순서 유지 (정렬하지 않음)
    return JSON.stringify(obj.map(item => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return JSON.parse(stableStringify(item));
      }
      return item;
    }));
  }

  // 객체의 키를 정렬하여 안정성 보장
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    const value = (obj as Record<string, unknown>)[key];

    // undefined 값은 제거 (null로 변환하지 않음)
    if (value === undefined) {
      continue;
    }

    // 중첩 객체는 재귀적으로 처리
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sortedObj[key] = value.map(item => {
          if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
            return JSON.parse(stableStringify(item));
          }
          return item;
        });
      } else {
        sortedObj[key] = JSON.parse(stableStringify(value));
      }
    } else {
      sortedObj[key] = value;
    }
  }

  return JSON.stringify(sortedObj);
}

