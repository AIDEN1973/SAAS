/**
 * useSchema Hook
 *
 * [불변 규칙] React Query 기반 Schema Registry 조회 Hook
 * [불변 규칙] Zero-Trust: tenantId, industryType은 Context에서 자동으로 가져옴
 *
 * 기술문서: docu/스키마엔진.txt 5.2 Schema Registry Service 사용법
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { FormSchema, TableSchema, DetailSchema, FilterSchema, WidgetSchema, UISchema } from '@schema-engine';

type SchemaType = 'form' | 'table' | 'detail' | 'filter' | 'widget';

type SchemaByType<T extends SchemaType> =
  T extends 'form' ? FormSchema :
  T extends 'table' ? TableSchema :
  T extends 'detail' ? DetailSchema :
  T extends 'filter' ? FilterSchema :
  T extends 'widget' ? WidgetSchema :
  UISchema;

/**
 * Schema Registry에서 스키마 조회 Hook
 *
 * [불변 규칙] 스키마 조회 우선순위:
 * 1. 테넌트별 Version Pinning
 * 2. Industry별 생성 스키마
 * 3. 공통 생성 스키마
 * 4. Fallback 스키마
 *
 * @param entity - 스키마 엔티티명 (예: 'student', 'class', 'teacher')
 * @param type - 스키마 타입 (예: 'form', 'table', 'detail', 'filter')
 * @param fallbackSchema - Fallback 스키마(Registry 조회 실패 시 사용)
 * @returns React Query result with schema data
 */
