/**
 * API Context
 *
 * [불변 규칙] UI는 테넌트 ID나 업종을 직접 결정해서는 안 됨
 * Context는 미들웨어 또는 인증 서비스에서 주입합니다.
 */

let currentContext: {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
} = {};

/**
 * Context 설정
 * 미들웨어 또는 인증 서비스에서 호출
 */
export function setApiContext(context: {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
}) {
  currentContext = { ...currentContext, ...context };
}

/**
 * Context 가져오기
 */
export function getApiContext() {
  return { ...currentContext };
}

/**
 * Context 초기화
 */
export function clearApiContext() {
  currentContext = {};
}
