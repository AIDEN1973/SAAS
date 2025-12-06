/**
 * Core Auth Service
 * 
 * 인증 서비스 (Supabase Auth 래핑)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 * 
 * ⚠️ 주의: 실제 인증 로직은 Supabase Auth를 직접 사용합니다.
 * 이 서비스는 인증 관련 유틸리티와 헬퍼 함수를 제공합니다.
 */

import { createServerClient } from '@lib/supabase-client/server';
import type { User } from './types';

export class AuthService {
  private supabase = createServerClient();

  /**
   * 현재 사용자 조회
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
   * 사용자 ID로 조회
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

