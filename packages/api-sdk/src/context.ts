/**
 * API Context
 *
 * [불변 규칙] UI는 테넌트 ID나 업종을 직접 결정해서는 안 됨
 * Context는 미들웨어 또는 인증 서비스에서 주입합니다.
 *
 * [P1-3 수정] Race Condition 방지:
 * - Mutex 패턴으로 동시 접근 제어
 * - 불변 객체 패턴으로 안전한 읽기 보장
 */

export interface ApiContextState {
  tenantId?: string;
  industryType?: string;
  authToken?: string;
}

// [P1-3] 불변 객체로 Context 관리 (Race Condition 방지)
let currentContext: Readonly<ApiContextState> = Object.freeze({});

// [P1-3] Context 업데이트 중 상태 추적
let isUpdating = false;
const pendingUpdates: Array<Partial<ApiContextState>> = [];

/**
 * [P1-3] 대기 중인 업데이트 처리
 */
function processPendingUpdates(): void {
  if (pendingUpdates.length === 0) return;

  // 모든 대기 중인 업데이트를 하나로 병합
  const mergedUpdate = pendingUpdates.reduce(
    (acc, update) => ({ ...acc, ...update }),
    {}
  );
  pendingUpdates.length = 0;

  // 불변 객체로 새 Context 생성
  currentContext = Object.freeze({ ...currentContext, ...mergedUpdate });
}

/**
 * Context 설정
 * 미들웨어 또는 인증 서비스에서 호출
 *
 * [P1-3 수정] Race Condition 방지:
 * - 동시 업데이트 시 큐에 저장 후 순차 처리
 * - 불변 객체로 새 Context 생성
 */
export function setApiContext(context: Partial<ApiContextState>): void {
  if (isUpdating) {
    // 업데이트 중이면 큐에 저장
    pendingUpdates.push(context);
    return;
  }

  isUpdating = true;

  try {
    // 불변 객체로 새 Context 생성
    currentContext = Object.freeze({ ...currentContext, ...context });

    // 대기 중인 업데이트 처리
    processPendingUpdates();
  } finally {
    isUpdating = false;

    // 업데이트 중 추가된 항목이 있으면 다시 처리
    if (pendingUpdates.length > 0) {
      setApiContext({});
    }
  }
}

/**
 * Context 가져오기
 *
 * [P1-3 수정] 불변 객체 반환으로 안전한 읽기 보장
 */
export function getApiContext(): Readonly<ApiContextState> {
  // 이미 freeze된 객체를 반환하므로 복사 불필요
  return currentContext;
}

/**
 * Context 초기화
 */
export function clearApiContext(): void {
  currentContext = Object.freeze({});
  pendingUpdates.length = 0;
  isUpdating = false;
}

/**
 * [P1-3 추가] Context 상태 확인 (디버깅용)
 */
export function getApiContextStatus(): {
  isUpdating: boolean;
  pendingCount: number;
  hasContext: boolean;
} {
  return {
    isUpdating,
    pendingCount: pendingUpdates.length,
    hasContext: !!currentContext.tenantId,
  };
}
