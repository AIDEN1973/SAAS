/**
 * Pagination Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  maxVisible?: number; // 양쪽에 표시할 페이지 수
}

/**
 * Pagination 컴포넌트
 *
 * 페이지네이션 컨트롤 (이미지 디자인 기준)
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  maxVisible = 5,
}) => {
  const getVisiblePages = () => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const half = Math.floor(maxVisible / 2);

    // 현재 페이지 기준으로 시작/끝 계산
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);

    // 끝에서 시작이 부족하면 시작을 앞으로 당김
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    // 시작이 1이 아니면 1과 말줄임표 추가
    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push(-1); // -1은 말줄임표를 의미
      }
    }

    // 중간 페이지들 추가
    for (let i = start; i <= end; i++) {
      if (i !== 1 || start === 1) {
        pages.push(i);
      }
    }

    // 끝이 마지막이 아니면 말줄임표와 마지막 페이지 추가
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(-1); // -1은 말줄임표를 의미
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  // totalPages가 유효하지 않으면 페이지네이션 표시하지 않음 (0 이하만 체크)
  if (!totalPages || totalPages <= 0) return null;

  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-xs)',
        flexWrap: 'wrap',
      }}
    >
      {/* 이전 버튼 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderRadius: 'var(--border-radius-xl)',
          border: 'var(--border-width-thin) solid var(--color-text)', // 기본 색상 테두리 적용
          backgroundColor: 'var(--color-white)',
          color: isFirstPage ? 'var(--color-gray-500)' : 'var(--color-text)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-normal)',
          cursor: isFirstPage ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-all)',
          height: 'var(--size-pagination-button)',
          paddingLeft: 'var(--spacing-md)',
          paddingRight: 'var(--spacing-md)',
          opacity: isFirstPage ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
          marginRight: 'var(--spacing-md)',
        }}
        onMouseEnter={(e) => {
          if (!isFirstPage) {
            e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isFirstPage) {
            e.currentTarget.style.backgroundColor = 'var(--color-white)';
          }
        }}
      >
        이전
      </button>

      {/* 페이지 번호 버튼들 */}
      {visiblePages.map((page, index) => {
        if (page === -1) {
          // 말줄임표
          return (
            <span
              key={`ellipsis-${index}`}
              style={{
                padding: 'var(--spacing-xs)',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              ...
            </span>
          );
        }

        const isActive = page === currentPage;

        return (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            style={{
              width: 'var(--size-pagination-button)',
              height: 'var(--size-pagination-button)',
              borderRadius: 'var(--border-radius-full)',
              border: isActive ? 'none' : 'var(--border-width-thin) solid var(--color-text)', // 활성화된 버튼은 테두리 제거, 비활성화 버튼은 기본 색상 테두리 적용
              backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-white)',
              color: isActive ? 'var(--color-white)' : 'var(--color-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              cursor: 'pointer',
              transition: 'var(--transition-all)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'var(--color-white)';
              }
            }}
          >
            {page}
          </button>
        );
      })}

      {/* 다음 버튼 */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLastPage}
        style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderRadius: 'var(--border-radius-xl)',
          border: 'var(--border-width-thin) solid var(--color-text)', // 기본 색상 테두리 적용
          backgroundColor: 'var(--color-white)',
          color: isLastPage ? 'var(--color-gray-500)' : 'var(--color-text)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-normal)',
          cursor: isLastPage ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-all)',
          height: 'var(--size-pagination-button)',
          paddingLeft: 'var(--spacing-md)',
          paddingRight: 'var(--spacing-md)',
          opacity: isLastPage ? 'var(--opacity-disabled)' : 'var(--opacity-full)',
          marginLeft: 'var(--spacing-md)',
        }}
        onMouseEnter={(e) => {
          if (!isLastPage) {
            e.currentTarget.style.backgroundColor = 'var(--color-gray-100)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLastPage) {
            e.currentTarget.style.backgroundColor = 'var(--color-white)';
          }
        }}
      >
        다음
      </button>
    </div>
  );
};