export function useSchema<T extends SchemaType = 'form'>(
  entity: string,
  fallbackSchema?: SchemaByType<T>,
  type: T = 'form' as T
) {
  const context = getApiContext();

  return useQuery<SchemaByType<T> | null>({
    queryKey: ['schema', entity, type, context.tenantId, context.industryType],
    queryFn: async () => {
      // schema-registry 요청은 404가 정상이므로 에러를 throw하지 않음
      // [불변 규칙] 기술문서에 명시된 대로 apiClient.get을 통해 Schema Registry 조회
      // 중요: UI/클라이언트는 직접 meta.schema_registry를 조회하지 않고,
      // @api-sdk/core의 서버사이드 API를 통해서만 접근합니다.
      // 기술문서: docu/스키마엔진.txt 5.2 Schema Registry Service 사용법
      //
      // 참고: 기술문서 예시에서는 params를 사용하지만, 실제 apiClient.get 구현은 filters를 사용합니다.
      // apiClient.get의 두 번째 파라미터는 options 객체이며, 그 안에 filters 속성이 있습니다.
      // 중요: schema-registry View를 사용하고 entity 필드로 필터링
      const table = 'schema_registry';

      try {
        // meta.schema_registry는 공통 테이블이므로 tenant_id 필터를 사용하지 않음
        // tenant_id는 Version Pinning 조회에만 사용됨
        // 중요: client_version과 type은 schema_json JSONB 내부에 있으므로 PostgREST에서 직접 필터링 불가
        // status='active'로만 필터링하고, 클라이언트에서 추가 필터링 수행
        const response = await apiClient.get<{
          id: string;
          entity: string;
          industry_type: string | null;
          version: string;
          min_supported_client: string;
          schema_json: SchemaByType<T>;
          status: string;
        }>(
          table,
          {
            filters: {
              entity: entity,
              industry_type: context.industryType,
              status: 'active',
            },
          }
        );

        // 404 에러는 스키마가 없다는 것을 의미하므로 조용히 처리
        // PGRST116은 "데이터 없음" 에러 코드입니다
        // schema-registry 엔드포인트는 스키마가 없을 수 있으므로 404는 정상적인 상황입니다
        // schema-registry 요청은 항상 조용히 처리 (스키마가 없을 수 있음)
        const tableStr = String(table);
        const isSchemaRegistryRequest = tableStr === 'schema_registry' || tableStr.startsWith('schema-registry/');

        const isNotFoundError = response.error && (
          response.error.code === 'PGRST116' ||
          response.error.code === 'PGRST204' || // 테이블 없음
          response.error.message?.toLowerCase().includes('404') ||
          response.error.message?.toLowerCase().includes('not found') ||
          response.error.message?.toLowerCase().includes('does not exist')
        );

        if (
          response.error ||
          !response.data ||
          (Array.isArray(response.data) && response.data.length === 0) ||
          isNotFoundError
        ) {
          // 운영 정책: Schema Registry 조회 실패 시 처리 방식
          // - 운영 환경(Production): 에러 처리 필수 (Fail-Closed, fail-open 방지)
          // - 개발/테스트 환경: fallbackSchema 허용 (개발 편의성)
          // 중요: 운영 환경에서는 fallbackSchema를 사용하지 않으며, Schema Registry 조회 실패 시 명확한 에러를 반환해야 합니다.
          // 개발/테스트 환경에서만 fallbackSchema를 사용하여 앱이 죽지 않도록 할 수 있습니다.
          //
          // 필수 규칙: fallbackSchema는 entity + industry 조합으로 개별 제공되어야 합니다
          // - academy/studentFormSchema
          // - salon/customerFormSchema
          // - real_estate/contractFormSchema  // 정본: real_estate (언더스코어 필수)
          // 각각 별도로 존재해야 하며, 업종별로 구분된 fallback 스키마를 제공해야 합니다

          // schema-registry 요청의 경우 로그를 출력하지 않음 (404는 정상적인 상황)
          // 다른 에러의 경우에만 개발 환경에서 로그 출력
          if (import.meta.env.DEV && response.error && !isNotFoundError && !isSchemaRegistryRequest) {
            console.log(`[useSchema] Schema not found in registry, using fallback: ${entity} (${type})`);
          }

          // 환경별 분기 처리
          // [불변 규칙] Vite 환경에서 import.meta.env.PROD는 빌드 타임에 주입됨
          // import.meta.env.MODE === 'production'도 빌드 타임에 결정됨
          // 운영 환경(Production): 에러 처리 필수 (Fail-Closed, fail-open 방지)
          if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
            // 운영 환경: 에러 처리 필수 (Fail-Closed)
            throw new Error(`Schema Registry 조회 실패: ${entity} (tenant: ${context.tenantId}, industry: ${context.industryType})`);
          }

          // 개발/테스트 환경: fallbackSchema 허용
          return (fallbackSchema as SchemaByType<T>) || null;
        }

        // response.data가 배열인 경우 클라이언트에서 추가 필터링
        if (!response.data || (Array.isArray(response.data) && response.data.length === 0)) {
          // 환경별 분기 처리
          // [불변 규칙] Vite 환경에서 import.meta.env.PROD는 빌드 타임에 주입됨
          // import.meta.env.MODE === 'production'도 빌드 타임에 결정됨
          // 운영 환경(Production): 에러 처리 필수 (Fail-Closed, fail-open 방지)
          if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
            // 운영 환경: 에러 처리 필수 (Fail-Closed)
            throw new Error(`Schema Registry 조회 실패: ${entity} (tenant: ${context.tenantId}, industry: ${context.industryType})`);
          }

          // 개발/테스트 환경: fallbackSchema 허용
          return (fallbackSchema as SchemaByType<T>) || null;
        }

        const schemas = Array.isArray(response.data) ? response.data : [response.data];

        // 클라이언트에서 type과 min_supported_client 필터링
        const clientVersion = '1.0.0'; // TODO: 실제 클라이언트 버전으로 교체
        const filteredSchemas = schemas.filter((s) => {
          // schema_json에서 type 확인
          const schemaType = (s.schema_json as { type?: string })?.type;
          if (schemaType !== type) {
            return false;
          }

          // min_supported_client 확인 (간단한 버전 비교)
          // TODO: 실제 Semver 비교 로직 구현 필요
          // 현재는 간단히 문자열 비교
          return true; // 일단 모든 active 스키마 반환
        });

        if (filteredSchemas.length === 0) {
          // 환경별 분기 처리
          // [불변 규칙] Vite 환경에서 import.meta.env.PROD는 빌드 타임에 주입됨
          // import.meta.env.MODE === 'production'도 빌드 타임에 결정됨
          // 운영 환경(Production): 에러 처리 필수 (Fail-Closed, fail-open 방지)
          if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
            // 운영 환경: 에러 처리 필수 (Fail-Closed)
            throw new Error(`Schema Registry 조회 실패: ${entity} (tenant: ${context.tenantId}, industry: ${context.industryType})`);
          }

          // 개발/테스트 환경: fallbackSchema 허용
          return (fallbackSchema as SchemaByType<T>) || null;
        }

        // 버전이 가장 높은 스키마 반환 (간단히 첫 번째 요소)
        // TODO: 실제로는 version 필드를 Semver로 비교하여 최신 버전 반환
        const schema = filteredSchemas[0];
        return schema.schema_json as SchemaByType<T>;
      } catch (error: unknown) {
        // 네트워크 에러나 기타 예외도 조용히 처리 (404는 정상적인 상황)
        const errorObj = error as { code?: string; message?: string; status?: number; statusCode?: number } | null;
        const isNotFoundError = errorObj?.code === 'PGRST116' ||
          errorObj?.code === 'PGRST204' ||
          errorObj?.message?.toLowerCase().includes('404') ||
          errorObj?.message?.toLowerCase().includes('not found') ||
          errorObj?.status === 404 ||
          errorObj?.statusCode === 404;

        // schema-registry 요청의 404 에러는 조용히 처리
        const tableStr = String(table);
        const isSchemaRegistryRequestCatch = tableStr === 'schema_registry' || tableStr.startsWith('schema-registry/');

        if (isNotFoundError || isSchemaRegistryRequestCatch) {
          // 환경별 분기 처리
          // [불변 규칙] Vite 환경에서 import.meta.env.PROD는 빌드 타임에 주입됨
          // import.meta.env.MODE === 'production'도 빌드 타임에 결정됨
          // 운영 환경(Production): 에러 처리 필수 (Fail-Closed, fail-open 방지)
          if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
            // 운영 환경: 에러 처리 필수 (Fail-Closed)
            throw new Error(`Schema Registry 조회 실패: ${entity} (tenant: ${context.tenantId}, industry: ${context.industryType})`);
          }

          // 개발/테스트 환경: fallbackSchema 허용
          return (fallbackSchema as SchemaByType<T>) || null;
        }

        // 예상치 못한 에러의 경우에만 개발 환경에서 로그 출력
        if (import.meta.env.DEV) {
          console.warn(`[useSchema] Unexpected error fetching schema: ${entity} (${type})`, error);
        }

        // 환경별 분기 처리
        if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
          // 운영 환경: 에러 처리 필수 (Fail-Closed)
          throw new Error(`Schema Registry 조회 실패: ${entity} (tenant: ${context.tenantId}, industry: ${context.industryType})`);
        }

        // 개발/테스트 환경: fallbackSchema 허용
        return (fallbackSchema as SchemaByType<T>) || null;
      }
    },
    // 중요: staleTime 운영 모드에 맞게 설정
    // - 운영 모드(Production): staleTime=5분 이상 (성능 최적화)
    // - 개발/릴리즈 환경: staleTime=0 사용 가능(스키마 변경이 빈번한 경우)
    staleTime: 5 * 60 * 1000, // 5분(운영 모드 기준)
    enabled: !!context.tenantId, // tenantId가 있을 때만 조회
    retry: false, // 404 에러는 재시도하지 않음 (스키마가 없을 수 있음)
    retryOnMount: false, // 마운트 시 재시도하지 않음
    refetchOnWindowFocus: false, // 윈도우 포커스 시 재조회하지 않음 (스키마는 자주 변경되지 않음)
    throwOnError: false, // 404 에러를 throw하지 않음 (fallback 사용)
    gcTime: 10 * 60 * 1000, // 10분간 캐시 유지 (기존 cacheTime)
  });
}
