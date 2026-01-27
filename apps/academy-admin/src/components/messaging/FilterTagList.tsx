/**
 * FilterTagList - 필터 태그 버튼 리스트 컴포넌트
 *
 * [LAYER: UI_COMPONENT]
 * [불변 규칙] 업종 중립 용어 사용 (useIndustryTerms)
 * [불변 규칙] CSS 변수 사용 (design-system 토큰)
 */

import { memo, useState } from 'react';
import { Spinner } from '@ui-core/react';
import { useFilterTagsByCategory } from '@hooks/use-filter-tags';
import {
  FILTER_CATEGORY_CONFIG,
  getSortedCategories,
  type FilterConditionCategory,
} from '@core/notification';

export interface FilterTagListProps {
  onTagClick: (tagId: string) => void;
  selectedTagId?: string | null;
  showCounts?: boolean;
  categoryFilter?: FilterConditionCategory; // 특정 카테고리만 표시 (예: 'popular')
}

// 카테고리별 표시명 매핑 (업종 중립 - 추후 확장 가능)
const getCategoryLabel = (category: FilterConditionCategory): string => {
  return FILTER_CATEGORY_CONFIG[category]?.label ?? category;
};

// 카테고리 아이콘 매핑
const getCategoryIcon = (category: FilterConditionCategory): string => {
  return FILTER_CATEGORY_CONFIG[category]?.icon ?? '';
};

export const FilterTagList = memo(function FilterTagList({
  onTagClick,
  selectedTagId,
  showCounts = false,
  categoryFilter,
}: FilterTagListProps) {
  const { data: groupedTags, isLoading } = useFilterTagsByCategory();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(getSortedCategories().map((c) => c.id))
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 'var(--spacing-lg)',
        }}
      >
        <Spinner size="md" />
      </div>
    );
  }

  if (!groupedTags || Object.keys(groupedTags).length === 0) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        등록된 필터 태그가 없습니다.
      </div>
    );
  }

  // 정렬된 카테고리 순서로 표시 (categoryFilter가 있으면 해당 카테고리만)
  const sortedCategories = categoryFilter
    ? getSortedCategories().filter((c) => c.id === categoryFilter)
    : getSortedCategories();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {sortedCategories.map((categoryConfig) => {
        const category = categoryConfig.id;
        const categoryTags = groupedTags[category];
        if (!categoryTags || categoryTags.length === 0) return null;

        const isExpanded = expandedCategories.has(category);
        const categoryIcon = getCategoryIcon(category);
        const categoryLabel = getCategoryLabel(category);

        return (
          <div key={category}>
            {/* 카테고리 헤더 */}
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                width: '100%',
                padding: 'var(--spacing-xs) 0',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-base)' }}>{categoryIcon}</span>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {categoryLabel}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginLeft: 'var(--spacing-xs)',
                }}
              >
                ({categoryTags.length})
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'var(--transition-all)',
                }}
              >
                ▼
              </span>
            </button>

            {/* 태그 버튼 목록 */}
            {isExpanded && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-xs)',
                }}
              >
                {categoryTags.map((tag) => (
                  <FilterTagButton
                    key={tag.id}
                    tag={tag}
                    isSelected={selectedTagId === tag.id}
                    onClick={() => onTagClick(tag.id)}
                    showCount={showCounts}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// 개별 태그 버튼 컴포넌트
interface FilterTagButtonProps {
  tag: {
    id: string;
    display_label: string;
    color: string;
    usage_count?: number;
  };
  isSelected: boolean;
  onClick: () => void;
  showCount?: boolean;
}

const FilterTagButton = memo(function FilterTagButton({
  tag,
  isSelected,
  onClick,
  showCount,
}: FilterTagButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getBackgroundColor = () => {
    if (isSelected) {
      return tag.color;
    }
    return isHovered ? 'var(--color-gray-100)' : 'var(--color-white)';
  };

  const getTextColor = () => {
    if (isSelected) {
      return 'var(--color-white)';
    }
    return 'var(--color-text-secondary)';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        fontFamily: 'var(--font-family)',
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        border: isSelected
          ? `var(--border-width-thin) solid ${tag.color}`
          : 'var(--border-width-thin) solid var(--color-gray-200)',
        borderRadius: 'var(--border-radius-sm)',
        cursor: 'pointer',
        transition: 'var(--transition-all)',
        lineHeight: 1.2,
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
    >
      {tag.display_label}
      {showCount && tag.usage_count !== undefined && tag.usage_count > 0 && (
        <span
          style={{
            marginLeft: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-xs)',
            opacity: 0.8,
          }}
        >
          ({tag.usage_count})
        </span>
      )}
    </button>
  );
});

export default FilterTagList;
