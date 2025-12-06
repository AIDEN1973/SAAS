/**
 * Core Search Service
 * 
 * Full Text Search 서비스 (PostgreSQL FTS 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 중요: Phase 1은 PostgreSQL Full Text Search
 * Phase 2+에서 외부 검색 엔진(Meilisearch, Algolia 등) 검토
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  SearchResult,
  SearchInput,
  SearchEntityType,
} from './types';

export class SearchService {
  private supabase = createServerClient();

  /**
   * 통합 검색
   */
  async search(
    tenantId: string,
    input: SearchInput
  ): Promise<SearchResult[]> {
    // Phase 1: PostgreSQL Full Text Search
    // 각 엔티티 타입별로 검색 후 결과 병합
    const results: SearchResult[] = [];

    const entityTypes = input.entity_types || ['person', 'consultation', 'post', 'review', 'event'];

    for (const entityType of entityTypes) {
      const entityResults = await this.searchEntity(tenantId, entityType, input.query);
      results.push(...entityResults);
    }

    // 관련도 순 정렬
    results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    // 페이징
    const limit = input.limit || 20;
    const offset = input.offset || 0;
    return results.slice(offset, offset + limit);
  }

  /**
   * 특정 엔티티 타입 검색
   */
  private async searchEntity(
    tenantId: string,
    entityType: SearchEntityType,
    query: string
  ): Promise<SearchResult[]> {
    // PostgreSQL Full Text Search 구현
    // 각 엔티티 타입별 테이블에서 검색
    // 예: persons, consultations, posts, reviews, events

    // 기본 구현: ILIKE 검색 (Phase 1)
    // Phase 2+에서 PostgreSQL FTS 인덱스 활용

    let tableName: string;
    let titleColumn: string;
    let contentColumn: string;

    switch (entityType) {
      case 'person':
        tableName = 'persons';
        titleColumn = 'name';
        contentColumn = 'name';
        break;
      case 'consultation':
        tableName = 'consultations';
        titleColumn = 'title';
        contentColumn = 'content';
        break;
      case 'post':
        tableName = 'posts';
        titleColumn = 'title';
        contentColumn = 'content';
        break;
      case 'review':
        tableName = 'reviews';
        titleColumn = 'title';
        contentColumn = 'content';
        break;
      case 'event':
        tableName = 'events';
        titleColumn = 'title';
        contentColumn = 'description';
        break;
      default:
        return [];
    }

    const { data, error } = await withTenant(
      this.supabase
        .from(tableName)
        .select('id, created_at')
        .or(`${titleColumn}.ilike.%${query}%,${contentColumn}.ilike.%${query}%`)
        .limit(10),
      tenantId
    );

    if (error) {
      console.error(`Search error for ${entityType}:`, error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      entity_type: entityType,
      relevance: 1, // 기본값, Phase 2+에서 실제 관련도 계산
      created_at: item.created_at,
    }));
  }
}

/**
 * Default Service Instance
 */
export const searchService = new SearchService();

