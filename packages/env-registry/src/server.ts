import { envServerSchema, type EnvServer } from './schema';
import { resolveEnv } from './resolve';

// ë¡œì»¬ ê°œë°œ ?˜ê²½?ì„œ dotenvë¡?.env.local ?Œì¼ ë¡œë“œ (ì¤‘ì•™ ê´€ë¦?
// ë£¨íŠ¸ ?”ë ‰? ë¦¬??.env.local ?Œì¼???ë™?¼ë¡œ ë¡œë“œ
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const fs = require('fs');
    
    // ë£¨íŠ¸ ?”ë ‰? ë¦¬??.env.local ?Œì¼ ì°¾ê¸°
    // process.cwd()??ë³´í†µ ?„ë¡œ?íŠ¸ ë£¨íŠ¸ë¥?ê°€ë¦¬í‚´
    const rootEnvPath = path.resolve(process.cwd(), '.env.local');
    
    if (fs.existsSync(rootEnvPath)) {
      const result = dotenv.config({ path: rootEnvPath });
      if (result.error) {
        console.warn(`[env-registry] ?˜ê²½ë³€???Œì¼ ë¡œë“œ ?¤íŒ¨: ${result.error.message}`);
      } else {
        console.log(`[env-registry] ?˜ê²½ë³€???Œì¼ ë¡œë“œ ?„ë£Œ: ${rootEnvPath}`);
      }
    } else {
      console.warn(`[env-registry] .env.local ?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤: ${rootEnvPath}`);
      console.warn(`[env-registry] ë£¨íŠ¸ ?”ë ‰? ë¦¬??.env.local ?Œì¼???ì„±?˜ì„¸??`);
    }
  } catch (error) {
    // dotenvê°€ ?†ê±°??ë¡œë“œ ?¤íŒ¨ ??ë¬´ì‹œ (?´ë? process.env???¤ì •?˜ì–´ ?ˆì„ ???ˆìŒ)
    console.warn(`[env-registry] dotenv ë¡œë“œ ?¤íŒ¨:`, error);
  }
}

function validateEnvServer(): EnvServer {
  const rawEnv = resolveEnv();
  const parsed = envServerSchema.safeParse(rawEnv);
  
  if (!parsed.success) {
    const errors = parsed.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    ).join('\n');
    
    const missingVars = parsed.error.errors
      .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
      .map(e => e.path.join('.'))
      .join(', ');
    
    throw new Error(
      `?˜ê²½ë³€??ê²€ì¦??¤íŒ¨:\n${errors}\n\n` +
      (missingVars ? `?„ë½???„ìˆ˜ ?˜ê²½ë³€?? ${missingVars}\n\n` : '') +
      `?„ìˆ˜ ?˜ê²½ë³€?˜ê? ?„ë½?˜ì—ˆê±°ë‚˜ ?•ì‹???˜ëª»?˜ì—ˆ?µë‹ˆ??\n` +
      `?„ë¡œ?íŠ¸ ë£¨íŠ¸ ?”ë ‰? ë¦¬??.env.local ?Œì¼???ì„±?˜ê±°?? packages/env-registry/.env.example ?Œì¼??ì°¸ê³ ?˜ì„¸??`
    );
  }
  
  return parsed.data;
}

// ? í”Œë¦¬ì??´ì…˜ ?œì‘ ????ë²ˆë§Œ ê²€ì¦?
export const envServer = validateEnvServer();

// ?€???ˆì „???‘ê·¼
// ?¬ìš© ?? envServer.SUPABASE_URL, envServer.SERVICE_ROLE_KEY
