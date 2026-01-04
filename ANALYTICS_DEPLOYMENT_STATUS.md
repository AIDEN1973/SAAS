# Analytics 페이지 배포 상태 진단 보고서

**생성일**: 2026-01-04
**작성자**: Claude Code
**목적**: P0 - 배포 상태 확인 (Edge Function, 데이터)

---

## 📋 요약 (Executive Summary)

| 항목 | 상태 | 비고 |
|------|------|------|
| Edge Functions 배포 | ✅ 완료 | daily-statistics-update (34 versions), ai-regional-insights-generation (4 versions) |
| Migration 파일 | ✅ 존재 | 141_create_analytics_materialized_views.sql, 142_add_analytics_mv_refresh_cron.sql, 143_add_ai_regional_insights_cron.sql |
| Cron Jobs 설정 | ⚠️ 확인 필요 | Migration에 정의되어 있으나 실제 실행 여부 미확인 |
| 데이터 존재 여부 | ⚠️ 확인 필요 | RLS 정책으로 인해 원격 조회 불가 |
| 히트맵 표시 | ❌ 미작동 | 브라우저 콘솔 디버그 로그 확인 필요 |

**결론**: Edge Functions은 정상 배포되었으나, 데이터 생성 여부와 Cron Jobs 실행 상태는 추가 확인이 필요합니다.

---

## ✅ 1. Edge Functions 배포 상태

### 1.1 daily-statistics-update
- **상태**: ✅ ACTIVE
- **버전**: 34개 (최신: 2026-01-03 09:29:46)
- **기능**:
  - 매일 23:59 KST에 실행 예정
  - `analytics.daily_store_metrics` 테이블에 매장별 통계 저장
  - `analytics.daily_region_metrics` 테이블에 지역별 집계 저장 (최소 3개 매장 필요)
- **소스 위치**: [infra/supabase/supabase/functions/daily-statistics-update/index.ts](infra/supabase/supabase/functions/daily-statistics-update/index.ts)

**주요 로직**:
```typescript
// Lines 251-446: 지역별 통계 집계
// - 동/구/시 단위 그룹화
// - 최소 샘플 수 조건 (>= 3개 매장)
// - 학생 수, 매출, 출석률, 성장률 집계
// - Percentile 계산 (P25, P75)
```

### 1.2 ai-regional-insights-generation
- **상태**: ✅ ACTIVE
- **버전**: 4개 (최신: 2026-01-03 09:29:46)
- **기능**:
  - 매일 07:30 KST에 실행 예정
  - AI 기반 지역 비교 인사이트 생성
  - `analytics.ai_insights` 테이블에 저장
- **소스 위치**: [infra/supabase/supabase/functions/ai-regional-insights-generation/index.ts](infra/supabase/supabase/functions/ai-regional-insights-generation/index.ts)

---

## 📊 2. 데이터베이스 스키마

### 2.1 테이블 구조

#### `analytics.daily_store_metrics`
매장별 일일 통계 (정본, `daily_metrics`는 구버전)
- `tenant_id`, `date_kst`, `student_count`, `revenue`, `attendance_rate`
- `arpu` (학생 1인당 평균 매출)
- `avg_students_per_class`, `avg_capacity_rate`

#### `analytics.daily_region_metrics`
지역별 집계 통계
- `region_code`, `region_level` (dong, gu_gun, si)
- `tenant_count`, `student_count`
- `avg_arpu`, `avg_attendance_rate`
- `attendance_rate_p25`, `attendance_rate_p75`
- `student_growth_rate_avg`, `revenue_growth_rate_avg`

#### `analytics.ai_insights`
AI 생성 인사이트
- `insight_type` = 'regional_comparison'
- `content` (AI 생성 텍스트)

### 2.2 Materialized Views

#### `analytics.daily_region_metrics_mv`
- **목적**: 지역 통계 조회 성능 최적화
- **데이터 범위**: 최근 30일
- **Refresh**: 매일 00:30 KST (Cron Job)
- **Migration**: [141_create_analytics_materialized_views.sql](infra/supabase/supabase/migrations/141_create_analytics_materialized_views.sql)

#### `analytics.daily_store_metrics_mv`
- **목적**: 매장 통계 조회 성능 최적화
- **데이터 범위**: 최근 90일
- **Refresh**: 매일 00:30 KST (Cron Job)

---

## ⏰ 3. Cron Jobs 스케줄

