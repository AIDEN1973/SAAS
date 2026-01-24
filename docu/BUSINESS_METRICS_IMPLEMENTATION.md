# 📊 비즈니스 메트릭 구현 완료 보고서

**날짜**: 2026-01-24
**상태**: ✅ Phase 1-3 전체 완료

---

## 📋 구현 내용

### Phase 1: 테넌트 관리 (완료)
### Phase 2: 비즈니스 메트릭 대시보드 (완료)
### Phase 3: 매출 & 지역 분석 (완료)

---

## 🗄️ Backend 구현

### 1. 신규 테이블 (3개)

#### A. user_login_logs
```sql
-- 로그인 추적
CREATE TABLE public.user_login_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  tenant_id uuid REFERENCES tenants(id),
  login_at timestamptz DEFAULT NOW(),
  ip_address inet,
  user_agent text
);
```

**용도**: 테넌트별 활성도, 마지막 로그인 추적

---

#### B. subscriptions
```sql
-- 구독 관리
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  plan text CHECK (plan IN ('basic', 'premium', 'enterprise')),
  status text CHECK (status IN ('active', 'canceled', 'expired', 'trial')),
  price_monthly numeric DEFAULT 0,
  started_at timestamptz,
  expires_at timestamptz
);
```

**용도**: MRR, ARR, Churn Rate 계산

---

#### C. billing_events
```sql
-- 과금 이벤트
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY,
  subscription_id uuid REFERENCES subscriptions(id),
  tenant_id uuid REFERENCES tenants(id),
  event_type text CHECK (event_type IN ('charge', 'refund', 'upgrade', 'downgrade', 'cancel')),
  amount numeric,
  occurred_at timestamptz DEFAULT NOW()
);
```

**용도**: 월별 매출 추이, 신규/해지 추적

---

### 2. RPC 함수 (9개)

| Phase | 함수명 | 용도 |
|-------|--------|------|
| **Phase 1** | `get_tenants_with_stats()` | 테넌트 목록 + 기본 통계 |
| | `get_tenant_detail(tenant_id)` | 테넌트 상세 정보 |
| **Phase 2** | `get_business_metrics()` | 플랫폼 전체 메트릭 |
| | `get_tenant_health_scores()` | 테넌트 건강도 스코어링 |
| **Phase 3** | `get_revenue_analytics(start, end)` | 매출 분석 (MRR, ARR, Churn) |
| | `get_regional_analytics()` | 지역별 통계 |

---

## 🖥️ Frontend 구현

### 1. Hooks (1개 파일, 6개 함수)

**파일**: [apps/super-admin/src/hooks/useBusinessMetrics.ts](../apps/super-admin/src/hooks/useBusinessMetrics.ts)

```typescript
// Phase 1
useTenants()              // 테넌트 목록
useTenantDetail(id)       // 테넌트 상세

// Phase 2
useBusinessMetrics()      // 전체 메트릭
useTenantHealthScores()   // 건강도

// Phase 3
useRevenueAnalytics()     // 매출 분석
useRegionalAnalytics()    // 지역별 분석
```

---

### 2. Pages (4개)

#### A. TenantsPage (Phase 1)
- **경로**: `/tenants`
- **기능**:
  - 테넌트 카드 레이아웃 (그리드)
  - 테넌트명, 업종, 플랜, 상태 표시
  - 사용자 수, 학생 수, 출결 활동 (7일)
  - 마지막 로그인 건강도 표시
  - 클릭 시 상세 모달

**UI 스크린샷**:
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ vanessa         │ │ test-academy    │ │ my-academy      │
│ academy         │ │ academy         │ │ academy         │
│ ┌─────┐ ┌─────┐ │ │ ┌─────┐ ┌─────┐ │ │ ┌─────┐ ┌─────┐ │
│ │BASIC│ │active│ │ │ │BASIC│ │active│ │ │ │BASIC│ │active│ │
│ └─────┘ └─────┘ │ │ └─────┘ └─────┘ │ │ └─────┘ └─────┘ │
│                 │ │                 │ │                 │
│ 사용자: 6명      │ │ 사용자: 0명      │ │ 사용자: 0명      │
│ 학생: 4명        │ │ 학생: 0명        │ │ 학생: 0명        │
│ 출결: 13건       │ │ 출결: 0건        │ │ 출결: 0건        │
│ 마지막: 2시간 전  │ │ 마지막: 없음     │ │ 마지막: 없음     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

