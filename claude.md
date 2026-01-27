# SAMDLE 프로젝트 - Claude/AI 작업 가이드

**프로젝트**: SAMDLE (디어쌤)
**설명**: 멀티테넌트 학원 관리 SaaS 플랫폼
**기술 스택**: React 18, TypeScript, Vite, Supabase, Turbo Monorepo
**프로젝트 성격**: 프로덕션 SaaS, 멀티테넌트, 업종 중립 설계
**최종 업데이트**: 2026-01-26
**버전**: 1.0.0

---

## 🎯 AI 작업 시 필수 원칙 (P0 - Critical)

> **⚠️ 중요**: AI 에이전트는 이 규칙들을 "절대 변경하지 않는다"고 가정하고 모든 코드를 생성합니다.

### 1. **멀티테넌트 보안 (Zero-Trust)**
- ✅ **RLS 필수**: 모든 테이블에 `tenant_id` 기반 RLS 정책 적용
- ✅ **withTenant() 필수**: 모든 쿼리에 `withTenant(tenantId)` 적용
- ✅ **Zero-Trust**: 모든 권한 검증은 서버/Edge Function에서 수행
- ❌ 프론트엔드에서 권한 판단 금지

### 2. **파일 생성 규칙 (Critical)**
- ❌ `.md`, `.txt` 파일 자동 생성 **절대 금지**
- ✅ **예외**: 사용자가 명시적으로 요청한 경우에만 생성 가능
- ✅ 기존 문서 수정은 허용
- **이유**: 문서는 개발자가 직접 작성/관리, 문서 중복 방지, 품질 보장

### 3. **업종 중립성 (Industry Neutrality)**
- ❌ 하드코딩된 업종 용어 금지 (학생, 강사, 학원 등)
- ✅ Industry Adapter 사용하여 동적 용어 변환
- ✅ `useIndustryTerms()` 훅으로 용어 조회
- 📖 **참조**: `docu/Industry_Neutrality.md`

### 4. **데이터 접근 패턴**
- ❌ React 컴포넌트에서 Supabase 직접 호출 금지
- ✅ API SDK (`@api-sdk/core`) 경유 필수
- ✅ React Query + Service Layer 사용
- ✅ 모든 쿼리에 `withTenant(tenantId)` 적용

### 5. **UI 컴포넌트 규칙**
- ✅ `packages/ui-core` 컴포넌트만 사용
- ❌ 커스텀 UI 컴포넌트 생성 금지
- ✅ SSOT 준수 (`docu/SSOT_UI_DESIGN.md`)
- ✅ 반응형 디자인: `useResponsiveMode()` 훅 사용

### 6. **환경변수 관리**
- ❌ `process.env` 직접 접근 금지
- ✅ 서버/Edge: `@env-registry/server` (envServer) 사용
- ✅ 클라이언트: `@env-registry/client` (envClient) 또는 `NEXT_PUBLIC_*` 사용
- ❌ 클라이언트 코드에서 `envServer` import 절대 금지

### 7. **타임존 규칙**
- ✅ 모든 날짜/시간은 **KST 기준** 처리
- ✅ `@lib/date-utils` 사용 (`toKST`, `getTodayKST`)
- ❌ `.toISOString().split('T')[0]` 직접 사용 금지

### 8. **TypeScript 타입 안전성**
- ❌ `any` 타입 사용 금지
- ✅ 명확한 타입 정의 필수
- ✅ Zod 스키마 검증 활용

### 9. **불변 키워드/패턴 (절대 변경 금지)**
- ❌ `tenant_id` 컬럼명 변경 금지
- ❌ `app.current_tenant_id` (PostgreSQL 설정 키) 변경 금지
- ❌ `withTenant()` 함수명 변경 금지
- ❌ `useResponsiveMode()` 훅명 변경 금지
- ❌ 표준 RLS 정책 패턴 변경 금지
- ❌ 날짜/시간 변환 헬퍼(`toKST`, `toUTC`) 변경 금지

---

