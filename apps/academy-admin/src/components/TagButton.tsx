/**
 * 태그 버튼 컴포넌트 (학생 수 표시)
 *
 * [LAYER: UI_COMPONENT]
 *
 * 태그별 학생 수를 표시하는 재사용 가능한 버튼 컴포넌트
 * StatsDashboard 우측 상단 기간 필터 버튼과 동일한 작은 높이 스타일 적용
 */

import { memo, useState } from 'react';
import { useStudentsPaged } from '@hooks/use-student';

export interface TagButtonProps {
  tag: { id: string; name: string; color: string };
  isSelected: boolean;
  onClick: () => void;
}

export const TagButton = memo(function TagButton({ tag, isSelected, onClick }: TagButtonProps) {
  // 이 태그가 붙은 학생 수 조회
  const { data: studentsPaged } = useStudentsPaged({
    filter: { tag_ids: [tag.id] },
    page: 1,
    pageSize: 1, // 개수만 필요하므로 1개만 조회
  });

  const count = (studentsPaged as { totalCount: number } | undefined)?.totalCount ?? 0;

  // hover 상태 관리 (StatsDashboard와 동일한 패턴)
  const [isHovered, setIsHovered] = useState(false);

  // hover 시 배경색 계산 (StatsDashboard 기간 필터 버튼과 동일)
  const getBackgroundColor = () => {
    if (isSelected) {
      return isHovered ? tag.color : tag.color; // 선택 시 태그 색상 유지
    }
    return isHovered ? 'var(--color-primary-hover)' : 'var(--color-white)';
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        // StatsDashboard 기간 필터 버튼과 동일한 작은 높이 스타일
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        fontFamily: 'var(--font-family)',
        backgroundColor: getBackgroundColor(),
        color: isSelected ? 'var(--color-white)' : 'var(--color-text-secondary)',
        border: isSelected ? `var(--border-width-thin) solid ${tag.color}` : 'var(--border-width-thin) solid var(--color-gray-200)',
        borderRadius: 'var(--border-radius-xs)',
        cursor: 'pointer',
        transition: 'var(--transition-all)',
        minWidth: 'auto',
        minHeight: 'auto',
        lineHeight: 1,
        boxSizing: 'border-box',
      }}
    >
      {tag.name} ({count})
    </button>
  );
});
