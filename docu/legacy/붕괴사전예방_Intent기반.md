# 붕괴 발생 지점 선제 보완
## Preflight / Contract Verification 아키텍처 (최종 정본)

**작성일**: 2025-01-28
**최종 업데이트**: 2025-01-29
**관련 문서**: `docu/계약붕괴방지.md`, `docu/핸들러 구현.md`, `docu/체크리스트.md`
**시스템**: SAMDLE (디어쌤 Multi-Tenant 학원관리 SaaS 플랫폼)

---

## 0. 문서 목적

본 문서는 ChatOps 직접 실행 구조에서 발생하는 **계약 붕괴(Contract Break)**를
"사후 차단" 이전 단계에서 **사전 탐지·격리·비활성화**하기 위한
**Preflight / Contract Verification** 체계를 정의한다.

### 핵심 질문

> **"계약 붕괴를 막기 전에, 붕괴가 발생할 수 있는 지점을 최대한 사전에 제거할 수 있는가?"**

본 문서는 이에 대해 **가능한 영역과 불가능한 영역을 구분**하고,
가능한 영역은 **배포 전·부팅 시점에 모두 검증**하도록 설계한다.

### 목표

**문제가 터지기 전에 최대한 많이 잡고, 남는 불확실성도 운영 가능한 상태로 격리하는 것**

---

## 1. 기본 선언 (Non-Negotiable)

### 1.1 계약 붕괴는 "버그"가 아니라 "환경/가정 불일치"다

**코드가 틀린 경우보다**

**환경(DB, 정책, 마이그레이션, 캐시, 설정)이 코드의 가정과 어긋난 경우가 더 치명적이다.**

**실제 사례:**
- 테이블 컬럼 누락 → PGRST204 오류
- 마이그레이션 미실행 → 스키마 불일치
- PostgREST schema cache 불일치 → 컬럼 인식 실패
- Policy 경로 오류 → 정책 검증 실패

### 1.2 "예측 불가능"의 대부분은 사실 "사전 검증 누락"이다

**예측 가능한 붕괴 지점:**
- ✅ 테이블 컬럼 없음 → **배포 전 검증 가능**
- ✅ 뷰/정책 미적용 → **배포 전 검증 가능**
- ✅ 마이그레이션 미실행 → **배포 전 검증 가능**
- ✅ PostgREST schema cache 불일치 → **부팅 시 검증 가능**
- ✅ Intent Registry 불완전 → **PR 단계 검증 가능**

👉 **이들은 런타임에서 처음 알게 되면 안 되는 문제다.**

---

## 2. Preflight / Contract Verification의 역할 정의

**Preflight / Contract Verification**이란
ChatOps 실행이 가능하다고 판단하기 전에,
시스템이 전제하는 모든 계약을 실제 환경 기준으로 검증하고
하나라도 실패하면 기능을 제한적으로 비활성화하는 체계다.

### 핵심 역할

1. **실행 이전 차단** (Early Abort)
2. **계약 실패 지점의 명확한 식별**
3. **기능 단위 Fail-Closed**
4. **"예측 불가능"을 "배포 전 오류"로 변환**

### 우리 시스템의 특성

- **Supabase Edge Functions** 기반
- **PostgREST** 경유 DB 접근
- **Multi-Tenant** 아키텍처 (RLS 필수)
- **Worker 아키텍처** (비동기 실행)
- **Intent Registry** 기반 동적 실행

---

## 3. 3-Layer Preflight 방어선 (정본)

### Layer A. 개발/PR 단계 – 정적 계약 검증 (Static Verification)

**목적**: 코드 레벨에서 이미 계약이 깨진 상태를 PR 단계에서 제거

**검증 대상:**
- ✅ Intent Registry 완전성
- ✅ Apply 입력 스키마(UUID 강제)
- ✅ Resolver 선언 누락
- ✅ Policy 경로 존재 여부
- ✅ idempotency_key 생성 규칙 존재 여부
- ✅ Domain Action Catalog 일치

**구현 위치:**
- `packages/chatops-intents/src/registry.ts` - `validateRegistryIntegrity()` (빌드타임 자동 실행)
- `scripts/precision-verification.ts` - Handler 정밀 검증
- `scripts/analyze-missing-handlers.ts` - Handler 누락 분석
- `scripts/verify-domain-action-catalog.ts` - Domain Action Catalog 검증

