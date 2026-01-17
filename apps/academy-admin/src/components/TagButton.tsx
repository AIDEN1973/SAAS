/**
 * 태그 버튼 컴포넌트 (학생 수 표시)
 *
 * [LAYER: UI_COMPONENT]
 *
 * 태그별 학생 수를 표시하는 재사용 가능한 버튼 컴포넌트
 */

import { memo } from 'react';
import { Button } from '@ui-core/react';
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

  return (
    <Button
      variant={isSelected ? 'solid' : 'outline'}
      size="sm"
      onClick={onClick}
      style={{
        fontSize: 'calc(var(--font-size-sm) - var(--spacing-xxs))',
        backgroundColor: isSelected ? tag.color : 'var(--color-white)',
        color: isSelected ? 'var(--color-white)' : undefined,
        borderColor: isSelected ? tag.color : undefined,
      }}
    >
      {tag.name} ({count})
    </Button>
  );
});