### 3.1 daily-statistics-update
- **스케줄**: 매일 23:59 KST (14:59 UTC)
- **Migration**: [076_setup_edge_function_cron_jobs.sql](infra/supabase/supabase/migrations/076_setup_edge_function_cron_jobs.sql) (예상)
- **상태**: ⚠️ 확인 필요

### 3.2 analytics-mv-refresh
- **스케줄**: 매일 00:30 KST (15:30 UTC, 전날)
- **Migration**: [142_add_analytics_mv_refresh_cron.sql](infra/supabase/supabase/migrations/142_add_analytics_mv_refresh_cron.sql)
- **실행 내용**: `analytics.refresh_all_materialized_views()` 함수 호출
- **상태**: ⚠️ 확인 필요

### 3.3 ai-regional-insights-generation
- **스케줄**: 매일 07:30 KST (22:30 UTC, 전날)
- **Migration**: [143_add_ai_regional_insights_cron.sql](infra/supabase/supabase/migrations/143_add_ai_regional_insights_cron.sql)
- **상태**: ⚠️ 확인 필요

---

## ❌ 4. 히트맵 미작동 원인 분석

### 4.1 현재 상황
- AnalyticsPage에서 "지역 히트맵" 섹션이 비어있음
- "AI 인사이트" 섹션도 내용이 나오지 않음

### 4.2 가능한 원인

#### 원인 1: 지역 정보 미설정
**확인 방법**:
```sql
SELECT tenant_id, value->'location' as location
FROM tenant_settings
WHERE key = 'config';
```

**필요 필드**:
- `location_code` (행정동 코드, 예: 1168010100)
- `sigungu_code` (시군구 코드, 예: 11680)
- `sido_code` (시도 코드, 예: 11)

**조치**: Tenant 설정에서 지역 정보 입력

#### 원인 2: 데이터 미생성
- `analytics.daily_region_metrics` 테이블이 비어있음
- Edge Function이 아직 실행되지 않았거나 실패함

**확인 방법**:
```sql
SELECT COUNT(*) FROM analytics.daily_region_metrics
WHERE region_level IN ('dong', 'gu_gun')
AND date_kst >= CURRENT_DATE - INTERVAL '7 days';
```

