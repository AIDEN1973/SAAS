/**
 * Supabase ?´ë¼?´ì–¸??? í‹¸ë¦¬í‹°
 * 
 * ?¬ìš©ë²?
 * - ?´ë¼?´ì–¸?? import { createClient } from '@lib/supabase-client'
 * - ?œë²„/Edge: import { createServerClient } from '@lib/supabase-client/server'
 * - ë©€?°í…Œ?ŒíŠ¸: import { withTenant } from '@lib/supabase-client/db'
 * 
 * ? ï¸ ì£¼ì˜: ??index.ts?ì„œ???´ë¼?´ì–¸??ì½”ë“œë§?export?©ë‹ˆ??
 * ?œë²„ ì½”ë“œ???´ë¼?´ì–¸??ë²ˆë“¤???¬í•¨?˜ì? ?Šë„ë¡?'./server'?ì„œ ì§ì ‘ import?˜ì„¸??
 */

// ?´ë¼?´ì–¸???„ìš© ì½”ë“œë§?export
export { createClient } from './client';
export { withTenant } from './db';

export type { SupabaseClient } from '@supabase/supabase-js';

// ?œë²„ ?„ìš© ì½”ë“œ????index.ts?ì„œ export?˜ì? ?ŠìŠµ?ˆë‹¤.
// ?œë²„?ì„œ??ì§ì ‘ import: import { createServerClient } from '@lib/supabase-client/server'