## 📂 모노레포 구조 (빠른 참조)

```
SAMDLE/
├── apps/
│   ├── academy-admin/        # 학원 관리자 대시보드 (메인 앱)
│   ├── super-admin/          # 플랫폼 관리자 (스키마 편집, 성능 모니터링)
│   ├── academy-parent/       # 학부모 포털
│   └── public-gateway/       # 공개 API
│
├── packages/
│   ├── core/*                # 23개 도메인 패키지 (auth, billing, payment, etc.)
│   ├── industry/*            # 업종별 비즈니스 로직 (industry-academy)
│   ├── services/*            # 서비스 레이어 (Industry Layer 래핑)
│   ├── hooks/*               # 34개 React Query 훅
│   ├── ui-core/              # UI 컴포넌트 라이브러리 (80+ 컴포넌트)
│   ├── lib/                  # 공통 유틸리티
│   │   ├── date-utils/       # KST 타임존 헬퍼
│   │   ├── supabase-client/  # Supabase 클라이언트 유틸
│   │   └── ...
│   ├── schema-engine/        # 동적 폼/테이블 생성 엔진
│   ├── api-sdk/              # API SDK (중앙화된 데이터 접근)
│   └── env-registry/         # 환경변수 관리 (server/client/common)
│
├── docu/                     # 프로젝트 문서 (40개 문서)
├── docs/archive/             # 아카이브 문서 (50+ 구현 보고서)
└── infra/supabase/           # Supabase 인프라 (마이그레이션, Edge Functions)
```

---

## 🏗️ 핵심 아키텍처 패턴

### 1. **레이어 아키텍처 (계층 구조)**
```
UI Layer (apps/*, @ui-core)
    ↓
Hooks Layer (packages/hooks/*)
    ↓
Service Layer (packages/services/*)
    ↓
Industry Layer (packages/industry/*)
    ↓
Core Layer (packages/core/*)
    ↓
Database (Supabase)
```

**레이어 분류 규칙**:
- **UI Core Component** (`packages/ui-core/*`): 시각/레이아웃/인터랙션 프리미티브, 비즈니스 규칙 없음
- **Shared Feature** (`apps/*/features/*`): 여러 페이지 재사용 플로우, UI + 상태 + 정책
- **Shared Hook** (`packages/hooks/*`): React Query/상태 캡슐화, UI 렌더링 금지
- **Service/UseCase** (`packages/services/*`): 도메인 로직/데이터 접근, UI/Router 의존 금지
- **Domain/Service** (`packages/industry/*`, `packages/core/*`): 비즈니스 로직
- **Cross-cutting Concern** (`packages/lib/*`, `@env-registry/*`): 전 영역 공통 규칙

**의존성 방향 규칙**:
- ✅ 허용: `apps/* → hooks/* → services/* → industry/* → core/* → DB`
- ✅ 허용: `industry-* → core/*`
- ❌ 금지: `core/* → industry-*` (역방향)
- ❌ 금지: `industry-* → industry-*` (업종 간 의존성)
- ❌ 금지: React 컴포넌트 → Supabase 직접 호출
- ❌ 금지: React 컴포넌트 → DB 쿼리/SQL 직접 작성

### 2. **SSOT (Single Source of Truth)**
- **API SDK**: `@api-sdk/core`를 통한 중앙화된 데이터 접근
- **UI 컴포넌트**: `packages/ui-core` 카탈로그
- **환경변수**: `@env-registry/*`
- **디자인 시스템**: `docu/SSOT_UI_DESIGN.md`
- **업종 중립성**: `docu/Industry_Neutrality.md`

### 3. **Industry Neutrality (업종 중립 설계)**
- 동적 용어 변환 (학생 ↔ 고객 ↔ 회원)
- Industry Adapter 패턴
- 업종별 필드 커스터마이징
- 새 업종 추가 시 Tool 코드 수정 불필요

### 4. **Schema-Driven UI (SDUI)**
- 동적 폼 생성 엔진
- 스키마 검증 및 미리보기
- Semantic diff viewer
- Condition editor (동적 조건 처리)

