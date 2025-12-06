/**
 * Core Auth Types
 * 
 * 인증 (Supabase Auth 기반)
 * [불변 규칙] Core Layer는 Industry 모듈에 의존하지 않음
 */

export interface User {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

