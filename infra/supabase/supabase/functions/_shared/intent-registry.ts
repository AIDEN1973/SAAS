/**
 * Intent Registry (Stub)
 *
 * [목적] L2-B 실행 차단 규칙을 위한 Intent 조회
 * [현재 상태] Stub 구현 (추후 확장 예정)
 */

export interface IntentRegistryItem {
  intent_key: string;
  action_key?: string;
}

// Stub: 현재는 빈 레지스트리 반환
const INTENT_REGISTRY: Record<string, IntentRegistryItem> = {};

/**
 * Intent 조회
 * @param intent_key Intent 키
 * @returns IntentRegistryItem 또는 null
 */
export function getIntent(intent_key: string): IntentRegistryItem | null {
  return INTENT_REGISTRY[intent_key] || null;
}

/**
 * Intent 등록
 * @param intent IntentRegistryItem
 */
export function registerIntent(intent: IntentRegistryItem): void {
  INTENT_REGISTRY[intent.intent_key] = intent;
}
