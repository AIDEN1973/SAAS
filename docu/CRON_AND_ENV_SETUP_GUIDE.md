# Cron Job 및 환경 변수 설정 가이드

> **날짜**: 2026-01-23
> **상태**: ✅ Cron Job MCP를 통해 자동 등록 완료!

---

## 🎉 Cron Job 자동 등록 완료!

**MCP를 통해 3개의 모니터링 Cron Job이 모두 등록되었습니다:**

| Job ID | Job Name | Schedule | Status |
|--------|----------|----------|--------|
| 19 | `sync-edge-function-logs` | `*/5 * * * *` (5분마다) | ✅ **활성화** |
| 20 | `sync-realtime-metrics` | `* * * * *` (1분마다) | ✅ **활성화** |
| 21 | `sync-sentry-errors` | `*/5 * * * *` (5분마다) | ✅ **활성화** |

### 등록 결과
```json
{
  "summary": {
    "total": 3,
    "success": 3,
    "failed": 0
  },
  "sync_edge_function_logs": {
    "success": true,
    "jobname": "sync-edge-function-logs"
  },
  "sync_realtime_metrics": {
    "success": true,
    "jobname": "sync-realtime-metrics"
  },
  "sync_sentry_errors": {
    "success": true,
    "jobname": "sync-sentry-errors"
  }
}
```

---

## ⚠️ 남은 작업: 환경 변수 설정

Cron Job이 정상 작동하려면 Edge Function에 환경 변수를 설정해야 합니다.

### 방법 1: Supabase Dashboard (추천)

#### 1.1 Management API Token 생성

1. **Supabase Dashboard** 접속
2. **Account Settings** > **Access Tokens** 이동
3. **"Generate New Token"** 클릭
4. Token 이름: `monitoring-api-token`
5. Scopes 선택:
   - ✅ `projects.read`
   - ✅ `logs.read`
6. **Generate** 클릭
7. **Token 복사** (한번만 표시됨!)

#### 1.2 Project Reference 확인

**Supabase Dashboard** > **Project Settings** > **General**:
```
Project URL: https://xxxxxxxxxxx.supabase.co
Project Reference: xxxxxxxxxxx  ← 이 값 복사
```

#### 1.3 sync-edge-function-logs 환경 변수 설정

**Supabase Dashboard** > **Edge Functions** > **sync-edge-function-logs** > **Settings** > **Secrets**:

```bash
# 자동 설정됨 (확인만)
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 수동 추가 필요
SUPABASE_ACCESS_TOKEN=sbp_...  # Management API Token
SUPABASE_PROJECT_REF=xxxxxxxxxxx  # Project Reference
```

**Add Secret** 클릭 후:
1. Name: `SUPABASE_ACCESS_TOKEN`
2. Value: `sbp_...` (복사한 Management API Token)
3. **Save** 클릭

4. Name: `SUPABASE_PROJECT_REF`
5. Value: `xxxxxxxxxxx` (Project Reference)
6. **Save** 클릭

#### 1.4 sync-realtime-metrics 환경 변수 설정

**Supabase Dashboard** > **Edge Functions** > **sync-realtime-metrics** > **Settings** > **Secrets**:

```bash
# 동일한 환경 변수 추가
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_REF=xxxxxxxxxxx
```

#### 1.5 sync-sentry-errors 환경 변수 설정

##### Sentry API Token 생성

1. **Sentry.io** 접속 및 로그인
2. **Settings** > **Developer Settings** > **Auth Tokens** 이동
3. **"Create New Token"** 클릭
4. Token 이름: `monitoring-sentry-token`
5. Scopes 선택:
   - ✅ `project:read`
   - ✅ `project:write`
6. **Create Token** 클릭
7. **Token 복사**

##### Sentry Organization & Project 확인

**Sentry.io** > **Your Project**:
```
URL: https://sentry.io/organizations/your-org/projects/your-project/

Organization Slug: your-org  ← 이 값 복사
Project Slug: your-project  ← 이 값 복사
```

##### 환경 변수 설정

**Supabase Dashboard** > **Edge Functions** > **sync-sentry-errors** > **Settings** > **Secrets**:

```bash
# Sentry API 설정
SENTRY_AUTH_TOKEN=sntrys_...  # Sentry API Token
SENTRY_ORG=your-org  # Organization Slug
SENTRY_PROJECT=your-project  # Project Slug
```

---

### 방법 2: Supabase CLI (고급 사용자)

#### 2.1 Supabase CLI 로그인

```bash
npx supabase login
```

#### 2.2 Project 연결

