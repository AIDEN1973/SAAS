/**
 * API Context
 * 
 * [ë¶ˆë? ê·œì¹™] UI???Œë„Œ??ID???…ì¢…??ì§ì ‘ ê²°ì •?˜ì? ?ŠëŠ”??
 * Context??ë¯¸ë“¤?¨ì–´???¸ì¦ ?œìŠ¤?œì—??ì£¼ì…?œë‹¤.
 */

let currentContext: {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
} = {};

/**
 * Context ?¤ì •
 * ë¯¸ë“¤?¨ì–´???¸ì¦ ?œìŠ¤?œì—???¸ì¶œ
 */
export function setApiContext(context: {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
}) {
  currentContext = { ...currentContext, ...context };
}

/**
 * Context ê°€?¸ì˜¤ê¸?
 */
export function getApiContext() {
  return { ...currentContext };
}

/**
 * Context ì´ˆê¸°??
 */
export function clearApiContext() {
  currentContext = {};
}

