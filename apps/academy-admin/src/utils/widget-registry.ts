/**
 * Widget Registration Flag Utility (SDUI 위젯 등록 플래그 관리)
 *
 * 중요: 이 파일은 window.__sduiWidgetRegistered 플래그를 관리하는 유틸리티입니다.
 * 실제 위젯 로더 레지스트리는 packages/schema-engine/src/widgets/registry.ts를 참조하세요.
 *
 * 목적:
 * - window.__sduiWidgetRegistered 플래그 객체 관리 (위젯 등록 여부 추적)
 * - SDUI 컴포넌트가 중복 등록되지 않도록 플래그 체크
 *
 * 관련 파일:
 * - packages/schema-engine/src/widgets/registry.ts: 실제 위젯 로더 레지스트리 (registerWidget, loadWidget)
 *
 * [불변 규칙] window.__sduiWidgetRegistered 직접 접근 금지
 * ESLint 규칙 P0-1 준수: window 전역 플래그는 전용 util로만 접근
 */

// [P0-1 해결] window 타입 선언을 전용 유틸리티 파일로 이동
// 위젯 등록 플래그 타입 안정성 보장 (XSS 공격 방지를 위한 타입 정의)
declare global {
  interface Window {
    __sduiWidgetRegistered?: Record<string, boolean>; // 키 기반 위젯 등록 플래그 관리
  }
}

/**
 * 위젯 등록 플래그 객체 가져오기 (내부 함수)
 * @returns 위젯 등록 플래그 객체
 */
function getWidgetRegistry(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return {};
  }

  // window.__sduiWidgetRegistered가 없으면 초기화
  // 이 파일은 window.__sduiWidgetRegistered를 래핑하는 유틸리티이므로 직접 접근 허용
  const win = window as unknown as { __sduiWidgetRegistered?: Record<string, boolean> };
  if (!win.__sduiWidgetRegistered) {
    win.__sduiWidgetRegistered = {};
  }

  return win.__sduiWidgetRegistered;
}

/**
 * 위젯이 등록되었는지 확인
 * @param key - 위젯 키 (네임스페이스 포함, 예: 'academy-admin/TagNameInput')
 * @returns 등록 여부
 */
export function isWidgetRegistered(key: string): boolean {
  const registry = getWidgetRegistry();
  return registry[key] === true;
}

/**
 * 위젯 등록 플래그 설정
 * @param key - 위젯 키 (네임스페이스 포함, 예: 'academy-admin/TagNameInput')
 */
export function setWidgetRegistered(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const registry = getWidgetRegistry();
  registry[key] = true;
}

