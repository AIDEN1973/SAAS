/**
 * API SDK Client
 *
 * [불변 규칙] UI에서 fetch, axios, supabase client를 직접 호출하지 않습니다.
 * [불변 규칙] 모든 요청은 SDK를 통해서만 수행합니다.
 * [불변 규칙] SDK가 자동으로 tenant_id, industry_type, auth token을 삽입합니다.
 */

import { createClient } from '@lib/supabase-client';
import { withTenant } from '@lib/supabase-client/db';
import { getApiContext } from './context';
import type { ApiResponse, ApiClientConfig } from './types';

/**
 * API Client
 *
 * Zero-Trust 원칙:
 * - UI에서 권한을 추론하지 않습니다.
 * - SDK에서 권한을 생성하지 않습니다.
 * - 권한 결정은 오직 Supabase RLS가 맡습니다.
 */
export class ApiClient {
  private supabase = createClient();

  /**
   * GET 요청
   */
  async get<T = unknown>(
    table: string,
    options?: {
      select?: string;
      filters?: Record<string, unknown>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      range?: { from: number; to: number };
      count?: 'exact' | 'planned' | 'estimated';
    }
  ): Promise<ApiResponse<T[]>> {
    try {
      const context = getApiContext();

      if (!context?.tenantId) {
        return {
          success: false,
          error: {
            message: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          },
          data: undefined,
        };
      }

      // 필터 처리 (withTenant 적용 전에 쿼리 빌드)
      // count가 필요하면 select({ count }) 사용
      let baseQuery = this.supabase
        .from(table)
        .select(options?.select || '*', options?.count ? { count: options.count } : undefined);

      if (options?.filters) {
        const searchFilters = { ...options.filters };

        // search 필터를 name 필드에 ilike로 변환 (ClassFilter 등에서 사용)
        if (searchFilters.search && typeof searchFilters.search === 'string' && searchFilters.search.trim() !== '') {
          baseQuery = baseQuery.ilike('name', `%${searchFilters.search}%`);
          delete searchFilters.search;
        }

        // name 필터가 ilike 패턴인 경우 별도 처리
        if (searchFilters.name && typeof searchFilters.name === 'string') {
          baseQuery = baseQuery.ilike('name', `%${searchFilters.name}%`);
          delete searchFilters.name;
        }

        // 나머지 필터 적용 (undefined, null, 빈 문자열은 제외)
        Object.entries(searchFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            // 범위 연산자 처리 (gte, lte, gt, lt)
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
              if ('gte' in value) {
                baseQuery = baseQuery.gte(key, value.gte);
              }
              if ('lte' in value) {
                baseQuery = baseQuery.lte(key, value.lte);
              }
              if ('gt' in value) {
                baseQuery = baseQuery.gt(key, value.gt);
              }
              if ('lt' in value) {
                baseQuery = baseQuery.lt(key, value.lt);
              }
              // 범위 연산자가 없으면 객체 전체를 무시 (예: Date 객체)
              if (!('gte' in value || 'lte' in value || 'gt' in value || 'lt' in value)) {
                // 객체가 범위 연산자가 아니면 무시하거나 경고
                console.warn(`[ApiClient] Filter value for ${key} is an object without range operators, ignoring:`, value);
              }
            } else if (Array.isArray(value)) {
              baseQuery = baseQuery.in(key, value);
            } else {
              baseQuery = baseQuery.eq(key, value);
            }
          }
        });
      }

      // 정렬
      if (options?.orderBy) {
        baseQuery = baseQuery.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }

      // 제한
      if (options?.limit) {
        baseQuery = baseQuery.limit(options.limit);
      }

      // range (서버 페이지네이션)
      if (options?.range) {
        baseQuery = baseQuery.range(options.range.from, options.range.to);
      }

      // [불변 규칙] SELECT 쿼리는 반드시 withTenant()를 사용하여 tenant_id 필터를 강제합니다.
      // 단, 공통 테이블(tenant_id 컬럼이 없는 테이블)은 예외 처리
      // 공통 테이블: industry_themes (tenant_id 없음), schema-registry (meta 스키마)
      // tenant_theme_overrides는 tenant_id가 primary key이지만, filters에 이미 명시되어 있으므로 withTenant 사용
      const isCommonTable = table === 'industry_themes' || table.startsWith('schema-registry/');
      const query = isCommonTable ? baseQuery : withTenant(baseQuery, context.tenantId);

      const { data, error, count } = await query;

      if (error) {
        // schema-registry 요청의 404 에러는 조용히 처리 (스키마가 없을 수 있음)
        const isSchemaRegistryRequest = table.startsWith('schema-registry/');
        const isNotFoundError = error.code === 'PGRST116' ||
          error.code === 'PGRST204' ||
          error.message?.toLowerCase().includes('404') ||
          error.message?.toLowerCase().includes('not found') ||
          error.message?.toLowerCase().includes('does not exist');

        // schema-registry의 404는 정상적인 상황이므로 콘솔에 에러를 출력하지 않음
        if (isSchemaRegistryRequest && isNotFoundError) {
          // 조용히 처리 (useSchema 훅에서 fallback 사용)
        } else if (process.env.NODE_ENV === 'development' && !isSchemaRegistryRequest) {
          // 개발 환경에서만 schema-registry가 아닌 요청의 에러를 로그로 출력
          console.warn(`[ApiClient] GET ${table} error:`, error);
        }

        return {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
          },
          data: undefined,
        };
      }

      return {
        success: true,
        data: data as T[],
        count: count ?? undefined,
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
      };
    }
  }

  /**
   * POST 요청
   *
   * [불변 규칙] SDK가 자동으로 tenant_id를 삽입합니다
   * [불변 규칙] industry_type은 테이블에 컬럼이 있는 경우에만 삽입합니다
   * [불변 규칙] persons 테이블은 industry_type 컬럼이 없으므로 삽입하지 않습니다
   */
  async post<T = unknown>(
    table: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const context = getApiContext();

      console.group(`🔍 [ApiClient.post] ${table} 테이블 INSERT`);
      console.log('📋 Context:', {
        tenantId: context?.tenantId,
        industryType: context?.industryType,
      });
      console.log('📤 입력 데이터 (tenant_id 주입 전):', data);

      if (!context?.tenantId) {
        console.error('❌ tenant_id 없음!');
        console.groupEnd();
        return {
          success: false,
          error: {
            message: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          },
          data: undefined,
        };
      }

      // [불변 규칙] SDK가 자동으로 tenant_id를 삽입합니다
      // Context에서 tenant_id를 가져와서 data에 포함
      const payload: Record<string, unknown> = {
        ...data,
        tenant_id: context.tenantId,
      };

      // persons, guardians, student_consultations 등 Core Party 관리 테이블에는 industry_type이 없습니다
      // industry_type이 있는 테이블: students (View), academy_students 등
      // 테이블별로 처리하거나, data에 명시적으로 포함된 경우에만 사용
      if (context.industryType && data.industry_type !== undefined) {
        (payload as Record<string, unknown>).industry_type = context.industryType;
      }

      console.log('📤 최종 Payload (tenant_id 주입 후):', payload);

      const { data: result, error } = await this.supabase
        .from(table)
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('❌ INSERT 실패:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        console.groupEnd();
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
          },
          data: undefined,
        };
      }

      console.log('✅ INSERT 성공!');
      console.log('📥 생성된 데이터:', result);
      console.groupEnd();

      return {
        success: true,
        data: result as T,
        error: undefined,
      };
    } catch (error) {
      console.error('❌ 예외 발생:', error);
      console.groupEnd();
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
      };
    }
  }

  /**
   * PATCH 요청
   */
  async patch<T = unknown>(
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const context = getApiContext();

      if (!context?.tenantId) {
        return {
          success: false,
          error: {
            message: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          },
          data: undefined,
        };
      }

      // [불변 규칙] academy_students 테이블은 person_id를 PRIMARY KEY로 사용
      // 다른 테이블은 id를 PRIMARY KEY로 사용
      const primaryKey = table === 'academy_students' ? 'person_id' : 'id';

      const { data: result, error } = await withTenant(
        this.supabase
          .from(table)
          .update(data)
          .eq(primaryKey, id)
          .select(),
        context.tenantId
      ).single();

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
          },
          data: undefined,
        };
      }

      return {
        success: true,
        data: result as T,
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
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
      const context = getApiContext();

      if (!context?.tenantId) {
        return {
          success: false,
          error: {
            message: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          },
          data: undefined,
        };
      }

      const { error } = await withTenant(
        this.supabase
          .from(table)
          .delete()
          .eq('id', id),
        context.tenantId
      );

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
          },
          data: undefined,
        };
      }

      return {
        success: true,
        data: undefined,
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
      };
    }
  }

  /**
   * PostgREST가 View를 수정하지 못하는 경우 사용
   */
  async callRPC<T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await this.supabase.rpc(functionName, params || {});

      if (error) {
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
          },
          data: undefined,
        };
      }

      return {
        success: true,
        data: data as T,
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
      };
    }
  }

  /**
   * 커스텀 엔드포인트 호출 (Edge Function 또는 RPC 함수)
   */
  async callCustom<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<ApiResponse<T>> {
    try {
      const context = getApiContext();

      if (!context?.tenantId) {
        return {
          success: false,
          error: {
            message: 'Tenant ID is required',
            code: 'TENANT_ID_REQUIRED',
          },
          data: undefined,
        };
      }

      // 일반적인 경우는 기존 메서드를 사용
      if (method === 'GET') {
        const getResponse = await this.get<T>(endpoint);
        // get은 T[]를 반환하지만 callCustom은 T를 반환해야 함
        if (getResponse.data && Array.isArray(getResponse.data) && getResponse.data.length > 0) {
          return {
            success: getResponse.success,
            data: getResponse.data[0] as T,
            error: getResponse.error,
          };
        }
        return {
          success: getResponse.success,
          data: undefined,
          error: getResponse.error,
        };
      } else if (method === 'POST') {
        return this.post<T>(endpoint, (body || {}) as Record<string, unknown>);
      } else if (method === 'PATCH') {
        // PATCH는 id가 필요하므로 별도 처리 필요
        throw new Error('PATCH method requires id parameter. Use patch() method instead.');
      } else if (method === 'DELETE') {
        // DELETE는 id가 필요하므로 별도 처리 필요
        throw new Error('DELETE method requires id parameter. Use delete() method instead.');
      }

      return {
        success: false,
        error: {
          message: 'Unsupported method',
          code: 'UNSUPPORTED_METHOD',
        },
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
        data: undefined,
      };
    }
  }

  /**
   * Schema Registry에서 스키마 로드 (Deprecated)
   *
   * ⚠️ 중요: 이 메서드는 기술문서 규칙 위반으로 인해 사용되지 않습니다.
   * 기술문서: docu/스키마엔진.txt 296-299줄
   * "UI/클라이언트는 직접 meta.schema_registry를 조회하지 않고,
   * @api-sdk/core의 서버사이드 API를 통해서만 접근합니다."
   *
   * 대신 useSchema Hook을 사용하세요:
   * - packages/hooks/use-schema/src/useSchema.ts
   * - useSchema Hook은 내부적으로 서버 API를 호출합니다.
   *
   * @deprecated 기술문서 규칙 위반. useSchema Hook을 사용하세요.
   */
  async loadSchema(
    _entity: string,
    _type: 'form' | 'table' | 'detail' | 'filter' | 'widget' = 'form'
  ): Promise<unknown | null> {
    // ⚠️ 이 메서드는 사용되지 않습니다.
    // useSchema Hook을 사용하세요.
    console.warn('[API SDK] loadSchema is deprecated. Use useSchema Hook instead.');
      return null;
  }
}

/**
 * API Client 생성 함수
 *
 * 필요시 커스텀 설정으로 새로운 인스턴스를 생성할 수 있습니다.
 * 대부분의 경우 기본 인스턴스(apiClient)를 사용하면 됩니다.
 */
export function createApiClient(_config?: ApiClientConfig): ApiClient {
  return new ApiClient();
}

/**
 * Default API Client Instance
 */
export const apiClient = new ApiClient();
