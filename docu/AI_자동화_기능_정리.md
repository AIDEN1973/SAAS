# AI 자동화 기능 정리 문서

**기준 문서**: 프론트 자동화 문서 (프론트엔드 상황 신호 수집 및 UI 조정 문서)
**버전**: Architecture v3.3 Strict-Compliant Edition
**작성일**: 2024

---

## ⚠️ Automation Config First (불변 원칙)

**본 시스템에서 어떠한 자동화도 하드코딩된 조건으로 실행되지 않는다.**
**모든 자동화는 사용자 설정값(Policy / Threshold / Toggle)을 통해 활성·비활성 및 강도가 결정되며,**
**실행 여부는 서버/Edge Function이 해당 설정을 해석하여 판단한다.**

⚠️ 표현·단어·순서 변경 금지

### 기본값(Default)의 정본 정의

**기본값(Default)이란 코드 상수가 아니라 Default Policy이다.**
**모든 자동화 기능은 기본 정책(Default Policy)을 가지며,**
**이 기본 정책은 테넌트 생성 시 설정값으로 저장된다.**
**코드에 하드코딩된 기본 임계값이나 조건은 존재하지 않는다.**

**금지 패턴:**
- ❌ "값이 없으면 기본값 사용"
- ❌ "undefined면 3으로 처리"
- ❌ 코드 내부 상수 기반 조건

**정본 패턴:**
- ✅ 설정이 존재 → 사용
- ✅ 설정이 없음 → 실행하지 않음 (Fail Closed)

### 자동화의 정본 구조

자동화는 반드시 아래 3요소 조합으로만 설명한다:

1. **Trigger**: 상황 신호 또는 이벤트
2. **Policy**: 사용자 설정값 (ON/OFF, 임계값, 승인 레벨)
3. **Executor**: Server / Edge Function (정책 해석 + 실행)

❌ 프론트엔드는 판단·실행 주체가 아니다.

---

## ✅ 설정 저장 SSOT (Single Source of Truth)

**⚠️ 모든 자동화 설정은 아래 규격을 준수합니다.**

### 저장소 및 경로 규격
- **저장소**: `tenant_settings` KV 구조 (key='config' row의 value JSONB)
  - `tenant_settings` 테이블은 (tenant_id, key, value JSONB) KV 구조입니다.
  - ⚠️ 중요: `config`는 컬럼이 아니라 key='config'인 row의 value(JSONB)입니다. `tenant_settings.auto_notification.*` 같은 top-level 컬럼 표기 금지
  - **⚠️ 정본 데이터 모델**: `tenant_settings` 테이블은 KV 구조이며, 모든 설정은 key='config'인 단일 row의 value(JSONB) 필드에 저장됩니다. 다른 문서에서 언급하는 "tenant_settings.* 단일 JSON 스펙"은 이 KV 구조 내부의 value(JSONB) 필드를 의미합니다.
- **자동화 정책 경로**: `auto_notification.<event_type>.(enabled|channel|template_key|throttle|...)`
  - 경로는 tenant_settings 테이블의 key='config' row의 value(JSONB) 내부 경로입니다.
- **코드에서 설정 읽기**:
  - **서버/Edge Function**: `getTenantSettingByPath(supabase, tenantId, path, legacyPath?)` 형식 사용
    - 예: `await getTenantSettingByPath(supabase, tenantId, "auto_notification.overdue_outstanding_over_limit.enabled")`
    - 시그니처: `(supabase: SupabaseClient, tenantId: string, path: string, legacyPath?: string) => Promise<unknown>`
    - 반환 타입: `unknown` (실제 구현 타입) → 사용 시 타입 캐스팅 필요 (예: `as boolean`, `as number`)
    - 반환 값 의미: Policy가 없으면 `null`, 있으면 직접 값 `T` 반환 (`.value` 접근 불필요)
    - **프론트엔드 Hook `useTenantSettingByPath`**: `UseQueryResult<unknown, Error>` 반환 (React Query의 `useQuery` 반환 객체)
      - 사용 예시: `const { data: enabledValue } = useTenantSettingByPath("auto_notification.overdue.enabled");`
    - **프론트엔드 SSOT 유틸리티** (apps/academy-admin/src/utils):
      - ⚠️ **Policy 조회 SSOT**: `getPolicyValueFromConfig<T>(config, path)` 함수 사용 (SSOT 위치: `apps/academy-admin/src/utils/policy-utils.ts`)
        - 사용 예시: `import { getPolicyValueFromConfig } from '../utils'; const threshold = getPolicyValueFromConfig<number>(config, 'auto_notification.overdue.threshold');`
      - ⚠️ **Policy Registry SSOT**: `POLICY_REGISTRY` 및 `getPolicyValue<T>(key, config)` 함수 사용 (SSOT 위치: `apps/academy-admin/src/utils/policy-registry.ts`)
        - Policy 소스 이원화 문제 해결: 모든 Policy를 Registry에 등록하여 단일 소스로 통일
        - 사용 예시: `import { getPolicyValue, POLICY_REGISTRY } from '../utils'; const threshold = getPolicyValue<number>('PAYMENT_FAILED_THRESHOLD', config);`
        - ⚠️ **EMERGENCY_CARDS_POLICY_PATHS 변경사항**: `apps/academy-admin/src/constants/emergency-cards-policy.ts`의 `EMERGENCY_CARDS_POLICY_PATHS`는 `POLICY_REGISTRY`를 기반으로 재정의되었습니다. 하위 호환성을 위해 export는 유지하되, 신규 코드에서는 `POLICY_REGISTRY`를 직접 사용하는 것을 권장합니다.
      - ⚠️ **Barrel Export 패턴**: 모든 유틸리티는 `apps/academy-admin/src/utils/index.ts`를 통해 export (SSOT)
        - 사용 예시: `import { getPolicyValueFromConfig, getPolicyValue, safe, normalizeDashboardCard } from '../utils';`
      - ⚠️ **Constants Barrel Export 패턴**: 모든 상수는 `apps/academy-admin/src/constants/index.ts`를 통해 export (SSOT)
        - 사용 예시: `import { POLICY_KEY_V2_CATEGORIES, AUTOMATION_EVENT_CRITERIA_FIELDS, AUTOMATION_EVENT_DESCRIPTIONS, validateAutomationEventDescriptions } from '../constants';`
        - Automation Event 관련 상수와 검증 함수는 이 파일을 통해 export
      - `data` 속성: `T | null` (Policy가 없으면 `null`, 있으면 직접 값 `T`, `.value` 접근 불필요)
      - 코드 위치: `packages/hooks/use-config/src/useConfig.ts`
    - 코드 위치: `infra/supabase/functions/_shared/policy-utils.ts`
    - ⚠️ **자동 검증 (구현 상태)**: `getTenantSettingByPath()` 함수는 `auto_notification.<event_type>.*` 형식의 경로를 받을 때 자동으로 event_type을 추출하여 카탈로그에 등록된 값인지 검증합니다 (Fail-Closed, 구현 확인: `infra/supabase/functions/_shared/policy-utils.ts:82`에서 `assertAutomationEventType` 호출).
  - **프론트엔드**: 프론트엔드 래퍼 함수 사용 (구현 필요 시 `packages/hooks/use-config` 또는 유사 패키지에서 제공)
    - ⚠️ 프론트엔드에서는 직접 `getTenantSettingByPath`를 호출하지 않으며, React Hook 또는 API 클라이언트를 통해 접근
  - 내부 동작: 1) tenant_settings에서 tenant_id + key='config' row의 value(JSONB) 획득, 2) value(JSONB)에서 경로 추출

### ✅ 금지 사항
- ❌ `tenant_settings.auto_notification.*` 처럼 **config 없이 top-level 컬럼처럼 보이는 표기 금지**
- ❌ v1/v2 키를 이중 저장 금지 (legacy v1은 alias-only, 저장 경로로 사용 금지)
- ❌ 채널 코드 'kakao' 저장 금지 (SSOT-3: 저장/실행용은 'sms' | 'kakao_at'만 허용)

### 책임 경계 (Responsibility Boundary)

**1) `tenant_settings` KV: key='config' row의 value(JSONB) 내부 경로 `notification.*` (메시지/알림 인프라 기본 정책)**
- ⚠️ 중요: `notification.*` 경로는 `tenant_settings` 테이블의 key='config' row의 value(JSONB) 내부 경로입니다. 저장 위치는 tenant_settings(key='config').value(JSONB)입니다.
- 기본 채널, 발송 제한, fallback, provider 등 "인프라 레벨" 정책
- 자동화별 오버레이가 없을 때 사용되는 기본값

**2) `tenant_settings` KV: key='config' row의 value(JSONB) 내부 경로 `auto_notification.<event_type>.*` (자동화별 정책 오버레이)**
- 자동화 enable/channel/template_key 등 "event_type 단위 정책"
- 각 자동화 시나리오별 세부 설정