```bash
cd infra/supabase
npx supabase link --project-ref xxxxxxxxxxx
```

#### 2.3 Secrets 설정

```bash
# sync-edge-function-logs
npx supabase secrets set --function sync-edge-function-logs \
  SUPABASE_ACCESS_TOKEN=sbp_... \
  SUPABASE_PROJECT_REF=xxxxxxxxxxx

# sync-realtime-metrics
npx supabase secrets set --function sync-realtime-metrics \
  SUPABASE_ACCESS_TOKEN=sbp_... \
  SUPABASE_PROJECT_REF=xxxxxxxxxxx

# sync-sentry-errors
npx supabase secrets set --function sync-sentry-errors \
  SENTRY_AUTH_TOKEN=sntrys_... \
  SENTRY_ORG=your-org \
  SENTRY_PROJECT=your-project
```

---

## 📝 Sentry DSN 설정 (.env 파일)

### Academy Admin & Super Admin

**.env.local** (개발):
```bash
VITE_SENTRY_DSN=  # 비워두면 console 사용
VITE_SENTRY_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0
```

**.env.production** (프로덕션):
```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

#### Sentry DSN 확인

1. **Sentry.io** > **Your Project** > **Settings** > **Client Keys (DSN)**
2. **DSN** 복사:
   ```
   https://xxxxxxxxxxxxx@o000000.ingest.sentry.io/0000000
   ```
3. `.env.production` 파일에 추가

---

## 🧪 환경 변수 설정 확인

### 1. Edge Function 수동 호출 테스트

```bash
# sync-edge-function-logs 테스트
curl -X POST https://xxxxxxxxxxx.supabase.co/functions/v1/sync-edge-function-logs \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# 예상 응답 (성공):
{
  "success": true,
  "logs_synced": 5,
  "timestamp": "2026-01-23T..."
}

# 예상 응답 (환경 변수 없음):
{
  "success": true,
  "logs_synced": 0,
  "timestamp": "2026-01-23T..."
}
```

### 2. Cron Job 실행 로그 확인

**Supabase Dashboard** > **Logs** > **Edge Functions**:
- Filter by: `sync-edge-function-logs`, `sync-realtime-metrics`, `sync-sentry-errors`
- Check for errors in environment variables

### 3. 데이터 수집 확인 (5분 대기)

```sql
-- Edge Function 로그 확인
SELECT COUNT(*) FROM edge_function_logs;

-- Realtime 메트릭 확인
SELECT COUNT(*) FROM realtime_connection_logs;

-- Sentry 에러 확인
SELECT COUNT(*) FROM frontend_error_logs;
```

---

## 📊 Cron Job 관리 명령어

### Cron Job 상태 확인

```sql
-- MCP를 통한 상태 확인
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors')
ORDER BY jobname;
```

### Cron Job 비활성화

```sql
-- 개별 비활성화
UPDATE cron.job
SET active = false
WHERE jobname = 'sync-edge-function-logs';

-- 모두 비활성화
UPDATE cron.job
SET active = false
WHERE jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors');
```

### Cron Job 재활성화

```sql
-- 개별 재활성화
UPDATE cron.job
SET active = true
WHERE jobname = 'sync-edge-function-logs';

-- 모두 재활성화
UPDATE cron.job
SET active = true
WHERE jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors');
```

### Cron Job 삭제

```sql
-- 개별 삭제
SELECT cron.unschedule('sync-edge-function-logs');

