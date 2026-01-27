# Performance Monitoring 종합 가이드

**최종 업데이트**: 2026-01-26
**버전**: 2.0.0 (통합본)
**상태**: ✅ 프로덕션 운영 중

---

## 📋 목차

1. [개요](#1-개요)
2. [아키텍처](#2-아키텍처)
3. [구현 완료 기능](#3-구현-완료-기능)
4. [빠른 시작](#4-빠른-시작)
5. [모니터링 항목](#5-모니터링-항목)
6. [Sentry 설정](#6-sentry-설정)
7. [보안 설정](#7-보안-설정)
8. [문제 해결](#8-문제-해결)

---

## 1. 개요

SAMDLE의 Performance Monitoring 시스템은 **슈퍼어드민 페이지**에서 플랫폼 전체의 성능 지표를 실시간으로 모니터링합니다.

### 주요 기능
- ✅ 데이터베이스 성능 모니터링 (쿼리 통계, 인덱스, 락, 연결 풀)
- ✅ Edge Function 통계 (호출 횟수, 에러율, 실행 시간)
- ✅ Realtime 연결 통계
- ✅ Storage 사용량 분석
- ✅ Frontend 에러 추적 (Sentry 연동)
- ✅ 전체 시스템 상태 대시보드

### 구현 위치
- **페이지**: `apps/super-admin/src/pages/PerformanceMonitoringPage.tsx`
- **훅**: `apps/super-admin/src/hooks/usePerformanceMetrics.ts`
- **컴포넌트**: `apps/super-admin/src/components/performance-monitoring/`
- **마이그레이션**: `infra/supabase/supabase/migrations/20260123130000_create_performance_monitoring_rpcs.sql`

---

## 2. 아키텍처

### 시스템 구성

```
┌─────────────────────────────────────────────────────────┐
│           Super Admin Dashboard                          │
│  (Performance Monitoring Page)                          │
└───────────────────┬─────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    ┌────▼─────┐      ┌───────▼────────┐
    │ Frontend │      │ Supabase RPCs  │
    │ (Sentry) │      │ (Performance)  │
    └──────────┘      └────────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
         │   pg_   │    │   edge_   │   │  realtime_ │
         │   stat  │    │ function_ │   │  metrics   │
         │  tables │    │   logs    │   │            │
         └─────────┘    └───────────┘   └────────────┘
```

### 데이터 흐름
1. **RPC Functions**: PostgreSQL 성능 통계 수집
2. **Edge Function Logs**: sync-edge-function-logs로 동기화
3. **Realtime Metrics**: sync-realtime-metrics로 수집
4. **Frontend Errors**: Sentry로 에러 추적 후 sync-sentry-errors로 동기화

---

## 3. 구현 완료 기능

### 3.1 데이터베이스 성능

#### ✅ 쿼리 통계 (Query Stats)
- **RPC**: `get_query_performance_stats()`
- **컴포넌트**: `QueryStatsTable.tsx`
- **기능**:
  - 슬로우 쿼리 탐지 (1초 이상)
  - 쿼리별 호출 횟수, 평균/최대 실행 시간
  - 캐시 히트율

#### ✅ 연결 풀 상태 (Connection Stats)
- **RPC**: `get_connection_stats()`
- **컴포넌트**: `ConnectionStatsCard.tsx`
- **기능**:
  - 활성 연결 수
  - Idle 연결 수
  - 최대 연결 수 대비 사용률

#### ✅ 락 대기 (Lock Waits)
- **RPC**: `get_lock_waits()`
- **컴포넌트**: `LockWaitsCard.tsx`
- **기능**:
  - 현재 락 대기 중인 쿼리
  - 블로킹 PID 및 대기 시간

#### ✅ 장기 실행 쿼리 (Long Running Queries)
- **RPC**: `get_long_running_queries()`
- **컴포넌트**: `LongRunningQueriesCard.tsx`
- **기능**:
  - 5분 이상 실행 중인 쿼리
  - 쿼리 상태 및 실행 시간

#### ✅ 테이블 크기 (Table Sizes)
- **RPC**: `get_table_sizes()`
- **컴포넌트**: `TableSizesCard.tsx`
- **기능**:
  - 테이블별 데이터 크기
  - 인덱스 크기
  - 전체 크기 (데이터 + 인덱스)

#### ✅ 미사용 인덱스 (Unused Indexes)
- **RPC**: `get_unused_indexes()`
- **컴포넌트**: `UnusedIndexesCard.tsx`
- **기능**:
  - 사용되지 않는 인덱스 탐지
  - 인덱스 크기
  - 최적화 권장 사항

#### ✅ 캐시 히트율 (Cache Hit Rate)
- **RPC**: `get_cache_hit_rate()`
- **컴포넌트**: `CacheHitRateCard.tsx`
- **기능**:
  - 버퍼 캐시 히트율
  - 인덱스 캐시 히트율
  - 권장 임계값: 99% 이상

### 3.2 Edge Function 모니터링

#### ✅ Edge Function 통계
- **RPC**: `get_edge_function_stats()`
- **컴포넌트**: `EdgeFunctionStatsCard.tsx`
- **동기화**: `sync-edge-function-logs` (Cron: 5분마다)
- **기능**:
  - 함수별 호출 횟수
  - 에러율 (%)
  - 평균/최대 실행 시간
  - 최근 에러 메시지

### 3.3 Realtime 통계

#### ✅ Realtime 연결 통계
- **RPC**: `get_realtime_stats()`
- **컴포넌트**: `RealtimeStatsCard.tsx`
- **동기화**: `sync-realtime-metrics` (Cron: 5분마다)
- **기능**:
  - 활성 연결 수
  - 채널별 구독자 수
  - 메시지 전송 통계

### 3.4 Storage 통계

#### ✅ Storage 사용량
- **RPC**: `get_storage_stats()`
- **컴포넌트**: `StorageStatsCard.tsx`
- **기능**:
  - 버킷별 파일 수
  - 전체 사용량 (GB)
  - 파일 타입별 분포

### 3.5 Frontend 에러 추적

#### ✅ Frontend 에러 모니터링
- **서비스**: Sentry
- **컴포넌트**: `FrontendErrorsCard.tsx`
- **동기화**: `sync-sentry-errors` (Cron: 10분마다)
- **기능**:
  - 에러 발생 횟수
  - 에러 메시지 및 스택 트레이스
  - 사용자 영향 범위

#### ✅ 인증 실패 추적
- **컴포넌트**: `AuthFailuresCard.tsx`
- **기능**:
  - 로그인 실패 횟수
  - IP별 실패 통계
  - 의심스러운 활동 탐지

---

## 4. 빠른 시작

### 4.1 환경 변수 설정

#### 필수 환경 변수

```bash
# Supabase
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key

# Sentry (Frontend 에러 추적)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# Sentry Integration (Edge Function)
SENTRY_API_URL=https://sentry.io/api/0
```

📖 **상세 가이드**:
- 환경 변수: [QUICK_ENV_SETUP.md](./QUICK_ENV_SETUP.md)
- Cron 설정: [CRON_AND_ENV_SETUP_GUIDE.md](./CRON_AND_ENV_SETUP_GUIDE.md)

### 4.2 Sentry 설정

```bash
# 1. Sentry 설정 스크립트 실행
chmod +x sentry-setup.sh
./sentry-setup.sh

# 2. 환경 변수 확인
cat .env | grep SENTRY
```

📖 **상세 가이드**: [SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md)

### 4.3 마이그레이션 실행

```bash
cd infra/supabase
npx supabase db push
```

### 4.4 Edge Functions 배포

```bash
# Edge Function 로그 동기화
npx supabase functions deploy sync-edge-function-logs

# Realtime 지표 동기화
npx supabase functions deploy sync-realtime-metrics

# Sentry 에러 동기화
npx supabase functions deploy sync-sentry-errors
```

### 4.5 슈퍼어드민 접속

```
http://localhost:5174/performance
```

---

## 5. 모니터링 항목

### 5.1 데이터베이스 건강도

| 지표 | 정상 범위 | 경고 | 위험 |
|------|----------|------|------|
| **캐시 히트율** | ≥ 99% | 95-99% | < 95% |
| **활성 연결** | < 80% | 80-90% | > 90% |
| **슬로우 쿼리** | 0개 | 1-5개 | > 5개 |
| **락 대기** | 0개 | 1-3개 | > 3개 |
| **장기 실행 쿼리** | 0개 | 1-2개 | > 2개 |

### 5.2 Edge Function 성능

| 지표 | 정상 | 경고 | 위험 |
|------|-----|------|------|
| **에러율** | < 1% | 1-5% | > 5% |
| **평균 실행 시간** | < 500ms | 500ms-1s | > 1s |
| **호출 실패** | < 10/시간 | 10-50/시간 | > 50/시간 |

### 5.3 Frontend 에러

| 지표 | 정상 | 경고 | 위험 |
|------|-----|------|------|
| **에러 발생률** | < 0.1% | 0.1-1% | > 1% |
| **사용자 영향** | < 10명/일 | 10-100명/일 | > 100명/일 |
| **반복 에러** | 0개 | 1-3개 | > 3개 |

---

## 6. Sentry 설정

### 6.1 초기 설정

```bash
# NPM 패키지 설치
npm install @sentry/react @sentry/vite-plugin

# 프로젝트 초기화
npx @sentry/wizard@latest -i sourcemaps
```

### 6.2 Frontend 통합 (academy-admin)

**파일**: `apps/academy-admin/src/main.tsx`

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 6.3 에러 캡처

```typescript
// 수동 에러 캡처
import * as Sentry from "@sentry/react";

try {
  // 작업 수행
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: "student-management",
      action: "create-student"
    },
    user: {
      id: tenantId,
      email: userEmail
    }
  });
}
```

### 6.4 성능 추적

```typescript
import * as Sentry from "@sentry/react";

const transaction = Sentry.startTransaction({
  name: "Load Student List",
  op: "load"
});

// ... 작업 수행 ...

transaction.finish();
```

📖 **상세 가이드**: [SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md)

---

## 7. 보안 설정

### 7.1 RLS 정책

모든 성능 모니터링 테이블에는 RLS 정책 적용:

```sql
-- edge_function_logs
CREATE POLICY "super_admin_only" ON edge_function_logs
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'super_admin'
  );

-- realtime_metrics
CREATE POLICY "super_admin_only" ON realtime_metrics
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'super_admin'
  );
```

### 7.2 Role 기반 접근 제어

**슈퍼어드민만 접근 가능**:
- ✅ Performance Monitoring 페이지
- ✅ 성능 지표 RPC 함수
- ✅ 로그 테이블

**일반 테넌트는 접근 불가**:
- ❌ 다른 테넌트의 성능 데이터
- ❌ 플랫폼 전체 통계

### 7.3 Service Role Key 보호

```typescript
// ❌ 잘못된 예 - 클라이언트에서 Service Role Key 사용
import { envServer } from '@env-registry/server'; // 클라이언트에서 금지!

// ✅ 올바른 예 - Edge Function에서만 사용
import { envServer } from '@env-registry/server';
const supabase = createClient(
  envServer.SUPABASE_URL,
  envServer.SERVICE_ROLE_KEY
);
```

📖 **상세 가이드**: [SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md)

---

## 8. 문제 해결

### 8.1 Edge Function 로그가 표시되지 않음

**증상**: EdgeFunctionStatsCard에 데이터가 없음

**해결**:
1. Edge Function이 배포되었는지 확인:
   ```bash
   npx supabase functions list
   ```

2. Cron Job이 실행 중인지 확인:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE '%edge-function%';
   ```

3. 로그 테이블 확인:
   ```sql
   SELECT COUNT(*) FROM edge_function_logs;
   ```

### 8.2 Sentry 에러가 수집되지 않음

**증상**: FrontendErrorsCard에 에러가 표시되지 않음

**해결**:
1. Sentry DSN 확인:
   ```bash
   echo $NEXT_PUBLIC_SENTRY_DSN
   ```

2. Sentry 대시보드에서 에러 확인:
   ```
   https://sentry.io/organizations/[org]/issues/
   ```

3. sync-sentry-errors Edge Function 로그 확인:
   ```bash
   npx supabase functions logs sync-sentry-errors
   ```

### 8.3 RPC 함수 실행 오류

**증상**: "permission denied for function get_query_performance_stats"

**해결**:
1. 함수 권한 확인:
   ```sql
   SELECT has_function_privilege('authenticated', 'get_query_performance_stats()', 'execute');
   ```

2. 권한 부여:
   ```sql
   GRANT EXECUTE ON FUNCTION get_query_performance_stats() TO authenticated;
   ```

### 8.4 성능 저하

**증상**: 모니터링 페이지 로딩이 느림

**해결**:
1. RPC 함수 실행 시간 확인:
   ```sql
   SELECT * FROM pg_stat_user_functions WHERE funcname LIKE 'get_%';
   ```

2. 인덱스 추가:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_edge_function_logs_created_at
     ON edge_function_logs(created_at DESC);
   ```

3. 데이터 보관 기간 조정 (기본: 7일):
   ```sql
   DELETE FROM edge_function_logs
   WHERE created_at < NOW() - INTERVAL '7 days';
   ```

---

## 9. 관련 문서

### 핵심 가이드
- **[QUICK_ENV_SETUP.md](./QUICK_ENV_SETUP.md)** - 빠른 환경 설정
- **[CRON_AND_ENV_SETUP_GUIDE.md](./CRON_AND_ENV_SETUP_GUIDE.md)** - Cron 및 환경 변수 상세 가이드
- **[SENTRY_SETUP_GUIDE.md](./SENTRY_SETUP_GUIDE.md)** - Sentry 설정 완벽 가이드
- **[SECURITY_CONFIGURATION_GUIDE.md](./SECURITY_CONFIGURATION_GUIDE.md)** - 보안 설정

### 아키텍처
- **[JOB_QUEUE_ARCHITECTURE.md](./JOB_QUEUE_ARCHITECTURE.md)** - 백그라운드 작업 큐 아키텍처

### 구현 상세
- **원본 구현 문서** (참조용):
  - `PERFORMANCE_MONITORING_IMPLEMENTATION.md`
  - `FRONTEND_MONITORING_INTEGRATION.md`
  - `MONITORING_VERIFICATION_COMPLETE.md`
  - `COMPLETE_MONITORING_IMPLEMENTATION.md`
  - `FINAL_VERIFICATION_REPORT.md`

---

**문서 버전**: 2.0.0 (통합본)
**최종 업데이트**: 2026-01-26
**작성**: Claude Sonnet 4.5
**목적**: 성능 모니터링 시스템 종합 가이드
