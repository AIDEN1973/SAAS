/**
 * useDebounce Hook
 *
 * 입력값 디바운싱을 위한 React Hook
 * 검색 입력 등에서 사용자가 타이핑을 멈춘 후에만 값을 업데이트하여 불필요한 API 호출을 방지합니다.
 */

import { useState, useEffect } from 'react';

/**
 * 값 디바운싱 Hook
 *
 * @param value - 디바운싱할 값
 * @param delay - 디바운스 지연 시간 (밀리초, 기본값: 300ms)
 * @returns 디바운싱된 값
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // debouncedSearchTerm이 변경될 때만 API 호출
 *   if (debouncedSearchTerm) {
 *     searchAPI(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // delay 시간 후에 값 업데이트
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // cleanup: 컴포넌트 언마운트 또는 값 변경 시 이전 타이머 취소
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

