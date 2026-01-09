/**
 * Virtual Tag List Component
 *
 * 가상 스크롤을 적용한 태그 리스트
 * [성능] 100개 이상의 태그도 부드럽게 스크롤
 */

import React, { useMemo } from 'react';
import { Button } from '@ui-core/react';
import { useVirtualScroll } from '../hooks/useVirtualScroll';

export interface VirtualTagListProps {
  tags: Array<{ id: string; name: string; color: string }>;
  selectedTagIds: string[];
  onTagClick: (tagId: string) => void;
  filter?: string;
}

export const VirtualTagList: React.FC<VirtualTagListProps> = ({
  tags,
  selectedTagIds,
  onTagClick,
  filter,
}) => {
  // 필터링된 태그
  const filteredTags = useMemo(() => {
    if (!filter) return tags;
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [tags, filter]);

  const { parentRef, virtualItems, totalSize } = useVirtualScroll({
    count: filteredTags.length,
    estimateSize: 35,
    overscan: 5,
  });

  if (filteredTags.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        {filter ? '검색 결과가 없습니다.' : '태그가 없습니다.'}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{
        height: '400px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const tag = filteredTags[virtualItem.index];
          const isSelected = selectedTagIds.includes(tag.id);

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                padding: 'var(--spacing-xs)',
              }}
            >
              <Button
                variant={isSelected ? 'solid' : 'outline'}
                size="sm"
                onClick={() => onTagClick(tag.id)}
                style={{
                  width: '100%',
                  fontSize: 'calc(var(--font-size-sm) - var(--spacing-xxs))',
                  backgroundColor: isSelected ? tag.color : 'var(--color-white)',
                  color: isSelected ? 'var(--color-white)' : undefined,
                }}
              >
                {tag.name}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
