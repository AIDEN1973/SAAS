/**
 * Core Search Types
 * 
 * Full Text Search 공통 레이어
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 중요: Phase 1은 PostgreSQL Full Text Search, Phase 2+에서 외부 검색 엔진 검토
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