**특징:**
- 코드만 보고 검증
- DB 연결 필요 없음
- 빠르고 반복 가능
- CI/CD 파이프라인에 통합 가능

👉 **"인텐트 구조 자체가 위험한 상태"를 제거**

**현재 구현 상태:**
- ✅ **Intent Registry 무결성 검증** (`validateRegistryIntegrity()`)
  - L0 Intent의 `responseSchema` 필수 검증
  - L2 Intent의 `execution_class` 필수 검증
  - L2-A Intent의 `event_type` Event Catalog 일치 검증
  - L2-B Intent의 `action_key` Domain Action Catalog 일치 검증
  - **빌드타임에 자동 실행** (모듈 로드 시점)
- ✅ Handler Registry 등록 확인 (`scripts/precision-verification.ts`)
- ✅ Domain Action Catalog 일치 확인
- ✅ Policy 경로 일치 확인
- ✅ Intent Registry와 Handler 일치 확인
- ⚠️ Apply 입력 스키마 강제 검증 게이트 없음 (보완 필요)

---

### Layer B. 배포 단계 – 환경 계약 스모크 테스트 (Deploy-time Verification)

**목적**: 실제 배포 대상 환경(DB, PostgREST, RLS)에 대해
코드가 가정하는 계약이 실제로 존재하는지 확인

**필수 검증 항목:**
- ✅ 필수 테이블 존재 여부
- ✅ 필수 컬럼 존재 여부 (예: `chatops_messages.automation_level`)
- ✅ 필수 뷰/함수 존재 여부
- ✅ 최소 insert/select 스모크 쿼리
- ✅ 정책/RLS로 접근 가능한지 여부
- ✅ PostgREST 경유 접근 가능 여부
- ✅ 마이그레이션 버전 확인

**구현 위치:**
- `scripts/test-db-contract.ts` - DB Contract Gate CI 테스트

**특징:**
- 배포 파이프라인에서 자동 실행
- 실패 시 배포 중단
- "실행 후 발견"을 "배포 실패"로 전환

👉 **PGRST204 류 오류는 여기서 100% 차단 가능**

**현재 구현 상태:**
- ✅ 핵심 테이블 컬럼 존재 검사
- ✅ Smoke insert/select 테스트
- ✅ 마이그레이션 버전 체크 (MIN_REQUIRED_VERSION = 136)
- ⚠️ **CI/CD 파이프라인 자동 통합 없음** (수동 실행 필요)
  - `package.json`에 스크립트는 없음 (추가 필요)
  - `turbo.json`에 파이프라인 통합 없음
  - 배포 스크립트(`deploy.ps1`, `deploy.sh`)에 통합 없음

**검증 대상 테이블:**
```typescript
const REQUIRED_TABLES: Record<string, string[]> = {
  'task_cards': ['id', 'tenant_id', 'created_at', 'suggested_action'],
  'automation_actions': ['id', 'tenant_id', 'executed_at', 'result', 'dedup_key', 'execution_context'],
  'chatops_sessions': ['id', 'tenant_id', 'user_id', 'created_at'],
  'chatops_drafts': ['id', 'session_id', 'tenant_id', 'user_id', 'status', 'draft_params'],
  'chatops_messages': ['id', 'session_id', 'tenant_id', 'user_id', 'content', 'created_at'],
  'message_outbox': ['id', 'tenant_id', 'intent_key', 'status', 'idempotency_key'],
  'persons': ['id', 'tenant_id', 'person_type', 'status'],
  'tenant_settings': ['tenant_id', 'key', 'value'],
};
```

---

### Layer C. 런타임 부팅 시 – 시스템 Preflight (Boot-time Verification)

**목적**: 배포 후에도 발생할 수 있는 환경 Drift / 캐시 불일치를 감지

**검증 시점:**
- 서버/Edge 프로세스 시작 시 1회
- 또는 일정 주기(저비용 체크)

**검증 대상:**
- ✅ DB schema version
- ✅ 핵심 테이블/컬럼 존재
- ✅ Intent Registry 로딩 성공
- ✅ Policy Registry 로딩 성공
- ✅ Worker/Job 테이블 존재 여부
- ✅ PostgREST schema cache 일치 여부

