/**
 * Core Search Service
 *
 * Full Text Search 서비스 (Phase 2: PostgreSQL FTS 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 중요: Phase 2는 PostgreSQL Full Text Search (simple 사전, 공백 기준 토큰화)
 * Phase 3+에서 전문 검색엔진(Meilisearch, Algolia 등) 검토
 */

import { createServerClient } from '@lib/supabase-client/server';
import type {
  SearchResult,
  SearchInput,
  SearchEntityType,
} from './types';
import { DEFAULT_SEARCH_ENTITY_TYPES } from './types';

export class SearchService {
  private supabase = createServerClient();

  /**
   * 통합 검색 (Phase 2: PostgreSQL FTS RPC 기반)
   *
   * @param tenantId - 테넌트 ID
   * @param input - 검색 입력 파라미터
   * @returns 검색 결과 배열 (관련도 순 정렬)
   */
  async search(
    tenantId: string,
    input: SearchInput
  ): Promise<SearchResult[]> {
    const query = input.query?.trim();

    // 빈 검색어 처리
    if (!query) {
      return [];
    }

    const entityTypes = input.entity_types || DEFAULT_SEARCH_ENTITY_TYPES;
    const limit = input.limit || 20;

    // Phase 2: PostgreSQL Full Text Search RPC 호출
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await this.supabase.rpc('global_search', {
      p_tenant_id: tenantId,
      p_query: query,
      p_entity_types: entityTypes,
      p_limit: limit,
    });

    if (error) {
      console.error('[SearchService] global_search RPC error:', error);
      return [];
    }

    // RPC 결과를 SearchResult 타입으로 변환
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (data || []).map((item: {
      id: string;
      entity_type: string;
      title: string;
      subtitle: string;
      relevance: number;
      created_at: string;
    }) => ({
      id: item.id,
      entity_type: item.entity_type as SearchEntityType,
      title: item.title,
      subtitle: item.subtitle,
      relevance: item.relevance,
      created_at: item.created_at,
    }));
  }

  /**
   * 특정 엔티티 타입만 검색
   *
   * @param tenantId - 테넌트 ID
   * @param entityType - 검색할 엔티티 타입
   * @param query - 검색어
   * @param limit - 결과 제한 (기본값: 10)
   * @returns 검색 결과 배열
   */
  async searchByEntityType(
    tenantId: string,
    entityType: SearchEntityType,
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    return this.search(tenantId, {
      query,
      entity_types: [entityType],
      limit,
    });
  }
}

/**
 * Default Service Instance
 */
export const searchService = new SearchService();
