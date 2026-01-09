/**
 * GlobalSearchResults Component
 *
 * 글로벌 검색 결과 표시 컴포넌트 (Phase 2: PostgreSQL FTS 기반)
 * [불변 규칙] 엔티티 타입별 그룹화 표시
 * [불변 규칙] 키보드 네비게이션 지원
 */

import React, { useRef, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import type { IconProps } from 'phosphor-react';
import {
  User,
  Chalkboard,
  Users,
  ChatCircle,
  Megaphone,
  Tag,
  MagnifyingGlass,
  SpinnerGap,
  Warning,
} from 'phosphor-react';
import { Badge } from './Badge';
import type { ColorToken } from '@design-system/core';

/**
 * 검색 가능한 엔티티 타입
 */
export type SearchEntityType =
  | 'student'
  | 'teacher'
  | 'class'
  | 'guardian'
  | 'consultation'
  | 'announcement'
  | 'tag';

/**
 * 검색 결과 항목
 */
export interface SearchResult {
  id: string;
  entity_type: SearchEntityType;
  title: string;
  subtitle: string;
  relevance: number;
  created_at: string;
}

/**
 * 엔티티 타입별 기본 라벨 (업종 중립)
 * [불변 규칙] UI-Core는 업종 중립적 기본값만 제공
 * [불변 규칙] 업종별 라벨은 useGlobalSearch에서 SEARCH_ENTITY_TYPE_LABELS import
 */
const SEARCH_ENTITY_TYPE_LABELS: Record<SearchEntityType, string> = {
  student: 'Primary Person',
  teacher: 'Secondary Person',
  class: 'Group',
  guardian: 'Guardian',
  consultation: 'Consultation',
  announcement: 'Announcement',
  tag: 'Tag',
};

export interface GlobalSearchResultsProps {
  /** 검색 결과 */
  results: SearchResult[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 에러 메시지 */
  error?: string | null;
  /** 검색어 (빈 결과 메시지에 사용) */
  query?: string;
  /** 결과 클릭 핸들러 */
  onResultClick?: (result: SearchResult) => void;
  /** 추가 클래스 */
  className?: string;
  /** 최대 높이 */
  maxHeight?: string;
  /** 그룹화 여부 (기본값: true) */
  grouped?: boolean;
  /** 엔티티 타입별 라벨 (업종별 커스터마이징) */
  entityTypeLabels?: Partial<Record<SearchEntityType, string>>;
}

// 엔티티 타입별 아이콘 컴포넌트 매핑
const ENTITY_ICONS: Record<SearchEntityType, React.ComponentType<IconProps>> = {
  student: User,
  teacher: Chalkboard,
  class: Chalkboard,
  guardian: Users,
  consultation: ChatCircle,
  announcement: Megaphone,
  tag: Tag,
};

// 엔티티 타입별 색상
const ENTITY_COLORS: Record<SearchEntityType, string> = {
  student: 'var(--color-primary)',
  teacher: 'var(--color-success)',
  class: 'var(--color-info)',
  guardian: 'var(--color-warning)',
  consultation: 'var(--color-text-secondary)',
  announcement: 'var(--color-error)',
  tag: 'var(--color-text-tertiary)',
};

// 엔티티 타입별 Badge 색상 (ColorToken)
const ENTITY_BADGE_COLORS: Record<SearchEntityType, ColorToken> = {
  student: 'primary',
  teacher: 'success',
  class: 'info',
  guardian: 'warning',
  consultation: 'secondary',
  announcement: 'error',
  tag: 'info',
};

/**
 * 検索 결과 항목 컴포넌트
 */
const SearchResultItem: React.FC<{
  result: SearchResult;
  onClick?: (result: SearchResult) => void;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  entityTypeLabels?: Partial<Record<SearchEntityType, string>>;
}> = ({ result, onClick, isHighlighted, onMouseEnter, entityTypeLabels }) => {
  const IconComponent = ENTITY_ICONS[result.entity_type];
  const iconColor = ENTITY_COLORS[result.entity_type];
  const labels = { ...SEARCH_ENTITY_TYPE_LABELS, ...entityTypeLabels };

  return (
    <button
      onClick={() => onClick?.(result)}
      onMouseEnter={onMouseEnter}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        width: '100%',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        backgroundColor: isHighlighted ? 'var(--color-primary-hover)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 'var(--border-radius-sm)',
        transition: 'var(--transition-all)',
      }}
    >
      {/* 아이콘 */}
      <div
        style={{
          width: 'var(--size-avatar-sm)',
          height: 'var(--size-avatar-sm)',
          borderRadius: 'var(--border-radius-sm)',
          backgroundColor: 'var(--color-gray-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconComponent
          weight="regular"
          style={{
            width: 'var(--size-icon-base)',
            height: 'var(--size-icon-base)',
            color: iconColor,
          }}
        />
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {result.title}
        </div>
        {result.subtitle && (
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {result.subtitle}
          </div>
        )}
      </div>

      {/* 엔티티 타입 배지 */}
      <Badge
        color={ENTITY_BADGE_COLORS[result.entity_type]}
        variant="solid"
        size="xs"
      >
        {labels[result.entity_type]}
      </Badge>
    </button>
  );
};

/**
 * 검색 결과 그룹 컴포넌트
 */
const SearchResultGroup: React.FC<{
  entityType: SearchEntityType;
  results: SearchResult[];
  onClick?: (result: SearchResult) => void;
  highlightedIndex?: number;
  startIndex: number;
  onItemMouseEnter?: (index: number) => void;
  entityTypeLabels?: Partial<Record<SearchEntityType, string>>;
}> = ({ entityType, results, onClick, highlightedIndex, startIndex, onItemMouseEnter, entityTypeLabels }) => {
  const labels = { ...SEARCH_ENTITY_TYPE_LABELS, ...entityTypeLabels };
  return (
    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      {/* 그룹 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs) var(--spacing-md)',
          borderBottom: 'var(--border-width-thin) solid var(--color-gray-200)',
          marginBottom: 'var(--spacing-xs)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wide)',
          }}
        >
          {labels[entityType]}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          ({results.length})
        </span>
      </div>

      {/* 결과 목록 */}
      {results.map((result, index) => (
        <SearchResultItem
          key={result.id}
          result={result}
          onClick={onClick}
          isHighlighted={highlightedIndex === startIndex + index}
          onMouseEnter={() => onItemMouseEnter?.(startIndex + index)}
          entityTypeLabels={entityTypeLabels}
        />
      ))}
    </div>
  );
};

/**
 * GlobalSearchResults 컴포넌트
 */
export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
  results,
  loading = false,
  error = null,
  query = '',
  onResultClick,
  className,
  maxHeight = 'var(--height-dropdown-max)',
  grouped = true,
  entityTypeLabels,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            onResultClick?.(results[highlightedIndex]);
          }
          break;
        case 'Escape':
          setHighlightedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, highlightedIndex, onResultClick]);

  // 결과 변경 시 하이라이트 초기화
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // 그룹화된 결과 계산
  const groupedResults = grouped
    ? results.reduce<Record<SearchEntityType, SearchResult[]>>(
        (acc, result) => {
          if (!acc[result.entity_type]) {
            acc[result.entity_type] = [];
          }
          acc[result.entity_type].push(result);
          return acc;
        },
        {} as Record<SearchEntityType, SearchResult[]>
      )
    : null;

  // 그룹별 시작 인덱스 계산
  const getStartIndex = (entityType: SearchEntityType): number => {
    if (!groupedResults) return 0;
    let index = 0;
    for (const type of Object.keys(groupedResults) as SearchEntityType[]) {
      if (type === entityType) return index;
      index += groupedResults[type].length;
    }
    return index;
  };

  // 로딩 상태
  if (loading) {
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-xl)',
          gap: 'var(--spacing-md)',
        }}
      >
        <SpinnerGap
          weight="bold"
          style={{
            width: 'var(--size-spinner-lg)',
            height: 'var(--size-spinner-lg)',
            color: 'var(--color-primary)',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          검색 중...
        </span>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-xl)',
          gap: 'var(--spacing-md)',
        }}
      >
        <Warning
          weight="regular"
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: 'var(--color-error)',
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-error)',
            textAlign: 'center',
          }}
        >
          {error}
        </span>
      </div>
    );
  }

  // 빈 결과 (검색어 있을 때만)
  if (results.length === 0 && query.trim()) {
    return (
      <div
        className={clsx(className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-xl)',
          gap: 'var(--spacing-md)',
        }}
      >
        <MagnifyingGlass
          weight="regular"
          style={{
            width: 'var(--size-icon-xl)',
            height: 'var(--size-icon-xl)',
            color: 'var(--color-text-tertiary)',
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
          }}
        >
          "{query}"에 대한 검색 결과가 없습니다.
        </span>
      </div>
    );
  }

  // 검색어 없을 때
  if (results.length === 0) {
    return null;
  }

  // 결과 표시
  return (
    <div
      ref={containerRef}
      className={clsx(className)}
      style={{
        maxHeight,
        overflowY: 'auto',
        padding: 'var(--spacing-sm)',
      }}
    >
      {grouped && groupedResults ? (
        // 그룹화된 결과
        (Object.keys(groupedResults) as SearchEntityType[]).map((entityType) => (
          <SearchResultGroup
            key={entityType}
            entityType={entityType}
            results={groupedResults[entityType]}
            onClick={onResultClick}
            highlightedIndex={highlightedIndex}
            startIndex={getStartIndex(entityType)}
            onItemMouseEnter={setHighlightedIndex}
            entityTypeLabels={entityTypeLabels}
          />
        ))
      ) : (
        // 플랫 결과
        results.map((result, index) => (
          <SearchResultItem
            key={result.id}
            result={result}
            onClick={onResultClick}
            isHighlighted={highlightedIndex === index}
            onMouseEnter={() => setHighlightedIndex(index)}
            entityTypeLabels={entityTypeLabels}
          />
        ))
      )}
    </div>
  );
};
