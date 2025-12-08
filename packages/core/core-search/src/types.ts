/**
 * Core Search Types
 *
 * Full Text Search 공통 시스템
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 중요: Phase 1은 PostgreSQL Full Text Search, Phase 2+에서 전문 검색엔진(Meilisearch, Algolia 등) 검토
 */

export type SearchEntityType = 'person' | 'consultation' | 'post' | 'review' | 'event';

export interface SearchResult {
  id: string;
  entity_type: SearchEntityType;
  title?: string;
  content?: string;
  relevance?: number;
  created_at: string;
}

export interface SearchInput {
  query: string;
  entity_types?: SearchEntityType[];
  limit?: number;
  offset?: number;
}
