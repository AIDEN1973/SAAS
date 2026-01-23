/**
 * 앱 전역 검색 훅
 * 글로벌 검색 API 호출 및 결과 처리
 */
import { useCallback } from 'react';
import { useGlobalSearch } from '@ui-core/react';
import type { SearchResult } from '@ui-core/react';
import { getApiContext } from '@api-sdk/core';

interface GlobalSearchResult {
  id: string;
  entity_type: string;
  title: string;
  subtitle: string;
  relevance: number;
  created_at: string;
}

interface UseAppSearchOptions {
  onNavigate: (path: string) => void;
}

export function useAppSearch({ onNavigate }: UseAppSearchOptions) {
  // 글로벌 검색 API 호출 함수
  const handleGlobalSearch = useCallback(async (input: { query: string; entity_types?: string[]; limit?: number }) => {
    const context = getApiContext();
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return [];
    }

    try {
      const { apiClient } = await import('@api-sdk/core');

      const response = await apiClient.callRPC<GlobalSearchResult[]>('global_search', {
        p_tenant_id: tenantId,
        p_query: input.query,
        p_entity_types: input.entity_types || ['student', 'teacher', 'class', 'guardian', 'consultation', 'announcement', 'tag'],
        p_limit: input.limit || 20,
      });

      if (!response.success) {
        console.error('[GlobalSearch] RPC error:', response.error);
        return [];
      }

      const results = response.data || [];
      return results.map((item) => ({
        id: item.id,
        entity_type: item.entity_type as SearchResult['entity_type'],
        title: item.title,
        subtitle: item.subtitle,
        relevance: item.relevance,
        created_at: item.created_at,
      }));
    } catch (error) {
      console.error('[GlobalSearch] Error:', error);
      return [];
    }
  }, []);

  // 글로벌 검색 훅
  const globalSearch = useGlobalSearch({
    tenantId: getApiContext()?.tenantId || '',
    onSearch: handleGlobalSearch,
  });

  // 검색 결과 클릭 핸들러
  const handleSearchResultClick = useCallback(async (result: SearchResult) => {
    switch (result.entity_type) {
      case 'student':
        onNavigate(`/students/${result.id}`);
        break;
      case 'teacher':
        onNavigate(`/teachers/${result.id}`);
        break;
      case 'class':
        onNavigate(`/classes/${result.id}`);
        break;
      case 'guardian':
        try {
          const { apiClient } = await import('@api-sdk/core');

          const response = await apiClient.get<{ student_id: string }>('guardians', {
            select: 'student_id',
            filters: { id: result.id },
            limit: 1,
          });

          if (!response.success || !response.data?.length) {
            console.error('[GlobalSearch] Failed to find student for guardian:', response.error);
            onNavigate(`/students/list`);
            return;
          }

          const guardian = response.data[0];
          onNavigate(`/students/list?studentId=${guardian.student_id}&panel=guardians`);
        } catch (error) {
          console.error('[GlobalSearch] Error navigating to guardian:', error);
          onNavigate(`/students/list`);
        }
        break;
      case 'consultation':
        onNavigate(`/students/list`);
        break;
      case 'announcement':
        onNavigate(`/notifications`);
        break;
      case 'tag':
        onNavigate(`/students/list`);
        break;
      default:
        onNavigate(`/home`);
    }
  }, [onNavigate]);

  return {
    ...globalSearch,
    handleSearchResultClick,
  };
}
