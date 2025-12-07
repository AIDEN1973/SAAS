/**
 * Core Auth Service
 * 
 * ?¸ì¦ ?œë¹„??(Supabase Auth ?˜í•‘)
 * [ë¶ˆë? ê·œì¹™] Core Layer??Industry ëª¨ë“ˆ???˜ì¡´?˜ì? ?ŠìŒ
 * 
 * ? ï¸ ì£¼ì˜: ?¤ì œ ?¸ì¦ ë¡œì§?€ Supabase Authë¥?ì§ì ‘ ?¬ìš©?©ë‹ˆ??
 * ???œë¹„?¤ëŠ” ?¸ì¦ ê´€??? í‹¸ë¦¬í‹°?€ ?¬í¼ ?¨ìˆ˜ë¥??œê³µ?©ë‹ˆ??
 */

import { createServerClient } from '@lib/supabase-client/server';
import type { User } from './types';

export class AuthService {
  private supabase = createServerClient();

  /**
   * ?„ì¬ ?¬ìš©??ì¡°íšŒ
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user }, error } = await this.supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
    };
  }

  /**
   * ?¬ìš©??IDë¡?ì¡°íšŒ
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      created_at: data.user.created_at,
    };
  }
}

/**
 * Default Service Instance
 */
export const authService = new AuthService();

