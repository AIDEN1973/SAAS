/**
 * Core Notification Service
 * 
 * ë©”ì‹œì§??Œë¦¼ ?œë¹„??
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?¤ì œ ë°œì†¡?€ Edge Function (fns-notification-dispatch)?ì„œ ì²˜ë¦¬?©ë‹ˆ??
 * ???œë¹„?¤ëŠ” ?Œë¦¼ ??ê´€ë¦?ë°?ë¡œê·¸ ?€?¥ì„ ?´ë‹¹?©ë‹ˆ??
 */

import { createServerClient } from '@lib/supabase-client/server';
import { withTenant } from '@lib/supabase-client/db';
import type {
  Notification,
  CreateNotificationInput,
  NotificationFilter,
  NotificationStatus,
} from './types';

export class NotificationService {
  private supabase = createServerClient();

  /**
   * ?Œë¦¼ ?ì„± (?ì— ì¶”ê?)
   */
  async createNotification(
    tenantId: string,
    input: CreateNotificationInput
  ): Promise<Notification> {
    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        channel: input.channel,
        recipient: input.recipient,
        template_id: input.template_id,
        content: input.content,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data as Notification;
  }

  /**
   * ?Œë¦¼ ëª©ë¡ ì¡°íšŒ
   */
  async getNotifications(
    tenantId: string,
    filter?: NotificationFilter
  ): Promise<Notification[]> {
    let query = withTenant(
      this.supabase.from('notifications').select('*'),
      tenantId
    );

    if (filter?.channel) {
      query = query.eq('channel', filter.channel);
    }

    if (filter?.status) {
      query = query.eq('status', filter.status);
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
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return (data || []) as Notification[];
  }

  /**
   * ?Œë¦¼ ?íƒœ ?…ë°?´íŠ¸ (Edge Function?ì„œ ?¸ì¶œ)
   */
  async updateNotificationStatus(
    tenantId: string,
    notificationId: string,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
    };

    if (status === 'sent' || status === 'delivered') {
      updateData.sent_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await withTenant(
      this.supabase
        .from('notifications')
        .update(updateData)
        .eq('id', notificationId),
      tenantId
    );

    if (error) {
      throw new Error(`Failed to update notification status: ${error.message}`);
    }
  }
}

/**
 * Default Service Instance
 */
export const notificationService = new NotificationService();

