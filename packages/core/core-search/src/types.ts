/**
 * Core Search Types
 * 
 * Full Text Search ê³µí†µ ?ˆì´??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì¤‘ìš”: Phase 1?€ PostgreSQL Full Text Search, Phase 2+?ì„œ ?¸ë? ê²€???”ì§„ ê²€??
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

