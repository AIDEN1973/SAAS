/**
 * API SDK Client
 * 
 * [ë¶ˆë? ê·œì¹™] UI??fetch, axios, supabase clientë¥?ì§ì ‘ ?¸ì¶œ?????†ë‹¤.
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?”ì²­?€ ??SDKë¥??µí•´?œë§Œ ?˜í–‰?œë‹¤.
 * [ë¶ˆë? ê·œì¹™] SDK???ë™?¼ë¡œ tenant_id, industry_type, auth token???½ì…?œë‹¤.
 */

import { createClient } from '@lib/supabase-client';
import { getApiContext } from './context';
import type { ApiResponse, ApiClientConfig } from './types';
import { SchemaRegistryClient, type SchemaRegistryEntry } from '@schema/engine/registry/client';
import type { FormSchema, UISchema } from '@schema/engine/types';

/**
 * API Client
 * 
 * Zero-Trust ?ì¹™:
 * - UI??ê¶Œí•œ??ì¶”ë¡ ?˜ì? ?ŠëŠ”??
 * - SDK??ê¶Œí•œ???ì„±?˜ì? ?ŠëŠ”??
 * - ê¶Œí•œ ê²°ì •?€ ?„ë? Supabase RLSê°€ ë§¡ëŠ”??
 */
export class ApiClient {
  private supabase = createClient();

