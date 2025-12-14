/**
 * Core Notification Service
 *
 * 메시지 알림 서비스
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 *
 * ⚠️ 주의: 실제 발송은 Edge Function (fns-notification-dispatch)에서 처리합니다.
 * 이 서비스는 알림 메타데이터와 로그만 담당합니다.
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
   * 알림 생성 (큐에 추가)
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
   * 알림 목록 조회
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
   * 알림 상태 업데이트 (Edge Function에서 호출)
   */
  async updateNotificationStatus(
    tenantId: string,
    notificationId: string,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: Partial<Notification> = {
      status,
    };

    if (status === 'sent' || status === 'delivered') {
      // 기술문서 19-1-1: 타임스탬프는 UTC로 저장 (DB 저장 규칙)
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
