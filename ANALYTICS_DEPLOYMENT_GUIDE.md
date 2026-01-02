# Analytics Page - 배포 가이드

## 📋 개요

이 문서는 Analytics Page 구현 완료 후 프로덕션 배포를 위한 단계별 가이드입니다.

### 구현 완료 항목
- ✅ P0-1: 지역별 통계 집계 로직
- ✅ P0-2: 에러 핸들링 강화
- ✅ P1-3: Materialized Views 성능 최적화
- ✅ P1-4: 지역 정보 미설정 안내 배너
- ✅ P2-1: Backfill Edge Function
- ✅ P2-2: AI 지역 인사이트 자동 생성
- ✅ P2-5: RLS 보안 정책 강화
- ✅ QUALITY-1: 지역 비교 로직 리팩토링

---

## 🚀 배포 순서

### 1단계: 배포 전 사전 점검 (중요!)

```bash
cd infra/supabase

# 사전 점검 스크립트 실행
psql <DATABASE_URL> -f ../../ANALYTICS_PRE_DEPLOYMENT_CHECK.sql
```

**또는 Supabase SQL Editor에서:**
1. `ANALYTICS_PRE_DEPLOYMENT_CHECK.sql` 파일 내용 복사
2. Supabase Dashboard → SQL Editor → New Query
3. 붙여넣고 실행

**기대 결과:**
```
✅ analytics 스키마 존재 확인
✅ daily_region_metrics 테이블 존재 확인
✅ 모든 필수 컬럼 존재 확인 (17개)
✅ Migration 116 적용 확인
✅ 배포 전 사전 점검 완료!
```

**⚠️ 에러 발생 시:**
- "Migration 116을 먼저 실행하세요" → 아래 "문제 1" 섹션 참조
- "다음 컬럼이 누락되었습니다" → Migration 116을 다시 실행

---

### 2단계: 데이터베이스 마이그레이션 적용

```bash
cd infra/supabase

# 마이그레이션 적용
npx supabase db push
```

**적용되는 마이그레이션:**
- `116_create_analytics_metrics_tables.sql` - 기본 테이블 생성 (이미 적용되었을 가능성 높음)
- `141_create_analytics_materialized_views.sql` - MV 생성
- `142_add_analytics_mv_refresh_cron.sql` - MV 자동 갱신
- `143_enhance_region_metrics_rls_security.sql` - RLS 강화

**확인 쿼리:**
```sql
-- 마이그레이션 적용 확인
SELECT version FROM schema_migrations
WHERE version IN ('116', '141', '142', '143')
ORDER BY version;

-- 테이블 스키마 확인
\d analytics.daily_region_metrics

-- Materialized View 확인
\d analytics.daily_region_metrics_mv
\d analytics.daily_store_metrics_mv
```

---

### 3단계: Edge Functions 배포

```bash
cd infra/supabase

# 1. 일일 통계 업데이트 (수정됨)
npx supabase functions deploy daily-statistics-update

# 2. 백필 함수 (신규)
npx supabase functions deploy analytics-backfill

# 3. AI 지역 인사이트 (신규)
npx supabase functions deploy ai-regional-insights-generation
```

**배포 확인:**
```bash
# 함수 목록 조회
npx supabase functions list

# 기대 결과:
# - daily-statistics-update: updated
# - analytics-backfill: created
# - ai-regional-insights-generation: created
```

---

### 4단계: Cron Job 등록 확인

**Cloud Supabase 사용 시:**

1. Supabase Dashboard → Functions → Cron Jobs
2. 다음 Cron Job이 등록되어 있는지 확인:
   - `analytics-mv-refresh`: 매일 00:30 KST (15:30 UTC)
   - `ai-regional-insights-generation-daily`: 매일 07:30 KST (22:30 UTC)

**Self-Hosted Supabase 사용 시:**
```sql
-- Cron Job 확인
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%analytics%'
   OR jobname LIKE '%ai-regional%';
```

---

### 5단계: 데이터 검증

#### 5.1. 지역 통계 집계 확인

```sql
-- daily_region_metrics에 데이터가 있는지 확인
SELECT
  region_code,
  region_level,
  tenant_count,
  student_count,
  avg_attendance_rate,
  date_kst
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date_kst DESC, region_level, region_code
LIMIT 20;
```