### 5. **Agent 기반 시스템 (ChatOps)**
- 자연어 명령 처리
- LLM Function Calling
- Execution Audit (작업 추적)
- Intent Pattern 커스터마이징

### 6. **Automation & AI Engine 규칙 (SSOT)**
- ✅ Automation Engine과 AI Engine은 **core 레이어에만** 존재
- ❌ industry 레이어에서 Automation/AI 엔진 구현 **절대 금지**
- ✅ industry 레이어에서는 **Adapter 또는 Schema Override만 허용**
- **목적**: 업종별 AI/자동화 엔진 중복 방지, 플랫폼 레벨 일관성 유지

---

## 📊 데이터 페칭 규칙 (React Query 패턴)

### 필수 규칙
1. **React Query 사용 필수**: 직접 fetch 금지
2. **API SDK 경유**: `@api-sdk/core`를 통한 모든 API 호출
3. **withTenant() 필수**: 모든 쿼리에 적용
4. **캐시 전략**:
   - Policy 캐시: 5분
   - 통계 데이터: 1시간
   - 실시간 데이터: staleTime 0

### Query Key 네이밍 패턴
```typescript
// ✅ 표준 패턴
const queryKey = [tenant_id, 'students', filters];
const queryKey = [tenant_id, 'attendance', 'daily', date];

// ❌ 잘못된 패턴
const queryKey = ['students']; // tenant_id 누락
```

### 데이터 페칭 예시
```typescript
// ✅ 올바른 패턴
import { useStudent } from '@hooks/use-student';

function StudentList() {
  const { data, isLoading } = useStudent.useList(tenantId, filters);
  // ...
}
```

```typescript
// ❌ 잘못된 패턴
import { createClient } from '@supabase/supabase-js';

function StudentList() {
  const supabase = createClient(...);
  const { data } = await supabase.from('students').select(); // 직접 호출 금지
}
```

📖 **상세 가이드**: `docu/React_Query_표준_패턴.md`

---

## 🎨 UI 컴포넌트 사용 규칙

### UI Core 컴포넌트 카탈로그 (80+ 컴포넌트)

**레이아웃**:
- `AppLayout`, `Sidebar`, `SubSidebar`, `Container`, `Grid`
- `SplitTableLayout`, `RightLayerMenuLayout`

**입력**:
- `Input`, `Textarea`, `NumberInput`, `TimeInput`, `DateInput`, `DatePicker`
- `Select`, `Checkbox`, `Radio`, `Switch`
- `AddressInput`, `SearchInput`

**데이터 표시**:
- `DataTable` (필터링/정렬 지원)
- `TableCardView` (카드 뷰)
- `VirtualList` (대용량 데이터)
- `Pagination`

**특수 컴포넌트**:
- `AILayerMenu` (AI 어시스턴트 패널)
- `ChatOpsPanel` (ChatOps 인터페이스)
- `ExecutionAuditPanel` (작업 추적)
- `GlobalSearchDropdown` (전역 검색)

**표시**:
- `Card`, `Badge`, `Avatar`, `Tooltip`, `Popover`
- `Modal`, `Drawer`, `Toast`, `Spinner`, `Skeleton`

### 사용 원칙
- ✅ `@ui-core/react`에서 import
- ❌ 커스텀 컴포넌트 생성 금지
- ✅ 필요한 경우 UI Core에 먼저 추가 후 사용
- ✅ SSOT 규칙 준수

📖 **컴포넌트 카탈로그**: `packages/ui-core/src/ssot/README.md`
📖 **디자인 시스템**: `docu/SSOT_UI_DESIGN.md`

---

## 🔐 보안 & 권한 규칙

### RLS (Row-Level Security) 필수
```sql
-- ✅ 모든 테이블에 RLS 정책 적용
CREATE POLICY "tenant_isolation"
  ON students
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### withTenant() 사용 패턴

**⚠️ 중요**: SELECT와 INSERT의 패턴이 다릅니다!

```typescript
// ✅ 올바른 패턴 (SELECT - withTenant() 체이닝)
const { data } = await supabase
  .from('students')
  .select()
  .withTenant(tenantId);