**구현 위치:**
- `infra/supabase/supabase/functions/chatops/index.ts` - ChatOps Edge Function 부팅 시
- `infra/supabase/supabase/functions/execute-task-card/index.ts` - TaskCard 실행 Edge Function 부팅 시
- `system.exec.run_healthcheck` Handler - 헬스체크 실행

**실패 시 동작 원칙 (Fail-Open for Observability):**
- ❌ 서비스 전체 다운 금지
- ✅ ChatOps L2 실행만 비활성화 (DEGRADED 모드)
- ✅ L0/L1 조회는 가능하면 유지
- ✅ UI/로그에 명확한 상태 표시
- ✅ **마이그레이션 체크 실패 시**: `migration_check: skipped` 로그만 기록, 서비스 계속
  - 예: `PGRST205: public.supabase_migrations.schema_migrations 없음` → 관측용 에러, 서비스 중단 안 함
  - 실제 테이블 접근 가능 여부는 Layer C 런타임 검증에서 확인

👉 **"조용히 깨진 상태로 운영"을 방지하되, 관측 실패가 서비스를 중단시키지 않음**

**현재 구현 상태:**
- ✅ **부팅 시 자동 검증 구현 완료** (`chatops/index.ts:690-724`)
  - 첫 요청 시 Preflight 검증 실행
  - 5분 TTL 캐싱으로 성능 최적화
  - ChatOps/L2 실행 제어 연동
- ✅ `system.exec.run_healthcheck` Handler 구현 완료
  - Layer A/B/C 검증 통합 구현 (`runAllPreflightChecks()`)
  - Healthcheck 상태 반환 (`healthy` / `degraded` / `unhealthy`)
  - Policy 검증 구현됨
  - Domain Action Catalog 검증 구현됨
  - **마이그레이션 체크 Fail-Open**: 실패 시 에러 로그만 기록, 서비스 계속 (`system-exec-run_healthcheck.ts:287-346`)
- ✅ `system.query.health` L0 Handler 구현 완료
  - `runAllPreflightChecks()` 재사용
  - checks 파라미터 필터링 지원
  - 실제 헬스체크 로직 구현 완료

**✅ 관측용 Healthcheck 원칙 (2025-01-29 명시):**
- Healthcheck는 **관측(Observability)**을 위한 것이며, 실패가 ChatOps 기능 자체를 중단시키지 않음
- 마이그레이션 테이블 접근 실패 (예: PGRST205) → `migration_check: skipped` 로그 + 서비스 계속
- 실제 기능 테이블 접근 실패 → DEGRADED 모드 전환 (L2 실행만 차단, L0/L1 유지)
- 핵심 원칙: **"관측 실패 ≠ 서비스 실패"**

**구현 완료 사항:**
```typescript
// chatops/index.ts 첫 요청 시 또는 주기적 검증 ✅ 구현 완료
let preflightCache: HealthCheckResult | null = null;
let preflightCacheTime = 0;
const PREFLIGHT_CACHE_TTL = 5 * 60 * 1000; // 5분

async function getOrRunPreflight(supabase: any, tenantId: string): Promise<HealthCheckResult> {
  const now = Date.now();
  if (preflightCache && (now - preflightCacheTime) < PREFLIGHT_CACHE_TTL) {
    return preflightCache;
  }

  // 1. 핵심 테이블 존재 확인 ✅
  // 2. Intent Registry 로딩 확인 ✅
  // 3. Policy Registry 로딩 확인 ✅
  // 4. 실패 시 DEGRADED 모드로 전환 ✅
  const result = await runAllPreflightChecks(supabase, tenantId);

  preflightCache = result;
  preflightCacheTime = now;
  return result;
}
```

---

## 4. ChatOps Healthcheck (통합 관문)

Preflight 결과는 반드시 하나의 Healthcheck 결과로 수렴해야 한다.

### Healthcheck 상태 예시