-- 모두 삭제
SELECT cron.unschedule('sync-edge-function-logs');
SELECT cron.unschedule('sync-realtime-metrics');
SELECT cron.unschedule('sync-sentry-errors');
```

### Cron Job 재등록 (MCP 사용)

```sql
-- 모든 Cron Job 다시 등록
SELECT register_all_monitoring_cron_jobs();
```

---

## 🔍 트러블슈팅

### 문제 1: Cron Job이 실행되지 않음

**증상**: 5분 후에도 데이터가 수집되지 않음

**원인 확인**:
```sql
-- Cron Job 활성화 확인
SELECT jobname, active FROM cron.job
WHERE jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors');
```

**해결**:
```sql
-- 비활성화되어 있다면 재활성화
UPDATE cron.job SET active = true
WHERE jobname IN ('sync-edge-function-logs', 'sync-realtime-metrics', 'sync-sentry-errors');
```

### 문제 2: 환경 변수가 적용되지 않음

**증상**: Edge Function 호출 시 환경 변수가 없음

**원인**: Secrets 저장 후 Edge Function이 재배포되지 않음

**해결**:
1. Supabase Dashboard > Edge Functions > 해당 함수
2. **Redeploy** 클릭 (현재 버전 재배포)
3. 또는 CLI로 재배포:
   ```bash
   npx supabase functions deploy sync-edge-function-logs
   npx supabase functions deploy sync-realtime-metrics
   npx supabase functions deploy sync-sentry-errors
   ```

### 문제 3: Sentry 에러가 수집되지 않음

**증상**: `frontend_error_logs` 테이블이 비어있음

**원인 확인**:
1. **Sentry API Token 권한 확인**:
   - Sentry.io > Settings > Developer Settings > Auth Tokens
   - Scopes: `project:read`, `project:write` 있는지 확인

2. **Sentry DSN 설정 확인**:
   ```bash
   # .env.production 파일 확인
   cat apps/academy-admin/.env.production
   cat apps/super-admin/.env.production
   ```

3. **Edge Function 로그 확인**:
   - Supabase Dashboard > Logs > Edge Functions
   - Filter: `sync-sentry-errors`
   - Error 메시지 확인

**해결**:
- API Token 재생성 (올바른 권한으로)
- Secrets 다시 설정
- Edge Function 재배포

### 문제 4: Management API 접근 오류

**증상**: `sync-edge-function-logs` 또는 `sync-realtime-metrics`에서 403/401 에러

**원인**: Management API Token 권한 부족 또는 만료

**해결**:
1. Supabase Dashboard > Account Settings > Access Tokens
2. 기존 Token 권한 확인 또는 새 Token 생성
3. Scopes: `projects.read`, `logs.read` 필수
4. Secrets 업데이트 후 재배포

---

## ✅ 설정 완료 체크리스트

### Cron Jobs
- [x] `sync-edge-function-logs` 등록 (Job ID: 19)
- [x] `sync-realtime-metrics` 등록 (Job ID: 20)
- [x] `sync-sentry-errors` 등록 (Job ID: 21)
- [x] 모든 Cron Job 활성화 (`active = true`)

### 환경 변수 (Edge Functions)
- [ ] **sync-edge-function-logs**:
  - [ ] `SUPABASE_ACCESS_TOKEN` 설정
  - [ ] `SUPABASE_PROJECT_REF` 설정
- [ ] **sync-realtime-metrics**:
  - [ ] `SUPABASE_ACCESS_TOKEN` 설정
  - [ ] `SUPABASE_PROJECT_REF` 설정
- [ ] **sync-sentry-errors**:
  - [ ] `SENTRY_AUTH_TOKEN` 설정
  - [ ] `SENTRY_ORG` 설정
  - [ ] `SENTRY_PROJECT` 설정

### Sentry DSN (.env)
- [ ] **Academy Admin**:
  - [ ] `.env.production` 파일에 `VITE_SENTRY_DSN` 설정
- [ ] **Super Admin**:
  - [ ] `.env.production` 파일에 `VITE_SENTRY_DSN` 설정

### 검증
- [ ] Edge Function 수동 호출 테스트 (200 OK 응답)
- [ ] 5분 대기 후 테이블 데이터 확인
- [ ] Performance Monitoring 페이지에서 실시간 데이터 확인

---

## 🎯 다음 단계

1. **환경 변수 설정** (위 가이드 참조)
2. **5분 대기** - Cron Job이 첫 번째 데이터 수집
3. **Performance Monitoring 페이지 확인**:
   ```
   Super Admin > /performance-monitoring
   ```
4. **실시간 데이터 확인**:
   - EdgeFunctionStatsCard: 함수별 통계
   - RealtimeStatsCard: 연결/메시지 통계
   - FrontendErrorsCard: Sentry 에러 목록

---

## 📚 관련 문서

- [COMPLETE_MONITORING_IMPLEMENTATION.md](COMPLETE_MONITORING_IMPLEMENTATION.md) - 전체 구현 가이드
- [MONITORING_VERIFICATION_COMPLETE.md](MONITORING_VERIFICATION_COMPLETE.md) - 검증 결과
- [FRONTEND_MONITORING_INTEGRATION.md](FRONTEND_MONITORING_INTEGRATION.md) - Frontend 통합
- [FINAL_VERIFICATION_REPORT.md](FINAL_VERIFICATION_REPORT.md) - 최종 검증

---

## 🎉 완료!

**Cron Job은 MCP를 통해 자동 등록 완료!**

남은 작업은 **환경 변수 설정**만 하면 됩니다. 위 가이드를 따라 Supabase Dashboard에서 Secrets를 설정하세요!