#### B. BusinessMetricsPage (Phase 2)
- **경로**: `/business-metrics`
- **기능**:
  - 플랫폼 개요 (총/활성/신규/위험 테넌트)
  - 사용자 활동 (DAU, WAU, MAU)
  - 플랜 분포 (basic/premium/enterprise)
  - 테넌트 건강도 요약 (정상/주의/위험)
  - 건강도 상세 테이블 (점수, 로그인, 활동)

**KPI 카드**:
```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 총 테넌트     │ │ 활성 테넌트   │ │ 신규 (이번 달)│ │ 이탈 위험     │
│     3개       │ │    3개 (100%) │ │     0개       │ │     2개 ⚠️    │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

---

#### C. RevenueAnalyticsPage (Phase 3)
- **경로**: `/revenue`
- **기능**:
  - MRR (Monthly Recurring Revenue)
  - ARR (Annual Recurring Revenue)
  - MRR 성장률
  - Churn Rate (해지율)
  - 월별 매출 추이 테이블

**데이터 없음 안내**:
```
⚠️ 매출 데이터가 없습니다
구독이 생성되고 과금 이벤트가 발생하면 데이터가 표시됩니다.
```

---

#### D. RegionalAnalyticsPage (Phase 3)
- **경로**: `/regional`
- **기능**:
  - 전국 요약 (총 테넌트, 학생, 매출)
  - 지역별 상세 테이블 (테넌트 수, 학생 수, 평균, 시장 점유율)
  - 지역별 테넌트 분포 시각화 (카드 + 프로그레스 바)

**데이터 소스**: `daily_region_metrics` 테이블

---

### 3. Navigation 업데이트

**기존**:
- 스키마 에디터
- 성능 모니터링

**추가**:
- ✅ 테넌트 관리
- ✅ 비즈니스 메트릭
- ✅ 매출 분석
- ✅ 지역별 분석

---

## 📊 데이터 흐름

### Phase 1: 테넌트 목록
```
User → TenantsPage
  → useTenants()
    → Supabase RPC: get_tenants_with_stats()
      → JOIN: tenants + user_tenant_roles + user_login_logs + academy_students + attendance_logs
        → Return: 테넌트별 통계
```

### Phase 2: 비즈니스 메트릭
```
User → BusinessMetricsPage
  → useBusinessMetrics()
    → Supabase RPC: get_business_metrics()
      → Aggregate: 플랫폼 전체 통계
        → Return: platform_overview, plan_distribution, user_activity, health_summary
```

### Phase 3: 매출 분석
```
User → RevenueAnalyticsPage
  → useRevenueAnalytics(startDate, endDate)
    → Supabase RPC: get_revenue_analytics(p_start_date, p_end_date)
      → SUM: subscriptions.price_monthly
      → JOIN: billing_events
        → Return: MRR, ARR, Churn Rate, monthly_revenue[]
```

---

## 🎯 건강도 스코어 알고리즘

```typescript
초기 점수: 100점

로그인 활동:
  - 30일 이상 미접속: -40점 (🔴 Critical)
  - 7~30일 미접속: -20점 (⚠️ Warning)

사용자 수:
  - 0명: -30점
  - 1명: -10점

데이터 활동:
  - 학생 0명: -20점
  - 출결 0건 (7일): -10점

최종 점수:
  - 80점 이상: 🟢 정상 (healthy)
  - 50~79점: ⚠️ 주의 (warning)
  - 49점 이하: 🔴 위험 (critical)
