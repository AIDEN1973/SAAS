/**
 * 시간대 필터 배지 컴포넌트
 *
 * [LAYER: UI_PAGE]
 */

import React from 'react';

export type TimeRangeFilter = 'all' | 'morning' | 'afternoon' | 'evening';

interface TimeRangeFilterBadgesProps {
  timeRangeFilter: TimeRangeFilter;
  onFilterChange: (filter: TimeRangeFilter) => void;
}

const TIME_RANGE_OPTIONS: Array<{ value: TimeRangeFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'morning', label: '오전' },
  { value: 'afternoon', label: '오후' },
  { value: 'evening', label: '저녁' },
];

export function TimeRangeFilterBadges({ timeRangeFilter, onFilterChange }: TimeRangeFilterBadgesProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: 'var(--spacing-md)',
    }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        {TIME_RANGE_OPTIONS.map((option) => {
          const isSelected = timeRangeFilter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-white)',
                color: isSelected ? 'var(--color-white)' : 'var(--color-text-secondary)',
                border: isSelected ? 'none' : 'var(--border-width-thin) solid var(--color-gray-200)',
                borderRadius: 'var(--border-radius-xs)',
                cursor: 'pointer',
                transition: 'var(--transition-all)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--color-white)';
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
