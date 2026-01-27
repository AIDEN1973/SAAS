/**
 * useFilterTags Hook
 *
 * 태그 기반 회원 필터링을 위한 React Query Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 */

export {
  useFilterTags,
  useFilterTagsByCategory,
  useApplyFilterTag,
  useCreateFilterTag,
  useUpdateFilterTag,
  useDeleteFilterTag,
  fetchFilterTags,
  fetchFilteredStudents,
} from './useFilterTags';

export type {
  FilterTag,
  FilterTagFilter,
  FilteredStudent,
  CreateFilterTagInput,
  UpdateFilterTagInput,
} from './useFilterTags';
