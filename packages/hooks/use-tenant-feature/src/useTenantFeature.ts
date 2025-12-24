/**
 * useTenantFeature Hook
 *
 * 테넌트 기능 조회 및 업데이트 Hook
 * SSOT: 프론트 자동화 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조
 *
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';

export interface TenantFeature {
  id: string;
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
  quota: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * 테넌트 기능 조회 Hook
 * @param featureKey 기능 키 (예: 'ai')
 */
export function useTenantFeature(featureKey: string) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<TenantFeature | null>({
    queryKey: ['tenant-feature', tenantId, featureKey],
    queryFn: async () => {
      if (!tenantId) {
        return null;
      }

      const response = await apiClient.get<TenantFeature>('tenant_features', {
        filters: {
          feature_key: featureKey,
        },
      });

      if (response.error) {
        // 레코드가 없으면 null 반환 (기본값: enabled = true)
        if (response.error.code === 'PGRST116') {
          return null;
        }
        throw new Error(response.error.message);
      }

      if (!response.data || response.data.length === 0) {
        return null;
      }

      return response.data[0] as TenantFeature;
    },
    enabled: !!tenantId,
    staleTime: 1 * 60 * 1000, // 1분
  });
}

/**
 * 테넌트 기능 업데이트 Hook
 * @param featureKey 기능 키 (예: 'ai')
 */
export function useUpdateTenantFeature(featureKey: string) {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 기존 기능 조회
      const existingResponse = await apiClient.get<TenantFeature>('tenant_features', {
        filters: {
          feature_key: featureKey,
        },
      });

      let existingId: string | null = null;
      if (existingResponse.data && existingResponse.data.length > 0) {
        existingId = existingResponse.data[0].id;
      }

      if (existingId) {
        // 업데이트
        const updateResponse = await apiClient.patch<TenantFeature>(
          'tenant_features',
          existingId,
          {
            enabled,
            updated_at: new Date().toISOString(),
          }
        );

        if (updateResponse.error) {
          throw new Error(updateResponse.error.message);
        }

        return updateResponse.data as TenantFeature;
      } else {
        // 새로 생성
        const createResponse = await apiClient.post<TenantFeature>('tenant_features', {
          tenant_id: tenantId,
          feature_key: featureKey,
          enabled,
          quota: null,
        });

        if (createResponse.error) {
          throw new Error(createResponse.error.message);
        }

        return createResponse.data as TenantFeature;
      }
    },
    onSuccess: () => {
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['tenant-feature', tenantId, featureKey] });
      // tenant::<id>::features 캐시도 무효화 (SSOT 규칙)
      queryClient.invalidateQueries({ queryKey: ['tenant-features', tenantId] });
    },
  });
}













