/**
 * Supabase ?�라?�언???�틸리티
 *
 * ?�용�?
 * - ?�라?�언?? import { createClient } from '@lib/supabase-client'
 * - ?�버/Edge: import { createServerClient } from '@lib/supabase-client/server'
 * - 멀?�테?�트: import { withTenant } from '@lib/supabase-client/db'
 *
 * ?�️ 주의: ??index.ts?�서???�라?�언??코드�?export?�니??
 * ?�버 코드???�라?�언??번들???�함?��? ?�도�?'./server'?�서 직접 import?�세??
 */
export { createClient } from './client';
export { withTenant } from './db';
export type { SupabaseClient } from '@supabase/supabase-js';
//# sourceMappingURL=index.d.ts.map