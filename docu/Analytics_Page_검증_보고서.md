# 통계분석 페이지 (AnalyticsPage) 검증 보고서

**검증 일시**: 2026-01-01
**검증자**: Claude Sonnet 4.5
**검증 범위**: http://localhost:3000/analytics 페이지 및 지역 통계 기능 전체

---

## 📋 Executive Summary

통계분석 페이지의 **프론트엔드 UI 및 대부분의 데이터 인프라는 구현 완료**되었으나, **백엔드 집계 로직에 P0 이슈**가 발견되었습니다.

### 핵심 발견사항
- ✅ **테이블/스키마**: `analytics.daily_store_metrics`, `analytics.daily_region_metrics` 완전 구현
- ✅ **프론트엔드**: AnalyticsPage UI, 지역 비교, AI 인사이트, 히트맵 모두 구현
- 🔴 **P0 이슈**: **지역별 집계 로직 미구현** (daily-statistics-update Edge Function)
- ⚠️ **영향도**: 현재 AnalyticsPage는 **실제 데이터를 표시하지 못함** (테이블이 비어있음)

---

## 1️⃣ P0 이슈 (Critical - 즉시 조치 필요)

### P0-1: 지역별 통계 집계 로직 미구현 🔴

**문제**: `daily-statistics-update` Edge Function이 `analytics.daily_store_metrics`만 집계하고, **`analytics.daily_region_metrics`는 집계하지 않음**

