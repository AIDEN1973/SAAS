/**
 * useConfig Hook
 *
 * React Query 기반 설정 관리 Hook
 * [불변 규칙] api-sdk를 통해서만 데이터 요청
 * [불변 규칙] Zero-Trust: tenantId는 Context에서 자동으로 가져옴
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { useSession } from '@hooks/use-auth';
import { createExecutionAuditRecord } from '@hooks/use-student/src/execution-audit-utils';
import type { TenantConfig, UpdateConfigInput } from '@core/config';

/**
 * 지역 정보 타입
 * SSOT: core_stores.region_id → core_regions 조인으로 지역정보 조회
 */
export interface StoreLocationInfo {
  /** 전체 지역명 (예: "서울시 강남구 역삼동") */
  region: string;
  /** 시/도 이름 */
  si: string;
  /** 시군구 이름 */
  gu: string;
  /** 동/읍/면 이름 */
  dong: string;
  /** 행정동 코드 (dong level) */
  location_code: string;
  /** 시군구 코드 */
  sigungu_code: string;
  /** 시도 코드 */
  sido_code: string;
  /** 권역 코드 (예: "CAPITAL", "YEONGNAM") */
  zone_code: string;
  /** 권역 이름 (예: "수도권", "영남권") */
  zone_name: string;
  /** 매장 주소 */
  address: string;
}

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
        // 설정이 없거나 테이블이 없으면 빈 객체 반환 (undefined 방지)
        // PGRST116: 데이터 없음, PGRST205: 테이블이 스키마 캐시에 없음
        if (response.error.code === 'PGRST116' || response.error.code === 'PGRST205') {
          return {} as TenantConfig;
        }
        // 다른 오류도 빈 객체 반환 (undefined 방지)
        // 개발 환경에서만 에러 출력 (프로덕션에서는 조용히 처리)
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to fetch config:', response.error);
        }
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
 * 테넌트 설정에서 중첩된 경로의 값 조회 Hook
 *
 * 프론트엔드 래퍼 함수: 서버/Edge Function의 getTenantSettingByPath와 동일한 기능을 제공합니다.
 * SSOT-1: tenant_settings는 KV 구조이며, config는 컬럼이 아니라 key='config' row의 value(JSONB)입니다.
 *
 * [최적화] useConfig의 캐시를 재사용하여 중복 API 호출 방지
 * - 별도 쿼리 대신 useConfig 결과에서 경로 추출
 * - useUpdateConfig가 setQueryData로 캐시 업데이트 시 즉시 반영됨
 *
 * @param path 점으로 구분된 경로 (예: 'auto_notification.overdue_outstanding_over_limit.enabled')
 * @returns 설정 값 또는 null (Policy가 없으면 null 반환, Fail Closed)
 */
export function useTenantSettingByPath(path: string) {
  // useConfig 캐시 재사용 - 별도 API 호출 없이 캐시된 config에서 경로 추출
  const { data: configData, isLoading } = useConfig();

  // 경로 추출 (useMemo로 최적화)
  const value = React.useMemo(() => {
    if (!configData || !path) {
      return null;
    }

    const keys = path.split('.');
    let current: unknown = configData;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return null; // Fail Closed
      }
    }

    return current;
  }, [configData, path]);

  return { data: value, isLoading };
}

/**
 * 테넌트 설정 업데이트 Hook
 */
