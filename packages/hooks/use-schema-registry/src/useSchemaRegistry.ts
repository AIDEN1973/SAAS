/**
 * useSchemaRegistry Hook
 * 
 * [ë¶ˆë? ê·œì¹™] Zero-Trust: ëª¨ë“  ?”ì²­?€ @api-sdk/coreë¥??µí•´ ?„ì†¡
 * [ë¶ˆë? ê·œì¹™] Schema Registry CRUD ?‘ì—…
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—?”í„°.txt 17. API ëª…ì„¸
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@lib/supabase-client';
import type { FormSchema, TableSchema, DetailSchema, FilterSchema, WidgetSchema, UISchema } from '@schema/engine/types';

export interface SchemaRegistryEntry {
  id: string;
  entity: string;
  industry_type: string | null;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  schema_json: UISchema;
  min_supported_client: string;
  min_client?: string | null; // SDUI v1.1: minClient ì¶”ê?
  migration_script: string | null;
  registered_by: string | null; // RPC ?¨ìˆ˜??registered_by ?¬ìš©
  registered_at: string; // RPC ?¨ìˆ˜??registered_at ?¬ìš©
  activated_at: string | null;
  deprecated_at: string | null;
  // ?˜ìœ„ ?¸í™˜?±ì„ ?„í•œ ?„ë“œ
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
  minClient?: string | null; // SDUI v1.1: minClient ì¶”ê?
  schema_json: UISchema;
  migration_script?: string | null;
  status?: 'draft' | 'active' | 'deprecated';
}

export interface UpdateSchemaInput {
  schema_json: UISchema;
  migration_script?: string | null;
  minSupportedClient?: string;
  minClient?: string | null; // SDUI v1.1: minClient ì¶”ê?
}

/**
 * ?¤í‚¤ë§?ëª©ë¡ ì¡°íšŒ
 * 
 * [ë¶ˆë? ê·œì¹™] Super Adminë§?ì¡°íšŒ ê°€??(RLS ?•ì±…)
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
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼)
      // ? ï¸ ì¤‘ìš”: Supabase RPC??ëª¨ë“  ë§¤ê°œë³€?˜ë? ëª…ì‹œ?ìœ¼ë¡??„ë‹¬?´ì•¼ ??      const { data, error } = await supabase.rpc('get_schema_registry_list', {
        p_entity: filters?.entity ?? null,
        p_industry_type: filters?.industry_type ?? null,
        p_status: filters?.status ?? null,
      });
      
      if (error) {
        // ?ì„¸ ?¤ë¥˜ ?•ë³´ ë¡œê¹…
        console.error('[Schema Registry] RPC ?¸ì¶œ ?¤íŒ¨:', {
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
    staleTime: 30 * 1000, // 30ì´?  });
}

/**
 * ?¤í‚¤ë§??¨ì¼ ì¡°íšŒ
 */
export function useSchema(id: string) {
  return useQuery({
    queryKey: ['schema-registry', id],
    queryFn: async () => {
      const supabase = createClient();
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼)
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
 * Draft ?¤í‚¤ë§??ì„±
 * 
 * [ë¶ˆë? ê·œì¹™] status??ê¸°ë³¸?ìœ¼ë¡?'draft'ë¡??¤ì •
 * [ë¶ˆë? ê·œì¹™] Super Adminë§??ì„± ê°€??(RLS ?•ì±…)
 */
export function useCreateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateSchemaInput) => {
      const supabase = createClient();
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼)
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
 * Draft ?¤í‚¤ë§??˜ì •
 * 
 * [ë¶ˆë? ê·œì¹™] draftë§??˜ì • ê°€??(RLS ?•ì±…)
 * [ë¶ˆë? ê·œì¹™] Optimistic Locking: updated_at ë¹„êµ
 */
export function useUpdateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, input, expectedUpdatedAt }: {
      id: string;
      input: UpdateSchemaInput;
      expectedUpdatedAt?: string; // Optimistic Locking??    }) => {
      const supabase = createClient();
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼, Optimistic Locking ì§€??
      const { data, error } = await supabase.rpc('update_schema_registry', {
        p_id: id,
        p_schema_json: input.schema_json,
        p_migration_script: input.migration_script || null,
        p_min_supported_client: input.minSupportedClient || null,
        p_min_client: input.minClient || null,
        p_expected_updated_at: expectedUpdatedAt || null,
      });
      
      if (error) {
        // Optimistic Locking ì¶©ëŒ ?ëŠ” ê¸°í? ?¤ë¥˜
        if (error.message?.includes('modified by another user') || error.message?.includes('Schema was modified')) {
          throw new Error('?¤ë¥¸ ê´€ë¦¬ìžê°€ ë¨¼ì? ?˜ì •?ˆìŠµ?ˆë‹¤. ë³€ê²??´ìš©???¤ì‹œ ?•ì¸?´ì£¼?¸ìš”.');
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
 * ?¤í‚¤ë§??œì„±??(Activate)
 * 
 * [ë¶ˆë? ê·œì¹™] ê¸°ì¡´ active ??deprecated, draft ??active
 * [ë¶ˆë? ê·œì¹™] Super Adminë§??œì„±??ê°€??(RLS ?•ì±…)
 */
export function useActivateSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼, ?ìž???¸ëžœ??…˜)
      const { data, error } = await supabase.rpc('activate_schema_registry', {
        p_id: id,
      });
      
      if (error) {
        throw new Error(`Failed to activate schema: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to activate schema: No data returned');
      }
      
      // RPC ê²°ê³¼???¼ë? ?„ë“œë§?ë°˜í™˜?˜ë?ë¡? ?„ì²´ ?¤í‚¤ë§ˆë? ?¤ì‹œ ì¡°íšŒ
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
 * Draft ?¤í‚¤ë§??? œ
 * 
 * [ë¶ˆë? ê·œì¹™] draftë§??? œ ê°€??(RLS ?•ì±…)
 */
export function useDeleteSchema() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      
      // RPC ?¨ìˆ˜ ?¬ìš© (meta ?¤í‚¤ë§??‘ê·¼)
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

