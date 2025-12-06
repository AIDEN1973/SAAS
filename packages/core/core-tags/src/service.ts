/**
 * Core Tags Service
 * 
 * 공통 태깅 시스템
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type { Tag, TagAssignment, CreateTagInput, TagFilter, EntityType } from './types';

export class TagsService {
  private supabase = createServerClient();

  /**
   * 태그 목록 조회
   */
  async getTags(
    tenantId: string,
    filter?: TagFilter
  ): Promise<Tag[]> {
    let query = withTenant(
      this.supabase.from('tags').select('*'),
      tenantId
    );

    if (filter?.entity_type) {
      query = query.eq('entity_type', filter.entity_type);
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }

    return (data || []) as Tag[];
  }

  /**
   * 태그 생성
   */
  async createTag(
    tenantId: string,
    input: CreateTagInput
  ): Promise<Tag> {
    const { data, error } = await this.supabase
      .from('tags')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        color: input.color || '#3b82f6',
        description: input.description,
        entity_type: input.entity_type,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }

    return data as Tag;
  }

  /**
   * 엔티티에 태그 할당
   */
  async assignTag(
    tenantId: string,
    entityId: string,
    entityType: EntityType,
    tagId: string
  ): Promise<TagAssignment> {
    const { data, error } = await this.supabase
      .from('tag_assignments')
      .insert({
        tenant_id: tenantId,
        entity_id: entityId,
        entity_type: entityType,
        tag_id: tagId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign tag: ${error.message}`);
    }

    return data as TagAssignment;
  }

  /**
   * 엔티티에 여러 태그 할당
   */
  async assignTags(
    tenantId: string,
    entityId: string,
    entityType: EntityType,
    tagIds: string[]
  ): Promise<void> {
    const assignments = tagIds.map((tagId) => ({
      tenant_id: tenantId,
      entity_id: entityId,
      entity_type: entityType,
      tag_id: tagId,
    }));

    const { error } = await this.supabase
      .from('tag_assignments')
      .upsert(assignments, { onConflict: 'entity_id,entity_type,tag_id' });

    if (error) {
      throw new Error(`Failed to assign tags: ${error.message}`);
    }
  }

  /**
   * 엔티티의 태그 조회
   */
  async getEntityTags(
    tenantId: string,
    entityId: string,
    entityType: EntityType
  ): Promise<Tag[]> {
    const { data, error } = await withTenant(
      this.supabase
        .from('tag_assignments')
        .select(`
          tag_id,
          tags (
            id,
            name,
            color,
            description
          )
        `)
        .eq('entity_id', entityId)
        .eq('entity_type', entityType),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to fetch entity tags: ${error.message}`);
    }

    return (data || []).map((item: any) => item.tags).filter(Boolean) as Tag[];
  }

  /**
   * 태그 할당 해제
   */
  async removeTag(
    tenantId: string,
    entityId: string,
    entityType: EntityType,
    tagId: string
  ): Promise<void> {
    const { error } = await withTenant(
      this.supabase
        .from('tag_assignments')
        .delete()
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .eq('tag_id', tagId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to remove tag: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const tagsService = new TagsService();

