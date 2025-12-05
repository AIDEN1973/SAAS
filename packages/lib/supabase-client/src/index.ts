/**
 * Supabase 클라이언트 유틸리티
 * 
 * 사용법:
 * - 클라이언트: import { createClient } from '@lib/supabase-client'
 * - 서버/Edge: import { createServerClient } from '@lib/supabase-client/server'
 * - 멀티테넌트: import { withTenant } from '@lib/supabase-client/db'
 */

export { createClient } from './client';
export { createServerClient } from './server';
export { withTenant } from './db';

export type { SupabaseClient } from '@supabase/supabase-js';

