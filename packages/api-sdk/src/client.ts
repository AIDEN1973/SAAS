/**
 * API SDK Client
 * 
 * [불�? 규칙] UI??fetch, axios, supabase client�?직접 ?�출?????�다.
 * [불�? 규칙] 모든 ?�청?� ??SDK�??�해?�만 ?�행?�다.
 * [불�? 규칙] SDK???�동?�로 tenant_id, industry_type, auth token???�입?�다.
 */

import { createClient } from '@lib/supabase-client';
import { getApiContext } from './context';
import type { ApiResponse, ApiClientConfig } from './types';
import { SchemaRegistryClient, type SchemaRegistryEntry, type FormSchema, type UISchema } from '@schema-engine';

/**
 * API Client
 * 
 * Zero-Trust ?�칙:
 * - UI??권한??추론?��? ?�는??
 * - SDK??권한???�성?��? ?�는??
 * - 권한 결정?� ?��? Supabase RLS가 맡는??
 */
export class ApiClient {
  private supabase = createClient();

  /**
   * GET ?�청
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
      // RLS가 ?�동?�로 tenant_id ?�터링을 처리
      // SDK???�순??Supabase ?�라?�언?��? ?�용
      // Context??RLS ?�책?�서 JWT claim???�해 ?�동?�로 ?�힘
      let query = this.supabase.from(table).select(options?.select || '*');
      
      // ?�터 처리
      if (options?.filters) {
        const searchFilters = { ...options.filters };
        
        // search ?�터�?name ?�드??ilike�?변??(ClassFilter ?�에???�용)
        if (searchFilters.search && typeof searchFilters.search === 'string' && searchFilters.search.trim() !== '') {
          query = query.ilike('name', `%${searchFilters.search}%`);
          delete searchFilters.search;
        }
        
        // name ?�터가 ilike ?�턴??경우 별도 처리
        if (searchFilters.name && typeof searchFilters.name === 'string' && searchFilters.name.startsWith('ilike.')) {
          const pattern = searchFilters.name.replace('ilike.', '');
          query = query.ilike('name', pattern);
          delete searchFilters.name;
        }
        
        // ?�머지 ?�터 ?�용 (undefined, null, �?문자???�외)
        Object.entries(searchFilters).forEach(([key, value]) => {
          // undefined, null, �?문자?��? ?�터?�서 ?�외
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


      // ?�렬
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // ?�한
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
   * POST ?�청 (INSERT)
   * 
   * [불�? 규칙] SDK???�동?�로 tenant_id�??�입?�다
   * [불�? 규칙] industry_type?� ?�이블에 컬럼???�는 경우?�만 ?�입?�다
   * [불�? 규칙] persons ?�이블�? industry_type 컬럼???�으므�??�입?��? ?�는??
   */
  async post<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // [불�? 규칙] SDK???�동?�로 tenant_id�??�입?�다
      // Context?�서 tenant_id�?가?��???data???�함
      const context = getApiContext();
      const insertData = { ...data };
      
      if (context.tenantId && !insertData.tenant_id) {
        insertData.tenant_id = context.tenantId;
      }
      
