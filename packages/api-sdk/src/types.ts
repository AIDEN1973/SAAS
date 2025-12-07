/**
 * API SDK Types
 * 
 * [ë¶ˆë? ê·œì¹™] UI???Œë„Œ??ID???…ì¢…??ì§ì ‘ ê²°ì •?˜ì? ?ŠëŠ”??
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?”ì²­?€ SDKë¥??µí•´ ?ë™?¼ë¡œ tenant_id, industry_type, auth token???½ì…?œë‹¤.
 */

export interface ApiRequest {
  tenant?: string;  // SDKê°€ ?ë™?¼ë¡œ ?½ì…
  industry?: string;  // SDKê°€ ?ë™?¼ë¡œ ?½ì…
  authorization?: string;  // SDKê°€ ?ë™?¼ë¡œ ?½ì…
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface ApiClientConfig {
  tenantId?: string;  // Context?ì„œ ê°€?¸ì˜´
  industryType?: string;  // Context?ì„œ ê°€?¸ì˜´
  authToken?: string;  // Auth?ì„œ ê°€?¸ì˜´
}