```

---

## 🔒 보안 (RLS 정책)

### 모든 신규 테이블

```sql
-- Super Admin만 조회 가능
CREATE POLICY "Super admins can view"
  ON public.{table_name}
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
```

**적용 테이블**:
- `user_login_logs`
- `subscriptions`
- `billing_events`

---

## 📁 파일 목록

### Backend (Migrations)
- ✅ [infra/supabase/supabase/migrations/202601XX_create_business_metrics_infrastructure.sql](../infra/supabase/supabase/migrations/202601XX_create_business_metrics_infrastructure.sql)

### Frontend
- ✅ [apps/super-admin/src/hooks/useBusinessMetrics.ts](../apps/super-admin/src/hooks/useBusinessMetrics.ts)
- ✅ [apps/super-admin/src/pages/TenantsPage.tsx](../apps/super-admin/src/pages/TenantsPage.tsx)
- ✅ [apps/super-admin/src/pages/BusinessMetricsPage.tsx](../apps/super-admin/src/pages/BusinessMetricsPage.tsx)
- ✅ [apps/super-admin/src/pages/RevenueAnalyticsPage.tsx](../apps/super-admin/src/pages/RevenueAnalyticsPage.tsx)
- ✅ [apps/super-admin/src/pages/RegionalAnalyticsPage.tsx](../apps/super-admin/src/pages/RegionalAnalyticsPage.tsx)
- ✅ [apps/super-admin/src/App.tsx](../apps/super-admin/src/App.tsx) (라우팅 추가)
- ✅ [apps/super-admin/src/components/Navigation.tsx](../apps/super-admin/src/components/Navigation.tsx) (메뉴 추가)

---

## 🧪 테스트 방법

### 1. 테넌트 목록 확인
```bash
# 1. Super Admin 로그인
# 2. Navigation에서 "테넌트 관리" 클릭
# 3. 3개 테넌트 카드 확인
# 4. 카드 클릭 → 상세 모달 확인
```

### 2. 비즈니스 메트릭 확인
```bash
# 1. "비즈니스 메트릭" 클릭
# 2. 플랫폼 개요 KPI 확인 (총 3개, 활성 3개)
# 3. 건강도 테이블 확인 (vanessa: 정상, 나머지: 위험)
```

### 3. 매출 분석 (데이터 없음 확인)
```bash
# 1. "매출 분석" 클릭
# 2. "매출 데이터가 없습니다" 안내 확인
```

### 4. 지역별 분석 (데이터 없음 확인)
```bash
# 1. "지역별 분석" 클릭
# 2. "지역별 데이터가 없습니다" 안내 확인
```

---

## 📊 현재 데이터 (테넌트 3개)

| 테넌트 | 사용자 | 학생 | 출결(7일) | 마지막 로그인 | 건강도 |
|--------|--------|------|-----------|---------------|--------|
| vanessa | 6명 | 4명 | 13건 | 2시간 전 | 🟢 정상 |
| test-academy | 0명 | 0명 | 0건 | 없음 | 🔴 위험 |
| my-academy | 0명 | 0명 | 0건 | 없음 | 🔴 위험 |

---

## 🚀 다음 단계

### 로그인 추적 자동화 (선택)
```typescript
// apps/super-admin/src/main.tsx에서 로그인 시 자동 기록
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    await supabase.from('user_login_logs').insert({
      user_id: session.user.id,
      tenant_id: currentTenantId,
      ip_address: ...,
      user_agent: navigator.userAgent
    });
  }
});
```

### 구독 데이터 시드 (테스트용)
```sql
-- 테스트 구독 생성
INSERT INTO subscriptions (tenant_id, plan, status, price_monthly)
VALUES
  ((SELECT id FROM tenants WHERE name = 'vanessa'), 'basic', 'active', 50000),
  ((SELECT id FROM tenants WHERE name = 'test-academy'), 'basic', 'active', 50000);

-- 테스트 과금 이벤트
INSERT INTO billing_events (subscription_id, tenant_id, event_type, amount, occurred_at)
SELECT
  s.id,
  s.tenant_id,
  'charge',
  50000,
  date_trunc('month', CURRENT_DATE - interval '1 month' * n)
FROM subscriptions s
CROSS JOIN generate_series(0, 11) n;
```

---

## ✨ 핵심 성과

### 구현 완료
- ✅ **9개 RPC 함수** (Phase 1~3 전체)
- ✅ **3개 신규 테이블** (로그인 추적, 구독, 과금)
- ✅ **4개 페이지** (테넌트, 메트릭, 매출, 지역)
- ✅ **6개 Hook 함수** (React Query 통합)
- ✅ **Navigation 메뉴** 추가

### 즉시 사용 가능
- ✅ 테넌트 3개 관리 UI (현재 데이터 표시됨)
- ✅ 건강도 스코어링 (로그인 활동 기반)
- ✅ 플랫폼 개요 메트릭 (DAU, WAU, MAU)

### 데이터 수집 후 활성화
- ⏰ 매출 분석 (구독 데이터 필요)
- ⏰ 지역별 분석 (daily_region_metrics 데이터 필요)

---

**구현자**: Claude Code
**검토자**: 개발팀
**최종 업데이트**: 2026-01-24