```typescript
type HealthStatus =
  | 'OK'                                    // 모든 검증 통과
  | 'DEGRADED_EXECUTION_DISABLED'          // L2 실행 비활성화, L0/L1만 가능
  | 'DB_CONTRACT_FAILED'                    // DB 계약 실패
  | 'POLICY_REGISTRY_FAILED'                // Policy Registry 실패
  | 'INTENT_REGISTRY_FAILED'                // Intent Registry 실패
  | 'WORKER_UNAVAILABLE'                    // Worker 시스템 불가
  | 'EXTERNAL_DEPENDENCY_FAILED';           // 외부 의존성 실패
```

### 활용

1. **ChatOps 실행 버튼 활성/비활성**
2. **L2 자동 실행 차단**
3. **운영자 알림**
4. **장애 분석 기준점**

### 구현 위치

- `infra/supabase/supabase/functions/execute-student-task/handlers/system-exec-run_healthcheck.ts`
- `infra/supabase/supabase/functions/_shared/l0-handlers.ts` - `systemQueryHealthHandler`

**현재 구현 상태:**
- ✅ Handler 구조 존재 (`system-exec-run_healthcheck.ts`)
- ✅ Handler Registry 등록 확인 (`registry.ts:182`)
- ✅ Domain Action Catalog 등록 확인 (`domain-action-catalog.ts:92`)
- ✅ Domain Action Catalog 검증 구현 (`assertDomainActionKey()` - Fail-Closed)
- ✅ Policy 검증 구현됨 (`getTenantSettingByPath()`)
- ✅ **실제 헬스체크 로직 구현 완료** (`runAllPreflightChecks()`)
  - Layer A 검증: `checkLayerA()` - Intent Registry 로딩 확인
  - Layer B 검증: `checkLayerB()` - 테이블/컬럼/마이그레이션 확인
  - Layer C 검증: `checkLayerC()` - 런타임 접근 가능 여부 확인
  - 통합 Healthcheck 상태 반환 (`healthy` / `degraded` / `unhealthy`)
- ✅ **Preflight 결과 통합 로직 구현 완료** (`runAllPreflightChecks()`)
  - Layer A/B/C 결과 통합
  - checks 레코드 생성
  - overallStatus 결정 로직
- ⚠️ **Healthcheck 상태 UI 노출 없음** (보완 필요)