**기대 결과:**
- 최근 7일간의 지역 통계 데이터 표시
- `tenant_count >= 3` (최소 샘플 수 조건)
- 동(dong), 구/군(gu_gun), 시(si) 레벨 데이터 존재

#### 5.2. Materialized View 확인

```sql
-- MV에 데이터가 캐시되었는지 확인
SELECT COUNT(*) as region_mv_count
FROM analytics.daily_region_metrics_mv;

SELECT COUNT(*) as store_mv_count
FROM analytics.daily_store_metrics_mv;
```

**기대 결과:**
- `region_mv_count`: 최근 30일 지역 통계 개수
- `store_mv_count`: 최근 90일 매장 통계 개수

#### 5.3. RLS 정책 확인

```sql
-- RLS 정책 목록 확인
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('daily_region_metrics', 'daily_store_metrics', 'ranking_snapshot')
ORDER BY tablename, policyname;
```

**기대 결과:**
- `industry_region_filter_daily_region_metrics` 정책 존재
- `tenant_isolation_daily_store_metrics` 정책 존재
- `ranking_snapshot_select` 정책 존재

---

### 6단계: Edge Function 테스트

#### 6.1. daily-statistics-update 수동 실행

```bash
curl -X POST \
  https://<project>.supabase.co/functions/v1/daily-statistics-update \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

**기대 응답:**
```json
{
  "success": true,
  "updated_count": 10,
  "regional_updated_count": 5
}
```

#### 6.2. analytics-backfill 테스트 (선택)

```bash
# 지난 7일 재집계 테스트
curl -X GET \
  'https://<project>.supabase.co/functions/v1/analytics-backfill?start_date=2026-01-01&end_date=2026-01-07' \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

**기대 응답:**
```json
{
  "success": true,
  "message": "Backfill completed for 7 dates",
  "dates_processed": 7,
  "store_metrics_updated": 45,
  "region_metrics_updated": 32
}
```

#### 6.3. ai-regional-insights-generation 테스트 (선택)

```bash
curl -X POST \
  https://<project>.supabase.co/functions/v1/ai-regional-insights-generation \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

**기대 응답:**
```json
{
  "success": true,
  "generated_count": 20
}
```

---

### 7단계: Frontend 배포

```bash
cd apps/academy-admin

# 빌드
npm run build

# 배포 (배포 방법에 따라 다름)
# Vercel/Netlify 등 자동 배포 설정된 경우 git push만 하면 됨
```

**확인 사항:**
- ✅ `LocationWarningBanner` 컴포넌트가 위치 미설정 시 표시됨
- ✅ 지역 통계 카드에 데이터 표시됨
- ✅ 에러 발생 시 logError로 추적됨

---

## 🔍 배포 후 모니터링

### 로그 확인

**Supabase Dashboard:**
1. Functions → Logs
2. 다음 함수의 로그 확인:
   - `daily-statistics-update`
   - `analytics-backfill`
   - `ai-regional-insights-generation`

**확인할 로그 메시지:**
```
[Daily Statistics] Starting regional aggregation for YYYY-MM-DD
[Regional Aggregation] Updated <region_code> (dong): 5 tenants
[Regional Aggregation] Completed: 10 regions updated
```

### 에러 모니터링

```sql
-- 에러 추적 (logError 사용)
SELECT * FROM error_logs
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

### 성능 모니터링

```sql
-- MV Refresh 실행 이력
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'analytics-mv-refresh')
ORDER BY start_time DESC
LIMIT 10;

-- AI 인사이트 생성 이력
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ai-regional-insights-generation-daily')
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🔧 문제 해결

### 문제 1: Migration 141 실행 시 "column does not exist" 에러

**에러 메시지:**
```
ERROR: 42703: column "tenant_count" does not exist
ERROR: 42703: column "updated_at" does not exist
```

**원인:**
- Migration 116 (`116_create_analytics_metrics_tables.sql`)이 적용되지 않음
- `analytics.daily_region_metrics` 테이블이 존재하지 않거나 컬럼이 누락됨

**해결:**
```sql
-- 1. 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'analytics'
AND table_name = 'daily_region_metrics';

-- 2. 컬럼 목록 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'analytics'
AND table_name = 'daily_region_metrics'
ORDER BY ordinal_position;

-- 3. Migration 116 적용 여부 확인
SELECT version FROM schema_migrations WHERE version = '116';

