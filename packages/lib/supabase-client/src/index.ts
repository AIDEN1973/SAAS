/**
 * Supabase 클라이언트 유틸리티
 *
 * 사용법:
 * - 클라이언트: import { createClient } from '@lib/supabase-client'
 * - 서버/Edge: import { createServerClient } from '@lib/supabase-client/server'
 * - 멀티테넌트: import { withTenant } from '@lib/supabase-client/db'
 *
 * ⚠️ 주의: 이 index.ts에서는 클라이언트 코드만 export합니다.
 * 서버 코드는 클라이언트 번들에 포함되지 않도록 './server'에서 직접 import하세요.
 */

// 클라이언트용 코드만 export
export { createClient } from './client';
export { withTenant } from './db';

export type { SupabaseClient } from '@supabase/supabase-js';

// 서버 사용 코드는 이 index.ts에서 export하지 않습니다.
// 서버에서는 직접 import: import { createServerClient } from '@lib/supabase-client/server'
