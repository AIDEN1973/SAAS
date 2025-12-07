/**
 * Pagination Component
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 */

import React from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showFirstLast?: boolean;
  maxVisible?: number;
}

/**
 * Pagination ì»´í¬?ŒíŠ¸
 * 
 * ?˜ì´ì§€?¤ì´??ì»¨íŠ¸ë¡?
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showFirstLast = true,
  maxVisible = 5,
}) => {
  const getVisiblePages = () => {
    const pages: number[] = [];
    const half = Math.floor(maxVisible / 2);
    
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  if (totalPages <= 1) return null;

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
      {showFirstLast && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          style={{
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          Â«
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        ??
      </Button>
      
      {visiblePages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'solid' : 'outline'}
          color={page === currentPage ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onPageChange(page)}
          style={{
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          {page}
        </Button>
      ))}
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          minWidth: '44px',
          minHeight: '44px',
        }}
      >
        ??
      </Button>
      {showFirstLast && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={{
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          Â»
        </Button>
      )}
    </div>
  );
};