**3) `tenant_features['ai'].enabled` (+ PLATFORM_AI_ENABLED)**
- AI 실행/비용이 걸리는 기능의 최종 스위치 (Fail-Closed)
- 프론트는 숨김이 아니라 "표시하되 실행을 막는 방식"이 원칙

---

## ⚠️ Automation & AI Industry-Neutral Rule (SSOT)

본 플랫폼의 자동화 설정 및 AI 기능은 **업종(Academy/Salon/Nail 등)에 종속되지 않는다.**

### 불변 원칙
- 자동화/AI의 실행 구조는 **Core Platform 공통 로직**이다.
- 업종별 차이는 로직이 아니라 **Adapter + Schema 레이어**에서만 허용된다.
- 업종별 신규 자동화 엔진 또는 AI 엔진을 생성하는 행위는 금지된다.

### 허용 구조
```
Core Automation / AI Engine
 └─ Industry Adapter (academy | salon | nail | ...)
```

### 금지 구조
- 업종별 Automation Engine ❌
- 업종별 AI Engine ❌
- 업종별 하드코딩 조건 ❌

본 규칙은 모든 문서와 구현의 정본(SSOT)이다.

### AI Engine Architecture (SSOT)

AI 기능은 다음 2계층으로 구성된다.

1. **Core AI Engine**
- 요약, 패턴 감지, 리포트 생성, 이상 탐지
- 업종 비의존
- 모델 호출 / 프롬프트 / 결과 포맷 공통

2. **Industry Adapter**
- 업종별 데이터 매핑
- 용어 치환
- 가중치 설정
- UI Label 변환

⚠️ AI 판단 및 실행 로직은 Core Engine에만 존재한다.

### Edge Functions Industry Adapter 구현 (SSOT)

Edge Functions에서 업종별 테이블명 및 FK 관계명을 동적으로 매핑하기 위한 Industry Adapter가 구현되어 있습니다.

**구현 위치:**
- `infra/supabase/functions/_shared/industry-adapter.ts`

**주요 기능:**
1. **테이블명 동적 매핑**
   - `getTenantTableName(supabase, tenantId, entityType)`: 테넌트의 industry_type에 따라 엔티티 타입('student', 'class' 등)을 업종별 테이블명으로 변환
   - 예: `academy` → `academy_students`, `salon` → `salon_customers`

2. **FK 관계명 동적 매핑**
   - `getFKRelationName(fkKey, industryType)`: 업종별 FK 관계명을 레지스트리에서 조회
   - 지원 FK 키: `attendance_logs_class_id`, `student_classes_class_id`, `student_classes_student_id`, `class_sessions_class_id`, `invoices_student_id`, `student_person_id`, `class_teacher_id`

3. **업종 타입 조회**
   - `getTenantIndustryType(supabase, tenantId)`: 테넌트의 industry_type 조회

**사용 규칙:**
- ❌ 하드코딩된 테이블명 사용 금지 (예: `'academy_students'`, `'academy_classes'`)
- ✅ Industry Adapter 함수 사용 필수
- ✅ Fail-Closed 원칙: 매핑 실패 시 null 반환, fallback 패턴 사용

**사용 예시:**
```typescript
import { getTenantTableName, getTenantIndustryType, getFKRelationName } from '../_shared/industry-adapter.ts';

// 테이블명 동적 조회
const studentTableName = await getTenantTableName(supabase, tenant_id, 'student');
const classTableName = await getTenantTableName(supabase, tenant_id, 'class');

// FK 관계명 동적 조회
const industryType = await getTenantIndustryType(supabase, tenant_id);
const classFKName = getFKRelationName('attendance_logs_class_id', industryType) ||
  'academy_classes!attendance_logs_class_id_fkey'; // Fallback

// 쿼리 실행
const { data } = await withTenant(
  supabase
    .from(studentTableName || 'academy_students') // Fallback
    .select(`*`),
  tenant_id
);
```

**적용 범위:**
- 모든 Edge Functions에서 업종별 테이블명 사용 시 필수
- L0 핸들러 (`l0-handlers.ts`): 모든 핸들러에서 적용 완료
- Task 실행 핸들러 (`execute-student-task/handlers/*`): 모든 핸들러에서 적용 완료
- 자동화 Edge Functions: 모든 자동화 함수에서 적용 완료

### UI Component Industry-Neutral Rule

AI 관련 UI 컴포넌트(ChatOpsPanel, ExecutionAuditPanel, AILayerMenu)도 업종에 종속되지 않으며, 모든 업종에서 공통으로 사용 가능합니다.

**불변 원칙:**
- AI UI 컴포넌트는 `packages/ui-core/src/components/`에 위치하며, 업종 독립적으로 설계됩니다.
- 업종별 차이는 prop을 통한 확장 포인트(`onViewTaskCard`, `onChatOpsViewTaskCard` 등)로 처리됩니다.
- 업종별 하드코딩된 라우팅 경로나 CSS 클래스는 금지됩니다.

**구현 위치:**
- `ChatOpsPanel`: `packages/ui-core/src/components/ChatOpsPanel.tsx`
- `ExecutionAuditPanel`: `packages/ui-core/src/components/ExecutionAuditPanel.tsx`
- `AILayerMenu`: `packages/ui-core/src/components/AILayerMenu.tsx`

**업종별 확장 방법:**
- 업종별 라우팅은 `AppLayout`에서 `onChatOpsViewTaskCard` prop을 통해 처리합니다.
- 업종별 라벨/용어는 Industry Adapter를 통해 변환됩니다.

### Automation Policy Schema Rule

자동화 설정(Policy)은 업종과 무관한 **중립 스키마**로 정의된다.

- Schema Key는 업종 용어를 포함하지 않는다.
- UI Label만 Industry Adapter에서 변환된다.
- tenant_settings JSON은 업종 공통 구조를 가진다.

예:
- academy: "출결 이상"
- salon: "방문 이상"
→ 내부 정책 키는 동일하다.

## ⚠️ Policy Key v2 (Purpose-Based) — SSOT (정본)

⚠️ 중요: 정본은 Policy Key v2 6개만 사용, legacy_policy_key는 UI 필터/검색용 alias

본 시스템의 자동화는 Policy Key(v2) 6개를 정본(SSOT)으로 사용한다.
- 정책 저장/권한/라우팅/설정 UI 그룹핑은 policy_key_v2만 사용한다.
- 기존 5개 Policy Key는 legacy_policy_key(alias)로만 유지한다. (런타임 SSOT 아님)
- 신규 자동화 추가는 Policy Key를 늘리는 것이 아니라 event_type(시나리오) 카탈로그에 추가로만 수행한다. (카탈로그에 추가 = 코드 상수 `AUTOMATION_EVENT_CATALOG`에 event_type 추가, 구현 위치: `packages/core/core-automation/src/automation-event-catalog.ts`, `infra/supabase/functions/_shared/automation-event-catalog.ts`)
- 설정값이 없거나 enabled=false이면 자동화는 실행되지 않는다(Fail-Closed).

### Policy Key v2 (6)
1) financial_health: 재무/현금흐름/수납/매출 KPI
2) capacity_optimization: 정원/시간표/반 운영 최적화
3) customer_retention: 출결 유지/이탈 예방/리스크 케어
4) growth_marketing: 신규/성장/전환/지역 경쟁(벤치마킹)
5) safety_compliance: 안전/공지/동의/민감정보/분쟁 리스크
6) workforce_ops: 강사/직원 운영(업무량/결근/대체)

### Legacy Policy Key(v1, 기존 5개) — Alias Only
- attendance_anomaly / payment_overdue / ai_suggestion / report_generation / dashboard_priority(미사용)
- legacy_policy_key는 표시/검색/호환을 위한 메타데이터이며, 정책 저장 경로의 SSOT가 아니다.
- 동일 event_type에 대해 v2 정책과 v1 정책을 이중 저장하지 않는다(설정 중복 금지).

### 확장 규칙
- 상위 Policy Key(v2 6개)는 고정(SSOT).
- 신규 자동화는 event_type 카탈로그에 추가하고, policy_key_v2 / legacy_policy_key / level / trigger / executor / policy_path를 정의한다.
- 문서/코드에서 "표에 없는 자동화 신규 추가 불가"는 "카탈로그에 없는 event_type은 실행/추가 불가"로 해석한다.

