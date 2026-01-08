/**
 * GlobalSearchDropdown Component
 *
 * 헤더에 통합된 글로벌 검색 드롭다운 (Phase 2: PostgreSQL FTS 기반)
 * [불변 규칙] Ctrl+K / Cmd+K 단축키 지원
 * [불변 규칙] 외부 클릭 시 자동 닫힘
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { MagnifyingGlass, X } from 'phosphor-react';
import { GlobalSearchResults } from './GlobalSearchResults';
import type { SearchResult, SearchEntityType } from './GlobalSearchResults';

export interface GlobalSearchDropdownProps {
  /** 검색어 */
  query: string;
  /** 검색어 변경 핸들러 */
  onQueryChange: (query: string) => void;
  /** 검색 결과 */
  results: SearchResult[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 드롭다운 열림 상태 */
  isOpen: boolean;
  /** 드롭다운 열기 */
  onOpen: () => void;
  /** 드롭다운 닫기 */
  onClose: () => void;
  /** 결과 클릭 핸들러 */
  onResultClick?: (result: SearchResult) => void;
  /** 검색창 placeholder (버튼과 input 공통) */
  placeholder?: string;
  /** 추가 클래스 */
  className?: string;
  /** 엔티티 타입별 라벨 (업종별 커스터마이징) */
  entityTypeLabels?: Partial<Record<SearchEntityType, string>>;
  /** 검색 입력창 placeholder */
  inputPlaceholder?: string;
  /** 빈 상태 안내 메시지 */
  emptyStateMessage?: string;
}

export const GlobalSearchDropdown: React.FC<GlobalSearchDropdownProps> = ({
  query,
  onQueryChange,
  results,
  loading = false,
  error = null,
  isOpen,
  onOpen,
  onClose,
  onResultClick,
  placeholder = 'Search (Ctrl+K)',
  className,
  entityTypeLabels,
  inputPlaceholder = 'Search people, groups, and more...',
  emptyStateMessage = 'Search for people, groups, consultations, and more.',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);

  // 드롭다운 위치 계산
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.top,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Ctrl+K / Cmd+K 단축키
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpen, onClose]);

  // 열릴 때 자동 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // 결과 클릭 핸들러
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onResultClick?.(result);
      onClose();
    },
    [onResultClick, onClose]
  );

  // 검색어 초기화
  const handleClear = useCallback(() => {
    onQueryChange('');
    inputRef.current?.focus();
  }, [onQueryChange]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
      }}
    >
      {/* 검색 버튼 (항상 렌더링, 열린 상태에서는 투명) */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen) {
            onOpen();
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: isOpen ? 'transparent' : 'var(--color-white)',
          border: isOpen ? 'var(--border-width-thin) solid transparent' : 'var(--border-width-thin) solid var(--color-gray-200)',
          borderRadius: 'var(--border-radius-xs)',
          cursor: isOpen ? 'default' : 'pointer',
          transition: 'var(--transition-all)',
          minWidth: 'var(--width-search-button)',
          visibility: isOpen ? 'hidden' : 'visible',
        }}
      >
        <MagnifyingGlass
          weight="regular"
          style={{
            width: 'var(--size-icon-base)',
            height: 'var(--size-icon-base)',
            color: 'var(--color-text-secondary)',
          }}
        />
        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {placeholder}
        </span>
      </button>

      {/* 검색 입력창 (열린 상태) - fixed로 stacking context 문제 해결 */}
      {isOpen && dropdownPosition && (
        <div
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            zIndex: 'var(--z-modal)',
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--border-radius-xs)',
            boxShadow: 'var(--shadow-lg)',
            border: 'var(--border-width-thin) solid var(--color-gray-200)',
            minWidth: 'var(--width-search-dropdown-min)',
            maxWidth: 'var(--width-search-dropdown-max)',
          }}
        >
          {/* 검색 입력 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-md)',
              paddingBottom: 'calc(var(--spacing-md) + var(--border-width-thin))',
              borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
            }}
          >
            <MagnifyingGlass
              weight="regular"
              style={{
                width: 'var(--size-icon-base)',
                height: 'var(--size-icon-base)',
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={inputPlaceholder}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 'var(--font-size-base)',
                color: 'var(--color-text)',
                backgroundColor: 'transparent',
              }}
            />
            {query && (
              <button
                onClick={handleClear}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 'var(--spacing-xs)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--border-radius-sm)',
                }}
              >
                <X
                  weight="bold"
                  style={{
                    width: 'var(--size-icon-sm)',
                    height: 'var(--size-icon-sm)',
                    color: 'var(--color-text-tertiary)',
                  }}
                />
              </button>
            )}
          </div>

          {/* 검색 결과 */}
          {(query.trim() || loading) && (
            <GlobalSearchResults
              results={results}
              loading={loading}
              error={error}
              query={query}
              onResultClick={handleResultClick}
              maxHeight="var(--height-search-results-max)"
              entityTypeLabels={entityTypeLabels}
            />
          )}

          {/* 빈 상태 안내 */}
          {!query.trim() && !loading && (
            <div
              style={{
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                  margin: 0,
                }}
              >
                {emptyStateMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