-- 4. Migration 116이 적용되지 않았다면 수동 적용
-- infra/supabase/supabase/migrations/116_create_analytics_metrics_tables.sql 파일을 직접 실행
```

**참고:** Migration 116은 모든 필수 컬럼(tenant_count, student_count, avg_arpu, avg_attendance_rate, percentile 컬럼, growth rate 컬럼, 타임스탬프 등)을 생성합니다. 이 마이그레이션이 반드시 Migration 141보다 먼저 실행되어야 합니다.

### 문제 2: daily_region_metrics에 데이터가 없음

**원인:**
- daily-statistics-update가 아직 실행되지 않음
- 테넌트 수가 3개 미만 (최소 샘플 수 조건)

**해결:**
```bash
# 수동으로 통계 업데이트 실행
curl -X POST \
  https://<project>.supabase.co/functions/v1/daily-statistics-update \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

### 문제 3: Materialized View가 비어있음

**원인:**
- MV Refresh가 실행되지 않음
- daily_region_metrics에 데이터가 없음

**해결:**
```sql
-- 수동으로 MV Refresh 실행
SELECT analytics.refresh_all_materialized_views();
```

### 문제 4: RLS 정책으로 인해 데이터 조회 안됨

**원인:**
- JWT claim에 industry_type이 없음
- tenant_settings에 location 정보가 없음

**해결:**
```sql
-- RLS 정책 임시 비활성화 (테스트용, 운영 환경 금지!)
ALTER TABLE analytics.daily_region_metrics DISABLE ROW LEVEL SECURITY;

-- 데이터 확인 후 다시 활성화
ALTER TABLE analytics.daily_region_metrics ENABLE ROW LEVEL SECURITY;
```

### 문제 5: Cron Job이 실행되지 않음

**원인:**
- pg_cron 확장이 설치되지 않음 (Self-Hosted)
- Cloud Supabase에서 수동 등록 필요

**해결:**
```sql
-- pg_cron 확장 확인
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 없으면 설치
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 📊 배포 체크리스트

### 배포 전

- [ ] 모든 마이그레이션 파일 리뷰 완료
- [ ] Edge Functions 코드 리뷰 완료
- [ ] 로컬 환경에서 테스트 완료
- [ ] 백업 생성 (데이터베이스 스냅샷)
- [ ] **사전 점검 스크립트 실행 (ANALYTICS_PRE_DEPLOYMENT_CHECK.sql)**

### 배포 중

- [ ] 사전 점검 통과 확인
- [ ] Migration 116 적용 확인 (테이블 생성)
- [ ] 마이그레이션 적용 (141, 142, 143)
- [ ] Edge Functions 배포 (3개)
- [ ] Cron Job 등록 확인
- [ ] 데이터 검증 쿼리 실행

### 배포 후

- [ ] 로그 모니터링 (최소 24시간)
- [ ] 에러 추적 설정 확인
- [ ] 성능 메트릭 확인
- [ ] 사용자 피드백 수집

---

## 📚 참고 문서

- [ANALYTICS_PRE_DEPLOYMENT_CHECK.sql](ANALYTICS_PRE_DEPLOYMENT_CHECK.sql) - **배포 전 사전 점검 스크립트 (필수)**
- [Analytics_Page_구현_완료_보고서.md](docu/Analytics_Page_구현_완료_보고서.md) - 구현 완료 상세 보고서
- [ANALYTICS_BACKFILL_DEPLOYMENT.md](infra/supabase/ANALYTICS_BACKFILL_DEPLOYMENT.md) - Backfill 사용 가이드
- [AI_REGIONAL_INSIGHTS_GENERATION.md](AI_REGIONAL_INSIGHTS_GENERATION.md) - AI 인사이트 구현 문서
- [디어쌤_아키텍처.md](docu/디어쌤_아키텍처.md) - 전체 아키텍처 문서
- [116_create_analytics_metrics_tables.sql](infra/supabase/supabase/migrations/116_create_analytics_metrics_tables.sql) - 기본 테이블 생성 마이그레이션

---

## 🎯 배포 완료 확인

모든 단계 완료 후 다음 확인:

```bash
# 1. 마이그레이션 적용 확인
npx supabase db remote status

# 2. Edge Functions 배포 확인
npx supabase functions list

# 3. 데이터 확인
# Supabase SQL Editor에서 검증 쿼리 실행

# 4. Frontend 확인
# https://<your-domain>/analytics 접속하여 UI 확인
```

**모든 항목이 ✅ 이면 배포 성공!** 🎉