  /**
   * GET ?”ì²­
   */
  async get<T = any>(
    table: string,
    options?: {
      select?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    }
  ): Promise<ApiResponse<T[]>> {
    try {
      // RLSê°€ ?ë™?¼ë¡œ tenant_id ?„í„°ë§ì„ ì²˜ë¦¬
      // SDK???¨ìˆœ??Supabase ?´ë¼?´ì–¸?¸ë? ?¬ìš©
      // Context??RLS ?•ì±…?ì„œ JWT claim???µí•´ ?ë™?¼ë¡œ ?½í˜
      let query = this.supabase.from(table).select(options?.select || '*');
      
      // ?„í„° ì²˜ë¦¬
      if (options?.filters) {
        const searchFilters = { ...options.filters };
        
        // search ?„í„°ë¥?name ?„ë“œ??ilikeë¡?ë³€??(ClassFilter ?±ì—???¬ìš©)
        if (searchFilters.search && typeof searchFilters.search === 'string' && searchFilters.search.trim() !== '') {
          query = query.ilike('name', `%${searchFilters.search}%`);
          delete searchFilters.search;
        }
        
        // name ?„í„°ê°€ ilike ?¨í„´??ê²½ìš° ë³„ë„ ì²˜ë¦¬
        if (searchFilters.name && typeof searchFilters.name === 'string' && searchFilters.name.startsWith('ilike.')) {
          const pattern = searchFilters.name.replace('ilike.', '');
          query = query.ilike('name', pattern);
          delete searchFilters.name;
        }
        
        // ?˜ë¨¸ì§€ ?„í„° ?ìš© (undefined, null, ë¹?ë¬¸ì???œì™¸)
        Object.entries(searchFilters).forEach(([key, value]) => {
          // undefined, null, ë¹?ë¬¸ì?´ì? ?„í„°?ì„œ ?œì™¸
          if (value === undefined || value === null || value === '') {
            return;
          }
          
          if (Array.isArray(value)) {
            if (value.length > 0) {
              query = query.in(key, value);
            }
          } else {
            query = query.eq(key, value);
          }
        });
      }


      // ?•ë ¬
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // ?œí•œ
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data: data as T[] };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * POST ?”ì²­ (INSERT)
   * 
   * [ë¶ˆë? ê·œì¹™] SDK???ë™?¼ë¡œ tenant_idë¥??½ì…?œë‹¤
   * [ë¶ˆë? ê·œì¹™] industry_type?€ ?Œì´ë¸”ì— ì»¬ëŸ¼???ˆëŠ” ê²½ìš°?ë§Œ ?½ì…?œë‹¤
   * [ë¶ˆë? ê·œì¹™] persons ?Œì´ë¸”ì? industry_type ì»¬ëŸ¼???†ìœ¼ë¯€ë¡??½ì…?˜ì? ?ŠëŠ”??
   */
  async post<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // [ë¶ˆë? ê·œì¹™] SDK???ë™?¼ë¡œ tenant_idë¥??½ì…?œë‹¤
      // Context?ì„œ tenant_idë¥?ê°€?¸ì???data???¬í•¨
      const context = getApiContext();
      const insertData = { ...data };
      
      if (context.tenantId && !insertData.tenant_id) {
        insertData.tenant_id = context.tenantId;
      }
      
      // [ë¶ˆë? ê·œì¹™] industry_type?€ ?¹ì • ?Œì´ë¸”ì—ë§?ì¡´ì¬
      // persons, guardians, student_consultations ??Core Party ê´€???Œì´ë¸”ì—???†ìŒ
      // industry_type???ˆëŠ” ?Œì´ë¸? students (View), academy_students ??
      // ?Œì´ë¸”ë³„ë¡?ì²˜ë¦¬?˜ê±°?? data???´ë? industry_type???ˆìœ¼ë©??½ì…?˜ì? ?ŠìŒ
      // ?„ì¬??data??ëª…ì‹œ?ìœ¼ë¡??¬í•¨??ê²½ìš°ë§??¬ìš©
      // ?ë™ ?½ì…?€ ?˜ì? ?ŠìŒ (?Œì´ë¸”ë³„ë¡??¤ë¥´ê¸??Œë¬¸)
      
      const { data: result, error } = await this.supabase
        .from(table)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data: result as T };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * PATCH ?”ì²­ (UPDATE)
   */
  async patch<T = any>(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // RLSê°€ ?ë™?¼ë¡œ tenant_id ?„í„°ë§?ì²˜ë¦¬
      const { data: result, error } = await this.supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data: result as T };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * DELETE ?”ì²­
   */
  async delete(
    table: string,
    id: string
  ): Promise<ApiResponse<void>> {
    try {
      // RLSê°€ ?ë™?¼ë¡œ tenant_id ?„í„°ë§?ì²˜ë¦¬
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return {};
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * RPC ?¨ìˆ˜ ?¸ì¶œ
   * PostgRESTê°€ Viewë¥??¸ì‹?˜ì? ëª»í•˜??ê²½ìš° ?¬ìš©
   */
  async rpc<T = any>(
    functionName: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T[]>> {
    try {
      const { data, error } = await this.supabase.rpc(functionName, params || {});

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data: (data || []) as T[] };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * ì»¤ìŠ¤?€ ?”ë“œ?¬ì¸???¸ì¶œ (Edge Function ?ëŠ” RPC ?¨ìˆ˜)
   * ?? student_consultations/{id}/generate-ai-summary
   */
  async call<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // ?”ë“œ?¬ì¸?¸ë? ?Œì‹±?˜ì—¬ ?Œì´ë¸”ê³¼ ID ì¶”ì¶œ
      // ?? "student_consultations/123/generate-ai-summary" -> table: "student_consultations", id: "123", action: "generate-ai-summary"
      const parts = endpoint.split('/');
      
      if (parts.length < 2) {
        throw new Error('Invalid endpoint format. Expected: table/id/action');
      }

      const table = parts[0];
      const id = parts[1];
      const action = parts[2];

      // RPC ?¨ìˆ˜ ?¸ì¶œ (?? generate_consultation_ai_summary)
      if (action) {
        const rpcFunctionName = `${table}_${action}`.replace(/-/g, '_');
        const { data: result, error } = await this.supabase.rpc(rpcFunctionName, {
          consultation_id: id,
          ...data,
        });

        if (error) {
          return {
            error: {
              message: error.message,
              code: error.code,
            },
          };
        }

        return { data: result as T };
      }

      // ?¼ë°˜?ì¸ ê²½ìš°??ê¸°ì¡´ ë©”ì„œ???¬ìš©
      if (method === 'GET') {
        const result = await this.get<T>(table, { filters: { id } } as any);
        if (result.error) {
          return { error: result.error };
        }
        // ë°°ì—´??ì²?ë²ˆì§¸ ??ª©ë§?ë°˜í™˜
        return { data: result.data?.[0] as T };
      } else if (method === 'POST') {
        return this.post<T>(table, { id, ...data });
      } else if (method === 'PATCH') {
        return this.patch<T>(table, id, data || {});
      } else {
        const result = await this.delete(table, id);
        // voidë¥?Të¡?ìºìŠ¤??
        return result as ApiResponse<T>;
      }
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Schema Registry?ì„œ ?¤í‚¤ë§?ì¡°íšŒ
   * 
   * [ë¶ˆë? ê·œì¹™] ê¸°ìˆ ë¬¸ì„œ PART 1??5. Schema Registry ?´ì˜ ë¬¸ì„œë¥?ì¤€?˜í•©?ˆë‹¤.
   * [ë¶ˆë? ê·œì¹™] meta.schema_registry??ê³µí†µ ?¤í‚¤ë§??€?¥ì†Œ?´ë?ë¡?tenant_id ì»¬ëŸ¼???†ìŠµ?ˆë‹¤.
   * [ë¶ˆë? ê·œì¹™] RLS ?•ì±…???°ë¼ ëª¨ë“  ?¸ì¦???¬ìš©?ê? ?½ê¸° ê°€?¥í•©?ˆë‹¤.
   * 
   * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 5.2 Schema Registry Service ?¬ìš©ë²?
   * 
   * @param entity - ?¤í‚¤ë§??”í‹°?°ëª… (?? 'student', 'class', 'teacher')
   * @param options - ì¡°íšŒ ?µì…˜
   * @returns ?¤í‚¤ë§??°ì´???ëŠ” null
   */
  async getSchema(
    entity: string,
    options?: {
      tenant_id?: string;
      industry_type?: string;
      client_version?: string;
    }
  ): Promise<ApiResponse<FormSchema>> {
    try {
      const context = getApiContext();
      const tenantId = options?.tenant_id || context.tenantId;
      const industryType = options?.industry_type || context.industryType;
      const clientVersion = options?.client_version || '1.0.0';

      // 1. ?Œë„Œ?¸ë³„ Version Pinning ì¡°íšŒ
      let pinnedVersion: string | null = null;
      if (tenantId) {
        const pinResponse = await this.get<{ pinned_version: string }>('meta.tenant_schema_pins', {
          filters: {
            tenant_id: tenantId,
            entity,
            industry_type: industryType || null,
          },
          limit: 1,
        });

        if (!pinResponse.error && pinResponse.data && pinResponse.data.length > 0) {
          pinnedVersion = pinResponse.data[0].pinned_version;
        }
      }

      // 2. ?œì„± ?¤í‚¤ë§?ì¡°íšŒ (status = 'active')
      let query = this.supabase
        .from('meta.schema_registry')
        .select('*')
        .eq('entity', entity)
        .eq('status', 'active');

      // Industryë³??„í„°ë§?
      if (industryType) {
        query = query.or(`industry_type.eq.${industryType},industry_type.is.null`);
      } else {
        query = query.is('industry_type', null);
      }

      const { data: entries, error } = await query;

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      // 3. Version Pinning???ˆìœ¼ë©??´ë‹¹ ë²„ì „ë§??„í„°ë§?
      // ? ï¸ ì¤‘ìš”: entries???´ë? status='active'ë¡??„í„°ë§ëœ ?íƒœ?…ë‹ˆ??
      // Version Pinning???ˆìœ¼ë©??´ë‹¹ ë²„ì „ë§?? íƒ?˜ê³ , ?†ìœ¼ë©?ëª¨ë“  ?œì„± ?¤í‚¤ë§ˆë? ?¬ìš©?©ë‹ˆ??
      const filteredEntries: SchemaRegistryEntry[] = (entries || [])
        .filter((e: any) => {
          if (pinnedVersion) {
            return e.version === pinnedVersion;
          }
          return true;
        })
        .map((e: any) => ({
          id: e.id,
          entity: e.entity,
          industry_type: e.industry_type,
          version: e.version,
          min_supported_client: e.min_supported_client,
          schema_json: e.schema_json as UISchema,
          status: e.status as 'draft' | 'active' | 'deprecated',
          activated_at: e.activated_at,
        }))
        .sort((a, b) => {
          // ë²„ì „ ?´ë¦¼ì°¨ìˆœ ?•ë ¬ (ìµœì‹  ë²„ì „ ?°ì„ )
          const aVersion = a.version.split('.').map(Number);
          const bVersion = b.version.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if (aVersion[i] !== bVersion[i]) {
              return bVersion[i] - aVersion[i];
            }
          }
          return 0;
        });

      // 4. SchemaRegistryClientë¥??¬ìš©?˜ì—¬ ?°ì„ ?œìœ„???°ë¼ ?¤í‚¤ë§?? íƒ
      // ? ï¸ ì°¸ê³ : fallbackSchema??useSchema hook?ì„œ ì²˜ë¦¬?˜ë?ë¡??¬ê¸°?œëŠ” undefined ?„ë‹¬
      const client = new SchemaRegistryClient({
        tenantId,
        industryType: industryType || undefined,
        clientVersion,
        fallbackSchema: undefined,
      });

      const resolvedSchema = client.resolveSchema(entity, filteredEntries);

      if (!resolvedSchema) {
        return {
          error: {
            message: `Schema not found for entity: ${entity}`,
          },
        };
      }

      // FormSchemaë¡??€??ìºìŠ¤??(UISchema??FormSchema | TableSchema?´ì?ë§? ?„ì¬??FormSchemaë§?ì§€??
      return { data: resolvedSchema as FormSchema };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

/**
 * Default API Client ?¸ìŠ¤?´ìŠ¤
 */
export const apiClient = new ApiClient();

/**
 * API Client ?ì„± (?„ìš”??
 * 
 * @param config - ?„ì¬???¬ìš©?˜ì? ?ŠìŒ (Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´)
 */
export function createApiClient(_config?: ApiClientConfig): ApiClient {
  return new ApiClient();
}