      // [불�? 규칙] industry_type?� ?�정 ?�이블에�?존재
      // persons, guardians, student_consultations ??Core Party 관???�이블에???�음
      // industry_type???�는 ?�이�? students (View), academy_students ??
      // ?�이블별�?처리?�거?? data???��? industry_type???�으�??�입?��? ?�음
      // ?�재??data??명시?�으�??�함??경우�??�용
      // ?�동 ?�입?� ?��? ?�음 (?�이블별�??�르�??�문)
      
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
   * PATCH ?�청 (UPDATE)
   */
  async patch<T = any>(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // RLS가 ?�동?�로 tenant_id ?�터�?처리
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
   * DELETE ?�청
   */
  async delete(
    table: string,
    id: string
  ): Promise<ApiResponse<void>> {
    try {
      // RLS가 ?�동?�로 tenant_id ?�터�?처리
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
   * RPC ?�수 ?�출
   * PostgREST가 View�??�식?��? 못하??경우 ?�용
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
   * 커스?� ?�드?�인???�출 (Edge Function ?�는 RPC ?�수)
   * ?? student_consultations/{id}/generate-ai-summary
   */
  async call<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // ?�드?�인?��? ?�싱?�여 ?�이블과 ID 추출
      // ?? "student_consultations/123/generate-ai-summary" -> table: "student_consultations", id: "123", action: "generate-ai-summary"
      const parts = endpoint.split('/');
      
      if (parts.length < 2) {
        throw new Error('Invalid endpoint format. Expected: table/id/action');
      }

      const table = parts[0];
      const id = parts[1];
      const action = parts[2];

      // RPC ?�수 ?�출 (?? generate_consultation_ai_summary)
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

      // ?�반?�인 경우??기존 메서???�용
      if (method === 'GET') {
        const result = await this.get<T>(table, { filters: { id } } as any);
        if (result.error) {
          return { error: result.error };
        }
        // 배열??�?번째 ??���?반환
        return { data: result.data?.[0] as T };
      } else if (method === 'POST') {
        return this.post<T>(table, { id, ...data });
      } else if (method === 'PATCH') {
        return this.patch<T>(table, id, data || {});
      } else {
        const result = await this.delete(table, id);
        // void�?T�?캐스??
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
   * Schema Registry?�서 ?�키�?조회
   * 
   * [불�? 규칙] 기술문서 PART 1??5. Schema Registry ?�영 문서�?준?�합?�다.
   * [불�? 규칙] meta.schema_registry??공통 ?�키�??�?�소?��?�?tenant_id 컬럼???�습?�다.
   * [불�? 규칙] RLS ?�책???�라 모든 ?�증???�용?��? ?�기 가?�합?�다.
   * 
   * 기술문서: docu/?�키마엔�?txt 5.2 Schema Registry Service ?�용�?
   * 
   * @param entity - ?�키�??�티?�명 (?? 'student', 'class', 'teacher')
   * @param options - 조회 ?�션
   * @returns ?�키�??�이???�는 null
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

      // 1. ?�넌?�별 Version Pinning 조회
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

      // 2. ?�성 ?�키�?조회 (status = 'active')
      let query = this.supabase
        .from('meta.schema_registry')
        .select('*')
        .eq('entity', entity)
        .eq('status', 'active');

      // Industry�??�터�?
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

      // 3. Version Pinning???�으�??�당 버전�??�터�?
      // ?�️ 중요: entries???��? status='active'�??�터링된 ?�태?�니??
      // Version Pinning???�으�??�당 버전�??�택?�고, ?�으�?모든 ?�성 ?�키마�? ?�용?�니??
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
          // 버전 ?�림차순 ?�렬 (최신 버전 ?�선)
          const aVersion = a.version.split('.').map(Number);
          const bVersion = b.version.split('.').map(Number);
          for (let i = 0; i < 3; i++) {
            if (aVersion[i] !== bVersion[i]) {
              return bVersion[i] - aVersion[i];
            }
          }
          return 0;
        });

      // 4. SchemaRegistryClient�??�용?�여 ?�선?�위???�라 ?�키�??�택
      // ?�️ 참고: fallbackSchema??useSchema hook?�서 처리?��?�??�기?�는 undefined ?�달
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

      // FormSchema�??�??캐스??(UISchema??FormSchema | TableSchema?��?�? ?�재??FormSchema�?지??
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
 * Default API Client ?�스?�스
 */
export const apiClient = new ApiClient();

/**
 * API Client ?�성 (?�요??
 * 
 * @param config - ?�재???�용?��? ?�음 (Context?�서 ?�동?�로 가?�옴)
 */
export function createApiClient(_config?: ApiClientConfig): ApiClient {
  return new ApiClient();
}

