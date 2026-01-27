/**
 * useFilterTags Hook
 *
 * 태그 기반 회원 필터링을 위한 React Query Hook
 * [불변 규칙] tenant 변경 시 invalidateQueries() 자동 발생
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] RPC 호출 시 tenant_id 필수 전달
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { FilterConditionCategory } from '@core/notification';

// ============================================================================
// Types
// ============================================================================

export interface FilterTag {
  id: string;
  tenant_id: string;
  name: string;
  display_label: string;
  category: FilterConditionCategory;
  color: string;
  icon?: string;
  condition_type: string;
  condition_params: Record<string, unknown>;
  is_active: boolean;
  is_system_default: boolean;
  sort_order: number;
  usage_count: number;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface FilterTagFilter {
  category?: FilterConditionCategory;
  is_active?: boolean;
  search?: string;
}

export interface FilteredStudent {
  student_id: string;
  student_name: string;
  phone: string;
  metadata: Record<string, unknown>;
}

export interface CreateFilterTagInput {
  name: string;
  display_label: string;
  category: FilterConditionCategory;
  condition_type: string;
  condition_params?: Record<string, unknown>;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateFilterTagInput {
  id: string;
  name?: string;
  display_label?: string;
  category?: FilterConditionCategory;
  condition_type?: string;
  condition_params?: Record<string, unknown>;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * 필터 태그 목록 조회 함수
 * [불변 규칙] useQuery 내부에서도 이 함수를 사용하여 일관성 유지
 */
export async function fetchFilterTags(
  tenantId: string,
  filter?: FilterTagFilter
): Promise<FilterTag[]> {
  if (!tenantId) {
    return [];
  }

  try {
    const filters: Record<string, unknown> = {
      is_active: filter?.is_active ?? true,
    };

    if (filter?.category) {
      filters.category = filter.category;
    }

    const response = await apiClient.get<FilterTag>('message_filter_tags', {
      filters,
      orderBy: { column: 'sort_order', ascending: true },
      limit: 500,
    });

    if (response.error) {
      // 테이블이 아직 생성되지 않았을 수 있으므로 빈 배열 반환
      if (
        response.error.message?.includes('does not exist') ||
        response.error.message?.includes('relation')
      ) {
        return [];
      }
      throw new Error(response.error.message);
    }

    let tags = (response.data || []) as FilterTag[];

    // 클라이언트 사이드 검색 필터링
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      tags = tags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(searchLower) ||
          tag.display_label.toLowerCase().includes(searchLower)
      );
    }

    return tags;
  } catch (error) {
    // 테이블이 없으면 빈 배열 반환
    return [];
  }
}

/**
 * 필터 태그 적용하여 회원 필터링
 * [불변 규칙] PostgreSQL Function 호출 (apply_filter_tag)
 */
export async function fetchFilteredStudents(
  tenantId: string,
  tagId: string
): Promise<FilteredStudent[]> {
  if (!tenantId || !tagId) {
    return [];
  }

  try {
    const response = await apiClient.callRPC<FilteredStudent[]>('apply_filter_tag', {
      p_tenant_id: tenantId,
      p_tag_id: tagId,
    });

    if (response.error) {
      // RPC 함수가 존재하지 않거나 400/404 에러인 경우 빈 배열 반환
      if (
        response.error.message?.includes('does not exist') ||
        response.error.message?.includes('function') ||
        response.error.message?.includes('404') ||
        response.error.message?.includes('400')
      ) {
        console.warn('[useFilterTags] apply_filter_tag RPC 함수가 아직 배포되지 않았습니다.');
        return [];
      }
      throw new Error(response.error.message);
    }

    // PostgreSQL 함수에서 이미 중복 제거되어 반환되므로 그대로 사용
    return (response.data || []) as FilteredStudent[];
  } catch (error) {
    // 네트워크 에러 등은 빈 배열 반환
    console.warn('[useFilterTags] fetchFilteredStudents error:', error);
    return [];
  }
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * 필터 태그 목록 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */
export function useFilterTags(filter?: FilterTagFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<FilterTag[]>({
    queryKey: ['filter-tags', tenantId, filter],
    queryFn: () => fetchFilterTags(tenantId!, filter),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 카테고리별로 그룹화된 필터 태그 조회 Hook
 */
export function useFilterTagsByCategory(filter?: Omit<FilterTagFilter, 'category'>) {
  const { data: tags, ...rest } = useFilterTags(filter);

  const groupedTags = tags?.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<FilterConditionCategory, FilterTag[]>
  );

  return {
    data: groupedTags,
    tags,
    ...rest,
  };
}

/**
 * 필터 태그 적용하여 회원 필터링 Hook
 */
export function useApplyFilterTag(tagId: string | null) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<FilteredStudent[]>({
    queryKey: ['filtered-students', tenantId, tagId],
    queryFn: () => fetchFilteredStudents(tenantId!, tagId!),
    enabled: !!tenantId && !!tagId,
    staleTime: 0, // 항상 최신 데이터 조회
    retry: false, // RPC 함수 미배포 시 반복 요청 방지
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * 필터 태그 생성 Hook
 */
export function useCreateFilterTag() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFilterTagInput) => {
      if (!tenantId) throw new Error('tenantId is required');

      const response = await apiClient.post<FilterTag>('message_filter_tags', {
        tenant_id: tenantId,
        ...input,
        condition_params: input.condition_params || {},
        color: input.color || '#E5E7EB',
        sort_order: input.sort_order || 0,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as FilterTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['filter-tags', tenantId],
      });
    },
  });
}

/**
 * 필터 태그 수정 Hook
 */
export function useUpdateFilterTag() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateFilterTagInput) => {
      if (!tenantId) throw new Error('tenantId is required');

      const { id, ...updateData } = input;

      const response = await apiClient.patch<FilterTag>('message_filter_tags', id, updateData);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as FilterTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['filter-tags', tenantId],
      });
    },
  });
}

/**
 * 필터 태그 삭제 Hook (Soft Delete)
 */
export function useDeleteFilterTag() {
  const context = getApiContext();
  const tenantId = context.tenantId;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!tenantId) throw new Error('tenantId is required');

      // Soft delete: is_active = false
      const response = await apiClient.patch<FilterTag>('message_filter_tags', tagId, {
        is_active: false,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data as FilterTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['filter-tags', tenantId],
      });
    },
  });
}
