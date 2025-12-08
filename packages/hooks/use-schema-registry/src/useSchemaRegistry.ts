/**
 * useSchemaRegistry Hook
 * 
 * [불변 규칙] Zero-Trust: 모든 요청은 @api-sdk/core를 통해 전송
 * [불변 규칙] Schema Registry CRUD 작업
 * 
 * 기술문서: docu/스키마에디터.txt 17. API 명세
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';
import type { UISchema } from '@schema-engine/types';

export interface SchemaRegistryEntry {
  id: string;
  entity: string;
  industry_type: string | null;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  schema_json: UISchema;
  min_supported_client: string;
  min_client?: string | null; // SDUI v1.1: minClient 추가
  migration_script: string | null;
  registered_by: string | null; // RPC 함수는 registered_by 사용
  registered_at: string; // RPC 함수는 registered_at 사용
  activated_at: string | null;
  deprecated_at: string | null;
  // 하위 호환성을 위한 필드
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CreateSchemaInput {
  entity: string;
  industry_type?: string | null;
  version: string;
  minSupportedClient: string;
  minClient?: string | null; // SDUI v1.1: minClient 추가
  schema_json: UISchema;
  migration_script?: string | null;
  status?: 'draft' | 'active' | 'deprecated';
}

export interface UpdateSchemaInput {
  schema_json: UISchema;
  migration_script?: string | null;
  minSupportedClient?: string;
  minClient?: string | null; // SDUI v1.1: minClient 추가
}

/**
 * 스키마 목록 조회
 * 
 * [불변 규칙] Super Admin만 조회 가능 (RLS 정책)
 */
export function useSchemaList(filters?: {
  entity?: string;
  industry_type?: string | null;
  status?: 'draft' | 'active' | 'deprecated';
}) {
  return useQuery({
    queryKey: ['schema-registry', 'list', filters],
    queryFn: async () => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근)
      // ⚠️ 중요: Supabase RPC는 모든 매개변수를 명시적으로 전달해야 함
      const { data, error } = await supabase.rpc('get_schema_registry_list', {
        p_entity: filters?.entity ?? null,
        p_industry_type: filters?.industry_type ?? null,
        p_status: filters?.status ?? null,
      });
      
      if (error) {
        // 상세 오류 정보 로깅
        console.error('[Schema Registry] RPC 호출 실패:', {
          function: 'get_schema_registry_list',
          error: error,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Failed to fetch schemas: ${error.message}${error.details ? ` (${error.details})` : ''}${error.hint ? ` Hint: ${error.hint}` : ''}`);
      }
      
      return (data || []) as SchemaRegistryEntry[];
    },
    staleTime: 30 * 1000, // 30초
  });
}

/**
 * 스키마 단일 조회
 */
export function useSchema(id: string) {
  return useQuery({
    queryKey: ['schema-registry', id],
    queryFn: async () => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근)
      const { data, error } = await supabase.rpc('get_schema_registry', {
        p_id: id,
      });
      
      if (error) {
        throw new Error(`Failed to fetch schema: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Schema not found');
      }
      
      return data[0] as SchemaRegistryEntry;
    },
    enabled: !!id,
  });
}

/**
 * Draft 스키마 생성
 * 
 * [불변 규칙] status는 기본적으로 'draft'로 설정
 * [불변 규칙] Super Admin만 생성 가능 (RLS 정책)
 */
export function useCreateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateSchemaInput) => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근)
      const { data, error } = await supabase.rpc('create_schema_registry', {
        p_entity: input.entity,
        p_industry_type: input.industry_type || null,
        p_version: input.version,
        p_min_supported_client: input.minSupportedClient,
        p_min_client: input.minClient || null,
        p_schema_json: input.schema_json,
        p_migration_script: input.migration_script || null,
      });
      
      if (error) {
        throw new Error(`Failed to create schema: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to create schema: No data returned');
      }
      
      return data[0] as SchemaRegistryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-registry'] });
    },
  });
}

/**
 * Draft 스키마 수정
 * 
 * [불변 규칙] draft만 수정 가능 (RLS 정책)
 * [불변 규칙] Optimistic Locking: updated_at 비교
 */
export function useUpdateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, input, expectedUpdatedAt }: {
      id: string;
      input: UpdateSchemaInput;
      expectedUpdatedAt?: string; // Optimistic Locking용
    }) => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근, Optimistic Locking 지원)
      const { data, error } = await supabase.rpc('update_schema_registry', {
        p_id: id,
        p_schema_json: input.schema_json,
        p_migration_script: input.migration_script || null,
        p_min_supported_client: input.minSupportedClient || null,
        p_min_client: input.minClient || null,
        p_expected_updated_at: expectedUpdatedAt || null,
      });
      
      if (error) {
        // Optimistic Locking 충돌 또는 기타 오류
        if (error.message?.includes('modified by another user') || error.message?.includes('Schema was modified')) {
          throw new Error('다른 관리자가 먼저 수정했습니다. 변경 내용을 다시 확인해주세요.');
        }
        throw new Error(`Failed to update schema: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to update schema: No data returned');
      }
      
      return data[0] as SchemaRegistryEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schema-registry'] });
      queryClient.invalidateQueries({ queryKey: ['schema-registry', variables.id] });
    },
  });
}

/**
 * 스키마 활성화 (Activate)
 * 
 * [불변 규칙] 기존 active → deprecated, draft → active
 * [불변 규칙] Super Admin만 활성화 가능 (RLS 정책)
 */
export function useActivateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근, 원자적 트랜잭션)
      const { data, error } = await supabase.rpc('activate_schema_registry', {
        p_id: id,
      });
      
      if (error) {
        throw new Error(`Failed to activate schema: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to activate schema: No data returned');
      }
      
      // RPC 결과는 일부 필드만 반환하므로, 전체 스키마를 다시 조회
      const { data: fullSchema, error: fetchError } = await supabase.rpc('get_schema_registry', {
        p_id: id,
      });
      
      if (fetchError || !fullSchema || fullSchema.length === 0) {
        throw new Error(`Failed to fetch activated schema: ${fetchError?.message || 'Schema not found'}`);
      }
      
      return fullSchema[0] as SchemaRegistryEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-registry'] });
    },
  });
}

/**
 * Draft 스키마 삭제
 * 
 * [불변 규칙] draft만 삭제 가능 (RLS 정책)
 */
export function useDeleteSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      
      // RPC 함수 사용 (meta 스키마 접근)
      const { error } = await supabase.rpc('delete_schema_registry', {
        p_id: id,
      });
      
      if (error) {
        throw new Error(`Failed to delete schema: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-registry'] });
    },
  });
}