// ✅ 올바른 패턴 (UPDATE - withTenant() 체이닝)
const { data } = await supabase
  .from('students')
  .update({ status: 'active' })
  .eq('id', studentId)
  .withTenant(tenantId);

// ✅ 올바른 패턴 (DELETE - withTenant() 체이닝)
const { data } = await supabase
  .from('students')
  .delete()
  .eq('id', studentId)
  .withTenant(tenantId);

// ✅ 올바른 패턴 (INSERT - row object에 tenant_id 직접 포함)
const { data } = await supabase
  .from('students')
  .insert({
    tenant_id: tenantId,  // INSERT는 여기에 직접 포함!
    name: 'John Doe',
    // ...
  });

// ❌ 잘못된 패턴 (SELECT/UPDATE/DELETE)
const { data } = await supabase
  .from('students')
  .select(); // withTenant() 누락!

// ❌ 잘못된 패턴 (INSERT)
const { data } = await supabase
  .from('students')
  .insert({ name: 'John Doe' })
  .withTenant(tenantId); // INSERT는 withTenant() 체이닝 불가!
```

### Zero-Trust 원칙
- ✅ 모든 권한 검증은 서버/Edge Function에서 수행
- ❌ 프론트엔드에서 권한 판단 금지
- ✅ RLS 정책으로 2차 검증

---

## 📋 작업 유형별 필수 문서

### 백엔드 작업
1. `docu/rules.md` - RLS, withTenant 규칙
2. `docu/Industry_Neutrality.md` - Industry Adapter 패턴
3. `docu/Agent_계약검증.md` - 6대 계약 검증

### 프론트엔드 작업
1. `docu/SSOT_UI_DESIGN.md` - UI 디자인 시스템
2. `docu/React_Query_표준_패턴.md` - 데이터 페칭
3. `docu/Industry_Neutrality.md` - 업종 중립 UI

### ChatOps/AI 작업
1. `docu/Agent_아키텍처_전환.md` - Agent 개요
2. `docu/Agent_파라미터_추출.md` - LLM Function Calling
3. `docu/챗봇_성능최적화.md` - 성능 최적화

### 테스트 작업
1. `docu/TESTING.md` - 유닛/E2E 테스트 가이드
2. `docu/프로젝트_자동화_가이드.md` - CI/CD 파이프라인

### 전체 문서 인덱스
📖 `docu/README.md` - 40개 문서 가이드 (역할별, 주제별 분류)

---

## ✅ AI 작업 완료 체크리스트

작업 완료 전 아래 항목을 확인하세요:

### P0 (보안 & 필수)
- [ ] RLS 정책이 모든 새 테이블에 적용되었는가?
- [ ] `withTenant()`가 모든 쿼리에 포함되었는가?
- [ ] `.md`, `.txt` 파일을 자동 생성하지 않았는가?
- [ ] 환경변수 접근 시 `@env-registry/*` 사용했는가?
- [ ] 클라이언트 코드에서 `envServer` import 하지 않았는가?

### P1 (아키텍처 & 패턴)
- [ ] 하드코딩된 업종 용어(학생/강사 등)가 없는가?
- [ ] UI Core 컴포넌트를 사용했는가?
- [ ] React Query를 사용하여 데이터를 페칭했는가?
- [ ] API SDK를 경유하여 데이터에 접근했는가?
- [ ] Industry Adapter 패턴을 따랐는가?

### P2 (품질 & 유지보수)
- [ ] TypeScript 타입이 명확하게 정의되었는가? (`any` 금지)
- [ ] KST 타임존 규칙을 따랐는가?
- [ ] 레이어 아키텍처 의존성 방향을 준수했는가?
- [ ] 린트 에러가 없는가? (`npm run lint`)
- [ ] 타입 체크가 통과하는가? (`npm run type-check`)

---

## ❌ 금지 사항 (절대 하지 말아야 할 것)

### 데이터 접근
- ❌ React 컴포넌트에서 Supabase 직접 호출
- ❌ `withTenant()` 없이 쿼리 실행
- ❌ 프론트엔드에서 권한 판단

### 업종 중립성
- ❌ 업종 하드코딩 (학생, 강사, 학원 등 고정 용어)
- ❌ 업종별 분기 로직 (Industry Adapter 사용해야 함)

### UI 컴포넌트
- ❌ 커스텀 UI 컴포넌트 생성 (UI Core 사용)
- ❌ 임의 px/hex 하드코딩 (Design Tokens 사용)
- ❌ 직접 CSS 스타일링 (Tailwind/Design System 사용)

### 환경변수
- ❌ `process.env` 직접 접근 (서버/Edge에서)
- ❌ 클라이언트 코드에서 `envServer` import
- ❌ 환경변수 하드코딩

### 파일 생성
- ❌ `.md`, `.txt` 파일 자동 생성
- ❌ 문서 파일 자동 생성

### 타입 & 코드 품질
- ❌ `any` 타입 사용
- ❌ `tenant_id`, `withTenant()` 등 핵심 키워드 변경
- ❌ `.toISOString()` 직접 사용 (KST 변환 필수)

### 아키텍처
- ❌ RLS 정책 없는 테이블 생성
- ❌ `core/* → industry-*` 의존성 (역방향 금지)
- ❌ React 컴포넌트에서 DB 쿼리/SQL 직접 작성
- ❌ industry 레이어에서 Automation/AI 엔진 구현 (core 레이어에만 허용)

---

## 🚀 빠른 명령어

```bash
# 개발 서버 실행
npm run dev              # 모든 앱 실행
npm run dev:admin        # academy-admin만 실행
npm run dev:super        # super-admin만 실행
npm run dev:parent       # academy-parent만 실행
npm run dev:gateway      # public-gateway만 실행

# 빌드 및 검증
npm run build            # 전체 빌드
npm run lint             # 린트 검사
npm run type-check       # TypeScript 타입 체크

# 테스트
npm run test             # 모든 테스트 실행
npm run test:unit        # 단위 테스트
npm run test:e2e         # E2E 테스트
npm run test:a11y        # 접근성 테스트

# 유틸리티
npm run clean            # 빌드 캐시 정리
```

---

## 🔧 환경변수 사용 패턴

### 서버/Edge 코드 (올바른 패턴)
```typescript
// ✅ 서버/Edge Function에서 환경변수 사용
import { envServer } from '@env-registry/server';

const supabase = createClient(
  envServer.SUPABASE_URL,
  envServer.SERVICE_ROLE_KEY
);
```

### 클라이언트 코드 (올바른 패턴)
```typescript
// ✅ 클라이언트에서 환경변수 사용
import { envClient } from '@env-registry/client';

const supabaseUrl = envClient.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envClient.NEXT_PUBLIC_SUPABASE_ANON_KEY;
```

### 금지 패턴
```typescript
// ❌ 서버에서 process.env 직접 접근
const url = process.env.SUPABASE_URL; // 금지

// ❌ 클라이언트에서 envServer import
import { envServer } from '@env-registry/server'; // 금지 (보안 위험)

// ❌ 클라이언트에서 NEXT_PUBLIC_ 없는 환경변수
const apiKey = process.env.API_KEY; // 금지
```

---

## 📅 타임존 처리 (KST)

### 올바른 패턴
```typescript
// ✅ KST 타임존 헬퍼 사용
import { toKST, getTodayKST, getDateRangeKST } from '@lib/date-utils';

const nowKst = toKST(); // KST 기준 현재 시간
const today = getTodayKST(); // 'YYYY-MM-DD' (KST 기준)
const range = getDateRangeKST(startDate, endDate);
```

### 금지 패턴
```typescript
// ❌ 직접 ISO 문자열 변환
const today = new Date().toISOString().split('T')[0]; // 금지 (UTC 기준)

// ❌ 직접 slice 사용
const dateStr = new Date().toISOString().slice(0, 10); // 금지
```

**중요**: 모든 날짜/시간은 DB에는 UTC로 저장하되, 비즈니스 로직/표시/집계는 KST 기준으로 처리합니다.

---

## 🏢 프로젝트 특수사항

### 1. **멀티테넌트 SaaS**
- 모든 데이터는 `tenant_id`로 격리
- RLS 정책으로 데이터 보호
- `withTenant()`로 테넌트 컨텍스트 주입

### 2. **KST 타임존**
- 모든 날짜/시간은 KST 기준
- `@lib/date-utils` 사용 필수
- DB 저장은 UTC, 표시는 KST

### 3. **PII 마스킹 제거 (2026-01-14)**
- AI 기능에서 PII 마스킹 완전 제거
- 구체적이고 상세한 정보 제공
- 관리자 운영 효율성 개선
- 📖 **변경 이력**: `docu/CHANGELOG_PII_MASKING_REMOVAL.md`

### 4. **Execution Audit**
- 모든 중요 작업은 audit trail 기록
- Operation → Details → Steps 구조
- 타임라인 시각화 지원

### 5. **ChatOps/Agent 시스템**
- 자연어 명령 처리 시스템
- LLM Function Calling 기반
- Intent Pattern 커스터마이징 가능
- 실시간 진행 상황 스트리밍

### 6. **업종 확장 지원**
- 현재: 학원 업종 (industry-academy)
- 향후: 피트니스, 학교 등 확장 가능
- Industry Adapter 패턴으로 새 업종 추가 시 Tool 코드 수정 불필요

### 7. **Vercel 배포 & Turbo 설정 (2026-01-27)**

#### 문제 배경
Vercel은 루트에 `turbo.json`이 있으면 자동으로 Turbo를 감지하고 자체 내장 Turbo로 파싱합니다.
Vercel의 내장 Turbo가 구버전이라 Turbo v2 형식(`tasks` 키)을 인식하지 못하는 문제가 발생합니다.

#### 현재 해결책
1. **`turbo.json`을 `.gitignore`에 추가** - Vercel이 클론 시 파일이 없으므로 Turbo 감지 안 함
2. **`turbo.json.template`에 설정 보관** - 실제 Turbo 설정 내용
3. **로컬에서 `npm run preturbo`로 복사** - `turbo.json.template` → `turbo.json`

#### 관련 파일
- `.gitignore` - `turbo.json` 제외
- `turbo.json.template` - Turbo v2 설정 (`tasks` 형식)
- `package.json` - `preturbo` 스크립트로 template 복사
- `apps/*/vercel.json` - 각 앱별 Vercel 빌드 설정

#### Vercel 빌드 오류 발생 시 체크리스트
1. **`turbo.json` 관련 오류** (`Found an unknown key 'tasks'`):
   - `turbo.json`이 git에 추가되었는지 확인 → `.gitignore`에 있어야 함
   - `turbo.json.template`이 존재하는지 확인

2. **모듈을 찾을 수 없음** (`Cannot find module 'xxx'`):
   - 해당 패키지가 앱의 `package.json` dependencies에 있는지 확인
   - 루트에만 있고 앱에 없으면 Vercel에서 찾지 못함

3. **`workspace:*` 오류**:
   - npm은 `workspace:*` 프로토콜 미지원
   - `file:../../path` 형식으로 변경 필요

#### 로컬 개발 시
```bash
# turbo.json이 없으면 template에서 복사
npm run preturbo

