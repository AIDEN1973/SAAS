/**
 * ì¤‘ì•™ ?˜ê²½ë³€??ê´€ë¦??œìŠ¤??
 * 
 * ?¬ìš©ë²?
 * - ?œë²„/Edge: import { envServer } from '@env-registry/core/server'
 * - ?´ë¼?´ì–¸?? import { envClient } from '@env-registry/core/client'
 * - ê³µí†µ: import { envCommon } from '@env-registry/core/common'
 * 
 * ? ï¸ ì£¼ì˜: ??index.ts?ì„œ???œë²„ ?„ìš© ì½”ë“œë¥?export?˜ì? ?ŠìŠµ?ˆë‹¤.
 * ?´ë¼?´ì–¸?¸ì—??'@env-registry/core'ë¥?import?´ë„ ?œë²„ ì½”ë“œê°€ ë²ˆë“¤???¬í•¨?˜ì? ?ŠìŠµ?ˆë‹¤.
 */

// ?´ë¼?´ì–¸???„ìš© (NEXT_PUBLIC_* ê°’ë§Œ)
export { envClient } from './client';
export type { EnvClient } from './schema';

// ?œë²„ ?„ìš© ì½”ë“œ??ì§ì ‘ ê²½ë¡œë¡œë§Œ import?˜ì„¸??
// import { envServer } from '@env-registry/core/server'
// import { envCommon } from '@env-registry/core/common'

