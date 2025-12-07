/**
 * ?œë²„/Edge ?˜ê²½ë³??˜ê²½ë³€??ë¡œë”© ?„ëµ
 * - Edge Function (Supabase): Deno.env.toObject()
 * - Vercel (App/Node): process.env
 * - ë¡œì»¬ ê°œë°œ: process.env (dotenv ë¡œë“œ ??
 * 
 * ? ï¸ ì£¼ì˜: ë¸Œë¼?°ì? ?˜ê²½?ì„œ???¬ìš© ë¶ˆê? (resolveEnv() ?¸ì¶œ ???ëŸ¬ ë°œìƒ)
 * 
 * ?˜ê²½ë³€???Œì¼ ?„ì¹˜:
 * - ë£¨íŠ¸ ?”ë ‰? ë¦¬: .env.local (ë¡œì»¬ ê°œë°œ?? ì¤‘ì•™ ê´€ë¦?
 * - dotenv??server.ts?ì„œ ì´ˆê¸°???œì ??ë¡œë“œ??
 */
export function resolveEnv(): Record<string, string | undefined> {
  // Edge Function ?˜ê²½ ê°ì? (Supabase Edge Functions??Deno ?°í???
  // @ts-ignore - Deno??Edge Function ?˜ê²½?ì„œë§?ì¡´ì¬
  if (typeof Deno !== 'undefined' && Deno.env) {
    // @ts-ignore
    const env: Record<string, string | undefined> = {};
    // @ts-ignore
    const denoEnv = Deno.env.toObject();
    for (const [key, value] of Object.entries(denoEnv)) {
      env[key] = typeof value === 'string' ? value : undefined;
    }
    return env;
  }
  
  // Node.js / Vercel ?˜ê²½
  // dotenv??server.ts?ì„œ ?´ë? ë¡œë“œ?˜ì–´ ?ˆìŒ
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  
  throw new Error(
    '?˜ê²½ë³€???‘ê·¼ ë¶ˆê?: Edge/App/Node ?˜ê²½??ê°ì??????†ìŠµ?ˆë‹¤.\n' +
    'ë¸Œë¼?°ì? ?˜ê²½?ì„œ??env-registry/serverë¥??¬ìš©?????†ìŠµ?ˆë‹¤.\n' +
    '?´ë¼?´ì–¸??ì½”ë“œ?ì„œ??NEXT_PUBLIC_* ??ë¹Œë“œ?€??ê°’ì„ ì§ì ‘ ?¬ìš©?˜ì„¸??'
  );
}
