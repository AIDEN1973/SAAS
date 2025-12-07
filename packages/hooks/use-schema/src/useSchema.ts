/**
 * useSchema Hook
 * 
 * [ë¶ˆë? ê·œì¹™] React Query ê¸°ë°˜ Schema Registry ì¡°íšŒ Hook
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId, industryType?€ Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 5.2 Schema Registry Service ?¬ìš©ë²?
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { FormSchema } from '@schema/engine';

/**
 * Schema Registry?ì„œ ?¤í‚¤ë§?ì¡°íšŒ Hook
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§?ì¡°íšŒ ?°ì„ ?œìœ„:
 * 1. ?Œë„Œ?¸ë³„ Version Pinning
 * 2. Industryë³??œì„± ?¤í‚¤ë§?
 * 3. ê³µí†µ ?œì„± ?¤í‚¤ë§?
 * 4. Fallback ?¤í‚¤ë§?
 * 
 * @param entity - ?¤í‚¤ë§??”í‹°?°ëª… (?? 'student', 'class', 'teacher')
 * @param fallbackSchema - Fallback ?¤í‚¤ë§?(Registry ì¡°íšŒ ?¤íŒ¨ ???¬ìš©)
 * @returns React Query result with schema data
 */
export function useSchema(entity: string, fallbackSchema?: FormSchema) {
  const context = getApiContext();
  
  return useQuery({
    queryKey: ['schema', entity, context.tenantId, context.industryType],
    queryFn: async () => {
      // [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ??ëª…ì‹œ???€ë¡?apiClientë¥??µí•´ Schema Registry ì¡°íšŒ
      // apiClient.getSchema???´ë??ìœ¼ë¡?meta.schema_registry ?Œì´ë¸”ì„ ì¡°íšŒ?˜ê³ 
      // SchemaRegistryClient??resolveSchema ë¡œì§???¬ìš©?˜ì—¬ ?°ì„ ?œìœ„???°ë¼ ?¤í‚¤ë§ˆë? ? íƒ?©ë‹ˆ??
      const response = await apiClient.getSchema(entity, {
        tenant_id: context.tenantId,
        industry_type: context.industryType,
        client_version: '1.0.0',
      });
      
      if (response.error || !response.data) {
        // ? ï¸ ì¤‘ìš”: fallbackSchema???¸ëŸ¬ë¸”ìŠˆ?…ìš©?…ë‹ˆ??
        // ?¤í‚¤ë§?ë¶€?????±ì´ ì£½ì? ?Šë„ë¡?fallback??? ì??´ì•¼ ?©ë‹ˆ??
        // 
        // ? ï¸ ?„ìˆ˜ ê·œì¹™: fallbackSchema??entity + industry ì¡°í•©?¼ë¡œ ê°œë³„ ?œê³µ?˜ì–´???©ë‹ˆ??
        // - academy/studentFormSchema
        // - salon/customerFormSchema
        // - realestate/contractFormSchema
        // ê°ê° ë³„ë„ë¡?ì¡´ì¬?´ì•¼ ?˜ë©°, ?…ì¢…ë³„ë¡œ êµ¬ë¶„??fallback ?¤í‚¤ë§ˆë? ?œê³µ?´ì•¼ ?©ë‹ˆ??
        return fallbackSchema || null;
      }
      
      return response.data;
    },
    // ? ï¸ ì¤‘ìš”: staleTime ?´ì˜ ëª¨ë“œë³??¤ì •
    // - ?´ì˜ ëª¨ë“œ(Production): staleTime=5ë¶?? ì? (?±ëŠ¥ ìµœì ??
    // - ê°œë°œ/ë¦´ë¦¬???˜ê²½: staleTime=0 ?¬ìš© ê°€??(?¤í‚¤ë§?ë³€ê²½ì´ ??? ê²½ìš°)
    staleTime: 5 * 60 * 1000, // 5ë¶?(?´ì˜ ëª¨ë“œ ê¸°ì?)
    enabled: !!context.tenantId, // tenantIdê°€ ?ˆì„ ?Œë§Œ ì¡°íšŒ
  });
}