**구현 완료 사항:**
```typescript
// system-exec-run_healthcheck.ts 구현 완료
async execute(plan, context): Promise<HandlerResult> {
  // 1. Layer A 검증 결과 확인 (정적 검증) ✅
  // 2. Layer B 검증 결과 확인 (배포 시 검증) ✅
  // 3. Layer C 검증 실행 (런타임 검증) ✅
  // 4. 통합 Healthcheck 상태 반환 ✅
  const healthCheckResult = await runAllPreflightChecks(context.supabase, context.tenant_id);
  return {
    status: 'success',
    result: { health_status: healthStatus },
  };
}

// checkLayerC 구현 (관측용 Fail-Open)
export async function checkLayerC(supabase, tenantId): Promise<{ passed: boolean; errors?: string[] }> {
  const errors: string[] = [];

  // ✅ 마이그레이션 체크: 실패해도 서비스 계속 (관측용)
  try {
    const { data: migrationCheck } = await supabase
      .from('supabase_migrations')
      .select('version')
      .limit(1);

    if (!migrationCheck) {
      errors.push('migration_check: skipped (table not found)');  // ✅ 로그만 기록
    }
  } catch (err) {
    errors.push(`migration_check: error - ${err.message}`);  // ✅ 로그만 기록
  }

  // ✅ 실제 기능 테이블 체크: 실패 시 DEGRADED 모드 전환
  // ... (핵심 테이블 접근 검증)

  return {
    passed: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

---

## 5. 붕괴 지점 분류 체계 (Unknown Unknowns 제거)

Preflight는 모든 붕괴를 막지는 못한다.
하지만 모든 붕괴를 **분류 가능하게** 만든다.

### 계약 붕괴 카테고리 (고정)

**우리 시스템의 ContractErrorCategory:**
```typescript
// infra/supabase/supabase/functions/execute-student-task/handlers/types.ts
export enum ContractErrorCategory {
  CONTRACT_INPUT_TYPE = 'CONTRACT_INPUT_TYPE',                    // 입력 스키마 위반
  CONTRACT_RESOLUTION_AMBIGUOUS = 'CONTRACT_RESOLUTION_AMBIGUOUS', // Resolver 모호
  CONTRACT_DB_SCHEMA_MISMATCH = 'CONTRACT_DB_SCHEMA_MISMATCH',     // DB 스키마 불일치
  CONTRACT_POLICY_DISABLED = 'CONTRACT_POLICY_DISABLED',           // 정책 비활성화
  CONTRACT_IDEMPOTENCY_VIOLATION = 'CONTRACT_IDEMPOTENCY_VIOLATION', // 멱등성 위반
  CONTRACT_STATE_CHANGED = 'CONTRACT_STATE_CHANGED',               // 상태 변경
  CONTRACT_TARGET_NOT_FOUND = 'CONTRACT_TARGET_NOT_FOUND',         // 대상 없음
  CONTRACT_SESSION_MISMATCH = 'CONTRACT_SESSION_MISMATCH',         // 세션 불일치
  CONTRACT_LEVEL_MISMATCH = 'CONTRACT_LEVEL_MISMATCH',             // 레벨 불일치
  EXTERNAL_PROVIDER_FAILURE = 'EXTERNAL_PROVIDER_FAILURE',         // 외부 의존성 실패
}
```

👉 **새로운 문제가 생겨도**
**"새 카테고리 추가"가 아니라 "기존 카테고리 귀속"**이 원칙이다.

### 카테고리별 Preflight 매핑

| 카테고리 | Layer A (정적) | Layer B (배포) | Layer C (부팅) |
|---------|---------------|---------------|---------------|
| `CONTRACT_INPUT_TYPE` | ✅ Schema 검증 | | |
| `CONTRACT_DB_SCHEMA_MISMATCH` | | ✅ 테이블/컬럼 검증 | ✅ 스키마 버전 검증 |
| `CONTRACT_POLICY_DISABLED` | ✅ Policy 경로 검증 | ✅ Policy 존재 검증 | ✅ Policy 로딩 검증 |
| `CONTRACT_STATE_CHANGED` | | | ✅ Preflight 재조회 |
| `CONTRACT_TARGET_NOT_FOUND` | | | ✅ Preflight 재조회 |
| `CONTRACT_SESSION_MISMATCH` | ✅ 세션 검증 로직 | | ✅ 세션 일치 검증 |
| `EXTERNAL_PROVIDER_FAILURE` | | | ⚠️ 운영으로 해결 |

---

## 6. Preflight가 커버하는 영역 vs 커버 불가 영역

### 거의 100% 커버 가능

- ✅ 테이블/컬럼/뷰 누락 → **Layer B (배포 시)**
- ✅ 마이그레이션 미적용 → **Layer B (배포 시)**
- ✅ 정책/권한 경로 오류 → **Layer A (PR 단계)**
- ✅ Intent Registry 불완전 → **Layer A (PR 단계)**
- ✅ Apply 입력 계약 위반 → **Layer A (PR 단계) + Layer C (런타임)**
- ✅ PostgREST schema cache 불일치 → **Layer C (부팅 시)**

### 커버 불가(운영으로 해결)

- ⚠️ 외부 API 장애 → **Worker 재시도 + Idempotency**
- ⚠️ 데이터 품질 문제(동명이인 폭증 등) → **Resolver Gate + 사용자 확인**
- ⚠️ 레이스 컨디션 → **Idempotency + Dedup Key**
- ⚠️ 일시적 네트워크 오류 → **Worker 재시도**

👉 **이 영역은 Worker + Idempotency + Partial Result 모델로 처리**

---

## 7. Preflight 실패 시 시스템 행동 규칙 (중요)

| 상황 | 행동 | 구현 위치 |
|------|------|----------|
| **DB 계약 실패** | ChatOps 실행 전면 비활성 | `system.exec.run_healthcheck` |
| **Policy 로딩 실패** | L2 실행 차단, L0/L1만 허용 | `chatops/index.ts` 부팅 시 |
| **Registry 실패** | ChatOps 기능 전체 비활성 | `chatops/index.ts` 부팅 시 |
| **외부 API 불가** | 실행은 허용하되 Worker 재시도 | `worker-process-job/index.ts` |
| **Preflight 재조회 실패** | 해당 실행만 차단, 다른 실행은 허용 | `execute-task-card/index.ts`, `worker-process-job/index.ts` |

### 원칙

> **"실행이 위험하면, 실행을 숨긴다. 오류를 숨기지 않는다."**

**구현 예시:**
```typescript
// chatops/index.ts 부팅 시
const preflightResult = await bootTimePreflight(supabase);
if (preflightResult.status === 'DB_CONTRACT_FAILED') {
  // ChatOps 전체 비활성화
  globalChatOpsEnabled = false;
  console.error('[ChatOps] DB Contract 실패로 전체 비활성화');
} else if (preflightResult.status === 'POLICY_REGISTRY_FAILED') {
  // L2 실행만 차단
  globalL2ExecutionEnabled = false;
  console.warn('[ChatOps] Policy Registry 실패로 L2 실행 차단');
}
```

---

## 8. 현재 구현 현황 및 보완 계획

### ✅ 이미 구현된 항목

1. **Layer A (정적 검증)**
   - ✅ **Intent Registry 무결성 검증** (`packages/chatops-intents/src/registry.ts`)
     - 빌드타임 자동 실행 (`validateRegistryIntegrity()`)
     - L0/L2 Intent 스키마 검증
     - Event Catalog / Domain Action Catalog 일치 검증
   - ✅ Handler Registry 등록 확인 (`scripts/precision-verification.ts`)
   - ✅ Domain Action Catalog 일치 확인
   - ✅ Policy 경로 일치 확인
   - ✅ Intent Registry와 Handler 일치 확인

2. **Layer B (배포 시 검증)**
   - ✅ DB Contract Gate CI 테스트 (`scripts/test-db-contract.ts`)
   - ✅ 핵심 테이블 컬럼 존재 검사
   - ✅ Smoke insert/select 테스트
   - ✅ 마이그레이션 버전 체크 (MIN_REQUIRED_VERSION = 136)

3. **Layer C (런타임 검증)**
   - ✅ Preflight 재조회 (`execute-task-card/index.ts:541-595`, `worker-process-job/index.ts:68-115`)
     - 실행 직전 상태 재확인
     - 상태 변경 감지 (퇴원한 학생 등)
     - 존재하지 않는 대상 감지
   - ✅ 세션 일치 검증 (`chatops/index.ts:1060-1070`)
   - ✅ ContractErrorCategory 분류 체계 (`types.ts:119-130`)

### ⚠️ 보완 필요 항목

1. **Layer A (정적 검증)**
   - ✅ Apply 입력 스키마 강제 검증 게이트 추가 (`chatops/index.ts:1282-1327`)
     - UUID 필드 검증
     - `student.exec.*` Intent 특정 검증
   - ⚠️ Resolver 선언 누락 검증
   - ⚠️ CI/CD 파이프라인에 `validateRegistryIntegrity()` 통합 (현재는 빌드타임만)

2. **Layer B (배포 시 검증)**
   - ✅ **CI/CD 파이프라인 자동 통합** (구현 완료)
     - `package.json`에 `test:db-contract` 스크립트 추가 ✅
     - `turbo.json`에 파이프라인 추가 ✅
     - 배포 전 자동 실행 (`deploy.ps1`, `deploy.sh`) ✅
   - ⚠️ PostgREST 경유 접근 가능 여부 검증

3. **Layer C (런타임 검증)**
   - ✅ **부팅 시 자동 Preflight 검증** (구현 완료)
     - Edge Function 특성상 첫 요청 시 검증 + 캐싱 (`chatops/index.ts:690-724`)
     - 5분 TTL 캐싱으로 성능 최적화
     - ChatOps/L2 실행 제어 연동
   - ✅ **`system.exec.run_healthcheck` 실제 로직 구현** (구현 완료)
     - Layer A/B/C 검증 결과 통합 (`runAllPreflightChecks()`)
     - Healthcheck 상태 반환 (`healthy` / `degraded` / `unhealthy`)
   - ✅ **`system.query.health` 실제 로직 구현** (구현 완료)
     - `runAllPreflightChecks()` 재사용
     - checks 파라미터 필터링 지원
   - ⚠️ Healthcheck 상태 통합 및 UI 노출 (보완 필요)

4. **통합**
   - ✅ ChatOps 실행 버튼 활성/비활성 로직 (`chatops/index.ts:730-751`)
     - `isChatOpsEnabled()` - ChatOps 전체 비활성화
     - `isL2ExecutionEnabled()` - L2 실행 차단
   - ⚠️ Healthcheck 결과 UI 표시
   - ⚠️ 운영자 알림 시스템 연동

---

## 9. 실제 코드 경로 참조

### 핵심 파일

1. **ContractErrorCategory 정의**
   - `infra/supabase/supabase/functions/execute-student-task/handlers/types.ts:119-130`

2. **Preflight 재조회 구현**
   - `infra/supabase/supabase/functions/execute-task-card/index.ts:541-595`
   - `infra/supabase/supabase/functions/worker-process-job/index.ts:68-115`

3. **세션 일치 검증**
   - `infra/supabase/supabase/functions/chatops/index.ts:1060-1070`

4. **DB Contract Gate CI 테스트**
   - `scripts/test-db-contract.ts`

5. **정적 검증 스크립트**
   - `scripts/precision-verification.ts`
   - `scripts/analyze-missing-handlers.ts`

6. **Healthcheck Handler**
   - `infra/supabase/supabase/functions/execute-student-task/handlers/system-exec-run_healthcheck.ts`
     - Handler Registry 등록: `registry.ts:182`
     - Domain Action Catalog: `domain-action-catalog.ts:92`
     - Domain Action 검증: `domain-action-catalog.ts:131-138` (`assertDomainActionKey`)
   - `infra/supabase/supabase/functions/_shared/l0-handlers.ts:4841-4873` (systemQueryHealthHandler)

---

## 10. 최종 요약 (정본 문장)

**Preflight / Contract Verification**은
'모든 문제를 없애는 장치'가 아니라
**'문제가 런타임에서 처음 드러나지 않게 만드는 장치'**다.

### 핵심 원칙

1. **예측 가능한 붕괴는 배포 전에 제거**
   - Layer A: PR 단계 정적 검증
   - Layer B: 배포 시 환경 검증

2. **남는 불확실성은 운영 가능한 경로로 격리**
   - Layer C: 부팅 시 런타임 검증
   - Worker + Idempotency: 외부 의존성 실패 처리

3. **모든 붕괴를 분류 가능하게**
   - ContractErrorCategory로 모든 오류 분류
   - Healthcheck로 시스템 상태 통합 관리

### 결과

**"어떤 문제가 또 터질지 모르는 상태"**
→
**"터져도 어디서 터졌는지 바로 아는 상태"**
→
**"터지기 전에 미리 막는 상태"**

---

## 부록: 구현 체크리스트

### Layer A (정적 검증)
- [x] Apply 입력 스키마 강제 검증 게이트 추가 ✅ (`chatops/index.ts:1282-1327`)
- [ ] Resolver 선언 누락 검증
- [ ] CI/CD 파이프라인 통합

### Layer B (배포 시 검증)
- [x] CI/CD 파이프라인 자동 통합 ✅ (`deploy.ps1`, `deploy.sh`)
- [ ] PostgREST 경유 접근 가능 여부 검증
- [ ] 배포 실패 시 자동 롤백

### Layer C (런타임 검증)
- [x] 부팅 시 자동 Preflight 검증 ✅ (`chatops/index.ts:690-724`)
- [x] `system.exec.run_healthcheck` 실제 로직 구현 ✅ (`system-exec-run_healthcheck.ts:328-387`)
- [x] `system.query.health` 실제 로직 구현 ✅ (`l0-handlers.ts:4842-4896`)
- [ ] Healthcheck 상태 통합 및 UI 노출
- [ ] 운영자 알림 시스템 연동

### 통합
- [x] ChatOps 실행 버튼 활성/비활성 로직 ✅ (`chatops/index.ts:730-751`)
- [ ] Healthcheck 결과 UI 표시
- [ ] L2 자동 실행 차단 로직
- [ ] 장애 분석 대시보드

---

**문서 버전**: 1.1
**최종 수정일**: 2025-01-29
**관리자**: SAMDLE 개발팀
**주요 업데이트 (v1.1)**:
- Healthcheck 관측용(Observability) 원칙 명시
- 마이그레이션 체크 Fail-Open 동작 명확화
- "관측 실패 ≠ 서비스 실패" 원칙 추가