### 코드 SSOT 위치
- ⚠️ 중요: 정본(SSOT)은 코드 상수 `AUTOMATION_EVENT_CATALOG`, 문서의 표는 그 출력물
- event_type 카탈로그 정본(SSOT)은 코드 상수 `AUTOMATION_EVENT_CATALOG`이며, 문서의 표는 그 카탈로그를 반영한 출력물이다.
  - **구현 상태**: ✅ `AUTOMATION_EVENT_CATALOG` 코드 상수 구현 완료 (2024년 구현, 파일 경로: `packages/core/core-automation/src/automation-event-catalog.ts`, `infra/supabase/functions/_shared/automation-event-catalog.ts`, `infra/supabase/supabase/functions/_shared/automation-event-catalog.ts`)
  - **코드 위치**:
    - `packages/core/core-automation/src/automation-event-catalog.ts` (Node.js/TypeScript 환경, 정본)
    - `infra/supabase/functions/_shared/automation-event-catalog.ts` (Edge Function/Deno 환경)
    - `infra/supabase/supabase/functions/_shared/automation-event-catalog.ts` (re-export 파일, 자동 동기화됨)
    - ⚠️ **수정 시**: 2개 파일(packages + infra/functions/_shared)만 업데이트하면 됩니다. infra/supabase/supabase/functions/_shared/automation-event-catalog.ts는 re-export이므로 자동으로 동기화됩니다.
- legacy_policy_key는 UI 필터/검색/호환 표기용이며, 런타임 저장/실행/권한 분기에는 사용하지 않는다.
- 설정 저장은 `tenant_settings` KV 구조에서 key='config' row의 value(JSONB) 경로 기반이며, 신규 항목은 `auto_notification.<event_type>.<field>` 형식으로 추가한다.
  - **서버/Edge Function 코드 예시**: `await getTenantSettingByPath(supabase, tenantId, "auto_notification.overdue_outstanding_over_limit.enabled")`
  - 내부 동작: 1) tenant_settings에서 key='config' row의 value(JSONB) 획득, 2) value(JSONB)에서 경로 추출

### Industry Expansion Rule (Critical)

신규 업종(Salon, Nail 등) 확장 시 다음을 금지한다:

- 신규 자동화 시스템 구축
- 신규 AI 분석 시스템 구축
- 신규 설정 UI 흐름 구축

허용되는 작업은 다음뿐이다:
- Industry Adapter 추가
- Schema Override 추가
- Label / Copy / 가중치 조정

### ⚠️ RLS 혼재 리스크 (AI/자동화 확장 시 주의)

**현재 상태:**
- `ai_insights` 테이블: `user_tenant_roles` 조인 기반 (레거시 패턴, 마이그레이션 대상)
- `ai_decision_logs` 테이블: JWT claim 기반 (정본 패턴)

**문제점:**
- AI/자동화 확장 시 RLS 패턴 혼재로 인한 성능 저하 및 보안 위험 발생 가능
- `ai_insights`는 조인 기반으로 매 쿼리마다 서브쿼리 실행 → 인덱스 최적화 필요
- PgBouncer Transaction Pooling 환경에서 일관성 문제 발생 가능

**마이그레이션 우선순위 (AI/자동화 관련):**
1. **P1 (상용화 단계 전)**: `ai_insights` (비즈니스 로직 핵심, AI 브리핑/요약 저장)
2. **P2 (상용화 단계)**: 기타 AI/자동화 관련 레거시 테이블

**조치 권장:**
- 신규 AI/자동화 테이블: 반드시 JWT claim 기반만 사용 (`tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`)
- 기존 `ai_insights`: 점진적으로 JWT claim 기반으로 마이그레이션 예정 (상용화 단계)

---

## 📋 목차

