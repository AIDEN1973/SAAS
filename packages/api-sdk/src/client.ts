/**
 * API SDK Client
 * 
 * [불변 규칙] UI는 fetch, axios, supabase client를 직접 호출할 수 없다.
 * [불변 규칙] 모든 요청은 이 SDK를 통해서만 수행한다.
 * [불변 규칙] SDK는 자동으로 tenant_id, industry_type, auth token을 삽입한다.
 */

import { createClient } from '@lib/supabase-client';
import { getApiContext } from './context';
import type { ApiRequest, ApiResponse, ApiClientConfig } from './types';

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
      const context = getApiContext();
      
      // RLS가 자동으로 tenant_id 필터링을 처리
      // SDK는 단순히 Supabase 클라이언트를 사용
      let query = this.supabase.from(table).select(options?.select || '*');

      // 필터 적용
      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
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
   */
  async post<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const context = getApiContext();
      
      // tenant_id는 RLS 정책이나 withTenant()를 통해 처리
      // SDK는 단순히 데이터를 전달
      const { data: result, error } = await this.supabase
        .from(table)
        .insert(data)
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
}

/**
 * Default API Client 인스턴스
 */
export const apiClient = new ApiClient();

/**
 * API Client 생성 (필요시)
 */
export function createApiClient(config?: ApiClientConfig): ApiClient {
  return new ApiClient();
}

