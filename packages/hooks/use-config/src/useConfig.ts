/**
 * useConfig Hook
 * 
 * React Query ê¸°ë°˜ ?¤ì • ê´€ë¦?Hook
 * [ë¶ˆë? ê·œì¹™] api-sdkë¥??µí•´?œë§Œ ?°ì´???”ì²­
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: tenantId??Context?ì„œ ?ë™?¼ë¡œ ê°€?¸ì˜´
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import type { TenantConfig, UpdateConfigInput } from '@core/config';

/**
 * ?Œë„Œ???¤ì • ì¡°íšŒ Hook
 */
export function useConfig() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['config', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        // tenantIdê°€ ?†ìœ¼ë©?ë¹?ê°ì²´ ë°˜í™˜ (undefined ë°©ì?)
        return {} as TenantConfig;
      }

      const response = await apiClient.get<{ key: string; value: TenantConfig }>('tenant_settings', {
        filters: { key: 'config' },
      });

      if (response.error) {
        // ?¤ì •???†ìœ¼ë©?ë¹?ê°ì²´ ë°˜í™˜ (undefined ë°©ì?)
        if (response.error.code === 'PGRST116') {
          return {} as TenantConfig;
        }
        // ?¤ë¥¸ ?ëŸ¬??ë¹?ê°ì²´ ë°˜í™˜ (undefined ë°©ì?)
        console.error('Failed to fetch config:', response.error);
        return {} as TenantConfig;
      }

      // ?°ì´?°ê? ?†ìœ¼ë©?ë¹?ê°ì²´ ë°˜í™˜
      if (!response.data || response.data.length === 0) {
        return {} as TenantConfig;
      }

      // keyê°€ 'config'???ˆì½”?œì˜ valueë¥?ë°˜í™˜
      const configRecord = response.data.find((item) => item.key === 'config');
      if (!configRecord || !configRecord.value) {
        return {} as TenantConfig;
      }

      return (configRecord.value as TenantConfig) || ({} as TenantConfig);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5ë¶?
  });
}

/**
 * ?Œë„Œ???¤ì • ?…ë°?´íŠ¸ Hook
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

      // ê¸°ì¡´ ?¤ì • ì¡°íšŒ
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

      // ?¤ì • ë³‘í•©
      const mergedConfig: TenantConfig = {
        ...existingConfig,
        ...input,
      };

      let result: TenantConfig;

      if (existingId) {
        // ê¸°ì¡´ ?ˆì½”?œê? ?ˆìœ¼ë©?PATCHë¡??…ë°?´íŠ¸
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
        // ê¸°ì¡´ ?ˆì½”?œê? ?†ìœ¼ë©?POSTë¡??ì„±
        const createResponse = await apiClient.post<{ key: string; value: TenantConfig }>('tenant_settings', {
          tenant_id: tenantId,
          key: 'config',
          value: mergedConfig,
          updated_at: new Date().toISOString(),
        });

        if (createResponse.error) {
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