1. [AI 자동화 개요](#1-ai-자동화-개요)
2. [자동화 실행 레벨 및 승인 기준](#2-자동화-실행-레벨-및-승인-기준)
3. [AI 자동화 기능 목록](#3-ai-자동화-기능-목록)
4. [자동화 활성화 조건](#4-자동화-활성화-조건)
5. [자동화 안전성 메커니즘](#5-자동화-안전성-메커니즘)
6. [자동화 실행 로그 및 추적](#6-자동화-실행-로그-및-추적)
7. [자동화 결과 가시성](#7-자동화-결과-가시성)

---

## 1. AI 자동화 개요

### 1.1 실행 주체 분리 (불변 규칙)

| 레이어 | 역할 | 금지 사항 |
|--------|------|----------|
| **프론트엔드** | 상황 신호 수집, UI 조정, 승인 요청 | ❌ 실행, ❌ 판단, ❌ 권한 검증 |
| **서버/Edge Function** | 판단, 실행, Role 검증, 로그 기록 | ❌ UI 직접 조작 |
| **AI/Rule Engine** | 분석, 추천 생성, 패턴 감지 | ❌ 직접 실행 |

### 1.2 용어 통일 규칙

| 금지 용어 | 정본 용어 | 설명 |
|----------|----------|------|
| ~~AI Suggestion~~ (v2.x 삭제) | TaskCard (task_type: 'ai_suggested', entity_type='student') | 정본 (StudentTaskCard는 학생용 별칭) |
| 자동 실행 | 서버가 정책에 따라 실행 | 프론트엔드는 실행하지 않음 |
| AI가 처리 | 서버가 AI 추천 생성 | AI는 결정하지 않음 |
| 프론트 자동화 | 프론트 상황 신호 표시 | 프론트엔드는 표시만 |
| 자동 판단 | 정책 해석 결과 | 판단은 서버/Edge Function |
| 기본값 | Default Policy | 코드 상수가 아닌 설정값 |
| 프론트 승인 | 승인 요청 | 프론트엔드는 요청만 보냄 |
| 자동 화면 전환 | 추천 배너 표시 | 사용자 클릭 필요 |
| AI가 실행한다 | 서버가 AI 추천 생성 → Edge Function이 정책 해석 후 실행 | 주어 명확화 |

### 1.3 처리 흐름 (정본)

```
1. Trigger: 상황 신호 또는 이벤트 발생
2. Policy: Edge Function이 사용자 설정값 조회 (tenant_features, tenant_settings)
3. AI/Rule Engine → 추천 생성 (서버, 실행 아님)
4. Edge Function → 정책 해석 → TaskCard 생성 (task_type: 'ai_suggested', entity_type='student')
5. 프론트엔드 → 승인 요청
   - Teacher: `apiClient.invokeFunction('execute-student-task', { action: 'request-approval', task_id: id })` (요청만 기록, 정본)
   - Admin: `apiClient.invokeFunction('execute-student-task', { action: 'approve-and-execute', task_id: id })` (실행 트리거, SSOT, 정본)
   - ⚠️ 명칭 정리 (챗봇.md 11.1.1 참조): `execute-student-task`는 레거시 명칭, 정본은 `execute-task-card` 또는 `execute-automation-action`
6. Edge Function → 정책 재확인 → Role 검증 + 실행 + 로그 기록
```

**⚠️ 중요:**
- 모든 단계에서 Policy 조회 및 해석이 필수
- 설정값이 없거나 enabled=false이면 자동화는 실행되지 않는다(Fail-Closed).
- AI는 결정·실행 주체가 아님

---

## 2. 자동화 실행 레벨 및 승인 기준

### 2.1 정책 기반 실행 레벨 및 승인 기준표 (불변)

**⚠️ Architecture v3.3 정본 규칙: 모든 자동화 액션은 아래 기준표를 따라야 합니다.**

| Action Type | Execution Level | 이유 | 승인 필요 |
|------------|----------------|------|----------|
| 출결 집계 | Auto (L0) | 영향 없음, 내부 기록 | ❌ |
| 상담 요약 | Auto (L0) | 내부 기록, 정보 요약 | ❌ |
| 미납 알림 | Auto + Notice (L1) | 금전 영향 있으나 표준화 | ❌ |
| 학부모 메시지 | Approval (L2) | 관계 리스크, 개인화 필요 | ✅ |
| 분석 리포트 실행 | Approval (L2) | 비용/해석 리스크 | ✅ |
| 청구서 생성 | Auto (L0) | 표준화된 프로세스 | ❌ |
| 출결 이상 감지 | Auto + Task (L1) | TaskCard 생성 | ❌ (감지/카드 생성은 승인 불필요, StudentTaskCard는 학생용 별칭) |
| 출결 이상 후속 실행 | Approval (L2) | 메시지 발송/분석 실행 | ✅ (후속 실행은 승인 필요) |

**⚠️ 중요:**
- 이 기준표 없으면 Zero-Management가 사람마다 다르게 해석됩니다
- 새로운 액션 타입 추가 시 반드시 이 표에 명시해야 합니다
- L0 → L1 → L2 승격은 신뢰 점수 기반으로만 가능 (상용화 단계)

### 2.2 실행 레벨 설명

- **L0 (Auto)**: 정책에 따라 서버가 실행, 승인 불필요 (정책 설정으로 제어)
- **L1 (Auto + Notice/Task)**: 정책에 따라 서버가 실행 + 알림/카드 생성, 승인 불필요 (정책 설정으로 제어)
- **L2 (Approval)**: 승인 필요, 사용자 확인 후 서버가 정책 해석하여 실행 (정책 설정으로 제어)

---

## 3. AI 자동화 기능 목록

**⚠️ 참고: 아래 섹션은 기존 자동화 기능 설명이며, Policy Key v2 카탈로그(Section 11)와는 별개입니다.**

**레거시 경로 규칙:**
- 기존 자동화 기능(상담 요약, 메시지 초안, 자동 청구, Daily Digest 등)은 레거시 경로(`auto_consultation_summary.*`, `auto_message_suggestion.*`, `auto_billing.*`, `auto_digest.*` 등)를 사용합니다. (저장 위치는 tenant_settings(key='config').value(JSONB)입니다)
- 이는 하위 호환성을 위한 것이며, 신규 자동화는 반드시 `auto_notification.<event_type>.<field>` 형식을 사용해야 합니다.
- ⚠️ **레거시 경로 읽기 fallback 허용**: 기존 값이 이미 저장되어 있는 경우에만 읽기 시 fallback을 허용합니다.
- ⚠️ **레거시 경로 쓰기/저장 금지**: 신규 설정 저장은 반드시 `auto_notification.<event_type>.<field>` 형식만 사용하며, 레거시 경로로의 저장은 금지됩니다 (SSOT 원칙).

**⚠️ 레거시 경로 사용 원칙 (정책 일관성):**
- **읽기 전용 허용 범위**: 레거시 경로는 읽기 시에만 제한적으로 fallback 허용
- **사용 기간**: 마이그레이션 완료 시점까지 임시 허용 (일몰 예정)
- **삭제 조건**: 모든 테넌트의 레거시 경로 값이 신규 경로로 마이그레이션 완료되면 레거시 경로 지원 제거
- **우선순위**: 신규 경로(`auto_notification.<event_type>.<field>`) 우선 조회, 없을 때만 레거시 경로 fallback
- **마이그레이션 권장**: 가능한 한 빨리 신규 경로로 마이그레이션하여 레거시 경로 의존성 제거

**⚠️ 레거시 경로 fallback 메커니즘:**
- `getTenantSettingByPath` 함수는 신규 경로(`auto_notification.<event_type>.<field>`) 우선 조회합니다.
- ⚠️ **자동 검증 (구현 상태)**: `getTenantSettingByPath()` 함수는 신규 경로(`path`)가 `auto_notification.<event_type>.*` 형식일 때 자동으로 event_type을 추출하여 `AUTOMATION_EVENT_CATALOG`에 등록된 값인지 검증합니다. 카탈로그에 없는 event_type이면 즉시 에러가 발생합니다 (Fail-Closed, 구현 확인: `infra/supabase/functions/_shared/policy-utils.ts:82`에서 `assertAutomationEventType` 호출).
- ⚠️ **레거시 경로 검증 제외**: 레거시 경로(`legacyPath`)는 검증하지 않습니다. 레거시 경로는 마이그레이션 전까지 사용되는 하위 호환 경로이며, 카탈로그에 없는 event_type(예: `overdue`)을 포함할 수 있습니다.
- **읽기 fallback**: 신규 경로가 없고 레거시 경로가 제공된 경우, 기존 값이 이미 저장되어 있을 때만 제한적으로 fallback합니다.
- **쓰기 금지**: 레거시 경로로의 신규 저장은 금지됩니다. 모든 신규 설정은 `auto_notification.<event_type>.<field>` 형식으로만 저장됩니다.
- fallback 사용 시 로그에 경고 메시지를 기록하여 마이그레이션 필요성을 알립니다.
- **주의**: fallback은 기존 값이 있을 때만 동작하며, 기본값으로 활성화하지 않습니다 (Fail-Closed 원칙 유지).

### 3.1 서버가 상담 AI 요약 생성 (Auto Consultation Summary)

**기능 설명:**
- 상담일지 저장 시 서버가 AI 요약 생성
- 요약 결과를 상담일지에 자동 연결

**실행 레벨:** L0 (Auto) - 승인 불필요

**위치:** `infra/supabase/functions/consultation-ai-summary/index.ts`

**활성화 조건 (Policy 기반):**
1. AI 기능 활성화 Policy 확인 (`effective_ai_enabled = true`)
2. 상담 요약 생성 Policy 확인 (`auto_notification.consultation_summary_ready.enabled` - SSOT 경로)
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_consultation_summary.enabled` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
3. 상담일지 저장 이벤트 발생 (Trigger)
4. 상담 내용 길이 임계값 Policy 확인 (`auto_notification.consultation_summary_ready.min_length` - SSOT 경로, Default Policy: 테넌트 생성 시 50자로 설정값 저장 (없으면 실행 안 함))
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_consultation_summary.min_length` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))

**실행 방식:**
- Database Trigger: `consultation_ai_summary_trigger`
- 큐 테이블: `consultation_summary_jobs`
- Edge Function (Cron/Worker)가 큐를 읽어 처리

**결과:**
- 상담일지에 요약 자동 연결
- `ai_insights` 테이블에 저장 (insight_type: 'consultation_summary')

---

### 3.2 서버가 추천 메시지 생성 (AI 호출 포함) (Auto Message Suggestion)

**기능 설명:**
- 학생 출결 패턴 분석
- 메시지 템플릿 자동 선택
- 서버가 메시지 초안 생성 (AI 호출 포함)
- TaskCard 생성 (task_type: 'ai_suggested', entity_type='student', StudentTaskCard는 학생용 별칭)

**실행 레벨:** L1 (Auto + Task) - 정책에 따라 서버가 카드 생성 (승인 불필요), 메시지 발송은 승인 필요

**위치:** `infra/supabase/supabase/functions/auto-message-suggestion/index.ts`

**스케줄:** 매일 08:00 KST (Supabase Cron Job)

**활성화 조건 (Policy 기반):**
1. AI 기능 활성화 Policy 확인 (`effective_ai_enabled = true`)
2. 메시지 초안 생성 Policy 확인 (`auto_notification.attendance_pattern_anomaly.enabled` - SSOT 경로)
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_message_suggestion.enabled` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
3. 결석 감지 임계값 Policy 확인 (`attendance.absence_threshold_days`, Default Policy: 테넌트 생성 시 3일로 설정값 저장 (없으면 실행 안 함), 저장 위치는 tenant_settings(key='config').value(JSONB))
   - **⚠️ 참고**: 출결 설정은 `attendance.*` 경로를 사용하며, 아키텍처 문서 3.3.7 출결 설정의 공식 스펙을 참조하세요.
4. 결석 임계값 이상 학생 존재 (Trigger)
5. 보호자 정보 존재
6. 자동화 안전성 제한 Policy 확인 (`automation_safety_state`)

**실행 프로세스 (Policy 기반):**
1. 모든 활성 테넌트 조회
2. 각 테넌트별 AI 기능 활성화 Policy 확인
3. 메시지 초안 생성 Policy 확인
4. 결석 감지 임계값 Policy 조회 및 해석
5. 결석 임계값 이상 학생 감지 (Trigger)
6. 보호자 정보 조회
7. 자동화 안전성 Policy 확인
8. 메시지 초안 생성 (AI 추천)
9. TaskCard 생성 (task_type: 'ai_suggested', entity_type='student', Edge Function 실행, StudentTaskCard는 학생용 별칭)

**생성되는 TaskCard:**
```typescript
{
  task_type: 'ai_suggested',
  source: 'attendance',
  title: `${studentName} 결석 연락`,
  description: '결석 3일 이상으로 학부모 연락을 추천합니다.',
  suggested_action: {
    type: 'send_message',
    payload: {
      recipient_ids: [guardianId],
      message: messageDraft,
      template_id: 'attendance_followup',
    },
  },
  // ⚠️ 중요: priority와 expires_at은 Policy에서 조회한 값만 사용 (하드코딩 금지)
  // priority: Policy에서 조회 (Default Policy: 테넌트 생성 시 설정값으로 저장)
  // expires_at: Policy에서 조회한 TTL 값 사용 (Default Policy: 테넌트 생성 시 설정값으로 저장)
  priority: resolvedPriority, // Policy에서 조회한 값 (변수명 예시)
  status: 'pending',
  expires_at: resolvedExpiresAt, // Policy에서 조회한 TTL 값 (변수명 예시)
  dedup_key: `${tenantId}:ai_suggested:student:${studentId}:${today}`,
}
```

**프론트엔드 표시:**
- `/notifications` 페이지의 "메시지 발송" 탭
- 상단에 AI 초안 제안 배너로 표시
- 최대 3개까지 표시
- 사용자가 "적용" 버튼 클릭 시 메시지 폼에 초안 적용

---

### 3.3 출결 이상 감지 (Attendance Anomaly Detection)

**기능 설명:**
- 학생 출결 패턴 분석
- 이상 패턴 감지
- TaskCard 생성 (task_type: 'absence', 'risk' 등, entity_type='student', StudentTaskCard는 학생용 별칭)

**실행 레벨:** L1 (Auto + Task) - 정책에 따라 서버가 감지/카드 생성 (승인 불필요)

**위치:** `infra/supabase/functions/student-task-card-generation/index.ts`

**스케줄:** 매일 06:00 KST (Supabase Cron Job)

**활성화 조건 (Policy 기반):**
1. 출결 이상 감지 Policy 확인 (`auto_notification.attendance_pattern_anomaly.enabled` - SSOT 경로)
   - **⚠️ 참고**: 출결 이상 감지 설정은 `auto_notification.attendance_pattern_anomaly.*` 경로를 사용합니다.
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `attendance.anomaly_detection.enabled` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
2. 출결 로그 데이터 존재 (Trigger)
3. 이상 패턴 감지 임계값 Policy 확인 (`auto_notification.attendance_pattern_anomaly.threshold` - SSOT 경로, Default Policy: 테넌트 생성 시 3일 연속 결석으로 설정값 저장 (없으면 실행 안 함))
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `attendance.anomaly_detection.threshold` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))

**생성되는 TaskCard:**
- task_type: 'absence' (결석 관련)
- task_type: 'risk' (위험 감지)
- task_type: 'ai_suggested' (AI 추천)

---

### 3.4 자동 청구 생성 (Auto Billing Generation)

**기능 설명:**
- 서버가 월별 청구서 생성
- 표준화된 프로세스

**실행 레벨:** L0 (Auto) - 승인 불필요

**위치:** `infra/supabase/functions/auto-billing-generation/index.ts`

**스케줄:** 매일 04:00 KST (Supabase Cron Job)

**활성화 조건 (Policy 기반):**
1. 청구 생성 Policy 확인 (`billing.auto_generation.enabled` - SSOT 경로, 저장 위치는 tenant_settings(key='config').value(JSONB))
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_billing.enabled` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
2. 청구 주기 Policy 확인 (`billing.auto_generation.cycle` - SSOT 경로, Default Policy: 테넌트 생성 시 월 1회로 설정값 저장 (없으면 실행 안 함), 저장 위치는 tenant_settings(key='config').value(JSONB))
   - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_billing.cycle` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
3. 청구 주기 도래 (Trigger)
4. 청구 대상 학생 존재

---

### 3.5 미납 알림 자동 발송 (Auto Overdue Notification)

**기능 설명:**
- 미납 청구서 감지
- 학부모에게 자동 알림 발송

**실행 레벨:** L1 (Auto + Notice) - 정책에 따라 서버가 실행, 승인 불필요

**위치:** `infra/supabase/functions/overdue-notification-scheduler/index.ts`

**스케줄:** 매일 09:00 KST (Supabase Cron Job)

**활성화 조건 (Policy 기반):**
1. 미납 알림 자동 발송 Policy 확인 (`auto_notification.overdue_outstanding_over_limit.enabled`)
   - **신규 경로 우선**: `auto_notification.overdue_outstanding_over_limit.enabled` 경로를 우선 조회합니다.
   - **레거시 fallback**: 신규 경로가 없으면 `auto_notification.overdue.enabled` 경로로 제한적 fallback합니다.
   - **레거시 fallback 정책**: 이행 기간 한정 read-only fallback, 일몰 예정. 신규 자동화는 반드시 `auto_notification.<event_type>.<field>` 형식을 사용합니다.
2. 미납 청구서 존재 (Trigger)
3. 보호자 정보 존재
4. 자동 알림 채널 Policy 확인 (`auto_notification.overdue_outstanding_over_limit.channel`, Default Policy: 'sms')
   - **신규 경로 우선**: `auto_notification.overdue_outstanding_over_limit.channel` 경로를 우선 조회합니다.
   - **레거시 fallback**: 신규 경로가 없으면 `auto_notification.overdue.channel` 경로로 제한적 fallback합니다.
   - **SSOT-3**: 저장/실행용 channel 코드는 'sms' | 'kakao_at'이며, 'kakao' 저장은 금지됨

---

### 3.6 Daily Automation Digest (일일 자동화 요약)

**기능 설명:**
- 하루 동안 실행된 자동화 결과 요약
- 사용자 인지 목적 (읽기 전용)

**실행 레벨:** L0 (Auto) - 정책에 따라 서버가 정보 생성, 정보 제공만

**위치:** `infra/supabase/supabase/functions/daily-automation-digest/index.ts`

**스케줄:** 매일 23:00 KST (Supabase Cron Job)

**활성화 조건 (Policy 기반):**
- Daily Automation Digest Policy 확인 (`auto_notification.daily_automation_digest.enabled` - SSOT 경로, Default Policy: 테넌트 생성 시 설정값으로 저장)
  - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_digest.enabled` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
- 자동화 결과가 있는 경우 (Trigger)

**생성 내용:**
```typescript
{
  insight_type: 'daily_automation_digest',
  title: `${date} 자동 처리 요약`,
  summary: {
    consultation_summaries: number, // 상담 요약 생성 건수
    overdue_notifications: number,    // 미납 알림 발송 건수
    risk_detections: number,          // 출결 이상 학생 감지 건수
    auto_billing: number,             // 자동 청구 생성 건수
    message_drafts: number,           // 메시지 초안 생성 건수
  },
}
```

**프론트엔드 표시:**
- HomePage에서 AI_BRIEFING 카드로 표시
- 버튼 없음, 실행 없음, 정보만 표시

---

## 4. 자동화 활성화 조건

### 4.1 AI 기능 활성화 체크 (SSOT)

**플랫폼 레벨:**
- 환경 변수: `PLATFORM_AI_ENABLED` (구현 확인: `packages/env-registry/src/server.ts:71`, `infra/supabase/functions/_shared/env-registry.ts:80`에서 사용)
- 위치: `.env` (로컬), Vercel Environment Variables (배포), Supabase Secrets (Edge Functions)
- Default Policy: 시스템 초기화 시 설정값으로 저장 (코드 상수 아님)

**테넌트 레벨 (SSOT):**
- 테이블: `tenant_features`
- 필드: `feature_key='ai'`, `enabled`
- Default Policy: 테넌트 생성 시 `enabled=true`로 설정값 저장 (코드 상수 아님)

**최종 유효값 (Policy 해석):**
```typescript
// Edge Function에서 Policy 조회 및 해석
const platformPolicy = getPlatformAIEnabled(); // env-registry/server에서만 읽음
const tenantPolicy = await getTenantFeature(tenantId, 'ai'); // tenant_features 테이블 조회
const effective_ai_enabled = platformPolicy && tenantPolicy?.enabled;

// 설정이 없으면 실행하지 않음 (Fail Closed)
if (!effective_ai_enabled) {
  // 실행 중지 및 로그 기록
  return;
}
```

**체크 위치:**
- 모든 Edge Function에서 AI 호출 직전 반드시 체크
- `effective_ai_enabled = false`이면:
  - 모델 호출 금지 (0 tokens)
  - `ai_insights` 신규 insert/update 금지
  - TaskCard 신규 생성 중 `task_type='ai_suggested'` 금지 (StudentTaskCard는 학생용 별칭)
  - `ai_decision_logs`에 `skipped_by_flag=true` 기록

### 4.2 자동화 안전성 체크

**테이블:** `automation_safety_state`

**체크 항목:**
1. `state === 'paused'` → 실행 중지
2. `executed_count >= max_allowed` → 실행 중지 및 상태를 `paused`로 변경
3. 시간 윈도우 체크 (오늘 00:00 KST ~ 23:59 KST)

**Default Policy 제한값 (설정값으로 저장):**
- 하루 학부모 메시지 자동 발송: `auto_notification.attendance_pattern_anomaly.throttle.daily_limit` (SSOT 경로, Default Policy: 테넌트 생성 시 20건으로 설정값 저장 (없으면 실행 안 함))
  - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_message_suggestion.daily_limit` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
- 동일 학생 관련 Task 연속 생성: `auto_notification.attendance_pattern_anomaly.throttle.student_limit` (SSOT 경로, Default Policy: 테넌트 생성 시 5회로 설정값 저장 (없으면 실행 안 함))
  - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_task_generation.student_limit` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))
- 일일 청구서 생성: `billing.auto_generation.throttle.daily_limit` (SSOT 경로, Default Policy: 테넌트 생성 시 1건으로 설정값 저장 (없으면 실행 안 함), 월 1회 배치, 저장 위치는 tenant_settings(key='config').value(JSONB))
  - **레거시 fallback**: 신규 경로가 없고 기존 값이 있을 때만 `auto_billing.daily_limit` 경로로 제한적 fallback (읽기만 허용, 쓰기 금지, 저장 위치는 tenant_settings(key='config').value(JSONB))

**⚠️ 중요:**
- 모든 제한값은 Policy로 관리되며, 코드에 하드코딩되지 않음
- 테넌트 생성 시 Default Policy가 설정값으로 저장됨

### 4.3 데이터 조건

각 자동화 기능별 필수 데이터 조건:

| 기능 | 필수 데이터 조건 |
|------|----------------|
| 서버가 상담 AI 요약 생성 | 상담일지 내용 50자 이상 |
| 서버가 추천 메시지 생성 (AI 호출 포함) | 결석 3일 이상 학생 + 보호자 정보 |
| 출결 이상 감지 | 출결 로그 데이터 |
| 자동 청구 생성 | 청구 주기 도래 + 청구 대상 학생 |
| 미납 알림 자동 발송 | 미납 청구서 + 보호자 정보 + 자동 알림 설정 |

---

## 5. 자동화 안전성 메커니즘

### 5.1 자동 실행 자기 억제 메커니즘 (Self-Regulation)

**목적:**
- 자동화 과도 실행 방지
- 테넌트별 자동화 안전성 보장
- 운영 안정성 필수 장치

**테이블 스키마:**
```sql
CREATE TABLE IF NOT EXISTS automation_safety_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'send_message', 'create_task', 'generate_billing' 등
  window_start timestamptz NOT NULL, -- 시간 윈도우 시작 (예: 오늘 00:00 KST)
  window_end timestamptz NOT NULL, -- 시간 윈도우 종료 (예: 오늘 23:59 KST)
  executed_count integer DEFAULT 0, -- 현재 윈도우에서 실행된 횟수
  max_allowed integer NOT NULL, -- 최대 허용 횟수
  state text NOT NULL DEFAULT 'normal', -- 'normal' | 'throttled' | 'paused'
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT automation_safety_state_state_check CHECK (state IN ('normal', 'throttled', 'paused'))
);
```

**동작 방식:**
1. Edge Function 실행 전 `automation_safety_state` 체크
2. `state === 'paused'` → 실행 중지
3. `executed_count >= max_allowed` → 실행 중지 및 상태를 `paused`로 변경
4. 실행 가능한 경우 → `executed_count` 증가

**⚠️ 중요:**
- 이 메커니즘 없으면 Zero-Management가 "폭주 자동화"로 오해받을 수 있습니다
- 모든 Edge Function은 자동 실행 전 반드시 이 체크를 수행해야 합니다

### 5.2 멱등성/중복 방지

**Dedup Key 포맷:**
```
{tenantId}:{trigger}:{entityType}:{entityId}:{window}
```

**예시:**
- `{tenantId}:ai_suggested:student:{studentId}:2024-01-15`
- `{tenantId}:absence:student:{studentId}:2024-01-15`

**UPSERT 사용:**
- 모든 TaskCard 생성 시 `UPSERT` 사용 (StudentTaskCard는 학생용 별칭)
- `onConflict: 'tenant_id,dedup_key'`
- `ignoreDuplicates: false` (기존 카드가 있으면 업데이트)

---

## 6. 자동화 실행 로그 및 추적

⚠️ 참고: 실행 결과 기록은 Execution Audit 시스템(액티비티.md) 참조

### 6.1 자동화 실행 로그

**테이블:** `automation_actions`

**스키마:**
```sql
CREATE TABLE IF NOT EXISTS automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES task_cards(id),
  action_type text NOT NULL,
  executed_by uuid,
  executed_at timestamptz DEFAULT now(),
  result jsonb,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 감사/추적 필수 필드
  trace_id text,              -- 요청 추적 ID (분산 추적용)
  request_id text,            -- 요청 ID (멱등성/재시도 추적용, 챗봇.md 6.3.1 참조)
  -- ⚠️ request_id 형식 규칙 (챗봇.md 6.3.1): {task_id}:{action}:{attempt_window}
  --   - attempt_window: 5분 버킷 (floor(now_utc / 5min))
  --   - automation_actions 테이블에서 request_id 유니크 제약으로 멱등 강제
  --   - 동일 request_id가 이미 존재하면 기존 automation_actions 레코드를 조회하여 동일한 결과를 반환 (idempotent replay)
  --   - request_id는 서버/Edge에서만 생성 (클라이언트 입력값 사용 금지)
  policy_version text,        -- RLS 정책 버전 (보안 감사용)
  rule_id text,               -- 실행된 규칙 ID (비즈니스 로직 추적용)
  dedup_key text,             -- 중복 방지 키 (멱등성 검증용)
  approved_by uuid,           -- 승인자 ID (Teacher의 request-approval인 경우)
  approved_at timestamptz,    -- 승인 시각
  executor_role text,         -- 실행자 역할 (admin/instructor/teacher 등, 감사용)  -- instructor는 정본 키, teacher는 backward compatibility
  execution_context jsonb     -- 실행 컨텍스트 (추가 메타데이터)
);
```

**⚠️ 중요:**
- 이 로그 없으면 Zero-Management 아키텍처 위반
- 감사/추적 필수 필드 표준화 (사건 재현 및 분쟁 대응용)

**⚠️ 참고: automation_actions와 execution_audit_runs의 관계**
- automation_actions: 워크플로우 이벤트 기록(승인요청/실행 이벤트, 챗봇.md 6.3.2 참조)
- execution_audit_runs: 실행 결과 기록(실제 실행 결과, 액티비티.md 참조)
- automation_actions 기록 후 execution_audit_runs도 생성되어야 함(챗봇.md 642줄: "Execution Audit 시스템에 실행 결과 기록" 참조)
- automation_actions.request_id와 execution_audit_runs.reference.request_id는 동일한 형식을 사용(챗봇.md 6.3.1 참조)

### 6.2 AI 판단 로그

**테이블:** `ai_decision_logs`

**스키마:**
```sql
CREATE TABLE IF NOT EXISTS ai_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model text NOT NULL,
  features jsonb,
  score numeric,
  reason text,
  created_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  skipped_by_flag boolean DEFAULT false -- AI 기능이 꺼져 있어 스킵된 경우
);
```

### 6.3 자동화 Undo 로그

**테이블:** `automation_undo_logs`

**목적:**
- 감사/롤백용
- 자동화 실행 취소 추적

**스키마:**
```sql
CREATE TABLE IF NOT EXISTS automation_undo_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES automation_actions(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reason text NOT NULL,
  before_state jsonb NOT NULL,  -- 변경 전 전체 상태 (snapshot)
  after_state jsonb NOT NULL,   -- 변경 후 전체 상태 (snapshot)
  reversible boolean NOT NULL DEFAULT true,  -- Undo 가능 여부 플래그
  original_action_type text NOT NULL,
  original_entity_type text NOT NULL,
  original_entity_id uuid NOT NULL,
  undo_status text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 6.4 TTL/아카이브 정책

**보관 기간:** 90일 (executed_at/created_at 기준)

**아카이브:** 90일 경과 후 자동 아카이브 테이블로 이동 또는 삭제

**인덱스:** (tenant_id, executed_at DESC, action_type, status) 복합 인덱스 필수

---

## 7. 자동화 결과 가시성

### 7.1 Daily Automation Digest

**목적:**
- 자동화 실행 결과의 사용자 인지
- Zero-Management의 투명성 보장
- AI_BRIEFING의 확장 (새 개념 아님)

**생성 시점:** 매일 23:00 KST

**저장 위치:** `ai_insights` 테이블 (insight_type: 'daily_automation_digest')

**프론트엔드 표시:**
- HomePage에서 AI_BRIEFING 카드로 표시
- 버튼 없음, 실행 없음, 정보만 표시

**내용:**
- 상담 요약 생성 건수
- 미납 알림 발송 건수
- 출결 이상 학생 감지 건수
- 자동 청구 생성 건수
- 메시지 초안 생성 건수

### 7.2 TaskCard 표시 (StudentTaskCard는 학생용 별칭)

**프론트엔드 표시 위치:**
- HomePage: TaskCard 그룹 (StudentTaskCard는 학생용 별칭)
- `/notifications` 페이지: AI 초안 제안 배너 (task_type: 'ai_suggested', suggested_action.type: 'send_message')

**자동 갱신:**
- `useStudentTaskCards` 훅이 1분마다 자동 갱신 (`refetchInterval: 60000`, StudentTaskCard는 학생용 별칭)
- 만료된 카드는 자동 필터링 (클라이언트 측)

---

## 8. 스케줄 요약

| 기능 | Edge Function | 스케줄 (KST) | 실행 레벨 |
|------|--------------|-------------|----------|
| 자동 청구 생성 | auto-billing-generation | 매일 04:00 | L0 (Auto) |
| 출결 이상 감지 | student-task-card-generation | 매일 06:00 | L1 (Auto + Task) |
| AI 브리핑 생성 | ai-briefing-generation | 매일 07:00 | L0 (Auto) |
| 서버가 추천 메시지 생성 (AI 호출 포함) | auto-message-suggestion | 매일 08:00 | L1 (Auto + Task) |
| 미납 알림 자동 발송 | overdue-notification-scheduler | 매일 09:00 | L1 (Auto + Notice) |
| Daily Automation Digest | daily-automation-digest | 매일 23:00 | L0 (Auto) |

---

## 9. 자동화 항목별 Policy 설정 표 (공통)

**⚠️ 모든 문서에 동일하게 삽입 (형태·내용 변경 금지)**

| 자동화 항목 | 사용자 설정 가능 | 하드코딩 금지 |
|------------|----------------|--------------|
| 출결 이상 감지 | 감지 기준, 카드 생성 여부 | 기준값 |
| 미납 알림 | 자동 발송 ON/OFF, 시점 | 발송 조건 |
| AI 업무 카드(TaskCard, task_type: 'ai_suggested', entity_type='student') | AI ON/OFF, 승인 필요 여부 | 서버가 정책에 따라 실행 | (StudentTaskCard는 학생용 별칭)
| 대시보드 우선순위 | 가중치 조정 | 그룹 순서 |
| 리포트 생성 | 자동 생성 여부 | 생성 주기 |

※ 상위 Policy Key는 SSOT(v2 6개)로 고정된다. 신규 자동화는 event_type 카탈로그에 추가 후 가능하며, 카탈로그에 없는 event_type은 실행/추가할 수 없다. (카탈로그에 추가 = 코드 상수 `AUTOMATION_EVENT_CATALOG`에 event_type 추가, 구현 위치: `packages/core/core-automation/src/automation-event-catalog.ts`, `infra/supabase/functions/_shared/automation-event-catalog.ts`)

---

## 10. 중요 규칙 요약

### 10.1 실행 주체 분리
- 프론트엔드는 실행하지 않음
- 모든 자동화 실행은 서버 사이드(Edge Function/DB Trigger/Scheduler)에서만 수행되며, Policy 해석 후 실행
- 프론트엔드는 승인 요청만

### 10.2 Policy 기반 실행
- 모든 자동화는 Policy 조회 및 해석 필수
- `tenant_features`, `tenant_settings`가 자동화 설정의 유일한 SSOT
- 설정값이 없거나 enabled=false이면 자동화는 실행되지 않는다(Fail-Closed).
- Default Policy는 테넌트 생성 시 설정값으로 저장

### 10.3 AI 기능 활성화
- 플랫폼 레벨 + 테넌트 레벨 모두 활성화되어야 함
- Edge Function에서 Policy 조회 및 해석: `effective_ai_enabled = PLATFORM_AI_ENABLED && tenant_features['ai'].enabled`
- Policy가 없으면 실행하지 않음

### 10.4 자동화 안전성
- 모든 Edge Function은 실행 전 Policy 조회 및 `automation_safety_state` 체크 필수
- 하루 최대 실행 횟수는 Policy로 관리 (`tenant_settings` 테이블)
- 제한 초과 시 자동 일시정지 (Policy 해석 결과)

### 10.5 멱등성/중복 방지
- Dedup Key 사용 필수
- UPSERT 사용 필수
- Race Condition 방지

### 10.6 로그 및 추적
- 모든 자동화 실행은 `automation_actions` 테이블에 기록
- 감사/추적 필수 필드 포함
- 90일 보관 후 아카이브

---

## 11. ✅ SSOT Catalog v2 — event_type 39 (정본)

**⚠️ 중요: 이 카탈로그는 코드 상수 `AUTOMATION_EVENT_CATALOG`를 정본(SSOT)으로 하며, 문서 표는 그 출력물이다.**
**카탈로그와 문서 간 동기화가 필요하며, 코드 카탈로그가 우선한다.**

**⚠️ 구현 상태:**
- ✅ `AUTOMATION_EVENT_CATALOG` 코드 상수 구현 완료 (2024년 구현, 파일 경로: `packages/core/core-automation/src/automation-event-catalog.ts`, `infra/supabase/functions/_shared/automation-event-catalog.ts`, `infra/supabase/supabase/functions/_shared/automation-event-catalog.ts`)
- **코드 위치**:
  - `packages/core/core-automation/src/automation-event-catalog.ts` (Node.js/TypeScript 환경, 정본)
  - `infra/supabase/functions/_shared/automation-event-catalog.ts` (Edge Function/Deno 환경)
  - `infra/supabase/supabase/functions/_shared/automation-event-catalog.ts` (re-export 파일, 자동 동기화됨)
  - ⚠️ **수정 시**: 2개 파일(packages + infra/functions/_shared)만 업데이트하면 됩니다. infra/supabase/supabase/functions/_shared/automation-event-catalog.ts는 re-export이므로 자동으로 동기화됩니다.
- **사용 방법**:
  - Edge Function에서 `auto_notification.<event_type>.*` 경로 사용 시 `getTenantSettingByPath()` 함수가 자동으로 event_type을 검증합니다.
  - 추가 안전장치로 명시적으로 `assertAutomationEventType(eventType)` 호출도 가능합니다 (중복 검증, 권장).
  - **성능 최적화**: `isAutomationEventType()` 함수는 Set 자료구조를 사용하여 O(1) 시간 복잡도로 검증합니다. 배열의 `includes()`는 O(n)이지만 Set의 `has()`는 O(1)입니다.
  - **검증 함수**: `apps/academy-admin/src/constants/automation-event-descriptions.ts`의 `validateAutomationEventDescriptions()` 함수는 `AUTOMATION_EVENT_CRITERIA_FIELDS`와 `AUTOMATION_EVENT_DESCRIPTIONS`가 `AUTOMATION_EVENT_CATALOG`와 일치하는지 검증합니다 (개발 환경에서만 사용 권장)
- 문서의 카탈로그 표는 코드 카탈로그의 출력물이며, 코드 카탈로그가 SSOT입니다.
- 일부 Edge Function은 신규 경로 우선, 레거시 경로 fallback 메커니즘을 사용하여 하위 호환성을 보장합니다.
- **레거시 fallback 정책**: 이행 기간 한정 read-only fallback, 일몰 예정. 신규 자동화는 반드시 `auto_notification.<event_type>.<field>` 형식을 사용합니다.

**※ 본 문서의 표는 코드 카탈로그(SSOT)의 렌더/요약 결과이며, 최종 정본은 코드 카탈로그 상수/파일이다.**

컬럼: event_type | policy_key_v2 | legacy_policy_key | audience | level | trigger(권장) | executor(권장) | policy_path(권장) | status

**⚠️ policy_path 규격:**
- **저장소**: `tenant_settings` KV 구조 (key='config' row의 value JSONB)
- **정본 경로 형식**: `auto_notification.<event_type>.<field>`
- **서버/Edge Function 코드 예시**: `await getTenantSettingByPath(supabase, tenantId, "auto_notification.overdue_outstanding_over_limit.enabled")`
- `legacy_policy_key`(ai_suggestion/report_generation 등)는 분류/하위호환 alias로만 사용되며, 저장/조회 경로로 사용하지 않는다.
- 모든 event_type은 동일한 경로 규격(`auto_notification.*`)을 사용한다.

### 1) financial_health (10)
- payment_due_reminder | financial_health | payment_overdue | guardian | L0 | 매일(설정 가능: days_before_first, days_before_second) | 배치 EF+dispatch | auto_notification.payment_due_reminder.* | active
- invoice_partial_balance | financial_health | payment_overdue | guardian | L0 | 부분결제 감지 | 트리거/배치+dispatch | auto_notification.invoice_partial_balance.* | active
- recurring_payment_failed | financial_health | payment_overdue | guardian | L0 | webhook 실패 | webhook+dispatch | auto_notification.recurring_payment_failed.* | active
  - **Policy 필드:**
    - `auto_notification.recurring_payment_failed.threshold`: 결제 실패 임계값 (건수, Default: 2)
    - `auto_notification.recurring_payment_failed.lookback_days`: 조회 기간 (일수, 최근 N일간의 실패만 조회)
  - **Fail Closed:** Policy가 없으면 Emergency Card 생성하지 않음
- revenue_target_under | financial_health | payment_overdue | owner_admin | L1 | 매일 07:10 | daily-statistics-update 확장 | auto_notification.revenue_target_under.* | active
- collection_rate_drop | financial_health | payment_overdue | owner_admin | L1 | 매일 07:20 | 배치 EF | auto_notification.collection_rate_drop.* | active
- overdue_outstanding_over_limit | financial_health | payment_overdue | owner_admin | L1 | 매일 09:00 | overdue-scheduler 확장 | auto_notification.overdue_outstanding_over_limit.* | active
  - **신규 경로 우선**: `auto_notification.overdue_outstanding_over_limit.*` 경로를 우선 조회합니다.
  - **레거시 fallback**: 신규 경로가 없으면 `auto_notification.overdue.*` 경로로 제한적 fallback합니다.
  - **상용화 단계**: 레거시 경로 fallback은 계속 지원되며, 신규 자동화는 `auto_notification.<event_type>.<field>` 형식을 사용합니다.
- revenue_required_per_day | financial_health | report_generation | owner_admin | L1 | 매일 07:30 | 배치 EF/브리핑 | auto_notification.revenue_required_per_day.* | active
- top_overdue_customers_digest | financial_health | payment_overdue | owner_admin | L1 | 매일 09:05 | overdue-scheduler 확장 | auto_notification.top_overdue_customers_digest.* | active
- refund_spike | financial_health | payment_overdue | owner_admin | L1 | 매일 07:40 | 배치 EF | auto_notification.refund_spike.* | active
- monthly_business_report | financial_health | report_generation | owner_admin | L1 | 매월 1일 09:00 | 서버/EF 생성 | auto_notification.monthly_business_report.* | active

### 2) capacity_optimization (6)
- class_fill_rate_low_persistent | capacity_optimization | attendance_anomaly | owner_admin | L1 | 매주 월 08:10 | 배치 EF | auto_notification.class_fill_rate_low_persistent.* | active
- ai_suggest_class_merge | capacity_optimization | ai_suggestion | owner_admin | L1 | 저정원 감지 연계 | ai-briefing-generation 확장 | auto_notification.ai_suggest_class_merge.* | active
- time_slot_fill_rate_low | capacity_optimization | attendance_anomaly | owner_admin | L1 | 매주 월 08:20 | 배치 EF | auto_notification.time_slot_fill_rate_low.* | active
- high_fill_rate_expand_candidate | capacity_optimization | attendance_anomaly | owner_admin | L1 | 매주 월 08:15 | 배치 EF | auto_notification.high_fill_rate_expand_candidate.* | active
- unused_class_persistent | capacity_optimization | attendance_anomaly | owner_admin | L1 | 매주 월 08:50 | 배치 EF | auto_notification.unused_class_persistent.* | active
- weekly_ops_summary | capacity_optimization | report_generation | owner_admin | L1 | 매주 월 08:00~09:00 | 배치 EF/브리핑 | auto_notification.weekly_ops_summary.* | active

### 3) customer_retention (8)
- class_reminder_today | customer_retention | attendance_anomaly | guardian | L0 | 시작 전 | 배치 EF+dispatch | auto_notification.class_reminder_today.* | active
- class_schedule_tomorrow | customer_retention | attendance_anomaly | guardian | L0 | 매일(설정 가능: notification_time, 기본값 20:00) | 배치 EF+dispatch | auto_notification.class_schedule_tomorrow.* | active
- consultation_reminder | customer_retention | ai_suggestion | guardian | L0 | 설정 가능( hours_before_first, hours_before_second, 기본값 24h/2h) | 배치 EF+dispatch | auto_notification.consultation_reminder.* | active
- absence_first_day | customer_retention | attendance_anomaly | guardian | L0 | 결석 insert | 트리거+dispatch | auto_notification.absence_first_day.* | active
- churn_increase | customer_retention | ai_suggestion | owner_admin | L1 | 매주 월 09:20 | 배치 EF | auto_notification.churn_increase.* | active
- ai_suggest_churn_focus | customer_retention | ai_suggestion | owner_admin | L1 | 매일 06:10 | ai-briefing-generation 확장 | auto_notification.ai_suggest_churn_focus.* | active
- attendance_rate_drop_weekly | customer_retention | attendance_anomaly | owner_admin | L1 | 매주 월 09:00 | 배치 EF/브리핑 | auto_notification.attendance_rate_drop_weekly.* | active
- risk_students_weekly_kpi | customer_retention | ai_suggestion | owner_admin | L1 | 매주 월 08:05 | 브리핑/TaskCard | auto_notification.risk_students_weekly_kpi.* | active

### 4) growth_marketing (6)
- new_member_drop | growth_marketing | ai_suggestion | owner_admin | L1 | 매주 월 09:10 | 배치 EF | auto_notification.new_member_drop.* | active
- inquiry_conversion_drop | growth_marketing | ai_suggestion | owner_admin | L1 | 매주 월 09:30 | 배치 EF | auto_notification.inquiry_conversion_drop.* | active
- birthday_greeting | growth_marketing | ai_suggestion | guardian | L0/L2 | 매일 | 배치 EF+dispatch | auto_notification.birthday_greeting.* | planned
- enrollment_anniversary | growth_marketing | ai_suggestion | guardian | L0/L2 | 매일 | 배치 EF+dispatch | auto_notification.enrollment_anniversary.* | planned
- regional_underperformance | growth_marketing | report_generation | owner_admin | L1 | 매주 월 09:10 | 배치 EF | auto_notification.regional_underperformance.* | active
- regional_rank_drop | growth_marketing | report_generation | owner_admin | L1 | 매월 1일 09:10 | 배치 EF | auto_notification.regional_rank_drop.* | active

### 5) safety_compliance (7)
- class_change_or_cancel | safety_compliance | attendance_anomaly | guardian | L0 | 변경/취소 이벤트 | DB trigger+dispatch | auto_notification.class_change_or_cancel.* | active
- checkin_reminder | safety_compliance | attendance_anomaly | guardian | L0 | 시작 전 | 배치 EF+dispatch | auto_notification.checkin_reminder.* | active
- checkout_missing_alert | safety_compliance | attendance_anomaly | guardian | L0 | 종료+grace | 배치 EF+dispatch | auto_notification.checkout_missing_alert.* | active
- announcement_urgent | safety_compliance | report_generation | guardian | L2 | urgent insert | DB trigger+dispatch | auto_notification.announcement_urgent.* | planned
- announcement_digest | safety_compliance | report_generation | guardian | L0/L2 | 주간/월간 | 배치 EF+dispatch | auto_notification.announcement_digest.* | planned
- consultation_summary_ready | safety_compliance | ai_suggestion | guardian | L2 | 요약 완료 | consultation-ai-summary 확장+dispatch | auto_notification.consultation_summary_ready.* | active
- attendance_pattern_anomaly | safety_compliance | attendance_anomaly | guardian | L1/L2 | 패턴 이상 감지 | task-card/AI + 승인 후 dispatch | auto_notification.attendance_pattern_anomaly.* | active

### 6) workforce_ops (2)
- teacher_workload_imbalance | workforce_ops | attendance_anomaly | owner_admin | L1 | 매주 월 08:40 | 배치 EF | auto_notification.teacher_workload_imbalance.* | active
- staff_absence_schedule_risk | workforce_ops | attendance_anomaly | owner_admin | L1 | 매일 18:00(상용화 단계) | 배치 EF | auto_notification.staff_absence_schedule_risk.* | planned (부분 구현, 주석 처리됨)

**⚠️ 주의:**
- status='planned' 항목은 UI에서 기본적으로 숨김 처리되며, "준비중 포함" 토글로 표시 가능 (단, AI 관련 페이지/메뉴는 "숨김 금지" 원칙에 따라 항상 표시됨)
- 모든 event_type은 enabled 필드를 필수로 포함
- guardian 대상 알림은 channel 필드 포함 (가능한 한)
- L2 이벤트는 require_approval 필드 포함 (기본값: true)
- 설정값이 없거나 enabled=false이면 자동화는 실행되지 않는다(Fail-Closed).
- **사용자 설정 가능 필드**: 각 자동화의 기준값(임계값, 알림 시간, 일수 등)은 UI에서 사용자가 직접 설정할 수 있으며, Policy 경로를 통해 저장됩니다.
  - 예: `payment_due_reminder`의 `days_before_first`, `days_before_second` (기본값: 3일, 1일)
  - 예: `consultation_reminder`의 `hours_before_first`, `hours_before_second` (기본값: 24시간, 2시간)
  - 예: `class_schedule_tomorrow`의 `notification_time` (기본값: "20:00")
  - 예: `class_reminder_today`의 `minutes_before` (수업 시작 전 알림 시간)
  - 예: `checkin_reminder`의 `minutes_before` (수업 시작 전 알림 시간)
  - 예: `checkout_missing_alert`의 `grace_period_minutes` (체크아웃 유예 시간)
  - 예: 각 자동화별 threshold, limit, target 등 모든 기준값

---

## 12. 참고 문서

- **프론트 자동화 문서**: `docu/프론트 자동화.md`
- **아키텍처 문서**: `docu/디어쌤  아키텍처.md`
- **전체 기술문서**: `docu/전체 기술문서.txt`
- **전체 UI/UX 문서**: `docu/전체 유아이문서.txt`

---

**⚠️ 중요:**
- 이 문서는 프론트 자동화 문서를 기반으로 작성되었습니다
- 모든 자동화 기능은 Architecture v3.3 정본 규칙을 준수해야 합니다
- 모든 자동화는 Policy 기반으로만 동작하며, 하드코딩된 조건은 존재하지 않습니다
- 새�
