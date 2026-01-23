# Performance Monitoring 구현 완료 보고서

> **날짜**: 2026-01-23
> **상태**: ✅ 구현 완료

---

## 1. 구현 개요

SAMDLE의 Performance Monitoring 시스템을 완성했습니다. Edge Function, Realtime, Storage 모니터링을 위한 백엔드 RPC 함수와 프로덕션 로깅 시스템을 구현했습니다.

---

## 2. 구현 내용

### 2.1 ✅ Edge Function 모니터링 RPC

**파일**: [20260123130000_create_performance_monitoring_rpcs.sql](../infra/supabase/supabase/migrations/20260123130000_create_performance_monitoring_rpcs.sql)

#### `get_edge_function_stats()` 함수

**기능**:
- Edge Function 로그 분석 (최근 24시간)
- 함수별 호출 횟수, 에러율, 평균/최대 실행 시간
- 최근 에러 메시지 및 발생 시간

**반환 데이터**:
```sql
{
  function_name: TEXT,
  total_calls: BIGINT,
  error_count: BIGINT,
  error_rate: NUMERIC,           -- 에러율 (%)
  avg_execution_time: NUMERIC,   -- 평균 실행 시간 (ms)
  max_execution_time: NUMERIC,   -- 최대 실행 시간 (ms)
  last_error: TEXT,              -- 최근 에러 메시지
  last_error_time: TIMESTAMPTZ   -- 최근 에러 발생 시간
}
```

**현재 상태**:
- ✅ RPC 함수 구현 완료
- ⚠️ **로그 수집 필요**: `edge_function_logs` 테이블에 로그 저장 필요
- 📌 **다음 단계**: Edge Function 로그 동기화 구현

**UI 연동**:
- ✅ [EdgeFunctionStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/EdgeFunctionStatsCard.tsx)
- ✅ [usePerformanceMetrics.ts:495](../apps/super-admin/src/hooks/usePerformanceMetrics.ts#L495)

---

### 2.2 ✅ Realtime 모니터링 RPC

#### `get_realtime_stats()` 함수

**기능**:
- Realtime 연결 통계 (활성 연결, 메시지, 에러)
- 채널별 구독자 및 메시지 통계

**반환 데이터**:
```json
{
  "active_connections": 0,
  "total_messages_24h": 0,
  "error_count_24h": 0,
  "channels": [
    {
      "name": "channel_name",
      "subscribers": 10,
      "messages": 1000
    }
  ]
}
```

**현재 상태**:
- ✅ RPC 함수 구현 완료
- ⚠️ **로그 수집 필요**: `realtime_connection_logs` 테이블에 로그 저장 필요
- 📌 **다음 단계**: Realtime 메트릭 수집 구현

**UI 연동**:
- ✅ [RealtimeStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/RealtimeStatsCard.tsx)
- ✅ [usePerformanceMetrics.ts:517](../apps/super-admin/src/hooks/usePerformanceMetrics.ts#L517)

---

### 2.3 ✅ Storage 사용량 모니터링 RPC

#### `get_storage_stats()` 함수

**기능**:
- Storage 전체 사용량 및 파일 수
- 버킷별 사용량 및 파일 수
- 사용률 계산 (100GB 기준)

**반환 데이터**:
```json
{
  "total_usage_bytes": 1073741824,
  "total_usage_formatted": "1 GB",
  "total_files": 1500,
  "usage_percentage": 1.0,
  "limit_bytes": 107374182400,
  "buckets": [
    {
      "bucket_name": "avatars",
      "total_size_bytes": 524288000,
      "total_size_formatted": "500 MB",
      "file_count": 800,
      "last_updated": "2026-01-23T12:00:00Z"
    }
  ]
}
```

**현재 상태**:
- ✅ RPC 함수 구현 완료
- ✅ **로그 수집 완료**: `storage.objects` 테이블에서 직접 조회
- ✅ **즉시 사용 가능**

**UI 연동**:
- ✅ [StorageStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/StorageStatsCard.tsx)
- ✅ [usePerformanceMetrics.ts:539](../apps/super-admin/src/hooks/usePerformanceMetrics.ts#L539)

---

### 2.4 ✅ 프로덕션 로깅 시스템

**파일**: [logger-utils.ts](../apps/academy-admin/src/utils/logger-utils.ts)

#### 구현 내용

**이전 (TODO 상태)**:
```typescript
// 프로덕션 환경에서는 콘솔 로그를 출력하지 않음
// TODO[LOGGER]: 향후 운영 환경 로깅 유틸리티 통합 시 logger.error() 사용
```

**현재 (✅ 구현 완료)**:
```typescript
import { getErrorTracker } from '@lib/error-tracking';

export function logError(scope: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${scope}]`, error);
  } else {
    // 프로덕션: Sentry로 전송
    const errorTracker = getErrorTracker();

    if (error instanceof Error) {
      errorTracker.captureException(error, {
        component: scope.split(':')[0],
        operation: scope.split(':')[1],
      });
    } else {
      errorTracker.captureMessage(`[${scope}] ${errorMessage}`, 'error', {
        component: scope.split(':')[0],
        operation: scope.split(':')[1],
        details: error,
      });
    }
  }
}
```

#### 기능

1. **logError() - 에러 로깅**
   - ✅ Error 객체 자동 캡처
   - ✅ 컨텍스트 정보 포함 (component, operation)
   - ✅ Sentry에 Exception 전송

2. **logWarn() - 경고 로깅**
   - ✅ Warning 레벨로 Sentry 전송
   - ✅ 구조화된 데이터 포함

3. **logInfo() - 정보 로깅**
   - ✅ 중요한 이벤트만 필터링 (Auth, Payment, Security, Critical)
   - ✅ Sentry 할당량 절약

#### Sentry 통합

**이미 구현됨**:
- ✅ [error-tracking/index.ts](../packages/lib/error-tracking/src/index.ts)
- ✅ [main.tsx:71](../apps/academy-admin/src/main.tsx#L71) - 초기화
- ✅ PII 마스킹 자동 적용
- ✅ 샘플링 설정 (100% 에러, 20% 트레이스)

---

## 3. 권한 설정

### RPC 함수 권한

```sql
-- authenticated 사용자만 호출 가능
GRANT EXECUTE ON FUNCTION get_edge_function_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_realtime_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_storage_stats() TO authenticated;
```

### 애플리케이션 레벨 권한

- ✅ Super Admin 앱에서만 Performance Monitoring 페이지 접근 가능
- ✅ RLS를 통한 추가 권한 검증 (애플리케이션 레벨)

---

## 4. 배포 방법

### 4.1 Migration 적용

```bash
cd infra/supabase
npx supabase db push
```

**예상 출력**:
```
✅ Performance Monitoring RPC 생성 완료!
  - get_edge_function_stats(): Edge Function 통계
  - get_realtime_stats(): Realtime 연결 통계
  - get_storage_stats(): Storage 사용량 통계

📌 실제 로그 수집 필요:
   1. Edge Function 로그 → edge_function_logs 테이블
   2. Realtime 메트릭 → realtime_connection_logs 테이블
   3. Storage는 storage.objects에서 직접 조회 (구현 완료)
```

### 4.2 Sentry 설정 (프로덕션)

**.env 파일**:
```bash
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

---

## 5. 테스트 방법

### 5.1 RPC 함수 테스트

#### Storage Stats (즉시 사용 가능)
```sql
SELECT get_storage_stats();
```

**예상 결과**:
```json
{
  "total_usage_bytes": 1073741824,
  "total_usage_formatted": "1 GB",
  "total_files": 1500,
  "buckets": [...]
}
```

#### Edge Function Stats (로그 테이블 필요)
```sql
SELECT * FROM get_edge_function_stats();
```

**현재 결과**: 빈 결과 (로그 테이블 없음)
**로그 수집 후**: 함수별 통계 반환

#### Realtime Stats (로그 테이블 필요)
```sql
SELECT get_realtime_stats();
```

**현재 결과**:
```json
{
  "active_connections": 0,
  "total_messages_24h": 0,
  "error_count_24h": 0,
  "channels": []
}
```

### 5.2 프로덕션 로깅 테스트

#### 개발 환경
```typescript
import { logError, logWarn, logInfo } from './utils';

// Console 출력됨
logError('Test:Error', new Error('Test error'));
logWarn('Test:Warning', 'Test warning', { data: 123 });
logInfo('Auth:Login', 'User logged in', { userId: 'test' });
```

#### 프로덕션 환경
```typescript
// Sentry로 전송됨 (VITE_SENTRY_DSN 설정 필요)
logError('API:FetchFailed', new Error('Network error'));
```

**Sentry 확인**:
1. https://sentry.io 로그인
2. Issues 탭에서 에러 확인
3. Breadcrumbs, Stack Trace, Context 정보 확인

---

## 6. 다음 단계 (우선순위)

### 🔴 높음: 로그 수집 구현

1. **Edge Function 로그 동기화**
   - Supabase Management API 호출
   - `edge_function_logs` 테이블에 저장
   - Cron job으로 주기적 동기화 (5분마다)

2. **Realtime 메트릭 수집**
   - Realtime Inspector API 연동
   - `realtime_connection_logs` 테이블에 저장

### 🟡 중간: 알림 설정

3. **Sentry 알림 규칙**
   - 에러율 임계값 초과 시 슬랙 알림
   - Critical 에러 발생 시 즉시 알림

4. **Performance Threshold 모니터링**
   - Edge Function 실행 시간 > 5초 알림
   - 에러율 > 10% 알림

### 🟢 낮음: 대시보드 개선

5. **실시간 차트 추가**
   - 시간별 에러율 그래프
   - 함수별 실행 시간 추이

6. **Core Web Vitals 추적**
   - LCP, FID, CLS 메트릭 수집
   - React Profiler 통합

---

## 7. 관련 파일

### Migrations
- [20260123130000_create_performance_monitoring_rpcs.sql](../infra/supabase/supabase/migrations/20260123130000_create_performance_monitoring_rpcs.sql)

### Frontend (Super Admin)
- [EdgeFunctionStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/EdgeFunctionStatsCard.tsx)
- [RealtimeStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/RealtimeStatsCard.tsx)
- [StorageStatsCard.tsx](../apps/super-admin/src/components/performance-monitoring/StorageStatsCard.tsx)
- [usePerformanceMetrics.ts](../apps/super-admin/src/hooks/usePerformanceMetrics.ts)
- [PerformanceMonitoringPage.tsx](../apps/super-admin/src/pages/PerformanceMonitoringPage.tsx)

### Logging
- [logger-utils.ts](../apps/academy-admin/src/utils/logger-utils.ts)
- [error-tracking/index.ts](../packages/lib/error-tracking/src/index.ts)
- [main.tsx](../apps/academy-admin/src/main.tsx)

---

## 8. 트러블슈팅

### 문제: RPC 함수 호출 시 "permission denied" 에러

**원인**: RLS 정책 또는 authenticated 권한 없음

**해결**:
```sql
-- 권한 확인
SELECT has_function_privilege('get_edge_function_stats()', 'execute');

-- 권한 재부여
GRANT EXECUTE ON FUNCTION get_edge_function_stats() TO authenticated;
```

### 문제: Sentry에 로그가 전송되지 않음

**원인**: DSN 미설정 또는 잘못된 환경 변수

**해결**:
1. `.env` 파일 확인: `VITE_SENTRY_DSN` 설정
2. 브라우저 콘솔 확인: `[ErrorTracking] Initialized with Sentry` 메시지
3. 네트워크 탭 확인: Sentry API 호출 여부

### 문제: Edge Function 통계가 빈 결과 반환

**원인**: `edge_function_logs` 테이블 없음

**해결**:
1. 로그 수집 Edge Function 구현 (다음 단계)
2. Supabase Management API로 로그 가져오기
3. 주기적으로 테이블에 저장

---

## 9. 결론

### ✅ 구현 완료 항목

1. ✅ Edge Function 통계 RPC 함수
2. ✅ Realtime 통계 RPC 함수
3. ✅ Storage 사용량 RPC 함수 (즉시 사용 가능)
4. ✅ 프로덕션 로깅 시스템 (Sentry 통합)
5. ✅ 에러 트래킹 (ErrorBoundary, captureException)

### 📌 남은 작업

1. ⚠️ Edge Function 로그 동기화 구현
2. ⚠️ Realtime 메트릭 수집 구현

### 🎯 즉시 사용 가능

- ✅ **Storage 모니터링**: 완전히 작동
- ✅ **프로덕션 로깅**: Sentry로 에러/경고 전송
- ✅ **에러 트래킹**: JavaScript 에러 자동 캡처

모든 핵심 인프라가 구현되었으며, 로그 수집만 추가하면 완전한 모니터링 시스템이 작동합니다.
