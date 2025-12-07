/**
 * Supabase URL ?•ì¸ ? í‹¸ë¦¬í‹°
 * ê°œë°œ ?˜ê²½?ì„œ ?¤ì œ ?¬ìš©?˜ëŠ” URL???•ì¸?˜ê¸° ?„í•œ ?¬í¼
 */

import { createClient } from '@lib/supabase-client';

/**
 * ?„ì¬ ?¬ìš© ì¤‘ì¸ Supabase URL ?•ì¸
 */
export function checkSupabaseUrl(): {
  url: string;
  anonKey: string;
  isCorrect: boolean;
} {
  const supabase = createClient();
  
  // Supabase ?´ë¼?´ì–¸?¸ì˜ ?´ë? URL ì¶”ì¶œ
  // @ts-ignore - ?´ë? ?ì„± ?‘ê·¼
  const url = supabase.supabaseUrl || '';
  // @ts-ignore - ?´ë? ?ì„± ?‘ê·¼
  const anonKey = supabase.supabaseKey || '';
  
  const correctUrl = 'https://xawypsrotrfoyozhrsbb.supabase.co';
  const isCorrect = url === correctUrl;
  
  console.log('?” Supabase URL ?•ì¸:', {
    ?„ì¬_URL: url,
    ?¬ë°”ë¥?URL: correctUrl,
    ?¼ì¹˜: isCorrect ? '?? : '??,
    Anon_Key_?¤ì •?? anonKey ? '?? : '??,
  });
  
  if (!isCorrect) {
    console.error('???˜ëª»??Supabase URL???¬ìš©?˜ê³  ?ˆìŠµ?ˆë‹¤!');
    console.error('   ?„ì¬:', url);
    console.error('   ?¬ë°”ë¥?ê°?', correctUrl);
    console.error('   .env.local ?Œì¼???•ì¸?˜ê³  ê°œë°œ ?œë²„ë¥??¬ì‹œ?‘í•˜?¸ìš”.');
  }
  
  return {
    url,
    anonKey,
    isCorrect,
  };
}

/**
 * ?˜ê²½ë³€?˜ì—??ì§ì ‘ URL ?•ì¸
 */
export function checkEnvVariables(): void {
  // @ts-ignore
  const viteUrl = import.meta.env?.VITE_SUPABASE_URL;
  
  console.log('?” ?˜ê²½ë³€???•ì¸:', {
    'import.meta.env.VITE_SUPABASE_URL': viteUrl || 'ë¯¸ì„¤??,
    'import.meta.env.MODE': import.meta.env?.MODE || 'ë¯¸ì„¤??,
    'import.meta.env.DEV': import.meta.env?.DEV || 'ë¯¸ì„¤??,
  });
  
  if (viteUrl && viteUrl.includes('npferbxuxocbfnfbpcnz')) {
    console.error('???˜ëª»??URL???˜ê²½ë³€?˜ì— ?¤ì •?˜ì–´ ?ˆìŠµ?ˆë‹¤!');
    console.error('   .env.local ?Œì¼???•ì¸?˜ê³  ê°œë°œ ?œë²„ë¥??¬ì‹œ?‘í•˜?¸ìš”.');
    console.error('   Vite ìºì‹œë¥??? œ: rm -rf node_modules/.vite');
  }
}

