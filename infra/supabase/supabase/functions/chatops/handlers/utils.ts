// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 공통 유틸리티 함수
 * - PII 마스킹
 * - 에러 마스킹
 */

import { maskPII } from '../../_shared/pii-utils.ts';

/**
 * [P0-LOG-A] Error/object를 string으로 변환 후 마스킹
 */
export function maskErr(e: unknown): string {
  const msg = (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message) : String(e);
  return maskPII(msg) as string;
}

/**
 * 🔧 FIX: P0-SEC/LOG - object 안전 마스킹 (maskPII는 string 전제)
 * - 로그/감사 저장용으로만 사용(객체로 되돌리지 않음)
 */
export function maskPIIJson(value: unknown, maxLen = 2000): string {
  try {
    const s = JSON.stringify(value);
    const masked = maskPII(s) as string;
    return masked.length > maxLen ? masked.slice(0, maxLen) + '…' : masked;
  } catch {
    const masked = maskPII(String(value)) as string;
    return masked.length > maxLen ? masked.slice(0, maxLen) + '…' : masked;
  }
}

/**
 * 🔧 FIX: P0-SEC - tenant_id 로그 노출 금지용 hash
 */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 🔧 FIX: P0-SEC - tenant_id를 직접 로그에 찍지 말 것
 */
export async function tenantLogKey(tenantId: string): Promise<string> {
  const h = await sha256Hex(tenantId);
  return `t:${h.slice(0, 8)}`;
}

