/**
 * Debounced Value Hook
 *
 * [LAYER: HOOK]
 * [성능 최적화] 입력값 디바운싱으로 불필요한 렌더링 방지
 *
 * 사용 예시:
 * - 검색 입력: 사용자가 타이핑을 멈춘 후 검색 실행
 * - 필터링: 필터 변경 후 일정 시간 대기 후 API 호출
 */

import { useState, useEffect } from 'react';

/**
 * 기본 디바운스 시간
 * [SSOT] 매직 넘버 제거
 */
const DEFAULT_DEBOUNCE_DELAY = 300; // 300ms

/**
 * 디바운스된 값을 반환하는 Hook
 *
 * @param value - 디바운스할 값
 * @param delay - 디바운스 지연 시간 (기본: 300ms)
 * @returns 디바운스된 값
 */
export function useDebouncedValue<T>(value: T, delay: number = DEFAULT_DEBOUNCE_DELAY): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 타이머 설정
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 클린업: 이전 타이머 취소
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
