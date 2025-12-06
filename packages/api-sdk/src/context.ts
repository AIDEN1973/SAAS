/**
 * API Context
 * 
 * [불변 규칙] UI는 테넌트 ID나 업종을 직접 결정하지 않는다.
 * Context는 미들웨어나 인증 시스템에서 주입된다.
 */

let currentContext: {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
} = {};

/**
 * Context 설정
 * 미들웨어나 인증 시스템에서 호출
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