# 또는 개별 스크립트 실행 (preturbo 자동 호출)
npm run dev
npm run build
```

---

## 📚 추가 참고 자료

### 핵심 문서 (우선순위 높음 - 반드시 읽기)
- **`docu/rules.md`** - 프로젝트 구조, 의존성, 네이밍, 보안 규칙 ⭐⭐⭐⭐⭐ (SSOT)
- **`docu/Industry_Neutrality.md`** - 업종 중립성 핵심 원칙 ⭐⭐⭐⭐⭐ (SSOT)
- **`docu/SSOT_UI_DESIGN.md`** - UI 디자인 시스템 ⭐⭐⭐⭐⭐ (SSOT)
- **`docu/체크리스트.md`** - P0/P1/P2 필수 체크리스트 ⭐⭐⭐⭐⭐
- **`docu/React_Query_표준_패턴.md`** - React Query 캐시 전략 ⭐⭐⭐⭐⭐

### 아키텍처 & 시스템
- `docu/디어쌤_아키텍처.md` - 전체 시스템 아키텍처
- `docu/Agent_아키텍처_전환.md` - Agent 기반 시스템 개요
- `docu/Agent_파라미터_추출.md` - LLM Function Calling
- `docu/Agent_계약검증.md` - 6대 계약 검증 + 배포 전 검증

### 자동화 & 테스트
- `docu/TESTING.md` - 유닛/E2E 테스트 가이드
- `docu/프로젝트_자동화_가이드.md` - CI/CD 파이프라인 (41개 검증 명령어)
- `docu/프론트 자동화.md` - 프론트엔드 자동화 (Policy 기반 UI)

### 성능 & 운영
- `docu/챗봇_성능최적화.md` - ChatOps 응답 시간/비용 최적화
- `docu/챗봇.md` - ChatOps 시스템 전체 가이드
- `docu/핸들러 구현.md` - Execution Audit Handler 구현

### 전체 문서 인덱스
- `docu/README.md` - 40개 문서 가이드 (역할별, 주제별, 우선순위별 분류)
- `docs/archive/` - 50+ 구현 보고서 및 검증 문서

---

## 💡 Claude Code 사용 팁

### ⚠️ 중요: 문서 읽기 패턴
Claude Code는 마크다운 링크를 **자동으로 따라가지 않습니다**. 작업 전 관련 문서를 **명시적으로 읽어야** 합니다.

**프롬프트 예시**:

**백엔드 작업**:
```
백엔드 작업을 해야 해.
다음 문서들을 순서대로 읽고 규칙을 따라줘:
1. docu/rules.md (RLS, withTenant 규칙)
2. docu/Industry_Neutrality.md (Industry Adapter 패턴)
3. docu/Agent_계약검증.md (6대 계약 검증)
```

**프론트엔드 작업**:
```
프론트엔드 작업을 해야 해.
다음 문서들을 읽고 규칙을 따라줘:
1. docu/SSOT_UI_DESIGN.md (UI 디자인 시스템)
2. docu/React_Query_표준_패턴.md (데이터 페칭)
3. docu/Industry_Neutrality.md (업종 중립 UI)
```

**전체 문서 탐색 (Explore Agent)**:
```
docu/ 폴더의 모든 문서를 탐색해서 [작업 내용]에 관련된 규칙과 패턴을 찾아줘.
```

### 작업 시작 전 체크
1. ✅ 이 문서 (claude.md)를 먼저 읽었는가?
2. ✅ 작업 유형에 맞는 필수 문서를 읽었는가?
3. ✅ 체크리스트 항목을 숙지했는가?
4. ✅ 금지 사항을 이해했는가?

---

## 📞 문제 해결 & 지원

### 문서 관련
- 문서 오류 발견: GitHub Issue 생성 (Label: `documentation`)
- 긴급 문서 업데이트: PR 생성
- 문서 질문: GitHub Issue 생성

### 개발 관련
- 버그 리포트: GitHub Issue 생성 (Label: `bug`)
- 기능 요청: GitHub Issue 생성 (Label: `enhancement`)
- 보안 이슈: 별도 보안 채널 사용

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2026-01-26
**작성**: Claude Sonnet 4.5
**목적**: AI 에이전트(Claude Code)가 SAMDLE 프로젝트에서 작업할 때 필수 컨텍스트 제공
