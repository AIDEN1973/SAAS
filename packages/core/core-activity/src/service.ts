/**
 * Core Activity Service
 * 
 * Activity Feed / ?€?„ë¼???´ë²¤??ê¸°ë¡ ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Activity,
  CreateActivityInput,
  ActivityFilter,
} from './types';

export class ActivityService {
  private supabase = createServerClient();

  /**
   * ?œë™ ê¸°ë¡
   */
  async createActivity(
    tenantId: string,
    input: CreateActivityInput
  ): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .insert({
        tenant_id: tenantId,
        activity_type: input.activity_type,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        user_id: input.user_id,
        description: input.description,
        metadata: input.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }

    return data as Activity;
  }

  /**
   * ?œë™ ëª©ë¡ ì¡°íšŒ (?€?„ë¼??
   */
  async getActivities(
    tenantId: string,
    filter?: ActivityFilter
  ): Promise<Activity[]> {
    let query = withTenant(
      this.supabase.from('activities').select('*'),
      tenantId
    );

    if (filter?.activity_type) {
      query = query.eq('activity_type', filter.activity_type);
    }

    if (filter?.entity_type) {
      query = query.eq('entity_type', filter.entity_type);
    }

    if (filter?.entity_id) {
      query = query.eq('entity_id', filter.entity_id);
    }

    if (filter?.user_id) {
      query = query.eq('user_id', filter.user_id);
    }

    if (filter?.date_from) {
      query = query.gte('created_at', filter.date_from);
    }

    if (filter?.date_to) {
      query = query.lte('created_at', filter.date_to);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    return (data || []) as Activity[];
  }
}

/**
 * Default Service Instance
 */
export const activityService = new ActivityService();

