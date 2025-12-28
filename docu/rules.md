📘 Cursor AI 전용 개발 규칙 (DearSaaS Monorepo)
0. 기본 원칙

멀티테넌트 + Supabase + Monorepo 아키텍처를 전제로 한다.

Cursor가 생성하는 모든 코드/SQL은 아래 규칙을 "절대 변경하지 않는다"고 가정한다.

0-1. 파일 생성 금지 규칙 (Critical)

[불변 규칙] AI 에이전트는 다음 파일 형식을 생성하지 않습니다:

❌ 금지:
- *.md 파일 (마크다운 문서)
- *.txt 파일 (텍스트 문서)

✅ 예외:
- 사용자가 명시적으로 요청한 경우에만 생성 가능
- 기존 문서 수정은 허용

이유:
1. 문서는 개발자가 직접 작성하고 관리해야 함
2. 자동 생성된 문서는 품질이 보장되지 않음
3. 문서 중복 생성 방지
4. 프로젝트 구조 명확성 유지

⚠️ 중요: 코드 생성 시 문서 파일(.md, .txt)을 자동으로 생성하지 않습니다.

특히 아래 키워드/패턴은 이름을 바꾸거나 변형하면 안 됨:

tenant_id 컬럼명

app.current_tenant_id (PostgreSQL 설정 키 이름)

withTenant() 유틸 함수 이름

표준 RLS 정책 패턴

useResponsiveMode()

날짜/시간 변환 헬퍼(toKST, toUTC 등)

1. 프로젝트 구조 & 의존성 규칙
1-1. Monorepo 구조 기본

앱:

apps/academy-admin

apps/academy-parent

apps/super-admin

apps/public-gateway

공용 패키지:

packages/core/*              # Core Platform Layer (업종 공통)

packages/industry/*           # Industry Layer (업종별 비즈니스 로직)
  └── industry-academy/      # 학원 업종
  └── industry-gym/          # 체육관 업종 (향후 추가)
  └── ...

packages/services/*          # Service Layer (Industry Layer 래핑)

packages/hooks/*             # React Query Hooks

packages/lib/*               # 공통 유틸
  └── date-utils/            # KST 타임존 헬퍼
  └── supabase-client/       # Supabase 클라이언트 유틸리티

**lib 공통 유틸리티 전체 목록 (업종 독립):**

| 패키지 | 경로 | 주요 함수 | 용도 | 업종 독립성 |
|--------|------|----------|------|------------|
| date-utils | `packages/lib/date-utils` | `toKST`, `getTodayKST`, `getDateRangeKST` | KST 타임존 헬퍼 | ✅ |
| supabase-client | `packages/lib/supabase-client` | `createClient`, `createServerClient`, `withTenant` | Supabase 클라이언트 유틸리티 | ✅ |

**date-utils 사용법:**
```typescript
import { toKST, getTodayKST } from '@lib/date-utils';

// KST 기준 현재 시간
const nowKst = toKST();

// KST 기준 오늘 날짜 문자열
const today = getTodayKST(); // 'YYYY-MM-DD'
```

**supabase-client 사용법:**
```typescript
// 클라이언트
import { createClient } from '@lib/supabase-client';

// 서버/Edge
import { createServerClient } from '@lib/supabase-client/server';

// 멀티테넌트
import { withTenant } from '@lib/supabase-client/db';
```

**불변 규칙:**
- 모든 시간은 DB에는 UTC로 저장하되, 비즈니스 로직·표시·집계는 KST 기준으로 처리합니다.
- UI·리포트·로그·알람: 항상 KST로 변환해서 표시합니다.
- `toISOString().split('T')[0]` 또는 `toISOString().slice(0, 10)` 직접 사용 금지 (KST 변환 필수).

---

## [SSOT] Layer Classification Rules (Cursor Must Follow)

**⚠️ 중요: Cursor는 아래 분류 규칙을 반드시 따라야 합니다.**

| 분류 | 경로 매핑 | 판단 규칙 |
|------|----------|----------|
| **UI Core Component** | `packages/ui-core/*` | 시각/레이아웃/인터랙션 프리미티브. 비즈니스 규칙 없음. 네트워크/DB 호출 직접 금지. |
| **Shared Feature** | `apps/*/features/*` (앱 내부) 또는 `packages/schema-engine/*` | 여러 페이지에서 재사용되는 사용자 플로우/기능. UI + 상태 + 정책 + 로딩/에러 포함 가능. (데이터 접근은 Hook/Service로 위임) |
| **Shared Hook** | `packages/hooks/*` | Feature를 UI에서 쓰기 위한 React Query/상태 캡슐화. UI 렌더링 금지. 내부에서 navigate() 같은 라우팅 직접 실행 금지. |
| **Service/UseCase** | `packages/services/*` + `@industry/*/service` | 도메인 로직/데이터 접근 캡슐화. UI/Router 의존 금지. React 컴포넌트에서 직접 DB 호출 금지 원칙의 실행 주체. |
| **Domain/Service** | `packages/industry/*` (업종별) + `packages/core/*` (업종 공통) | 비즈니스 로직. 업종별 도메인: `packages/industry/*`. 업종 공통 도메인: `packages/core/*`. |
| **Cross-cutting Concern** | `packages/lib/*` + `packages/api-sdk/*` + `packages/env-registry/*` + `packages/core/core-config/*` + `packages/ui-core/src/components/ErrorBoundary.tsx` | 로깅/정책/권한/추적/에러처리/PII 등 전 영역에 적용되는 공통 규칙과 유틸. |

**용어 통일 규칙:**
- 항상 같은 단어를 같은 철자로 반복: "UI Core Component / Shared Feature / Shared Hook / Service/UseCase / Domain/Service / Cross-cutting Concern"
- 파일 상단에 레이어 태그 추가 권장: `// LAYER: UI_CORE_COMPONENT`, `// LAYER: SHARED_HOOK` 등

# UI 컴포넌트는 ui-core 사용 (@ui-core/react)

특히 packages/env-registry는 모든 앱/서비스에서 환경변수 접근의 유일한 경로입니다.

## [SSOT] UI Design, Style, Layout, Component Rules

**⚠️ 중요: 디자인/스타일/레이아웃/공통 컴포넌트 사용 규칙의 정본(SSOT)은 `docu/SSOT_UI_DESIGN.md`입니다.**

이 문서는 다음을 정의합니다:
- Design Tokens SSOT (토큰 종류/네이밍/추가 규칙/금지 규칙)
- Theme/Override SSOT (core/industry/tenant 우선순위, 허용 범위, 예외 처리)
- UI Core Component SSOT (컴포넌트 분류, "언제 무엇을 쓰는지" 결정표, 상태 UI 단일화 규칙)
- Layout SSOT (Layout primitives 규칙, Page templates 규칙, Responsive 규칙)
- SDUI 연동 규칙 (스키마에서 표현 가능한 ui.variant/ui.density/ui.intent 등)
- Enforcement (PR 체크리스트, ESLint/코드 규칙 후보, 예외 승인 프로세스)

**관련 문서**:
- 상세 가이드: `docu/컴포넌트 디자인.md` (컴포넌트별 사용 예시)
- 아키텍처 문서: `docu/디어쌤 아키텍처.md` (4장: Multi-Tenant Theme Engine, 6장: Responsive UX)

**불변 규칙**:
- "디자인 값"의 정본은 Design Tokens/Theme로만 존재한다. 임의 px/hex 하드코딩을 금지한다.
- "UI 조립"의 정본은 UI Core Component 카탈로그/사용 규칙이다.
- "레이아웃"의 정본은 Layout Primitives + Page Templates 규칙이다.
- 페이지/피처는 SSOT를 소비만 한다. 새 규칙/새 값은 SSOT에 먼저 추가한다.

1-2. 의존성 방향 (중요)

[불변 규칙] Industry Layer는 상용화 단계부터 적용됩니다.

허용 방향

apps/* → hooks/* → services/* → industry/* → core/* → DB

apps/* → core/*, lib/*
apps/* → schema-engine (@ui-core/react 컴포넌트 간접 사용)

industry-* → core/*

services/* → industry/*

금지 방향

core/* → industry-* 금지

industry-* → industry-* (업종 간 의존성 금지)

React 컴포넌트 → Supabase 직접 호출 금지

React 컴포넌트 → DB 쿼리/SQL 직접 작성 금지

1-2-1. Industry Layer 구조 규칙 (Critical)

[불변 규칙] 업종별 비즈니스 로직은 `packages/industry/industry-{업종}/`에 구현됩니다.

[불변 규칙] Industry Layer의 `index.ts`는 타입만 export하며, 서버 코드는 `/service` 경로에서만 import합니다.

[불변 규칙] Service Layer는 Industry Layer를 래핑하여 제공합니다.

1-2-2. Core Layer 모듈 구조 규칙 (Critical)

[불변 규칙] Core Layer 모듈은 업종 공통 비즈니스 로직, 도메인 모델, 공통 스키마를 제공합니다.

[불변 규칙] Core Layer 모듈의 `index.ts`는 타입만 export하며, 서버 코드는 `/service` 경로에서만 import합니다.

[불변 규칙] Core Layer 모듈은 Industry Layer를 import하지 않습니다 (단방향 의존성).

[불변 규칙] Core Layer 모듈은 다른 Core Layer 모듈을 import할 수 있습니다 (예: core-consultation → core-storage).

[불변 규칙] Cursor는 Industry Layer와 Core Layer 사이에 새로운 공통 패키지를 자동 생성하지 않는다.

[불변 규칙] 외부 라이브러리 사용 시 멀티테넌트 격리와 Zero-Trust 아키텍처를 우선 고려합니다.

[불변 규칙] 자체 구현 권장 모듈: core-calendar, core-community, core-search (상용화 단계는 PostgreSQL FTS)

## Automation & AI Engine Rule (SSOT)

- Automation Engine과 AI Engine은 반드시 core 레이어에만 존재해야 한다.
- industry 레이어에서는 Adapter 또는 Schema Override만 허용된다.
- 업종별 Automation/AI 엔진 구현은 금지된다.

본 규칙은 Automation & AI Industry-Neutral Rule(SSOT)을 따른다.

1-2-3. B2B 추천인 코드 제도 규칙 (Critical)

[불변 규칙] B2B 추천인 코드는 SaaS 사용자(테넌트) 간 추천 시스템입니다.

[불변 규칙] 추천인 코드는 referrer_tenant_id와 연결되어 생성됩니다.

[불변 규칙] 추천인 코드 사용 시 new_tenant_id와 연결되어 추적됩니다.

[불변 규칙] 추천인 보상은 할인/크레딧/무료 체험 등으로 제공됩니다.

[불변 규칙] 추천인 통계는 추천 건수, 성공 건수 등을 추적합니다.

1-3. 중앙 환경변수 관리 규칙 (Critical)

[불변 규칙] 서버/Edge/Node 코드(services/*, Edge Functions, Server Components)는 process.env를 직접 사용하지 않고 반드시 packages/env-registry에서 export된 envServer 객체를 사용해야 합니다.

[불변 규칙] React 클라이언트 코드에서는 @env-registry/server import만 금지한다. @env-registry/client (envClient)만 허용된다. Service Role Key가 포함된 envServer는 절대 클라이언트 번들에 들어가면 안 됩니다.

[불변 규칙] @env-registry/common(envCommon)은 서버/Edge 전용이며, 클라이언트 코드("use client")에서는 절대 사용하지 않는다.

[불변 규칙] Cursor는 서버/Edge 코드 생성 시 process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY 같은 직접 접근을 사용하면 안 되며, 반드시 import { envServer } from '@env-registry/server'를 사용해야 합니다.

[불변 규칙] Cursor는 클라이언트 코드 생성 시 envServer를 import하면 안 되며, NEXT_PUBLIC_* 값만 직접 사용해야 합니다.

[불변 규칙] Cursor는 클라이언트 코드에서 NEXT_PUBLIC_* prefix가 없는 환경변수(process.env.SUPABASE_URL 등)를 절대 사용하면 안 된다. 클라이언트는 NEXT_PUBLIC_* 또는 envClient만 사용한다.

[불변 규칙] Cursor는 env-registry import 경로를 다음 3개로만 사용한다:
- @env-registry/server
- @env-registry/client
- @env-registry/common

이 외의 경로(@env-registry/core/server 등)는 절대 생성하지 않는다.

[불변 규칙] Cursor는 env-registry 모듈을 절대 상대경로(../)로 import하지 않는다.

[불변 규칙] packages/env-registry는 Edge/App/Node 환경을 자동으로 인식하며, 각 환경에 맞는 환경변수 로딩 전략을 사용합니다.

환경변수 접근 패턴:

❌ 금지 예시:
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SERVICE_ROLE_KEY!,
);

✅ 허용 예시 (서버/Edge 코드):
import { envServer } from '@env-registry/server';

const supabase = createClient(
  envServer.SUPABASE_URL,
  envServer.SERVICE_ROLE_KEY,
);

✅ 허용 예시 (클라이언트 코드):
// 클라이언트에서는 NEXT_PUBLIC_* 값만 직접 사용
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 또는 선택적으로 envClient 사용 (빌드타임 값만)
import { envClient } from '@env-registry/client';
const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;

❌ 금지 예시 (클라이언트 코드):
import { envServer } from '@env-registry/server';  // ESLint 에러 발생
// "use client" 선언된 파일에서는 절대 envServer import 금지

import { envCommon } from '@env-registry/common';  // envCommon은 서버/Edge 전용

const supabaseUrl = process.env.SUPABASE_URL;  // NEXT_PUBLIC_ prefix 없음 - 금지
const apiKey = process.env.API_KEY;  // NEXT_PUBLIC_ prefix 없음 - 금지

환경변수 스키마:

packages/env-registry/src/schema.ts에서 서버/클라이언트 스키마를 분리하여 정의합니다.

- envServerSchema: 모든 환경변수 포함 (Service Role Key 등 비밀 값 포함)
- envClientSchema: NEXT_PUBLIC_* 등 클라이언트 노출 가능 값만

환경변수 로딩:

packages/env-registry/src/resolve.ts에서 Edge/App/Node 환경을 자동 감지하여 적절한 환경변수 소스를 사용합니다.

- Edge Function (Supabase): Deno.env.toObject()
- Vercel (App/Node): process.env
- 로컬 개발: process.env (dotenv 로드 후)
- 브라우저: 사용 불가 (resolveEnv() 호출 시 에러 발생)

⚠️ 주의: Edge Function 번들에 env-registry 패키지를 포함할 때 번들 사이즈와 cold start 영향이 있을 수 있습니다. 상용화 단계에서 실제 성능 측정 후 최적화를 검토합니다.

필수 환경변수 (상용화 단계):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SERVICE_ROLE_KEY
- NODE_ENV

선택 환경변수 (상용화 단계):
- PAYMENT_WEBHOOK_ROLE_KEY
- BILLING_BATCH_ROLE_KEY
- ANALYTICS_ROLE_KEY
- CUSTOM_DOMAIN_VERIFY_SECRET
- NEXT_PUBLIC_KAKAO_JS_KEY (상용화 단계 지도 기능용, JavaScript SDK)
- KAKAO_REST_API_KEY (상용화 단계 지도 기능용, 서버/Edge Function 전용)
- PLATFORM_AI_ENABLED (AI 기능 플랫폼 전체 온오프, env-registry/server에서만 읽음, 배포 환경에서 반드시 명시적으로 설정 필요, 누락 시 false로 간주하여 실행하지 않음)
- AWS_LAMBDA_*, CLOUDFLARE_WORKER_* 등

**⚠️ AI 기능 온오프 환경변수:**
- `PLATFORM_AI_ENABLED`: 플랫폼 전체 AI 기능 온오프 (env-registry/server에서만 읽음)
  - 배포 환경에서 반드시 명시적으로 설정되어야 함
  - 누락 시 false로 간주하여 실행하지 않음 (Fail Closed)
- 테넌트별 AI 온오프는 `tenant_features(feature_key='ai').enabled`로 관리 (SSOT)
- 최종 유효값: `effective_ai_enabled = PLATFORM_AI_ENABLED && tenant_features['ai'].enabled`
- 상세 규칙은 프론트 상황 신호 수집 문서 "글로벌 헤더 AI 토글 — UX/정책 SSOT" 섹션 참조

환경변수 검증:

애플리케이션 시작 시 packages/env-registry/src/index.ts에서 자동으로 검증됩니다.

누락되거나 잘못된 값이 있으면 즉시 에러를 발생시켜야 합니다.

Missing 변수 에러는 누락된 필수 환경변수 목록을 명확히 표시합니다.

보안 규칙:

[불변 규칙] Service Role Key는 프론트엔드 코드(apps/*의 Client Components)에서 절대 사용하지 않습니다.

[불변 규칙] envServer는 서버/Edge 전용이며, 클라이언트 번들에 포함되면 안 됩니다. ESLint 규칙으로 강제합니다.

[불변 규칙] Cursor는 클라이언트 컴포넌트(.tsx 파일에서 "use client" 선언된 파일) 또는 pages/app 라우트의 Client Component에서 envServer를 import하는 코드를 어떠한 상황에서도 생성하면 안 된다.

[불변 규칙] 환경변수는 코드에 하드코딩하지 않고, 반드시 환경변수 또는 Secrets 관리 시스템을 통해 주입받아야 합니다.

[불변 규칙] .env 파일은 git에 커밋하지 않으며, packages/env-registry/.env.example 파일에 예시만 포함합니다 (실제 키 제외).

Optional 환경변수 사용 시점 체크 (Lazy Validation):

상용화 단계에서 알림뱅킹은 필수 기능이지만, 스키마에서는 optional로 정의되어 있습니다.

실제 payment-alimbank, analytics, custom-domain 모듈에서 사용 시점에 requireEnv() 유틸을 사용하여 강하게 체크합니다:

// packages/payments/payment-alimbank/src/env.ts
export function requireEnv<K extends keyof EnvServer>(
  key: K
): NonNullable<EnvServer[K]> {
  const value = envServer[key];
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되어 있지 않습니다.`);
  }
  return value as NonNullable<EnvServer[K]>;
}

// 또는 직접 체크 (간단한 경우)
const secret = envServer.PAYMENT_ALIMBANK_SECRET;
if (!secret) throw new Error("PAYMENT_ALIMBANK_SECRET missing");

3단계 분리 구조:

packages/env-registry는 다음 3단계로 분리되어 있습니다:

- 🔵 server-env (server.ts): 모든 SECRET 변수 포함 (SERVICE_ROLE_KEY, webhook secret 등)
- 🔵 client-env (client.ts): NEXT_PUBLIC_*로 시작하는 변수만 (절대 Service Role Key 포함 X)
- 🔵 common-env (common.ts): 서버/Edge 전용 공개 값 (APP_NAME, APP_VERSION, INDUSTRY_MODE 등)
  - envCommon은 서버/Edge에서만 사용하며, 클라이언트에서 필요한 값은 NEXT_PUBLIC_*로 envClient에 포함

테넌트별 환경변수 (선택적 구현, 실제 필요 시):

선택적 구현으로 테넌트별 Secret Storage를 도입할 수 있습니다 (실제 필요 시).

- Larger SaaS 고객이 자체 PG 계약을 사용하는 경우
- Industry Layer에 따라 키가 달라지는 경우
- 테넌트별 Custom Domain Key 관리가 필요한 경우

→ 상용화 단계에서는 전역 환경변수만 사용하며, 테넌트별 Secret Storage는 선택적 구현(실제 필요 시)으로 검토합니다.

ESLint 규칙:

클라이언트 코드에서 envServer import를 막기 위해 ESLint 규칙을 설정합니다:

// .eslintrc.json 또는 .eslintrc.cjs
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "@env-registry/server",
            "message": "클라이언트 코드에서는 @env-registry/server를 import할 수 없습니다."
          },
          {
            "name": "@env-registry/common",
            "message": "클라이언트 코드에서는 @env-registry/common을 import할 수 없습니다."
          }
        ]
      }
    ]
  }
}

패키지 구조:

packages/env-registry/
  src/
    index.ts            # 모든 env 로딩의 단일 진입점
    schema.ts           # Zod 기반 환경변수 스키마
    resolve.ts          # Vercel/Supabase 환경변수 로딩 로직
  .env.example          # 환경변수 예시 파일

2. 데이터 접근 & RLS / 멀티테넌트 규칙
2-1. Supabase 접근 레이어

React 컴포넌트에서 Supabase 직접 호출 금지

항상 Service Layer를 통해 접근:

packages/services/* 안에서만 Supabase 쿼리 수행

packages/hooks/* 에서 React Query + Service 래핑

Service 함수 사용 패턴

// services/attendance-service.ts
import { withTenant } from '../_db';

export const attendanceService = {
  async checkIn(tenantId, studentId) {
    // INSERT는 tenant_id를 row object에 직접 포함
    return supabase
      .from('attendance_logs')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        occurred_at: new Date(),
      });
  },

  async list(tenantId, filters) {
    // SELECT는 반드시 withTenant() 사용
    return withTenant(
      supabase
        .from('attendance_logs')
        .select('*')
        .order('occurred_at', { ascending: false }),
      tenantId
    );
  },
};

2-2. 공통 쿼리 가드 withTenant 강제 사용

[불변 규칙] INSERT 시에는 row object 안에 tenant_id 필드를 직접 포함한다.

[불변 규칙] Cursor는 INSERT 쿼리에서 withTenant()를 절대 사용하지 않는다. INSERT는 반드시 row object에 tenant_id를 직접 포함한다.

[불변 규칙] Cursor는 INSERT 쿼리에서 withTenant()를 단 1번도 호출해서는 안 된다.

SELECT/UPDATE/DELETE 쿼리는 반드시 withTenant()를 사용해 tenant_id 필터를 강제한다.

Cursor는 이 2가지 패턴을 혼용해도 혼동하지 않도록 반드시 규칙을 분리해 기억한다.

[불변 규칙] Cursor는 INSERT 문에서 tenant_id를 row object 외에 .eq('tenant_id') 형태로 중복 포함하는 코드를 생성하면 안 된다.

[불변 규칙] Cursor는 SELECT/UPDATE/DELETE 쿼리 생성 시 .eq('tenant_id', ...)를 직접 사용하면 안 되며, 반드시 withTenant() 감싸기 패턴을 사용해야 한다.

[불변 규칙] Cursor는 SELECT/UPDATE/DELETE 쿼리에서 .eq('tenant_id', ...)를 생성하지 않는다.

// services/_db.ts
export function withTenant<T>(
  q: PostgrestFilterBuilder<T>,
  tenantId: string,
) {
  return q.eq('tenant_id', tenantId);
}

// INSERT 예시 (tenant_id를 row object에 직접 포함)
supabase
  .from('attendance_logs')
  .insert({
    tenant_id: tenantId,  // 직접 포함
    student_id: studentId,
    occurred_at: new Date(),
  });

// SELECT/UPDATE/DELETE 예시 (withTenant() 사용)
return withTenant(
  supabase.from('students').select('*').order('created_at', { ascending: false }),
  tenantId,
);

return withTenant(
  supabase.from('students').update({ name: '새 이름' }),
  tenantId,
);

return withTenant(
  supabase.from('students').delete(),
  tenantId,
);

❌ 금지 예시 (SELECT/UPDATE/DELETE에서 .eq 직접 사용):
supabase.from('students').select('*').eq('tenant_id', tenantId);  // withTenant() 사용해야 함
supabase.from('students').update({ name: '새 이름' }).eq('tenant_id', tenantId);  // withTenant() 사용해야 함

Cursor는 withTenant() 이름을 절대 바꾸지 않는다.

모든 멀티테넌트 테이블 쿼리는 tenant_id 조건 + RLS 2중 필터를 유지해야 한다.

2-3. 표준 RLS 정책 패턴 (SQL 코드 생성 시 필수)

⚠️ 중요: PgBouncer Transaction Pooling을 사용하는 경우, 반드시 JWT claim 기반 RLS를 사용해야 합니다.

옵션 1: JWT claim 기반 RLS (권장, Transaction Pooling 호환):

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_students ON public.students
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

→ JWT claim에서 tenant_id를 직접 읽어 RLS 정책 적용
→ PgBouncer Transaction Pooling과 완벽 호환
→ Supabase JWT 생성 시 tenant_id를 claim에 포함해야 함

**❌ 잘못된 패턴 (금지):**
```sql
-- ❌ 금지: 중복 괄호와 불필요한 ::text 캐스팅
tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid
```

**잘못된 패턴의 문제점:**
- 중복 괄호 `((...))`는 불필요하며 가독성을 해칩니다
- `'tenant_id'::text` 캐스팅은 불필요합니다 (JSON 연산자 `->>` 는 이미 text를 반환)
- 올바른 패턴: `(auth.jwt() ->> 'tenant_id')::uuid` (단일 괄호, ::text 없음)

옵션 2: 세션 변수 기반 RLS (Session Pooling 또는 전용 커넥션 전용) - ⚠️ Deprecated:

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_students ON public.students
FOR ALL TO authenticated
USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);

⚠️ 레거시 예시: JWT claim 기반 RLS 사용 권장. 이 방식은 PgBouncer Transaction Pooling과 호환되지 않습니다. Session Pooling 또는 전용 커넥션을 사용하는 경우에만 유효합니다.

[불변 규칙] Cursor는 새로운 SQL 생성 시 OPTION 2 (current_setting 기반 RLS)를 절대 사용하지 않는다.

[불변 규칙] RLS 정책 이름은 기본적으로 tenant_isolation_<table> 형식을 따라야 한다.

**정본 네이밍 규칙:**

1. **테넌트 격리 정책 (기본, 필수)**: `tenant_isolation_<table>` 형식 사용
   - 예: `tenant_isolation_students`, `tenant_isolation_invoices`
   - ❌ 금지: `rls_tenant_users`, `policy_users_tenant`, `tenant_users_policy` 등

2. **예외: read/write 분리 정책 (레거시 허용)**:
   - 기존 운영 DB에 `products_read`, `products_write`, `student_task_cards_read` 같은 네이밍이 존재하는 경우, 레거시로 유지 가능
   - 정본: `task_cards_read`, `task_cards_write` (정본)
   - 레거시: `student_task_cards_read`, `student_task_cards_write` (하위 호환, 일몰 예정)
   - 신규 생성 정책은 가능하면 `tenant_isolation_<table>` 형식 사용 권장
   - read/write 분리가 필요한 경우: `tenant_isolation_<table>_read`, `tenant_isolation_<table>_write` 형식 사용

**Cursor 생성 규칙:**
- 신규 정책 생성 시: `tenant_isolation_<table>` 형식 사용
- 기존 레거시 정책 수정 시: 기존 네이밍 유지 (마이그레이션 없이)

2-4. Edge Function에서 테넌트 설정 패턴 - ⚠️ Deprecated

🚨 [불변 규칙] PgBouncer Transaction Pooling 사용 시 set_config 기반 RLS 금지:

[불변 규칙] Supabase 환경에서는 기본적으로 PgBouncer Transaction Pooling을 사용하므로, set_config('app.current_tenant_id') 기반 RLS는 절대 사용하지 않습니다.

[불변 규칙] Transaction Pooling 모드에서는 세션 변수가 트랜잭션 종료 후 유지되지 않으므로, set_config 기반 RLS는 보안 상 안전하게 동작하지 않을 가능성이 매우 높습니다.

[불변 규칙] 모든 RLS 정책은 반드시 JWT claim 기반(auth.jwt() ->> 'tenant_id')으로 구현해야 합니다.

⚠️ Deprecated: Edge Function에서 set_config 사용은 더 이상 권장하지 않습니다.

❌ 금지 예시:
```sql
-- ⚠️ 레거시 예시: Transaction Pooling에서는 작동하지 않음
-- Edge Function에서 set_config 사용 (더 이상 사용하지 않음)
SELECT set_config('app.current_tenant_id', :tenant_id::text, true);
```

✅ 권장 예시:
- JWT에 tenant_id를 claim으로 포함하여 RLS 정책에서 자동으로 읽음
- Edge Function에서 별도 set_config 호출 불필요

2-5. PgBouncer Transaction Pooling과 RLS 전략 (Critical)

🚨 중요: PgBouncer Transaction Pooling 모드에서는 세션 변수(set_config)가 트랜잭션 종료 후 유지되지 않으므로, RLS는 반드시 JWT claim 기반으로 구현해야 합니다.

[불변 규칙] PgBouncer Transaction Pooling 모드를 사용할 때는 RLS 정책이 JWT claim 기반으로 작동하도록 설계해야 합니다. set_config 기반 RLS는 Transaction Pooling과 호환되지 않습니다.

문제점:
- Transaction Pooling 모드에서는 세션 레벨 SET이 트랜잭션 종료 후 유지되지 않음
- set_config('app.current_tenant_id') 기반 RLS는 Transaction Pooling에서 작동하지 않음
- RLS 정책이 잘못된 tenant_id로 평가되거나 모든 row가 차단될 위험

해결책 (구조적):

옵션 1: JWT claim 기반 RLS (권장, Supabase 기본 방식):
- Supabase JWT에 tenant_id를 claim으로 포함
- RLS 정책에서 JWT claim을 직접 읽어 tenant_id 확인
- PgBouncer Transaction Pooling과 완벽 호환

옵션 2: Session Pooling 모드 (제한적):
- PgBouncer Session Pooling 모드 사용 (커넥션 수 제한 증가)
- 세션 변수 유지 가능하나 커넥션 효율성 저하

옵션 3: 전용 커넥션 (특수 케이스):
- 특정 Edge Function만 전용 커넥션 사용 (논풀링)
- 일반적인 경우에는 권장하지 않음

모니터링 전략:
- RLS 실패율 모니터링 (예상치 못한 401/403 증가 감지)
- JWT claim 누락 감지 (로그 수집)
- 테넌트 간 데이터 누수 감지 (audit 로그 분석)

3. 네이밍 & 파일 구조 규칙
3-1. SQL

테이블/컬럼: snake_case

예: tenant_id, created_at, industry_type

인덱스:

idx_<table>_<column>

ux_<table>_<unique_column>

예: idx_students_tenant_created, ux_payment_idem

3-2. TypeScript / React

파일명:

일반: kebab-case (예: payment-service.ts, tenant-utils.ts)

컴포넌트: PascalCase (예: StudentList.tsx, PaymentForm.tsx)

변수명:

JS/TS: camelCase (예: tenantId, createdAt)

SQL 변수: snake_case (예: _tenant_id, _start_date)

3-3. Industry / Core 네이밍

Industry 패키지:

packages/industry/industry-academy

packages/industry/industry-salon 등

Industry 테이블 prefix(필요 시):

academy_classes, salon_customers 등

4. UI / 반응형 / Zoom 규칙
4-1. 반응형 핵심 훅
const mode = useResponsiveMode();
// 반환 예시:
// {
//   breakpoint: "sm" | "md" | "lg" | "xl",
//   device: "phone" | "tablet" | "desktop",
//   tableMode: "card" | "compact" | "table" | "split"
// }


Breakpoint/모드 값은 위 스펙을 기준으로 쓴다.

반응형 로직은 개별 CSS media query 직접 작성보다
ui-core 컴포넌트는 CSS 변수 기반 토큰/스타일을 사용하며, 반응형은 필요 시 CSS Media Query 또는 ui-core의 반응형 유틸/레이아웃 컴포넌트를 사용합니다.

4-2. 테이블/리스트 UI 패턴

휴대폰: ui-core `DataTable` (컴팩트 모드) 또는 카드 레이아웃

태블릿: ui-core `DataTable` (컴팩트 모드)

PC: ui-core `DataTable` (기본 모드)

4-3. 알림/경고 모달 규칙 (Critical)

[불변 규칙] 모든 알림/경고/확인 대화상자는 커스텀 모달을 사용해야 합니다.

❌ 금지:
- window.alert()
- window.confirm()
- window.prompt()

✅ 허용:
- useModal().showAlert(message, title?, type?)
- useModal().showConfirm(message, title?)
- 커스텀 Modal 컴포넌트

이유:
1. 일관된 UX: 모든 알림이 동일한 디자인 시스템 사용
2. 접근성: 커스텀 모달은 접근성 개선 가능
3. 모바일 최적화: 모바일에서 네이티브 alert는 부자연스러움
4. 다크모드: Theme Engine + ui-core CSS 변수 토큰으로 지원
5. i18n 지원: 다국어 메시지 지원

사용 예시:
```typescript
function MyComponent() {
  const { showAlert, showConfirm } = useModal();

  // 알림
  showAlert('저장되었습니다.', '성공', 'success');
  showAlert('저장에 실패했습니다.', '오류', 'error');

  // 확인
  const confirmed = await showConfirm('정말 삭제하시겠습니까?', '삭제 확인');
  if (confirmed) {
    await deleteItem.mutateAsync(id);
  }
}
```

참고: 상세 가이드라인은 `docu/전체 유아이문서.txt`의 "6-2. 모달 vs 페이지 선택 기준" 섹션 참조

5. 시간 & 타임존(KST) 규칙
5-1. 저장/표시 원칙

DB: timestamptz(UTC)로 저장

UI·리포트·로그·알람: 항상 KST로 변환해서 표시

5-2. 전역 설정 및 헬퍼
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.tz.setDefault('Asia/Seoul'); // KST

export const toKST = (d: string | Date | number) =>
  dayjs(d).tz('Asia/Seoul');


Cursor는 날짜 표시 로직에서 직접 .toLocaleString() 등 쓰지 말고
반드시 toKST() 같은 헬퍼를 통해 처리하는 패턴을 유지해야 한다.

DB 파티션/인덱싱 기준은 UTC 컬럼 기준, KST 변환은 App/Batch 레이어에서 수행.

5-4. 파티셔닝 인덱스 규칙 (Critical)

[불변 규칙] 로그성 테이블(attendance_logs, analytics.events 등)의 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스가 적용되어야 합니다.

파티셔닝 도입 타이밍:
- 임계값(1억 rows 또는 50GB)의 50~70% 도달 시점에 미리 도입
- 성능 저하가 실제로 발생한 후 도입하면 이미 늦습니다

인덱스 예시:
CREATE INDEX ON attendance_logs_2025_01 (tenant_id, occurred_at DESC);
CREATE INDEX ON analytics.events_2025 (tenant_id, occurred_at DESC);

5-3. KST 기준 날짜 처리 규칙 (Critical)

[불변 규칙] DB에서 날짜 기준 로직에 CURRENT_DATE를 그대로 사용하면 안 됩니다.

[불변 규칙] DB에서 KST 기준 날짜가 필요하면 반드시 timezone('Asia/Seoul', now())::date를 사용합니다.

❌ 금지 예시:
SELECT * FROM invoices WHERE date = CURRENT_DATE;  // UTC 기준 날짜 반환

✅ 허용 예시:
SELECT * FROM invoices WHERE date = (timezone('Asia/Seoul', now()))::date;

[불변 규칙] 앱 레이어에서 KST 기준 날짜를 계산해서 파라미터로 넘기는 것이 더 안전합니다.

// 서비스 레이어 예시
import { toKST } from '@lib/date-utils';

const todayKst = toKST().startOf('day');
const tomorrowKst = toKST().add(1, 'day').startOf('day');

return withTenant(
  supabase
    .from('attendance_logs')
    .select('*')
    .gte('occurred_at', todayKst.toISOString())
    .lt('occurred_at', tomorrowKst.toISOString()),
  tenantId,
);

[불변 규칙] 파일명 생성 시 날짜 형식은 반드시 KST 기준을 사용합니다.

❌ 금지 예시:
const fileName = `학생목록_${new Date().toISOString().split('T')[0]}.xlsx`;  // UTC 기준 날짜

✅ 허용 예시:
import { toKST } from '@lib/date-utils';
const fileName = `학생목록_${toKST().format('YYYY-MM-DD')}.xlsx`;  // KST 기준 날짜

이유:
- 사용자 경험: 파일명의 날짜가 사용자의 로컬 시간대와 일치해야 함
- 일관성: 모든 날짜 표시가 KST 기준으로 통일

6. 에러 처리 & 로깅 & PII 규칙
6-1. 에러 타입 표준
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public isRetryable: boolean = false,
  ) {
    super(message);
  }
}


PostgREST 에러는 반드시 AppError로 매핑해서 사용.

const mapPostgrestError = (error: PostgrestError): AppError => {
  const code = error.code;
  if (code === '23505') return new AppError('CONFLICT', 409, error.message, false);
  if (code === '23503') return new AppError('NOT_FOUND', 404, error.message, false);
  return new AppError('INTERNAL_ERROR', 500, error.message, false);
};

6-2. PII 마스킹 헬퍼 사용 (Critical)

[불변 규칙] PII 마스킹 유틸리티는 packages/core/pii-utils 또는 packages/core-config/pii-utils에 정의하며, 모든 애플리케이션에서 일관되게 사용합니다.

[불변 규칙] Cursor는 PII 마스킹 유틸리티를 직접 정의하지 않고, 반드시 중앙 모듈에서 import하여 사용합니다.

마스킹 유틸리티 위치:

packages/core/pii-utils/src/index.ts

또는

packages/core-config/pii-utils/src/index.ts

마스킹 유틸리티 사용:

import { maskPhone, maskEmail, maskName, maskPII } from '@core/pii-utils';

// 개별 필드 마스킹
const maskedPhone = maskPhone(user.phone);
const maskedEmail = maskEmail(user.email);
const maskedName = maskName(user.name);

// 객체 전체 마스킹
const maskedUser = maskPII(user);

마스킹 유틸리티 정의 (참고):

export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  // 010-1234-5678 → 010-****-5678
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

export const maskEmail = (email: string | null | undefined): string => {
  if (!email) return '';
  // user@example.com → u***@example.com
  return email.replace(/(^.).*(@.*$)/, '$1***$2');
};

export const maskName = (name: string | null | undefined): string => {
  if (!name) return '';
  // 홍길동 → 홍*동
  if (name.length <= 2) return name.charAt(0) + '*';
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
};

export const maskPII = (data: any): any => {
  if (typeof data === 'string') {
    data = data.replace(/(^.).*(@.*$)/, '$1***$2');           // 이메일 마스킹
    data = data.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');   // 전화번호 마스킹
  }
  return data;
};


로그, audit.events.meta 등에 직접 이름/전화번호/이메일을 남기지 않는다.

[불변 규칙] Cursor는 로그/모니터링 코드 생성 시 전화번호·이메일·이름 등의 PII를 maskPII()를 통하지 않고 직접 출력하는 코드를 절대 생성하면 안 된다.

[불변 규칙] Cursor는 logger.debug / logger.info / logger.warn 등에 사용자 객체(user) 전체를 그대로 전달하거나 PII 포함 문자열을 직접 전달해서는 안 되며, 반드시 maskPII()를 적용한 값만 전달해야 한다.

[불변 규칙] 개발 환경(import.meta.env?.DEV)에서도 PII 마스킹을 적용해야 합니다. 개발 환경의 로그도 보안 위험에 노출될 수 있습니다.

❌ 금지 예시:
console.log(user.email);
logger.info('User phone:', user.phone);
audit.meta = { name: user.name };
logger.debug(user.email);  // logger 라이브러리 직접 전달 금지
logger.warn(JSON.stringify(user));  // 객체 전체 직렬화 금지

// 개발 환경에서도 PII 마스킹 없이 로깅 금지
if (import.meta.env?.DEV) {
  console.log('student prop:', {
    name: student?.name,
    phone: student?.phone,
    email: student?.email,
  });
}

✅ 허용 예시:
console.log('User email:', maskPII(user.email));
logger.info('User phone:', maskPII(user.phone));
audit.meta = { name: maskPII(user.name) };
logger.debug('User email:', maskPII(user.email));  // logger에도 maskPII 적용
logger.warn('User data:', maskPII(user));  // 객체도 maskPII 적용 후 전달

// 개발 환경에서도 PII 마스킹 적용
if (import.meta.env?.DEV) {
  import('@core/pii-utils').then(({ maskPII }) => {
    console.log('student prop:', maskPII({
      name: student?.name,
      phone: student?.phone,
      email: student?.email,
    }));
  });
}

7. 보안 / 키 관리 / Edge Function 규칙
7-1. Service Role Key

프론트 코드에 Service Role Key 절대 포함 금지.

Edge Function / 서버 코드에서만 사용.

환경변수에서 주입 (중앙 env-registry 시스템 사용).

⚠️ 중요: @lib/env 같은 별도 래퍼는 사용하지 않습니다. 반드시 @env-registry/server의 envServer를 직접 사용합니다.

✅ 허용 예시:
import { envServer } from '@env-registry/server';

const supabase = createClient(
  envServer.SUPABASE_URL,
  envServer.SERVICE_ROLE_KEY,
);

❌ 금지 예시:
import { env } from '@lib/env';  // 구 버전 래퍼 - 사용 금지

7-2. Role 분리 (상용화 단계)

⚠️ 중요: 이 규칙은 상용화 단계에서 적용합니다.

상용화 단계에서 Role 분리 구현 예정 (환경변수 스키마 정의 완료, Edge Function에서 실제 사용 미구현).

기능별 Role 예시 (상용화 단계):

payment_webhook_role

billing_batch_role

analytics_role

public_gateway_role

Cursor는 Edge Function 예제 생성 시,
해당 기능에 맞는 최소 권한 Role만 사용하도록 가정해야 한다.

→ 상용화 단계에서 Role 분리를 도입 예정 (현재는 SERVICE_ROLE_KEY 사용 중).

7-3. Webhook 보안 패턴

기본 (상용화 단계 필수):

const sig = req.headers['x-signature'];
const ts  = req.headers['x-timestamp']; // ISO / epoch

assert(within5MinKST(ts));

const expected = hmacSHA256(secret, ts + rawBody);
if (!timingSafeEqual(sig, expected)) throw new Error('Invalid signature');

idempotency-key 기반 멱등성 인덱스 항상 포함.

⚠️ 참고: automation_actions 테이블의 request_id는 별도 규칙을 따릅니다 (챗봇.md 6.3.1 참조).
- request_id 형식: `{task_id}:{action}:{attempt_window}` (5분 버킷)
- automation_actions.request_id와 execution_audit_runs.reference.request_id는 동일한 형식을 사용 (액티비티.md 7.2 참조)
- idempotency_key는 webhook/event_logs용, request_id는 automation_actions 전용

PG/알림뱅킹 관련 재시도는 지수 백오프 패턴 사용.

고급 (상용화 단계 선택적):

Ordering Guarantee (Late event drop)

상태 전이 규칙 검증

→ 상용화 단계에서는 멱등성 처리를 기본으로 하며, Ordering Guarantee는 실제 필요성이 확인된 후 도입합니다.

7-4. 결제/알림뱅킹 운영 정책 (핀테크 수준 필수)

⚠️ 중요: SaaS Billing에서 가장 중요한 "실운영 안정성"을 보장하기 위한 핵심 정책입니다.

[불변 규칙] 모든 webhook 이벤트는 반드시 idempotency_key 기반 중복 처리 방지를 수행합니다.

[불변 규칙] 동일 idempotency_key로 수신된 이벤트는 첫 번째 이벤트만 처리하고, 이후 이벤트는 무시합니다.

⚠️ 참고: automation_actions 테이블의 request_id는 별도 규칙을 따릅니다 (챗봇.md 6.3.1 참조).
- request_id 형식: `{task_id}:{action}:{attempt_window}` (5분 버킷)
- automation_actions 테이블에서 request_id 유니크 제약으로 멱등 강제
- automation_actions.request_id와 execution_audit_runs.reference.request_id는 동일한 형식을 사용 (액티비티.md 7.2 참조)
- idempotency_key는 webhook/event_logs용, request_id는 automation_actions 전용

[불변 규칙] 결제/알림뱅킹 webhook과 실제 정산 데이터 간 불일치가 발생하면 자동으로 감지하고 수동 조정 UI를 제공합니다.

[불변 규칙] 결제 실패 시 지수 백오프 패턴으로 자동 재시도하며, 최대 재시도 횟수와 재시도 간격을 명확히 정의합니다.

[불변 규칙] 모든 결제/수납/환불 거래는 회계적 정합성을 검증하며, 불일치 시 즉시 알림을 발송합니다.

[불변 규칙] 운영팀이 결제/정산 불일치를 수동으로 조정할 수 있는 UI를 제공합니다.

[불변 규칙] 결제/알림뱅킹 시스템의 실시간 상태를 모니터링하고, 이상 징후 시 즉시 알림을 발송합니다.

[불변 규칙] 결제/알림뱅킹 처리 중 일부 단계만 실패한 경우, 완료된 단계는 롤백하지 않고 부분 성공 상태로 기록하며, 실패한 단계만 재시도합니다.

[불변 규칙] 결제 취소는 원거래와 연결하여 처리하며, 재요청은 멱등성 키를 재사용하여 중복 결제를 방지합니다.

[불변 규칙] 알림뱅킹 서비스 장애 시 자동으로 대체 채널(SMS)로 전환하거나, 장애 복구 후 재시도 큐에 추가합니다.

→ 상세 내용은 기술문서 PART 3의 14-2-1-1 "결제/알림뱅킹 운영 정책" 섹션 참조

8. Edge Function / 배치 / Analytics 규칙
8-1. Supabase Edge Function 제약

Edge Function은 짧은 요청/응답, Webhook, Public Gateway 검증 용도만.

⚠️ 중요: Supabase Edge Functions는 Timeout 제한(예시: 5초 기본, 최대 15초)으로 인해 장시간 배치 작업에 부적합합니다.

[불변 규칙] Timeout 수치는 예시이며, Cursor는 Timeout 숫자를 코드/문서에 직접 하드코딩하지 않는다.

→ 상세 제약사항은 기술문서 PART 3의 15-4-3 "Supabase Edge Function 제약사항 상세" 섹션 참조

상용화 단계:
- Supabase Edge Function + 간단한 집계 가능
- 짧은 요청/응답, Webhook, Public Gateway 검증 용도
- 대규모 Analytics·Batch 작업 코드는 AWS Lambda·Cloudflare Workers 필수
- Supabase cron은 트리거 용도로만 사용하고, 실제 heavy 작업은 외부 Worker에 둔다

Cursor는:

큰 루프/수백만 row 집계 로직을 Edge Function 안에 넣지 않는다.

[불변 규칙] Cursor는 Edge Function 안에 대규모 루프(for, while) 또는 수천/수만 row를 직접 처리하는 코드를 생성하지 않는다.

8-2. Analytics 집계 패턴

상용화 단계:
- Supabase Edge Function + 간단한 집계 가능
- analytics.daily_store_metrics, analytics.daily_region_metrics 테이블 구현 (정본)
- 대규모 Analytics·Batch 작업은 AWS Lambda·Cloudflare Workers 필수
- Supabase cron은 트리거 용도로만 사용

원시 이벤트 테이블: analytics.events (RANGE 파티션)

집계 테이블 (정본):

analytics.daily_store_metrics (매장 단위 일별 KPI)

analytics.daily_region_metrics (지역 단위 집계 KPI)

⚠️ 중요: analytics.daily_metrics, analytics.monthly_revenue는 구버전/폐기된 네이밍이며 더 이상 사용하지 않습니다. 정본은 analytics.daily_store_metrics, analytics.daily_region_metrics만 사용합니다.

모든 집계는 KST 기준 date/year/month 사용.

8-3. 지역 통계 및 벤치마킹 (상용화 단계)

⚠️ 중요: 기본 지역 통계와 고급 기능은 상용화 단계에서 모두 구현 예정 (테이블 스키마 정의 완료, core_stores/core_regions 및 analytics.daily_store_metrics/daily_region_metrics 테이블 생성 마이그레이션 필요).

상용화 단계 기본 기능:
- 지역순위 (학생 수, 매출, 출석률 기준)
- 지역 평균 대비 비교 차트
- 행정동 기준 기본 히트맵
- 기본 AI 인사이트 (3종)

상용화 단계 고급 기능:
- 고급 히트맵 (다중 지표, 시계열)
- 다중 지역 비교
- AI 인사이트 고도화
- 지도 기반 매장 분포 시각화 (고급)

지역 통계 관련 테이블:

- core_regions: 지역 마스터 데이터 (동/구/시/전국 계층) (상용화 단계)
- core_stores: 매장 정보 (region_id, latitude, longitude 포함) (상용화 단계)
- analytics.daily_store_metrics: 매장 단위 일별 KPI (상용화 단계)
- analytics.daily_region_metrics: 지역 단위 집계 KPI (상용화 단계)

[불변 규칙] core_stores 테이블 쿼리는 반드시 withTenant()를 사용해야 합니다.

[불변 규칙] analytics.daily_store_metrics는 RLS + tenant_id 필터가 적용되는 "자기 매장 전용 KPI" 테이블입니다.

[불변 규칙] analytics.daily_region_metrics는 집계·익명화된 region-level 통계 테이블이며, 일반 매장 사용자는 "자기 업종 + 자기 지역의 통계만" 볼 수 있습니다.

[불변 규칙] analytics.daily_region_metrics 조회 시 Cursor는 withTenant()를 사용하지 않는다. 이 테이블은 익명 집계 테이블이며 RLS 정책이 별도로 정의된다.

[불변 규칙] analytics.daily_region_metrics는 tenant_id 컬럼을 사용해 필터링하지 않는다.

[불변 규칙] 지역 통계는 store_count >= 3 조건을 만족할 때만 사용자에게 제공합니다. 조건 미충족 시 에러 메시지를 반환합니다.

[불변 규칙] 이벤트 저장 시 반드시 UTC → KST 변환을 수행하고 event_date_kst에 저장합니다. 집계 시에는 event_date_kst를 그대로 사용하며 추가 변환을 수행하지 않습니다.

지역 통계 쿼리 예시:

// 매장 위치 조회 (withTenant() 사용)
return withTenant(
  supabase
    .from('core_stores')
    .select('id, name, latitude, longitude, region_id')
    .eq('status', 'active'),
  tenantId,
);

// 지역 벤치마크 조회 (익명화된 집계 데이터)
return supabase
  .from('analytics.daily_region_metrics')
  .select('*')
  .eq('industry_type', store.industry_type)
  .eq('region_level', region.level)
  .eq('region_code', region.code)
  .gte('date_kst', range.from)
  .lte('date_kst', range.to);

9. 커스텀 도메인 & Middleware 규칙
9-1. Next.js Middleware 도메인 → 테넌트 매핑
export async function middleware(req: NextRequest) {
  const host = req.headers.get('host');

  const tenant = await findTenantByDomain(host);

  if (tenant) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-tenant-id', tenant.id);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.rewrite('/errors/domain-not-found');
}


x-tenant-id 헤더 이름 그대로 사용.

캐시 레이어(KV/Redis)를 우선 조회 후 DB fallback 패턴 유지.

[불변 규칙] findTenantByDomain() 함수는 반드시 packages/services/tenant-service.ts 안에 존재한다.

Cursor는 이 함수를 다른 경로에 생성하거나 이름을 변경하면 안 된다.

[불변 규칙] findTenantByDomain()의 시그니처는

(domain: string) => Promise<{ id: uuid, tenant_id: uuid, status: string } | null>

형식을 절대 벗어나면 안 된다.

Cursor는 추가 파라미터나 추가 반환 필드를 생성하면 안 된다.

[불변 규칙] Cursor는 findTenantByDomain() 반환 객체에 id, tenant_id, status 외의 어떠한 필드도 추가하면 안 된다. 필드 수는 정확히 3개여야 한다.

함수 시그니처 예시:

// packages/services/tenant-service.ts
export async function findTenantByDomain(domain: string): Promise<{ id: uuid, tenant_id: uuid, status: string } | null> {
  // KV 캐시 우선 조회 → DB fallback
  // tenant_domains 테이블에서 domain으로 조회
  // 반환: { id: uuid, tenant_id: uuid, status: string } | null
}

❌ 금지 예시:
findTenantByDomain(host: string, path: string)  // 추가 파라미터 금지
findTenantByDomain(domain: string): Promise<{ id, tenant_id, status, address, name }>  // 추가 반환 필드 금지

9-2. Public Gateway Token 보안 (상용화 단계 필수)

상용화 단계:
- Signed token 기반 invoice 접근 (HMAC-SHA256)
- 만료 시간: 10분 (KST 기준)
- jti(jwt id) 포함
- 재사용 방지는 짧은 만료 시간(10분)으로 현실적으로 커버

상용화 단계 (고도화):
- Edge KV / audit.public_tokens 기반 재사용 방지
- Rate-limit (invoice_id당 1분당 10회, IP당 1분당 30회)

→ 상용화 단계에서는 서명 검증 + exp(만료) + jti를 적용합니다.

10. 테스트 / 더미 데이터 / 이모지 규칙
10-1. 더미 데이터 생성 금지

[불변 규칙] Cursor는 운영 코드(apps/*, services/*, hooks/*) 안에 랜덤 더미 데이터 생성 코드를 절대 포함시키면 안 된다.

테스트 전용 더미 데이터는 dev/test/seed 영역에만 생성한다.

운영/실서비스 코드에서 의미 없는 랜덤 더미 데이터 생성 금지.

테스트/문서용 예제 데이터는:

dev/staging 또는 테스트 스크립트/시드에서만 사용.

❌ 금지 예시 (운영 코드):
// services/student-service.ts
const dummyStudents = Array.from({ length: 10 }, (_, i) => ({
  name: `학생${i}`,
  // ...
}));

✅ 허용 예시 (테스트 코드):
// tests/seed/students.ts 또는 dev/scripts/seed.ts
const dummyStudents = Array.from({ length: 10 }, (_, i) => ({
  name: `학생${i}`,
  // ...
}));

10-2. 이모지 사용 금지/허용 범위

코드/사용자 노출 UI 텍스트에는 이모지 사용 금지.

기술 설계 문서, 설명용 마크다운에는 이모지 사용 가능.

Cursor가 코드 생성할 때:

console.log("✅ 성공!") 같은 표현 금지

대신 console.log("Success"); 형태로 작성.

11. Cursor가 절대 바꾸면 안 되는 이름/패턴 정리

Cursor가 코드/SQL을 생성할 때 반드시 그대로 유지해야 하는 키워드/패턴:

RLS / 테넌시

컬럼: tenant_id

⚠️ 레거시 패턴 (기존 코드에만 존재, 새 코드에서는 사용 금지):

설정 키: app.current_tenant_id

RLS 패턴:

tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid

Edge Function tenant 설정:

SELECT set_config('app.current_tenant_id', :tenant_id::text, true);

⚠️ 레거시 예시: 더 이상 사용하지 않음, JWT claim 기반 RLS 사용 권장. app.current_tenant_id / set_config 기반 RLS 패턴은 과거 코드에만 남아 있을 수 있는 레거시입니다.

Cursor는:
- 기존 SQL에서 이 패턴을 '이름 변경/기능 변경'하지 않고 그대로 보존하되,
- 기존 SQL을 리팩터링하는 PR에서도 Cursor는 app.current_tenant_id 관련 코드를 삭제·수정·교체하지 않습니다.
- 새로운 코드/SQL을 생성할 때는 이 패턴을 절대 사용하지 않고,
  오직 JWT claim 기반 RLS(auth.jwt() ->> 'tenant_id')만 사용해야 합니다.

→ 상세 내용은 2-4, 2-5 섹션 참조


공통 유틸

withTenant() 함수 이름 및 역할

useResponsiveMode() 훅 이름 및 반환 스펙

toKST() (및 toUTC가 있을 경우)

구조/네이밍

packages/core/*, packages/industry/*, packages/services/*, packages/hooks/*

Edge Function 디렉토리 명은 kebab-case (예: payment-webhook, public-gateway-verify)

보안/키

Service Role 키는 항상 @env-registry/server의 envServer를 통해 주입 (envServer.SERVICE_ROLE_KEY)

프론트엔드 코드에서 Service Role Key 사용 금지

12. 지역 통계 및 지도 기능 규칙 (상용화 단계)

⚠️ 중요: 기본 지역 통계와 고급 기능은 상용화 단계에서 모두 구현 예정 (테이블 스키마 정의 완료, core_stores/core_regions 및 analytics.daily_store_metrics/daily_region_metrics 테이블 생성 마이그레이션 필요).

12-1. Kakao Maps API 사용 규칙

[불변 규칙] 주소 → 좌표 변환은 반드시 Kakao Local REST API를 사용하며, 서버/Edge Function에서만 수행합니다.

[불변 규칙] REST API 호출은 Next.js Server Components / Route Handlers / Supabase Edge Functions에서만 허용됩니다. Client Component에서는 절대 금지합니다.

[불변 규칙] Kakao Maps API Key는 클라이언트와 서버에서 분리하여 사용합니다:
- 클라이언트(프론트엔드): envClient.NEXT_PUBLIC_KAKAO_JS_KEY (JavaScript SDK용, 지도 표시 등)
- 서버/Edge Function: envServer.KAKAO_REST_API_KEY (REST API용, 주소→좌표 변환 등)

[불변 규칙] 절대 NEXT_PUBLIC_KAKAO_REST_API_KEY 같은 형태로 클라이언트에 REST API Key를 노출하면 안 됩니다.

[불변 규칙] 클라이언트에서는 Kakao JS SDK + JS_KEY만 사용하며, REST API 호출은 항상 서버/Edge에서 처리합니다.

[불변 규칙] Cursor는 Client Component에서 Kakao Local REST API를 호출하는 fetch() 요청을 절대 생성하지 않는다.

[불변 규칙] Cursor는 Client Component 안에서 'fetch("https://dapi.kakao.com")' 형태의 코드를 절대 생성하지 않는다.

[불변 규칙] GeoJSON은 [lng, lat] 배열이므로 Kakao Polygon 생성 시 반드시 (lat, lng)로 변환해야 합니다.

Kakao Maps API 사용 예시:

⚠️ 중요: 주소 → 좌표 변환(Kakao Local REST API)은 Next.js Server Components / Route Handlers / Supabase Edge Functions에서만 수행하며, REST API Key를 사용합니다.
클라이언트(Client Component)에서는 Kakao JS SDK + JS_KEY만 사용하며, REST API 호출은 절대 금지합니다.

✅ 서버/Edge Function 예시 (REST API 호출):
// services/store-service.ts
import { envServer } from '@env-registry/server';

export async function geocodeAddress(address: string) {
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    {
      headers: {
        'Authorization': `KakaoAK ${envServer.KAKAO_REST_API_KEY}`, // REST API Key는 서버 전용
      },
    }
  );
  // ...
}

✅ 클라이언트 예시 (JS SDK 사용):
// components/MapComponent.tsx
import { envClient } from '@env-registry/client';

// Kakao JS SDK 초기화
useEffect(() => {
  const script = document.createElement('script');
  script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${envClient.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false`;
  document.head.appendChild(script);
  // ...
}, []);

GeoJSON 좌표 변환 예시:

// GeoJSON은 [lng, lat] 순서이므로 Kakao LatLng(lat, lng)로 변환
const polygon = new kakao.maps.Polygon({
  path: feature.geometry.coordinates[0].map(([lng, lat]: [number, number]) =>
    new kakao.maps.LatLng(lat, lng)  // 순서 변환: [lng, lat] → LatLng(lat, lng)
  ),
  // ...
});

12-2. 지역 통계 익명화 규칙

[불변 규칙] 지역 통계는 store_count >= 3 조건을 만족할 때만 사용자에게 제공합니다.

조건 미충족 시 다음 에러를 반환합니다:

{
  "error": "INSUFFICIENT_SAMPLE",
  "message": "해당 지역의 통계는 매장 수 부족으로 제공되지 않습니다."
}

12-3. 지역 통계 쿼리 패턴

[불변 규칙] core_stores 테이블 쿼리는 반드시 withTenant()를 사용해야 합니다.

[불변 규칙] analytics.daily_region_metrics는 집계·익명화된 테이블이므로 RLS 정책이 다를 수 있습니다. 일반 사용자는 자기 업종 + 자기 지역의 통계만 조회 가능합니다.

지역 벤치마크 조회 예시:

// 1) 내 매장의 region / industry 정보 조회
const store = await withTenant(
  supabase
    .from('core_stores')
    .select('region_id, industry_type')
    .eq('id', storeId)
    .single(),
  tenantId,
);

// 2) region_id → region_code, level 매핑
const region = await supabase
  .from('core_regions')
  .select('level, code')
  .eq('id', store.region_id)
  .single();

// 3) 동일 업종 + 동일 지역 벤치마크
const benchmarks = await supabase
  .from('analytics.daily_region_metrics')
  .select('*')
  .eq('industry_type', store.industry_type)
  .eq('region_level', region.level)
  .eq('region_code', region.code)
  .gte('date_kst', range.from)
  .lte('date_kst', range.to);

13. 업종별 데이터 분리 전략 규칙 (Critical)

[불변 규칙] 기본 철학은 "단일 테이블 + industry_type 컬럼 + Soft Isolation"이며, 모든 확장 전략은 이 기본 구조를 유지하면서 선택적으로 분리하는 방식입니다.

핵심 원칙:
1. 기본 구조: 모든 업종이 public 스키마의 동일 테이블에 공존 (industry_type 컬럼으로 구분)
2. 확장 전략: 특정 업종의 데이터량/조회량이 폭증할 때만 해당 업종을 선택적으로 분리
3. 분리 범위: 전체 구조를 변경하지 않고, 필요한 업종만 선택적으로 분리
4. 일관성 유지: 분리된 업종도 동일한 스키마 구조와 비즈니스 로직을 유지

📌 업종별 데이터 분리 전환 기준표:

| 단계 | 분리 방식 | 전환 기준 (명확한 수치) | 설명 |
|------|----------|----------------------|------|
| 상용화 단계 | industry_type 컬럼 단일 테이블 | 테넌트 수 < 5,000<br>테이블 크기 < 50GB<br>단일 업종 row 수 < 1천만 | 기본 구조. 모든 업종이 public 스키마의 동일 테이블에 공존 |
| 상용화 단계 | industry_type 기반 파티셔닝 | 특정 업종 row 수 ≥ 1천만<br>또는 특정 업종 테이블 크기 ≥ 50GB<br>또는 특정 업종 QPS가 전체의 30% 초과 | SELECT 경로 차별화 용도. 예: `students_academy PARTITION OF students FOR VALUES IN ('academy')` |
| 상용화 단계 | 업종별 prefix 테이블 (선택적) | 업종 전용 도메인 테이블 필요 시<br>(Core Party 테이블과는 별개) | 업종 전용 도메인 테이블만. 예: `academy_classes`, `salon_customers` (Core Party 테이블과는 별개) |
| 선택적 구현 | 업종별 스키마 분리 | 테넌트 수 ≥ 20k<br>또는 Core 테이블(students/invoices) 단일 파티션 ≥ 200GB<br>또는 특정 업종 조회량이 전체의 50% 초과 | 조회량 편중 시. 예: `academy.students`, `salon.customers` |

⚠️ 중요: 위 기준 중 하나라도 도달하면 해당 업종만 선택적으로 분리합니다. 전체 구조를 변경하지 않고 필요한 업종만 분리하는 것이 핵심 원칙입니다.

[불변 규칙] Cursor는 industry-specific prefix 테이블(예: academy_*)을 자동 생성하지 않는다. 개발자가 명시 요청한 경우에만 생성한다.

→ 상세 내용은 기술문서 PART 1의 3-3 "스키마 분리" 섹션 참조

14. Hot Tenant 샤딩 트리거 기준 규칙 (초과 성장 시나리오, 현재 불필요)

⚠️ 중요: 이 규칙은 초과 성장 시나리오(수십만 테넌트)에서도 대규모 팀이 필요하며, 1인 개발사에서는 구현이 비현실적입니다.

[불변 규칙] 다음 기준 중 3개 이상을 동시에 만족하면 Hot Tenant 샤딩을 검토합니다:

1. 초당 요청 수 (QPS):
   - 단일 테넌트 QPS ≥ 1,000 req/s
   - 또는 단일 테넌트 QPS가 전체의 30% 초과 (7일 이동평균)

2. 월별 Row 증가량:
   - 단일 테넌트 월별 row 증가량 ≥ 1천만 rows/월
   - 또는 단일 테넌트 총 row 수가 전체의 20% 초과

3. 이벤트 Ingestion 속도:
   - 단일 테넌트 이벤트 ingestion 속도 ≥ 10,000 events/min
   - 또는 analytics.events 테이블에서 단일 테넌트 비중 ≥ 25%

4. CPU/IO 부하 기준:
   - 단일 테넌트 CPU 사용량이 전체의 25% 초과 (1시간 이동평균)
   - 단일 테넌트 IOPS가 전체의 30% 초과 (1시간 이동평균)
   - 단일 테넌트 DB 연결 수가 전체의 20% 초과

5. 트래픽 급증 패턴:
   - 5분 이동평균 대비 300% 증가가 3회 이상 발생
   - 또는 일일 트래픽이 전일 대비 200% 증가

⚠️ 중요: 위 기준 중 3개 이상을 동시에 만족하고, Read Replica로 트래픽 분산, 파티셔닝, 업종별 분리 전략으로 해결되지 않는 경우에만 Hot Tenant 샤딩을 검토합니다. 다만, 초과 성장 시나리오에서도 대규모 팀이 필요하므로 현재 불필요합니다.

→ 상세 내용은 기술문서 PART 1의 5-5-1 "Hot Tenant 수직 분리 절차" 섹션 참조

15. Custom Domain 운영 규칙 (Critical)

⚠️ 중요: Custom Domain은 실제 SaaS 운영에서 매우 빈번한 장애 유형이므로, 자동화 및 장애 대응 정책이 필수입니다.

[불변 규칙] ACME 인증 실패 시 자동 재시도 및 수동 개입 프로세스를 정의합니다.

[불변 규칙] DNS 연동 실패 시 지수 백오프 패턴으로 자동 재시도하며, 최대 재시도 횟수와 재시도 간격을 명확히 정의합니다.

[불변 규칙] 모든 활성 Custom Domain은 24시간마다 자동으로 DNS/SSL 상태를 재검증합니다.

[불변 규칙] Wildcard SSL 인증서는 특정 조건에서만 사용하며, 개별 인증서 발급이 불가능한 경우에만 Fallback으로 사용합니다.

[불변 규칙] 각 Custom Domain의 SSL 만료일을 모니터링하고, 만료 전 고객에게 알림을 발송합니다.

ACME 인증 재시도 정책:
- 재시도 횟수: 최대 5회
- 재시도 간격: 5분 → 10분 → 30분 → 1시간 → 2시간

DNS 재시도 정책:
- 재시도 횟수: 최대 10회
- 재시도 간격: 5분 → 10분 → 30분 → 1시간 → 2시간 → 4시간 → 8시간 → 12시간 → 24시간 → 48시간

SSL 만료 알림 정책:
- 30일 전: 1차 경고 알림 (이메일)
- 7일 전: 2차 경고 알림 (이메일 + SMS)
- 1일 전: 3차 Critical 알림 (이메일 + SMS + Slack 운영팀 알림)

→ 상세 내용은 기술문서 PART 8 "Custom Domain 운영 가이드" 참조

16. Mobile & Tablet UI/UX 규칙 (Critical)

⚠️ 중요: 기술문서에서 기능 구조는 아무리 좋아도, UI/UX 명세가 없으면 QA·개발 간 충돌이 반드시 발생합니다.

[불변 규칙] 모바일 환경에서는 테이블을 카드형 UI로 자동 전환하며, 확대보기(Zoom) 기능을 제공합니다.

[불변 규칙] 모바일 환경에서 작은 텍스트나 상세 정보를 확인하기 위해 확대보기 기능을 제공합니다.

[불변 규칙] 모바일 환경에서 키패드와 버튼은 터치하기 쉬운 크기와 간격을 유지합니다.

[불변 규칙] 태블릿 환경에서는 ui-core `DataTable`의 컴팩트 모드를 사용하여 화면 공간을 효율적으로 활용합니다.

[불변 규칙] 모바일 환경에서는 하단 네비게이션 바를 사용하여 주요 기능에 빠르게 접근할 수 있도록 합니다.

[불변 규칙] 모바일 환경에서 폼 입력은 자동 완성, 입력 검증, 오류 메시지를 명확히 제공합니다.

[불변 규칙] 모바일 환경에서는 이미지 지연 로딩, 가상 스크롤, 코드 스플리팅을 적용하여 성능을 최적화합니다.

[불변 규칙] 모바일 환경에서도 웹 접근성 표준(WCAG 2.1 AA)을 준수합니다.

전환 규칙:
- 화면 너비 < 768px (모바일): ui-core `DataTable` (컴팩트 모드) 또는 카드 레이아웃
- 화면 너비 768px ~ 1024px (태블릿): ui-core `DataTable` (컴팩트 모드)
- 화면 너비 > 1024px (데스크톱): ui-core `DataTable` (기본 모드)

버튼 최소 크기:
- 높이: 최소 44px (iOS HIG 기준)
- 너비: 최소 44px (터치 타겟)
- 간격: 버튼 간 최소 8px

확대보기 범위:
- 최소: 100% (원본 크기)
- 최대: 200% (2배 확대)
- 기본: 100%

→ 상세 내용은 기술문서 PART 7 "Mobile & Tablet UI/UX 설계 규칙" 참조
