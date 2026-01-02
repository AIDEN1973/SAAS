# AI 지역 인사이트 자동 생성 구현 문서

## 개요

AI 지역 인사이트 자동 생성 Edge Function을 구현하여 매일 07:30 KST에 모든 활성 테넌트의 지역 통계 인사이트를 자동으로 생성합니다.

## 생성된 파일

### 1. Edge Function
**위치**: `infra/supabase/supabase/functions/ai-regional-insights-generation/index.ts`

**기능**:
- 모든 활성 테넌트에 대해 지역 통계 인사이트 자동 생성
- AnalyticsPage의 AI 인사이트 생성 로직 완전 재구현
- 4가지 메트릭(학생 수, 매출, 출석률, 성장률)에 대한 인사이트 생성
- 중복 방지: 같은 날짜의 기존 인사이트는 스킵
- 지역 비교 그룹 결정 로직 (동 → 구 → 시도 → 권역 fallback)

**주요 로직**:
1. **AI 활성화 확인**: shouldUseAI 함수로 테넌트별 AI 기능 활성화 여부 확인
2. **중복 방지**: 오늘 이미 생성된 regional_analytics 인사이트 확인
3. **위치 정보 조회**: tenant_settings에서 지역 정보 및 업종 조회
4. **메트릭 계산**:
   - 학생 수: persons 테이블 학생 개수
   - 매출: invoices 테이블 현재 월 수납액
   - 출석률: attendance_logs 현재 월 출석률 계산
   - 성장률: 현재 월 vs 전월 학생 수 성장률

5. **지역 비교 그룹 결정** (최소 샘플 수 3개):
   - 1순위: 같은 행정동 (location_code)
   - 2순위: 같은 구 (sigungu_code)
   - 3순위: 같은 시도 (sido_code)
   - 4순위: 없음 (현재 구현)

6. **Percentile 계산**:
   - daily_region_metrics의 통계값(p25, median, p75) 기반
   - 우리 학원의 값이 어느 위치인지 1-99 범위로 계산

7. **Rank 계산**:
   - percentile을 역으로 계산하여 몇 위인지 결정
   - rank = number_of_values_below + 1

8. **인사이트 저장**: ai_insights 테이블에 다음 정보 저장
   - tenant_id: 테넌트 ID
   - student_id: null (테넌트 레벨 인사이트)
   - insight_type: 'regional_analytics'
   - title: "{지역} 지역 {메트릭} 분석"
   - summary: AI 해석 문장
   - details: 상세 정보 (value, average, percentile, rank 등)
   - related_entity_type: 'regional_analytics'
   - related_entity_id: location_code
   - status: 'active'

### 2. 마이그레이션 파일
**위치**: `infra/supabase/supabase/migrations/143_add_ai_regional_insights_cron.sql`

**기능**:
- pg_cron을 통한 Cron Job 등록
- 매일 07:30 KST (UTC 22:30)에 Edge Function 자동 호출

**주의사항**:
- Self-Hosted Supabase: pg_cron 방식 (마이그레이션 파일로 자동 등록)
- Cloud Supabase: 대시보드에서 Functions > Cron Job으로 수동 설정 필요

## 아키텍처 및 설계

### Zero-Trust 원칙 준수
- tenantId는 Context에서 자동으로 가져옴 (하드코딩 금지)
- industryType도 tenant_settings에서 조회

### 중복 방지 메커니즘
```sql
-- 오늘 이미 생성된 regional_analytics 인사이트 확인
SELECT id FROM ai_insights
WHERE tenant_id = ?
AND insight_type = 'regional_analytics'
AND created_at BETWEEN '2024-01-02T00:00:00' AND '2024-01-02T23:59:59'
```

### 지역 비교 그룹 결정 로직 (아키텍처 문서 3.6.2)
```
동 (location_code)
  ↓ (샘플 수 < 3 또는 비교 불가)
구 (sigungu_code)
  ↓ (샘플 수 < 3 또는 비교 불가)
시도 (sido_code)
  ↓ (샘플 수 < 3 또는 비교 불가)
비교 불가 (insufficient)
```

### Percentile 계산 알고리즘 (통계문서 2.4)
```
값이 p75 이상: 75-100 percentile
값이 median~p75: 50-75 percentile
값이 p25~median: 25-50 percentile
값이 p25 미만: 0-25 percentile
```

### Rank 계산
```
rank = (100 - percentile) / 100 * sample_count + 1
```

## 데이터 흐름