export function useUpdateConfig() {
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (input: UpdateConfigInput) => {
      const startTime = Date.now();
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

      // SSOT-3: 'kakao' 저장 금지, 'kakao_at'로 정규화
      const normalizedInput = { ...input };
      if ((normalizedInput.attendance?.notification_channel as string) === 'kakao') {
        console.warn('[useConfig] Legacy channel "kakao" detected, normalizing to "kakao_at"');
        normalizedInput.attendance = {
          ...normalizedInput.attendance,
          notification_channel: 'kakao_at',
        };
      }

      // 설정 병합
      const mergedConfig: TenantConfig = {
        ...existingConfig,
        ...normalizedInput,
      };

      let result: TenantConfig;

      if (existingId) {
        // 기존 레코드가 있으면 PATCH로 업데이트
        const updateResponse = await apiClient.patch<{ key: string; value: TenantConfig }>(
          'tenant_settings',
          existingId,
          {
            value: mergedConfig,
            // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
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

      // Execution Audit 기록 생성 (액티비티.md 3.3, 12 참조)
      if (session?.user?.id) {
        const durationMs = Date.now() - startTime;
        const changedSections = Object.keys(input);
        await createExecutionAuditRecord(
          {
            operation_type: 'config.update',
            status: 'success',
            summary: `테넌트 설정 업데이트 완료 (${changedSections.join(', ')})`,
            details: {
              changed_sections: changedSections,
            },
            reference: {
              entity_type: 'tenant',
              entity_id: tenantId,
            },
            duration_ms: durationMs,
          },
          session.user.id
        );
      }

      return result;
    },
    onSuccess: (data) => {
      // setQueryData로 캐시 직접 업데이트 - API 호출 없이 즉시 반영
      // useTenantSettingByPath가 useConfig를 재사용하므로 자동으로 업데이트됨
      queryClient.setQueryData(['config', tenantId], data);
    },
  });
}

/**
 * 매장 지역 정보 조회 Hook
 *
 * SSOT: core_stores 테이블에 지역 코드가 직접 저장됨 (카카오 API 연동)
 * 조인 없이 단일 쿼리로 지역 정보 조회
 *
 * @returns 매장 지역 정보 (si, gu, dong, location_code 등)
 */
export function useStoreLocation() {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery({
    queryKey: ['store-location', tenantId],
    queryFn: async (): Promise<StoreLocationInfo> => {
      const emptyLocation: StoreLocationInfo = {
        region: '',
        si: '',
        gu: '',
        dong: '',
        location_code: '',
        sigungu_code: '',
        sido_code: '',
        zone_code: '',
        zone_name: '',
        address: '',
      };

      if (!tenantId) {
        return emptyLocation;
      }

      // core_stores에서 현재 테넌트의 매장 정보 조회 (지역 코드 직접 포함)
      const storeResponse = await apiClient.get<{
        id: string;
        address: string | null;
        sido_code: string | null;
        sido_name: string | null;
        sigungu_code: string | null;
        sigungu_name: string | null;
        dong_code: string | null;
        dong_name: string | null;
      }>('core_stores', {
        select: 'id,address,sido_code,sido_name,sigungu_code,sigungu_name,dong_code,dong_name',
      });

      if (storeResponse.error || !storeResponse.data || storeResponse.data.length === 0) {
        return emptyLocation;
      }

      const store = storeResponse.data[0];

      // 지역 코드가 없으면 빈 정보 반환
      if (!store.dong_code) {
        return emptyLocation;
      }

      const si = store.sido_name || '';
      const gu = store.sigungu_name || '';
      const dong = store.dong_name || '';
      const sidoCode = store.sido_code || '';

      // 권역 정보 조회 (시도 코드 → 권역 매핑)
      let zoneCode = '';
      let zoneName = '';

      if (sidoCode) {
        // core_sido_zone_mappings 테이블에서 권역 조회
        const mappingResponse = await apiClient.get<{
          zone_id: string;
          core_region_zones: {
            zone_code: string;
            zone_name: string;
          } | null;
        }>('core_sido_zone_mappings', {
          select: 'zone_id,core_region_zones(zone_code,zone_name)',
          filters: { sido_code: sidoCode },
        });

        if (mappingResponse.data && mappingResponse.data.length > 0 && mappingResponse.data[0].core_region_zones) {
          zoneCode = mappingResponse.data[0].core_region_zones.zone_code;
          zoneName = mappingResponse.data[0].core_region_zones.zone_name;
        }
      }

      return {
        region: [si, gu, dong].filter(Boolean).join(' '),
        si,
        gu,
        dong,
        location_code: store.dong_code || '',
        sigungu_code: store.sigungu_code || '',
        sido_code: sidoCode,
        zone_code: zoneCode,
        zone_name: zoneName,
        address: store.address || '',
      };
    },
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000, // 10분 (지역 정보는 자주 변경되지 않음)
  });
}
