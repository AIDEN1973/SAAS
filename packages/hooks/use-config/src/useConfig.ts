/**
 * useConfig Hook
 *
 * React Query 기반 설정 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { TenantConfig, UpdateConfigInput } from '@core/config';

/**
 * 테넌트 설정 조회 Hook
 */
export function useConfig() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['config', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        // tenantId가 없으면 빈 객체 반환 (undefined 방지)
        return {} as TenantConfig;
      }

      const response = await apiClient.get<{ key: string; value: TenantConfig }>('tenant_settings', {
        filters: { key: 'config' },
      });

      if (response.error) {
        // 설정이 없으면 빈 객체 반환 (undefined 방지)
        if (response.error.code === 'PGRST116') {
          return {} as TenantConfig;
        }
        // 다른 오류도 빈 객체 반환 (undefined 방지)
        console.error('Failed to fetch config:', response.error);
        return {} as TenantConfig;
      }

      // 데이터가 없으면 빈 객체 반환
      if (!response.data || response.data.length === 0) {
        return {} as TenantConfig;
      }

      // key가 'config'인 레코드의 value를 반환
      const configRecord = response.data.find((item) => item.key === 'config');
      if (!configRecord || !configRecord.value) {
        return {} as TenantConfig;
      }

      return (configRecord.value as TenantConfig) || ({} as TenantConfig);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 테넌트 설정 업데이트 Hook
 */
export function useUpdateConfig() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useMutation({
    mutationFn: async (input: UpdateConfigInput) => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // 기존 설정 조회
      const existingResponse = await apiClient.get<{ id: string; key: string; value: TenantConfig }>('tenant_settings', {
        filters: { key: 'config' },
      });

      let existingConfig: TenantConfig = {};
      let existingId: string | null = null;
      if (existingResponse.data && existingResponse.data.length > 0) {
        const configRecord = existingResponse.data.find((item) => item.key === 'config');
        if (configRecord) {
          existingId = configRecord.id;
          if (configRecord.value) {
            existingConfig = configRecord.value as TenantConfig;
          }
        }
      }

      // 설정 병합
      const mergedConfig: TenantConfig = {
        ...existingConfig,
        ...input,
      };

      let result: TenantConfig;

      if (existingId) {
        // 기존 레코드가 있으면 PATCH로 업데이트
        const updateResponse = await apiClient.patch<{ key: string; value: TenantConfig }>(
          'tenant_settings',
          existingId,
          {
            value: mergedConfig,
            updated_at: new Date().toISOString(),
          }
        );

        if (updateResponse.error) {
          throw new Error(updateResponse.error.message);
        }

        if (updateResponse.data && updateResponse.data.value) {
          result = updateResponse.data.value as TenantConfig;
        } else {
          result = mergedConfig;
        }
      } else {
        // 기존 레코드가 없으면 POST로 생성
        const createResponse = await apiClient.post<{ key: string; value: TenantConfig }>('tenant_settings', {
          tenant_id: tenantId,
          key: 'config',
          value: mergedConfig,
          updated_at: new Date().toISOString(),
        });

        if (createResponse.error) {
          // Foreign key constraint 위반 에러인 경우 더 명확한 메시지 제공
          if (createResponse.error.message?.includes('foreign key constraint') ||
              createResponse.error.message?.includes('tenant_settings_tenant_id_fkey')) {
            throw new Error(`테넌트가 존재하지 않습니다. tenantId: ${tenantId}. 개발 환경에서는 마이그레이션 063_create_dev_tenant.sql을 실행하세요.`);
          }
          throw new Error(createResponse.error.message);
        }

        if (createResponse.data && createResponse.data.value) {
          result = createResponse.data.value as TenantConfig;
        } else {
          result = mergedConfig;
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config', tenantId] });
    },
  });
}