**현재 구현** ([daily-statistics-update/index.ts:136](../infra/supabase/supabase/functions/daily-statistics-update/index.ts#L136)):
```typescript
// ✅ 구현됨: 매장 단위 통계 집계
const { error: upsertError } = await supabase
  .from('analytics.daily_store_metrics')
  .upsert({
    tenant_id: tenant.id,
    date_kst: dateKst,
    student_count: studentCount,
    revenue: revenue,
    attendance_rate: attendanceRate,
    // ...
  });

// ❌ 누락: 지역별 통계 집계 (analytics.daily_region_metrics)
// 문서 요구사항: 아키텍처 문서 3.6.5, 통계문서 FR-05
```

**문서 요구사항**:
- **아키텍처 문서 3.6.5**: 지역 단위 집계 (동/구/시/권역)
- **통계문서 FR-05**: `analytics.daily_region_metrics` 1일 1회 집계 (00:30 KST)
- **통계문서 237-255줄**: region_code, region_level별 집계 필수

**필요한 집계 로직**:
```sql
-- 동 단위 집계 예시 (region_level='dong')
INSERT INTO analytics.daily_region_metrics (
  region_code,        -- 행정동 코드 (location_code)
  region_level,       -- 'dong'
  industry_type,      -- 'academy'
  tenant_count,       -- 해당 동의 학원 수 (>= 3 조건)
  student_count,      -- 전체 학생 수 합계
  avg_arpu,           -- ARPU 평균
  avg_attendance_rate,-- 출석률 평균
  attendance_rate_p25,-- 출석률 25분위수
  attendance_rate_p75,-- 출석률 75분위수
  student_growth_rate_avg,  -- 학생 성장률 평균
  revenue_growth_rate_avg,  -- 매출 성장률 평균
  date_kst
)
SELECT
  location_code,
  'dong',
  industry_type,
  COUNT(*) AS tenant_count,
  SUM(student_count) AS student_count,
  AVG(arpu) AS avg_arpu,
  AVG(attendance_rate) AS avg_attendance_rate,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY attendance_rate) AS attendance_rate_p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY attendance_rate) AS attendance_rate_p75,
  -- ... 성장률 계산
  date_kst
FROM analytics.daily_store_metrics
WHERE date_kst = :yesterday
GROUP BY location_code, industry_type, date_kst
HAVING COUNT(*) >= 3; -- 최소 샘플 수 조건
```

**영향도**:
- AnalyticsPage가 `fetchDailyRegionMetrics` 호출 시 **빈 결과 반환**
- 지역 비교, AI 인사이트, 순위 계산 모두 **동작하지 않음**
- 사용자는 "해당 지역의 통계는 매장 수 부족으로 제공되지 않습니다" 메시지만 표시됨

**조치 방안**:
1. `daily-statistics-update/index.ts`에 지역별 집계 로직 추가
2. 구/시/권역 단위 집계도 함께 구현 (Fallback 우선순위)
3. 최소 샘플 수 조건 (tenant_count >= 3) 적용
4. 성장률 계산 (전월 대비 증감률)

---

### P0-2: 실시간 집계 스테이징 테이블 미구현 ⚠️

**문제**: `attendance_stats_staging`, `class_heatmap_staging` 테이블 및 집계 로직 미구현

**문서 요구사항** (통계문서 FR-05):
- `attendance_stats_staging`: **1분 단위** 집계
- `class_heatmap_staging`: **10분 단위** 집계

**현재 상태**:
- 테이블 마이그레이션 없음
- Cron Job 없음 (1분/10분 단위 Edge Function 필요)

**영향도**:
- 히트맵 데이터가 **일일 집계에만 의존** (실시간 갱신 불가)
- 아키텍처 문서 3.6.5의 "Materialized View" 성능 최적화 미적용

**조치 방안**:
1. 스테이징 테이블 마이그레이션 생성
2. 1분/10분 단위 Edge Function 구현
3. Cron Job 등록 (pg_cron)

**우선순위 조정 제안**: P0 → **P1**로 하향 조정
**이유**: 현재 일일 집계만으로도 MVP 기능은 동작 가능. 실시간 집계는 성능 최적화 단계에서 추가 가능.

---

### P0-3: ranking_snapshot, ai_insights 저장 실패 시 에러 처리 미흡 ⚠️

**문제**: [AnalyticsPage.tsx:555-593](../apps/academy-admin/src/pages/AnalyticsPage.tsx#L555-L593)에서 저장 실패 시 **에러 무시 처리**

**현재 구현**:
```typescript
try {
  await apiClient.post('ranking_snapshot', { /* ... */ });
} catch (error) {
  // 저장 실패는 무시 (선택적 기능)
  logWarn('AnalyticsPage:SaveRankingSnapshot', 'Failed to save ranking snapshot', error);
}
```

**문제점**:
- 사용자에게 **피드백 없음** (저장 성공/실패 여부를 알 수 없음)
- 디버깅 어려움 (로그만 남고 UI에는 표시 안 됨)
- RLS 정책 오류, 네트워크 오류 등을 **조용히 무시**

**조치 방안**:
1. 저장 성공 시 토스트 메시지 표시 (선택적)
2. 저장 실패 시 **경고 배너** 또는 **재시도 버튼** 표시
3. `logError`로 변경하여 에러 트래킹 시스템에 전송

**우선순위 조정 제안**: P0 → **P1**로 하향 조정
**이유**: 저장 실패가 페이지 동작을 막지는 않으므로 UX 개선 수준.

---

## 2️⃣ P1 이슈 (High - 단기 구현 필요)

### P1-1: HomePage에 지역 통계 요약 카드 미통합

**문제**: [HomePage.tsx](../apps/academy-admin/src/pages/HomePage.tsx)에 지역 통계 요약 카드가 없음

**문서 요구사항** (아키텍처 문서 4.6):
> 홈 대시보드 우선순위 5순위: **통계/트렌드 요약**

**현재 구현**:
```typescript
// HomePage 카드 우선순위:
// 1. EMERGENCY > 2. AI_BRIEFING > 3. TASKS > 4. CLASSES > 5. STATS > 6. BILLING

// ✅ 구현됨: STATS (useStudentStatsCards, useAttendanceStatsCards, ...)
// ❌ 누락: 지역 통계 요약 카드 (예: "우리 학원, 강남구에서 출석률 상위 10%")
```

**조치 방안**:
1. `useRegionalStatsCards` 훅 생성 (지역 순위/비교 요약)
2. HomePage의 `STATS` 그룹에 추가
3. 카드 클릭 시 `/analytics` 페이지로 이동

**예상 카드 내용**:
```
📊 지역 순위
강남구에서 출석률 상위 15%
지역 평균 대비 +8% 우수합니다.
```

---

### P1-2: 월간 리포트 PDF 생성 기능 미구현

**문제**: [AnalyticsPage.tsx:647](../apps/academy-admin/src/pages/AnalyticsPage.tsx#L647)의 `generateMonthlyReport`가 **JSON 다운로드만 제공**

**문서 요구사항** (통계문서 FR-09):
> 월간 경영 리포트: 핵심 지표, 지역 대비 평가, 개선점 (PDF 또는 대시보드 형태)

**현재 구현**:
```typescript
const generateMonthlyReport = useMutation({
  mutationFn: async () => {
    // ... 데이터 수집 ...
    // ❌ JSON 다운로드만 제공
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    // ...
  }
});
```

**조치 방안**:
1. PDF 생성 라이브러리 추가 (`jspdf`, `pdfmake` 등)
2. 템플릿 디자인 (헤더, 차트, 표)
3. 또는 Edge Function으로 서버사이드 PDF 생성

---

### P1-3: Materialized View Refresh 전략 미구현

**문제**: MV 사용 언급만 있고 실제 구현 없음

**문서 요구사항** (아키텍처 문서 7.5):
> Materialized View 활용으로 성능 최적화

**조치 방안**:
1. `daily_region_metrics_mv` 생성
2. Cron Job으로 매일 00:30 KST에 REFRESH
3. AnalyticsPage에서 MV 조회

---

### P1-4: 지역 정보 미설정 시 안내 강화

**문제**: [AnalyticsPage.tsx](../apps/academy-admin/src/pages/AnalyticsPage.tsx)에서 경고 메시지만 표시

**현재 구현**:
```typescript
if (!locationInfo.location_code) {
  return <div>경고: 위치 정보가 설정되지 않았습니다. 설정에서 위치를 등록해주세요.</div>
}
```

**개선 방안**:
```tsx
<ContextRecommendationBanner
  title="지역 통계를 사용하려면 위치 정보를 설정하세요"
  actionLabel="설정하기"
  actionLink="/settings/location"
/>
```

---

### P1-5: AnalyticsPage 코드 분리 (1234줄)

**문제**: 파일 크기가 너무 커서 유지보수 어려움

**조치 방안**:
1. `HeatmapCard.tsx` 컴포넌트 분리
2. `RegionalComparisonChart.tsx` 컴포넌트 분리
3. `regional-comparison-utils.ts` 유틸리티 분리 (Fallback 로직)

---

## 3️⃣ P2 이슈 (Medium - 중기 구현 필요)

### P2-1: 데이터 무결성 보정 (Backfill & Repair Mode)

**문서 요구사항** (아키텍처 문서 3.6.6):
> 관리자 대시보드에서 "데이터 재동기화" 기능

**조치 방안**:
1. Backfill Edge Function 구현 (과거 데이터 재집계)
2. Repair Mode UI 추가 (관리자 전용)

---

### P2-2: AI 인사이트 스케줄 자동화

**문서 요구사항** (아키텍처 문서 2-4):
> Phase 1: 일일 브리핑, Phase 2: 실시간 분석

**현재 상태**: AnalyticsPage에서 수동 생성만 가능

**조치 방안**:
1. `ai-regional-insights-generation` Edge Function 생성
2. Cron Job 등록 (매일 07:30 KST)

---

### P2-3: 권역별 평균/순위 계산

**문제**: 권역 코드 사용은 구현되었으나 집계 미확인

**조치 방안**:
1. `region_level='region_zone'` 집계 로직 추가
2. Fallback 우선순위에 권역 추가

---

### P2-4: 히트맵 색상 임계값 Policy 기반 관리

**문제**: [AnalyticsPage.tsx:47-64](../apps/academy-admin/src/pages/AnalyticsPage.tsx#L47-L64)에서 하드코딩된 상수 사용

**현재 구현**:
```typescript
const PERCENTILE_FALLBACK_RATIOS = {
  P25_FACTOR: 0.75,
  P75_FACTOR: 1.25,
  // ... (하드코딩)
};
```

**조치 방안**:
1. `tenant_settings`에 `analytics.percentile_ratios` 키 추가
2. `useTenantSettingByPath` 훅으로 조회
3. Fallback만 하드코딩 유지

---

### P2-5: 익명화 보안 정책 적용

**문서 요구사항** (기술문서 15-3-3-2):
> RLS 기반 데이터 격리

**현재 상태**: `daily_region_metrics`의 RLS 정책이 `true` (모든 인증 사용자 접근 가능)

**조치 방안**:
```sql
CREATE POLICY industry_region_filter_daily_region_metrics
ON analytics.daily_region_metrics
FOR SELECT TO authenticated
USING (
  -- 사용자의 업종과 지역 정보를 JWT claim에서 가져와서 필터링
  industry_type = (auth.jwt() ->> 'industry_type')::text
  AND region_code = (
    SELECT location_code FROM tenant_settings
    WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
);
```

---

## 4️⃣ 코드 품질 개선 (QUALITY)

### QUALITY-1: AnalyticsPage 코드 분리 (P1-5와 동일)

### QUALITY-2: Fallback 로직 중복 제거

**문제**: 동→구→시도→권역 fallback 로직이 반복됨

**조치 방안**:
```typescript
// utils/regional-comparison-utils.ts
export function findBestComparisonGroup(
  locationInfo: LocationInfo,
  regionMetrics: DailyRegionMetrics[]
): { group: string; level: 'dong' | 'gu' | 'si' | 'region_zone'; usedFallback: boolean } {
  // ...
}
```

### QUALITY-3: 에러 처리 개선 (P0-3와 동일)

---

## 5️⃣ 성능 최적화 (PERF)

### PERF-1: 지역 통계 API 캐싱 전략

**현재**: 3초 staleTime, 5초 refetchInterval

**개선 방안**:
1. Redis 캐시 활용 (Edge Function 레벨)
2. MV 기반 성능 최적화

### PERF-2: Percentile 계산 최적화

**현재**: p25, median, p75 기반 추정 로직

**개선 방안**:
```sql
-- DB에서 직접 계산
SELECT
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY attendance_rate) AS p25,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY attendance_rate) AS p75
FROM analytics.daily_region_metrics;
```

---

## 6️⃣ UX 개선

### UX-1: 지역 정보 미설정 시 안내 강화 (P1-4와 동일)

### UX-2: 히트맵 툴팁 개선

**현재**: `title` 속성만 사용

**개선 방안**:
```tsx
<Tooltip content={
  <div>
    <strong>{date}</strong><br />
    출석률: {value}%<br />
    주간 평균: {weeklyAvg}%
  </div>
}>
  <div className="heatmap-cell" />
</Tooltip>
```

### UX-3: 모바일 히트맵 UX 개선

**문제**: 35개 셀 그리드가 모바일에서 작게 보임

**개선 방안**:
1. 스와이프로 주간 단위 이동
2. 주간 접기/펼치기 기능

---

## 📊 우선순위별 요약

| 우선순위 | 항목 수 | 주요 항목 |
|---------|---------|----------|
| **P0** | 3개 | 지역 집계 로직, 실시간 집계, 저장 에러 처리 |
| **P1** | 5개 | 홈 통합, PDF 생성, MV 전략, 위치 안내, 코드 분리 |
| **P2** | 5개 | Backfill, AI 스케줄, 권역별 통계, Policy 전환, 익명화 |
| **QUALITY** | 3개 | 코드 분리, 중복 제거, 에러 처리 |
| **PERF** | 2개 | 캐싱 전략, Percentile 최적화 |
| **UX** | 3개 | 설정 안내, 툴팁, 모바일 UX |

---

## 🎯 권장 조치 계획

### 즉시 조치 (P0)

1. **[P0-1] 지역 집계 로직 구현** (최우선)
   - `daily-statistics-update/index.ts` 수정
   - 동/구/시 단위 집계 추가
   - 성장률 계산 로직 추가

2. **[P0-2 → P1] 실시간 집계 스테이징 테이블**
   - P1로 하향 조정 (MVP에 필수 아님)

3. **[P0-3 → P1] 저장 에러 처리 개선**
   - P1로 하향 조정 (UX 개선 수준)

### 단기 조치 (P1, 1-2주 내)

1. HomePage에 지역 통계 요약 카드 추가
2. 월간 리포트 PDF 생성 기능 구현
3. AnalyticsPage 코드 분리 (유지보수성 향상)

### 중기 조치 (P2, 1-2개월 내)

1. AI 인사이트 스케줄 자동화
2. 데이터 무결성 보정 기능 구현
3. 보안 정책 강화 (익명화, RLS)

---

## 📌 결론

**현재 상태**: 프론트엔드 UI는 완성되었으나, **백엔드 집계 로직 미구현으로 실제 데이터가 표시되지 않음**

**최우선 조치**: `daily-statistics-update` Edge Function에 **지역별 집계 로직 추가**

**예상 작업 시간**: P0-1 구현에 약 4-6시간 소요 (SQL 작성, 테스트, 배포)

**완료 후 기대 효과**:
- AnalyticsPage가 실제 지역 통계 데이터를 표시
- 지역 비교, AI 인사이트, 순위 계산 모두 정상 동작
- 사용자가 지역 기반 경영 인사이트를 활용 가능

---

**검증 완료 일시**: 2026-01-01
**다음 단계**: P0-1 이슈 수정 후 재검증
