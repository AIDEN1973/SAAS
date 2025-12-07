import { envClientSchema, type EnvClient } from './schema';

// Vite ?˜ê²½ë³€???€???•ì˜ (Viteê°€ ?†ëŠ” ?˜ê²½?ì„œ???€??ì²´í¬ ?µê³¼)
interface ImportMetaEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_KAKAO_JS_KEY?: string;
  [key: string]: any;
}

function validateEnvClient(): EnvClient {
  const rawEnv: Record<string, string | undefined> = {};
  
  // Vite ?˜ê²½ ê°ì? (import.meta.env ?¬ìš©)
  // Vite?ì„œ??import.meta.envë¥??µí•´ ?˜ê²½ë³€?˜ì— ?‘ê·¼
  // ?„ë¡œ?•ì…˜ ë¹Œë“œ?ì„œ??ë¹Œë“œ ?€?„ì— ì£¼ì…?˜ë?ë¡???ƒ ?‘ê·¼ ê°€?¥í•´????  let isVite = false;
  try {
    // @ts-ignore - import.meta??Vite?ì„œë§?ì¡´ì¬?˜ë©°, ?€???•ì˜ê°€ ?„ë²½?˜ì? ?Šì„ ???ˆìŒ
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const metaEnv = import.meta.env;
    if (metaEnv) {
      isVite = true;
      const viteEnv = metaEnv as ImportMetaEnv;
      
      // Vite: VITE_* ?‘ë‘???¬ìš©
      // VITE_ ?‘ë‘?¬ë? NEXT_PUBLIC_ë¡?ë§¤í•‘ (?¤í‚¤ë§??¸í™˜??
      // ë¹?ë¬¸ì??ì²´í¬ (define ?µì…˜?¼ë¡œ ì£¼ì…??ê²½ìš° ë¹?ë¬¸ì?´ì´ ?????ˆìŒ)
      if (viteEnv.VITE_SUPABASE_URL && viteEnv.VITE_SUPABASE_URL.trim() !== '') {
        rawEnv.NEXT_PUBLIC_SUPABASE_URL = viteEnv.VITE_SUPABASE_URL;
      }
      if (viteEnv.VITE_SUPABASE_ANON_KEY && viteEnv.VITE_SUPABASE_ANON_KEY.trim() !== '') {
        rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = viteEnv.VITE_SUPABASE_ANON_KEY;
      }
      if (viteEnv.VITE_KAKAO_JS_KEY && viteEnv.VITE_KAKAO_JS_KEY.trim() !== '') {
        rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY = viteEnv.VITE_KAKAO_JS_KEY;
      }
    }
  } catch (e) {
    // import.metaê°€ ?†ëŠ” ?˜ê²½ (Node.js ?? - ?•ìƒ?ì¸ ?™ì‘
    isVite = false;
  }
  
  // Next.js ?˜ê²½ ?ëŠ” ?¼ë°˜ Node.js ?˜ê²½ (?ëŠ” Vite ?„ë¡œ?•ì…˜?ì„œ process.env??ì²´í¬)
  if (typeof process !== 'undefined' && process.env) {
    // Next.js: NEXT_PUBLIC_* ?‘ë‘??    for (const key in process.env) {
      if (key.startsWith('NEXT_PUBLIC_')) {
        rawEnv[key] = process.env[key];
      }
    }
    
    // Vite ?˜ê²½ë³€?˜ë? NEXT_PUBLIC_ë¡?ë§¤í•‘ (VITE_*ê°€ ?ˆëŠ” ê²½ìš°)
    // ?„ë¡œ?•ì…˜ ë¹Œë“œ?ì„œ import.meta.envê°€ ?‘ë™?˜ì? ?ŠëŠ” ê²½ìš°ë¥??€ë¹?    if (process.env.VITE_SUPABASE_URL && !rawEnv.NEXT_PUBLIC_SUPABASE_URL) {
      rawEnv.NEXT_PUBLIC_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    }
    if (process.env.VITE_SUPABASE_ANON_KEY && !rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
    }
    if (process.env.VITE_KAKAO_JS_KEY && !rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY) {
      rawEnv.NEXT_PUBLIC_KAKAO_JS_KEY = process.env.VITE_KAKAO_JS_KEY;
    }
  }
  
  const parsed = envClientSchema.safeParse(rawEnv);
  
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    ).join('\n');
    const missingVars = parsed.error.errors
      .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
      .map(e => e.path.join('.'))
      .join(', ');
    
    // Vite ?˜ê²½?¸ì? ?•ì¸ (?„ì—???´ë? ?•ì¸??
    const envPrefix = isVite ? 'VITE_' : 'NEXT_PUBLIC_';
    
    // ?”ë²„ê¹??•ë³´ ?˜ì§‘
    const debugInfo: string[] = [];
    try {
      // @ts-ignore
      const metaEnv = import.meta.env;
      if (metaEnv) {
        debugInfo.push(`import.meta.env.VITE_SUPABASE_URL: ${metaEnv.VITE_SUPABASE_URL ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
        debugInfo.push(`import.meta.env.VITE_SUPABASE_ANON_KEY: ${metaEnv.VITE_SUPABASE_ANON_KEY ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
      }
    } catch (e) {
      debugInfo.push('import.meta.env ?‘ê·¼ ë¶ˆê?');
    }
    if (typeof process !== 'undefined' && process.env) {
      debugInfo.push(`process.env.VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
      debugInfo.push(`process.env.VITE_SUPABASE_ANON_KEY: ${process.env.VITE_SUPABASE_ANON_KEY ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
      debugInfo.push(`process.env.NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
      debugInfo.push(`process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '?¤ì •?? : 'ë¯¸ì„¤??}`);
    }
    
    throw new Error(
      `?´ë¼?´ì–¸???˜ê²½ë³€??ê²€ì¦??¤íŒ¨:\n${errors}\n\n` +
      (missingVars ? `?„ë½???„ìˆ˜ ?˜ê²½ë³€?? ${missingVars}\n\n` : '') +
      `?„ìˆ˜ ?´ë¼?´ì–¸???˜ê²½ë³€?˜ê? ?„ë½?˜ì—ˆ?µë‹ˆ??\n\n` +
      `?˜ê²½ë³€???¤ì • ë°©ë²•:\n` +
      `1. ë¡œì»¬ ê°œë°œ: ?„ë¡œ?íŠ¸ ë£¨íŠ¸ ?”ë ‰? ë¦¬??.env.local ?Œì¼??${envPrefix}SUPABASE_URLê³?${envPrefix}SUPABASE_ANON_KEYë¥??¤ì •?˜ì„¸??\n` +
      `2. Vercel ë°°í¬: Vercel ?€?œë³´??> ?„ë¡œ?íŠ¸ ?¤ì • > Environment Variables?ì„œ ${envPrefix}SUPABASE_URLê³?${envPrefix}SUPABASE_ANON_KEYë¥??¤ì •?˜ì„¸??\n` +
      `   (Vite ?„ë¡œ?íŠ¸??VITE_ ?‘ë‘?? Next.js ?„ë¡œ?íŠ¸??NEXT_PUBLIC_ ?‘ë‘???¬ìš©)\n\n` +
      (debugInfo.length > 0 ? `?”ë²„ê¹??•ë³´:\n${debugInfo.join('\n')}\n\n` : '') +
      `ì°¸ê³ : Vite ?„ë¡œ?•ì…˜ ë¹Œë“œ?ì„œ??ë¹Œë“œ ?€?„ì— ?˜ê²½ë³€?˜ê? ì£¼ì…?˜ì–´???©ë‹ˆ??`
    );
  }
  
  return parsed.data;
}

// ? í”Œë¦¬ì??´ì…˜ ?œì‘ ????ë²ˆë§Œ ê²€ì¦?export const envClient = validateEnvClient();
