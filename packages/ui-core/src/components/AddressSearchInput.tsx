/**
 * AddressSearchInput Component
 *
 * 카카오 주소 검색 API를 사용한 주소 검색 입력 컴포넌트
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 *
 * @example
 * <AddressSearchInput
 *   value={address}
 *   onChange={(address, regionInfo) => {
 *     setAddress(address);
 *     setRegionInfo(regionInfo);
 *   }}
 * />
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input, InputProps } from './Input';
import { Spinner } from './Spinner';
import type { ParsedRegionInfo } from '@lib/kakao-address';

export interface AddressSearchResult {
  /** 전체 주소 */
  address: string;
  /** 파싱된 지역 정보 */
  regionInfo: ParsedRegionInfo;
}

export interface AddressSearchInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  /** 현재 주소 값 */
  value?: string;
  /** 주소 선택 시 콜백 */
  onChange?: (address: string, regionInfo: ParsedRegionInfo | null) => void;
  /** 카카오 REST API 키 (환경변수에서 가져옴) */
  kakaoApiKey?: string;
  /** 검색 결과 최대 개수 */
  maxResults?: number;
  /** 검색 딜레이 (ms) */
  debounceMs?: number;
}

/**
 * 주소 검색 입력 컴포넌트
 */
export function AddressSearchInput({
  value = '',
  onChange,
  kakaoApiKey,
  maxResults = 5,
  debounceMs = 300,
  label = '학원 주소',
  ...inputProps
}: AddressSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 value 변경 시 동기화
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 주소 검색 함수
  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // API 키 가져오기 (props > 환경변수)
    const apiKey = kakaoApiKey || (typeof window !== 'undefined' && (window as any).__KAKAO_API_KEY__) || import.meta.env?.VITE_KAKAO_REST_API_KEY;

    if (!apiKey) {
      console.warn('[AddressSearchInput] 카카오 API 키가 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    try {
      // 동적 import로 kakao-address 모듈 로드
      const { searchAndParseAddress } = await import('@lib/kakao-address');
      const parsedResults = await searchAndParseAddress(query, apiKey);

      const searchResults: AddressSearchResult[] = parsedResults.slice(0, maxResults).map((info) => ({
        address: info.full_address,
        regionInfo: info,
      }));

      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('[AddressSearchInput] 주소 검색 실패:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [kakaoApiKey, maxResults]);

  // 입력값 변경 핸들러 (디바운스 적용)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // 선택된 값을 초기화 (새로 입력 시)
    onChange?.(newValue, null);

    // 디바운스
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      searchAddress(newValue);
    }, debounceMs);
  }, [searchAddress, debounceMs, onChange]);

  // 결과 선택 핸들러
  const handleSelect = useCallback((result: AddressSearchResult) => {
    setInputValue(result.address);
    setIsOpen(false);
    setResults([]);
    onChange?.(result.address, result.regionInfo);
  }, [onChange]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, results, selectedIndex, handleSelect]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <Input
          {...inputProps}
          label={label}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          fullWidth
          autoComplete="off"
        />
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              right: 'var(--spacing-sm)',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <Spinner size="sm" />
          </div>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-gray-300)',
            borderRadius: 'var(--border-radius-md)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {results.map((result, index) => (
            <div
              key={`${result.address}-${index}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                cursor: 'pointer',
                backgroundColor: selectedIndex === index ? 'var(--color-gray-100)' : 'transparent',
                borderBottom: index < results.length - 1 ? '1px solid var(--color-gray-300-light)' : 'none',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
              >
                {result.address}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  marginTop: 'var(--spacing-2xs)',
                }}
              >
                {result.regionInfo.si} {result.regionInfo.gu} {result.regionInfo.dong}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
