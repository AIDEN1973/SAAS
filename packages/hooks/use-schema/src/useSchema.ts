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
      // [불변 규칙] 기술문서에 명시된 대로 apiClient.get을 통해 Schema Registry 조회
      // ⚠️ 중요: UI/클라이언트는 직접 meta.schema_registry를 조회하지 않고,
      // @api-sdk/core의 서버사이드 API를 통해서만 접근합니다.
      // 기술문서: docu/스키마엔진.txt 5.2 Schema Registry Service 사용법
      //
      // 참고: 기술문서 예시에서는 params를 사용하지만, 실제 apiClient.get 구현은 filters를 사용합니다.
      // apiClient.get의 두 번째 파라미터는 options 객체이며, 그 안에 filters 속성이 있습니다.
      const response = await apiClient.get<SchemaByType<T>>(
        `schema-registry/${entity}`,
        {
          filters: {
            tenant_id: context.tenantId,
            industry_type: context.industryType,
            client_version: '1.0.0',
            type,
          },
        }
      );

      if (response.error || !response.data || (Array.isArray(response.data) && response.data.length === 0)) {
        // ⚠️ 중요: fallbackSchema는 폴백으로 사용됩니다
        // 스키마 부재로 인해 UI가 죽지 않도록 fallback을 제공해야 합니다
        //
        // ⚠️ 필수 규칙: fallbackSchema는 entity + industry 조합으로 개별 제공되어야 합니다
        // - academy/studentFormSchema
        // - salon/customerFormSchema
        // - realestate/contractFormSchema
        // 각각 별도로 존재해야 하며, 업종별로 구분된 fallback 스키마를 제공해야 합니다
        return (fallbackSchema as SchemaByType<T>) || null;
      }

      // response.data가 배열인 경우 첫 번째 요소 반환
      const schema = Array.isArray(response.data) ? response.data[0] : response.data;
      return schema as SchemaByType<T>;
    },
    // ⚠️ 중요: staleTime 운영 모드에 맞게 설정
    // - 운영 모드(Production): staleTime=5분 이상 (성능 최적화)
    // - 개발/릴리즈 환경: staleTime=0 사용 가능(스키마 변경이 빈번한 경우)
    staleTime: 5 * 60 * 1000, // 5분(운영 모드 기준)
    enabled: !!context.tenantId, // tenantId가 있을 때만 조회
  });
}
