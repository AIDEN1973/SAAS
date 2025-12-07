/**
 * Core Search Service
 * 
 * Full Text Search ?œë¹„??(PostgreSQL FTS ê¸°ë°˜)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì¤‘ìš”: Phase 1?€ PostgreSQL Full Text Search
 * Phase 2+?ì„œ ?¸ë? ê²€???”ì§„(Meilisearch, Algolia ?? ê²€??
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
   * ?µí•© ê²€??
   */
  async search(
    tenantId: string,
    input: SearchInput
  ): Promise<SearchResult[]> {
    // Phase 1: PostgreSQL Full Text Search
    // ê°??”í‹°???€?…ë³„ë¡?ê²€????ê²°ê³¼ ë³‘í•©
    const results: SearchResult[] = [];

    const entityTypes = input.entity_types || ['person', 'consultation', 'post', 'review', 'event'];

    for (const entityType of entityTypes) {
      const entityResults = await this.searchEntity(tenantId, entityType, input.query);
      results.push(...entityResults);
    }

    // ê´€?¨ë„ ???•ë ¬
    results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    // ?˜ì´ì§?
    const limit = input.limit || 20;
    const offset = input.offset || 0;
    return results.slice(offset, offset + limit);
  }

  /**
   * ?¹ì • ?”í‹°???€??ê²€??
   */
  private async searchEntity(
    tenantId: string,
    entityType: SearchEntityType,
    query: string
  ): Promise<SearchResult[]> {
    // PostgreSQL Full Text Search êµ¬í˜„
    // ê°??”í‹°???€?…ë³„ ?Œì´ë¸”ì—??ê²€??
    // ?? persons, consultations, posts, reviews, events

    // ê¸°ë³¸ êµ¬í˜„: ILIKE ê²€??(Phase 1)
    // Phase 2+?ì„œ PostgreSQL FTS ?¸ë±???œìš©

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
      relevance: 1, // ê¸°ë³¸ê°? Phase 2+?ì„œ ?¤ì œ ê´€?¨ë„ ê³„ì‚°
      created_at: item.created_at,
    }));
  }
}

/**
 * Default Service Instance
 */
export const searchService = new SearchService();

