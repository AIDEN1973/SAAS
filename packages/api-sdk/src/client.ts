/**
 * API SDK Client
 * 
 * [불변 규칙] UI는 fetch, axios, supabase client를 직접 호출할 수 없다.
 * [불변 규칙] 모든 요청은 이 SDK를 통해서만 수행한다.
 * [불변 규칙] SDK는 자동으로 tenant_id, industry_type, auth token을 삽입한다.
 */

import { createClient } from '@lib/supabase-client';
import { getApiContext } from './context';
import type { ApiResponse, ApiClientConfig } from './types';

/**
 * API Client
 * 
 * Zero-Trust 원칙:
 * - UI는 권한을 추론하지 않는다
 * - SDK는 권한을 생성하지 않는다
 * - 권한 결정은 전부 Supabase RLS가 맡는다
 */
export class ApiClient {
  private supabase = createClient();

  /**
   * GET 요청
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
      // RLS가 자동으로 tenant_id 필터링을 처리
      // SDK는 단순히 Supabase 클라이언트를 사용
      // Context는 RLS 정책에서 JWT claim을 통해 자동으로 읽힘
      let query = this.supabase.from(table).select(options?.select || '*');
      
      // 필터 처리
      if (options?.filters) {
        const searchFilters = { ...options.filters };
        
        // search 필터를 name 필드의 ilike로 변환 (ClassFilter 등에서 사용)
        if (searchFilters.search && typeof searchFilters.search === 'string' && searchFilters.search.trim() !== '') {
          query = query.ilike('name', `%${searchFilters.search}%`);
          delete searchFilters.search;
        }
        
        // name 필터가 ilike 패턴인 경우 별도 처리
        if (searchFilters.name && typeof searchFilters.name === 'string' && searchFilters.name.startsWith('ilike.')) {
          const pattern = searchFilters.name.replace('ilike.', '');
          query = query.ilike('name', pattern);
          delete searchFilters.name;
        }
        
        // 나머지 필터 적용 (undefined, null, 빈 문자열 제외)
        Object.entries(searchFilters).forEach(([key, value]) => {
          // undefined, null, 빈 문자열은 필터에서 제외
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


      // 정렬
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // 제한
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
   * POST 요청 (INSERT)
   * 
   * [불변 규칙] SDK는 자동으로 tenant_id를 삽입한다
   * [불변 규칙] industry_type은 테이블에 컬럼이 있는 경우에만 삽입한다
   * [불변 규칙] persons 테이블은 industry_type 컬럼이 없으므로 삽입하지 않는다
   */
  async post<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // [불변 규칙] SDK는 자동으로 tenant_id를 삽입한다
      // Context에서 tenant_id를 가져와서 data에 포함
      const context = getApiContext();
      const insertData = { ...data };
      
      if (context.tenantId && !insertData.tenant_id) {
        insertData.tenant_id = context.tenantId;
      }
      
      // [불변 규칙] industry_type은 특정 테이블에만 존재
      // persons, guardians, student_consultations 등 Core Party 관련 테이블에는 없음
      // industry_type이 있는 테이블: students (View), academy_students 등
      // 테이블별로 처리하거나, data에 이미 industry_type이 있으면 삽입하지 않음
      // 현재는 data에 명시적으로 포함된 경우만 사용
      // 자동 삽입은 하지 않음 (테이블별로 다르기 때문)
      
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
   * PATCH 요청 (UPDATE)
   */
  async patch<T = any>(
    table: string,
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // RLS가 자동으로 tenant_id 필터링 처리
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
   * DELETE 요청
   */
  async delete(
    table: string,
    id: string
  ): Promise<ApiResponse<void>> {
    try {
      // RLS가 자동으로 tenant_id 필터링 처리
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
   * RPC 함수 호출
   * PostgREST가 View를 인식하지 못하는 경우 사용
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
   * 커스텀 엔드포인트 호출 (Edge Function 또는 RPC 함수)
   * 예: student_consultations/{id}/generate-ai-summary
   */
  async call<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
    data?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      // 엔드포인트를 파싱하여 테이블과 ID 추출
      // 예: "student_consultations/123/generate-ai-summary" -> table: "student_consultations", id: "123", action: "generate-ai-summary"
      const parts = endpoint.split('/');
      
      if (parts.length < 2) {
        throw new Error('Invalid endpoint format. Expected: table/id/action');
      }

      const table = parts[0];
      const id = parts[1];
      const action = parts[2];

      // RPC 함수 호출 (예: generate_consultation_ai_summary)
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

      // 일반적인 경우는 기존 메서드 사용
      if (method === 'GET') {
        const result = await this.get<T>(table, { filters: { id } } as any);
        if (result.error) {
          return { error: result.error };
        }
        // 배열의 첫 번째 항목만 반환
        return { data: result.data?.[0] as T };
      } else if (method === 'POST') {
        return this.post<T>(table, { id, ...data });
      } else if (method === 'PATCH') {
        return this.patch<T>(table, id, data || {});
      } else {
        const result = await this.delete(table, id);
        // void를 T로 캐스팅
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
}

/**
 * Default API Client 인스턴스
 */
export const apiClient = new ApiClient();

/**
 * API Client 생성 (필요시)
 * 
 * @param config - 현재는 사용하지 않음 (Context에서 자동으로 가져옴)
 */
export function createApiClient(_config?: ApiClientConfig): ApiClient {
  return new ApiClient();
}

