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
import type { FormSchema } from '@schema-engine';

/**
 * Schema Registry에서 스키마 조회 Hook
 * 
 * [불변 규칙] 스키마 조회 우선순위:
 * 1. 테넌트별 Version Pinning
 * 2. Industry별 활성 스키마
 * 3. 공통 활성 스키마
 * 4. Fallback 스키마
 * 
 * @param entity - 스키마 엔티티명 (예: 'student', 'class', 'teacher')
 * @param fallbackSchema - Fallback 스키마 (Registry 조회 실패 시 사용)
 * @returns React Query result with schema data
 */
export function useSchema(entity: string, fallbackSchema?: FormSchema) {
  const context = getApiContext();
  
  return useQuery({
    queryKey: ['schema', entity, context.tenantId, context.industryType],
    queryFn: async () => {
      // [불변 규칙] 기술문서에 명시된 대로 apiClient를 통해 Schema Registry 조회
      // apiClient.getSchema는 내부적으로 meta.schema_registry 테이블을 조회하고
      // SchemaRegistryClient의 resolveSchema 로직을 사용하여 우선순위에 따라 스키마를 선택합니다.
      const response = await apiClient.getSchema(entity, {
        tenant_id: context.tenantId,
        industry_type: context.industryType,
        client_version: '1.0.0',
      });
      
      if (response.error || !response.data) {
        // ⚠️ 중요: fallbackSchema는 트러블슈팅용입니다.
        // 스키마 부재 시 앱이 죽지 않도록 fallback을 유지해야 합니다.
        // 
        // ⚠️ 필수 규칙: fallbackSchema는 entity + industry 조합으로 개별 제공되어야 합니다.
        // - academy/studentFormSchema
        // - salon/customerFormSchema
        // - realestate/contractFormSchema
        // 각각 별도로 존재해야 하며, 업종별로 구분된 fallback 스키마를 제공해야 합니다.
        return fallbackSchema || null;
      }
      
      return response.data;
    },
    // ⚠️ 중요: staleTime 운영 모드별 설정
    // - 운영 모드(Production): staleTime=5분 유지 (성능 최적화)
    // - 개발/릴리스 환경: staleTime=0 사용 가능 (스키마 변경이 잦은 경우)
    staleTime: 5 * 60 * 1000, // 5분 (운영 모드 기준)
    enabled: !!context.tenantId, // tenantId가 있을 때만 조회
  });
}