**조치**: 수동으로 Edge Function 실행
```bash
curl -X POST "https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/daily-statistics-update" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

#### 원인 3: 최소 샘플 수 미달
- 지역 집계는 **최소 3개 매장**이 동일 지역에 있어야 생성됨
- 현재 tenant가 3개 미만이면 집계되지 않음

**조치**:
- 다른 지역 레벨 (gu_gun, si)로 Fallback 확인
- 테스트 데이터 추가 (최소 3개 매장)

#### 원인 4: RLS 정책 문제
- `analytics.daily_region_metrics`에 대한 SELECT 권한 부족

**조치**: RLS 정책 확인 및 수정

#### 원인 5: Cron Job 미실행
- Cron Job이 등록되지 않았거나 실패함

**조치**: Supabase Dashboard에서 Cron Job 상태 확인

### 4.3 디버그 로그 확인 방법

브라우저에서 [http://localhost:3000/analytics](http://localhost:3000/analytics) 접속 후 개발자 도구 콘솔 확인:

**예상 로그**:
```
[HeatmapCard] tenantId가 없습니다
[HeatmapCard] 지역 정보가 없습니다 { location_code: null, sigungu_code: null }
[HeatmapCard] 행정동 데이터 조회 결과: 0건
[HeatmapCard] 히트맵 데이터가 없습니다
```

---

## 🔧 5. 권장 조치사항

### 즉시 조치 (P0)

1. **브라우저 콘솔 디버그 로그 확인**
   - [http://localhost:3000/analytics](http://localhost:3000/analytics) 접속
   - F12 → Console 탭에서 `[HeatmapCard]` 로그 확인
   - 지역 정보 누락 여부 확인

2. **Tenant 지역 정보 확인**
   - Supabase Dashboard → Table Editor → `tenant_settings`
   - `key = 'config'`인 row의 `value.location` 필드 확인
   - `location_code`, `sigungu_code`, `sido_code`가 모두 설정되어 있는지 확인

3. **Edge Function 수동 실행**
   - Supabase Dashboard → Edge Functions → `daily-statistics-update`
   - "Invoke now" 클릭하여 수동 실행
   - Logs 탭에서 실행 결과 확인

4. **데이터 생성 확인**
   - Supabase Dashboard → SQL Editor
   - 아래 쿼리 실행:
     ```sql
     -- 지역 통계 데이터 확인
     SELECT * FROM analytics.daily_region_metrics
     ORDER BY date_kst DESC
     LIMIT 10;

     -- AI 인사이트 데이터 확인
     SELECT * FROM analytics.ai_insights
     WHERE insight_type = 'regional_comparison'
     ORDER BY created_at DESC
     LIMIT 5;
     ```

### 단기 조치 (P1)

5. **Cron Job 상태 확인**
   - Supabase Dashboard → Database → Cron Jobs
   - `daily-statistics-update`, `analytics-mv-refresh`, `ai-regional-insights-generation` 등록 여부 확인
   - 실행 이력 (job_run_details) 확인

6. **RLS 정책 확인**
   - `analytics.daily_region_metrics` 테이블의 RLS 정책 확인
   - Frontend에서 SELECT 권한이 있는지 확인

7. **Migration 적용 확인**
   - Supabase Dashboard → Database → Migrations
   - 141, 142, 143번 Migration이 모두 적용되었는지 확인

### 중기 조치 (P2)

8. **모니터링 대시보드 추가**
   - Edge Function 실행 성공/실패 카운트
   - 지역별 데이터 생성 건수
   - AI 인사이트 생성 건수

9. **에러 알림 설정**
   - Edge Function 실패 시 Slack/Email 알림
   - 데이터 미생성 시 알림

---

## 📝 6. 체크리스트

### Edge Functions
- [x] daily-statistics-update 배포됨 (34 versions)
- [x] ai-regional-insights-generation 배포됨 (4 versions)
- [ ] Edge Function 실행 로그 확인
- [ ] Edge Function 수동 실행 테스트

### 데이터베이스
- [x] Migration 파일 존재 (141, 142, 143)
- [ ] Migration 적용 여부 확인
- [ ] daily_region_metrics 테이블에 데이터 존재 확인
- [ ] daily_store_metrics 테이블에 데이터 존재 확인
- [ ] ai_insights 테이블에 데이터 존재 확인
- [ ] Materialized View 존재 및 Refresh 확인

### Cron Jobs
- [x] Cron Job 설정 코드 존재 (142, 143번 Migration)
- [ ] Cron Job 등록 여부 확인 (Supabase Dashboard)
- [ ] Cron Job 실행 이력 확인
- [ ] Cron Job 스케줄 정확성 확인 (UTC/KST 변환)

### Frontend
- [x] AnalyticsPage.tsx에 디버그 로그 추가됨
- [ ] 브라우저 콘솔에서 디버그 로그 확인
- [ ] Tenant 지역 정보 설정 확인
- [ ] Heatmap 데이터 표시 확인
- [ ] AI Insights 데이터 표시 확인

### 테스트
- [ ] 최소 3개 매장이 동일 지역에 설정되어 있는지 확인
- [ ] 지역 Fallback 로직 테스트 (동→구→시)
- [ ] 빈 데이터 상태 메시지 표시 확인

---

## 🎯 7. 다음 단계 (Next Steps)

1. **사용자에게 요청**:
   - 브라우저에서 [http://localhost:3000/analytics](http://localhost:3000/analytics) 접속
   - F12 → Console 탭 열기
   - `[HeatmapCard]` 로그 스크린샷 또는 복사하여 공유

2. **개발자 작업**:
   - Supabase Dashboard 로그인
   - Edge Functions 실행 이력 확인
   - SQL Editor에서 데이터 존재 여부 확인
   - Cron Jobs 등록 상태 확인

3. **문제 해결 우선순위**:
   - P0: Tenant 지역 정보 설정
   - P1: Edge Function 수동 실행 및 데이터 생성
   - P2: Cron Jobs 자동 실행 확인

---

## 📞 지원

**문제 발생 시**:
1. 이 문서의 "권장 조치사항" 섹션 참조
2. 브라우저 콘솔 로그 확인
3. Supabase Dashboard에서 Edge Function 로그 확인
4. GitHub Issues에 문의

**관련 문서**:
- [통계문서](docu/전체 기술문서.txt) - FR-05 지역 비교 분석
- [아키텍처 문서](docu/디어쌤 아키텍처.md) - 3.6.5 Analytics 스키마
- [ANALYTICS_DEPLOYMENT_GUIDE.md](ANALYTICS_DEPLOYMENT_GUIDE.md) - 상세 배포 가이드

---

**작성 완료**: 2026-01-04
**다음 검토 예정**: 데이터 확인 후 업데이트