```
1. Edge Function 시작 (매일 07:30 KST)
   ↓
2. 모든 활성 테넌트 조회
   ↓
3. 테넌트별 반복:
   a) AI 활성화 확인
   b) 중복 인사이트 확인
   c) 위치 정보 조회
   d) 4가지 메트릭 처리:
      - 메트릭 값 계산
      - 지역 통계 조회 (daily_region_metrics)
      - 지역 비교 그룹 결정
      - Percentile & Rank 계산
      - 인사이트 생성
   ↓
4. ai_insights 테이블에 일괄 저장
   ↓
5. 결과 반환 (생성 개수)
```

## 의존성

### Shared 모듈
- `policy-utils.ts`: shouldUseAI, getTenantSettingByPath
- `withTenant.ts`: 테넌트 RLS 적용 쿼리
- `date-utils.ts`: toKST, toKSTDate, toKSTMonth
- `env-registry.ts`: 환경 변수 관리

### 데이터베이스
- `tenants`: 활성 테넌트 목록
- `tenant_settings`: 테넌트 설정 (위치, 업종)
- `persons`: 학생 정보
- `invoices`: 수납 정보
- `attendance_logs`: 출석 정보
- `analytics.daily_region_metrics`: 지역 통계 (일일)
- `ai_insights`: AI 인사이트 저장

## 에러 처리

### 로그 레벨
- `console.log`: 정상 실행
- `console.warn`: 안전성 체크 실패, fallback 사용
- `console.error`: 쿼리 실패, 테넌트 처리 실패

### 무시 가능 에러
- 지역 통계 조회 실패 → 비교 불가, 인사이트 미생성
- AI 비활성화 → 해당 테넌트 스킵
- 중복 인사이트 존재 → 이미 생성된 인사이트 스킵

### 치명적 에러
- 테넌트 목록 조회 실패 → 전체 함수 중단
- 환경 변수 누락 → 함수 시작 불가

## 성능 고려사항

### 쿼리 최적화
- `daily_region_metrics` 테이블의 인덱스 활용
  ```sql
  (industry_type, region_level, region_code, date_kst)
  ```
- `ai_insights` 중복 방지 인덱스 (마이그레이션 106)
  ```sql
  (tenant_id, insight_type, title, date_trunc('day', created_at AT TIME ZONE 'UTC'))
  ```

### 배치 처리
- 모든 메트릭을 병렬로 처리하지 않음 (순차 처리)
- 테넌트별로 순차 처리 (병렬 처리는 향후 개선)

### 실행 시간 추정
- 테넌트 1개당: 500ms - 2초
- 100개 테넌트 기준: 1분 - 3분

## 테스트 방법

### 수동 테스트
```bash
# Edge Function 직접 호출
curl -X POST \
  https://<project>.supabase.co/functions/v1/ai-regional-insights-generation \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 데이터 검증
```sql
-- 생성된 인사이트 확인
SELECT tenant_id, insight_type, title, created_at
FROM ai_insights
WHERE insight_type = 'regional_analytics'
AND created_at::date = CURRENT_DATE;

-- 중복 확인
SELECT tenant_id, COUNT(*) as count
FROM ai_insights
WHERE insight_type = 'regional_analytics'
GROUP BY tenant_id
HAVING COUNT(*) > 1;
```

## 배포 체크리스트

- [ ] Edge Function 코드 검토
- [ ] 마이그레이션 파일 검토
- [ ] 의존성 모듈 확인 (policy-utils, withTenant 등)
- [ ] 데이터베이스 테이블 확인
- [ ] 마이그레이션 실행 (143번)
- [ ] Cron Job 등록 확인
- [ ] 수동 테스트 실행
- [ ] 로그 모니터링 설정
- [ ] 실행 결과 데이터 검증

## 향후 개선 사항

1. **병렬 처리**: Promise.all() 활용하여 테넌트 병렬 처리
2. **대시보드 인사이트**: 대시보드용 별도 인사이트 생성
3. **학생별 인사이트**: 학생별 개인화된 인사이트 생성
4. **AI 모델 통합**: Claude API를 통한 고급 자연어 분석
5. **인사이트 이력**: 시간대별 인사이트 변화 추적
6. **알림 통합**: 중요한 인사이트 실시간 알림
7. **캐싱**: Redis를 통한 자주 조회되는 데이터 캐싱

## 참고 문서

- 아키텍처 문서: 3.6 지역 기반 통계 (3.6.1~3.6.9)
- 통계 문서: 2.4 Percentile Rank, 3.1 운영 현황 카드
- 기술 문서: 19-1-2 KST 날짜 처리, 5 운영/보안 설계
- AI 자동화 기능 정리: Section 10 자동화 안전성
