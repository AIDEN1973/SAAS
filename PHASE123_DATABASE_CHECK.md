# Phase 1-3 데이터베이스 점검 가이드

## 🔍 점검 방법

Supabase CLI에는 직접 SQL 실행 명령어가 없으므로, 다음 방법 중 하나를 사용하세요:

### 방법 1: Supabase SQL Editor (권장) ✅

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb

2. **SQL Editor 열기**
   - 왼쪽 메뉴 > SQL Editor

3. **점검 SQL 실행**
   - 아래 "빠른 점검 SQL"을 복사해서 실행

### 방법 2: psql 설치 후 직접 연결

```bash
# PostgreSQL 설치 (winget 사용)
winget install PostgreSQL.PostgreSQL

# 연결
psql "postgresql://postgres.xawypsrotrfoyozhrsbb:Nqf6tCgDSrXbO8kU@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
```

---

## 📋 빠른 점검 SQL

### 1. Phase 1-3 컬럼 추가 확인 (21개 컬럼)

```sql
-- 기대 결과: 21개 행 반환
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_region_metrics'
  AND (
    column_name LIKE '%new_enrollments%' OR
    column_name LIKE '%arpu%' OR
    column_name LIKE '%capacity_rate%' OR
    column_name LIKE '%overdue_rate%' OR
    column_name LIKE '%churn_rate%' OR
    column_name LIKE '%late_rate%' OR
    column_name LIKE '%absent_rate%'
  )
ORDER BY column_name;
```

**기대 결과**:
```
absent_rate_avg          | numeric(5,2)
absent_rate_p25          | numeric(5,2)
absent_rate_p75          | numeric(5,2)
arpu_avg                 | numeric(12,2)
arpu_p25                 | numeric(12,2)
arpu_p75                 | numeric(12,2)
capacity_rate_avg        | numeric(5,2)
capacity_rate_p25        | numeric(5,2)
capacity_rate_p75        | numeric(5,2)
churn_rate_avg           | numeric(5,2)
churn_rate_p25           | numeric(5,2)
churn_rate_p75           | numeric(5,2)
late_rate_avg            | numeric(5,2)
late_rate_p25            | numeric(5,2)
late_rate_p75            | numeric(5,2)
new_enrollments_avg      | numeric(8,2)
new_enrollments_p25      | numeric(8,2)
new_enrollments_p75      | numeric(8,2)
overdue_rate_avg         | numeric(5,2)
overdue_rate_p25         | numeric(5,2)
overdue_rate_p75         | numeric(5,2)
```

---

### 2. 지역 통계 데이터 확인 (최근 7일)

```sql
-- 기대 결과: 오늘 밤 23:59 KST 이후 데이터 생성됨
SELECT
  date_kst,
  region_code,
  region_level,
  tenant_count,
  new_enrollments_avg,
  arpu_avg,
  capacity_rate_avg,
  overdue_rate_avg,
  churn_rate_avg,
  late_rate_avg,
  absent_rate_avg
FROM analytics.daily_region_metrics
WHERE date_kst >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date_kst DESC, region_code
LIMIT 10;
```

**현재 상태**:
- 데이터 없음 (정상) - Edge Function이 매일 23:59 KST에 실행되므로 오늘 밤 이후 데이터 생성

---

### 3. 개별 매장 메트릭 확인

```sql
-- daily_store_metrics 테이블에 새 메트릭이 추가되었는지 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'daily_store_metrics'
  AND column_name IN (
    'new_enrollments', 'arpu', 'avg_capacity_rate',
    'overdue_rate', 'churn_rate', 'late_rate', 'absent_rate'
  )
ORDER BY column_name;
```

---

### 4. 마이그레이션 158 적용 확인

```sql
-- 기대 결과: 158 마이그레이션이 적용되어 있어야 함
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE version::text LIKE '158%'
ORDER BY version DESC;
```

**기대 결과**:
```
version | name                                              | inserted_at
--------|--------------------------------------------------|------------------
158     | add_phase123_metrics_to_region_metrics          | 2026-01-04 ...
```

---

### 5. Edge Function 로그 확인

**Supabase Dashboard에서**:
1. Edge Functions > daily-statistics-update
2. Logs 탭 클릭
3. 최근 실행 로그 확인

**확인 사항**:
- 마지막 실행 시각: 오늘 23:59 KST (아직 실행 안 됨)
- 에러 여부: 없어야 함
- 처리된 tenant 수: 1개 이상

---

## ✅ 점검 체크리스트

### 데이터베이스 스키마
- [ ] `analytics.daily_region_metrics` 테이블에 21개 컬럼 추가 확인
- [ ] 컬럼 타입 확인 (numeric(8,2), numeric(12,2), numeric(5,2))
- [ ] 컬럼 주석(COMMENT) 확인

### 데이터 확인
- [ ] `analytics.daily_region_metrics`에 최근 데이터 존재 (오늘 밤 이후)
- [ ] `analytics.daily_store_metrics`에 새 메트릭 컬럼 존재
- [ ] Edge Function 실행 로그 정상

### 프론트엔드
- [ ] AnalyticsPage에 11개 메트릭 카드 표시
- [ ] 지역 비교 데이터 표시 (오늘 밤 이후)
- [ ] TypeScript 컴파일 성공

---

## 🐛 문제 해결

### 문제 1: 컬럼이 21개가 아님
**해결**: Migration 158을 다시 실행
```sql
-- Supabase SQL Editor에서 실행
\i infra/supabase/supabase/migrations/158_add_phase123_metrics_to_region_metrics.sql
```

### 문제 2: 데이터가 없음
**원인**: Edge Function이 아직 실행 안 됨 (매일 23:59 KST)
**해결**: 수동 실행
```bash
# Supabase Dashboard > Edge Functions > daily-statistics-update > Invoke
# 또는
curl -X POST \
  'https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/daily-statistics-update' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

### 문제 3: Edge Function 에러
**확인**: Logs에서 에러 메시지 확인
**일반적 원인**:
- RLS 정책 문제
- 데이터 타입 불일치
- NULL 값 처리 누락

---

## 📊 예상 데이터 예시

### daily_region_metrics (오늘 밤 23:59 KST 이후)

```
region_code | region_level | new_enrollments_avg | arpu_avg | capacity_rate_avg | ...
------------|--------------|---------------------|----------|-------------------|----
1168010100  | dong         | 8.50                | 320000   | 78.25             | ...
11680       | sigungu      | 7.80                | 295000   | 75.50             | ...
11          | sido         | 6.90                | 285000   | 72.30             | ...
```

### 프론트엔드 표시 예시

```
┌─────────────────────────────┐
│ 👤+ 신규 등록               │
│ 12 명                       │
│                             │
│ 대치동 기준 상위 15%        │
│ 지역 평균: 8.5명            │
│ 상위 10%: 15명              │
└─────────────────────────────┘
```

---

## 📚 참고 파일

- **Migration**: `infra/supabase/supabase/migrations/158_add_phase123_metrics_to_region_metrics.sql`
- **Edge Function**: `infra/supabase/supabase/functions/daily-statistics-update/index.ts`
- **Frontend**: `apps/academy-admin/src/pages/AnalyticsPage.tsx`
- **Component**: `apps/academy-admin/src/components/analytics-cards/RegionalMetricCard.tsx`
- **완전 점검 SQL**: `infra/supabase/check_phase123_deployment.sql`

---

**작성일**: 2026-01-04
**다음 자동 실행**: 오늘 23:59 KST (약 21시간 30분 후)
