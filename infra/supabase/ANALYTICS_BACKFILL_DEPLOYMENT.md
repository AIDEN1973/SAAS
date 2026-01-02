# Analytics Backfill Edge Function 배포 및 사용 가이드

## 개요

`analytics-backfill` Edge Function은 과거 날짜 범위의 일일 통계(`daily_store_metrics`, `daily_region_metrics`)를 재집계하여 데이터 무결성 문제를 해결하는 관리자 전용 도구입니다.

## 주요 특징

### 1. 보안 (Service Role Key 인증)
- **Authorization Header**: `Bearer [SERVICE_ROLE_KEY]` 형식 필수
- Service Role Key가 아닌 다른 토큰은 거부 (403 Forbidden)
- Query parameter 검증 추가로 2중 보안 강화

### 2. 입력 파라미터 검증
```
GET /functions/v1/analytics-backfill?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
Authorization: Bearer SERVICE_ROLE_KEY
```

**필수 파라미터:**
- `start_date`: 시작 날짜 (YYYY-MM-DD 형식)
- `end_date`: 종료 날짜 (YYYY-MM-DD 형식)

**검증 규칙:**
- 날짜 형식: `^\d{4}-\d{2}-\d{2}$`
- `start_date <= end_date` 필수
- 최대 범위: 90일 (과도한 요청 방지)

### 3. 재집계 로직

#### 매장 통계 (daily_store_metrics)
각 테넌트별로 다음 메트릭을 계산:
- `student_count`: 전체 학생 수
- `active_student_count`: 활성 학생 수
- `inactive_student_count`: 비활성 학생 수
- `attendance_rate`: 출석률 (%)
- `late_rate`: 지각률 (%)
- `absent_rate`: 결석률 (%)
- `revenue`: 매출 (해당 날짜 송장된 금액)
- `arpu`: 학생 1인당 평균 매출
- `avg_students_per_class`: 반당 평균 학생 수
- `avg_capacity_rate`: 평균 수용률 (%)

#### 지역별 통계 (daily_region_metrics)
최소 샘플 수(>= 3개 테넌트)를 충족하는 지역만 집계:
- 동(dong), 구/군(gu_gun), 시/도(si) 단위
- 평균값(avg), 분위수(p25, p75) 계산
- 월간 대비 성장률 계산

### 4. 진행 상황 로깅
모든 작업은 구조화된 로그로 기록:
```
[Backfill] Starting backfill from YYYY-MM-DD to YYYY-MM-DD
[Backfill] Processing date: YYYY-MM-DD
[Backfill] Updated metrics for tenant {tenant_id} on YYYY-MM-DD
[Backfill] Skipping {region_code} (level): only N tenants
[Backfill] Updated {region_code} (level) on YYYY-MM-DD: N tenants
[Backfill] Completed: X dates processed, Y store metrics updated, Z region metrics updated
```

## 배포 방법

### 1. 함수 배포
```bash
# Supabase CLI를 사용한 배포
supabase functions deploy analytics-backfill --no-verify

# 또는 전체 함수 배포 (deploy.sh 사용)
./infra/supabase/supabase/functions/deploy.sh
```

### 2. 환경 변수 설정
Supabase 대시보드 또는 `.env.local`에 다음 항목 확인:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (Secret)

## 사용 방법

### cURL 예제
```bash
# 지난 7일 재집계
curl -X GET \
  'https://your-project.supabase.co/functions/v1/analytics-backfill?start_date=2024-01-01&end_date=2024-01-07' \
  -H 'Authorization: Bearer your-service-role-key'

# 응답 (성공)
{
  "success": true,
  "message": "Backfill completed for 7 dates",
  "dates_processed": 7,
  "store_metrics_updated": 45,      // 9 tenants * 5 days 등
  "region_metrics_updated": 32
}

# 응답 (에러: 90일 초과)
{
  "success": false,
  "error": "Date range exceeds maximum of 90 days"
}
```

### TypeScript 클라이언트 예제
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-service-role-key'
);

async function backfillAnalytics(startDate: string, endDate: string) {
  const { data, error } = await supabase.functions.invoke('analytics-backfill', {
    body: {},
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
  });

  if (error) {
    console.error('Backfill failed:', error);
  } else {
    console.log('Backfill result:', data);
  }
}

// 사용
await backfillAnalytics('2024-01-01', '2024-01-07');
```

### Python 클라이언트 예제
```python
import requests
import os
from datetime import datetime, timedelta

def backfill_analytics(start_date: str, end_date: str):
    """
    과거 통계 재집계 (관리자용)

    Args:
        start_date: 시작 날짜 (YYYY-MM-DD)
        end_date: 종료 날짜 (YYYY-MM-DD)
    """
    supabase_url = os.getenv('SUPABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    url = f"{supabase_url}/functions/v1/analytics-backfill"
    headers = {
        'Authorization': f'Bearer {service_role_key}',
        'Content-Type': 'application/json'
    }
    params = {
        'start_date': start_date,
        'end_date': end_date
    }

    response = requests.get(url, headers=headers, params=params)
    result = response.json()

    if result.get('success'):
        print(f"✓ Backfill completed")
        print(f"  - Dates processed: {result['dates_processed']}")
        print(f"  - Store metrics: {result['store_metrics_updated']}")
        print(f"  - Region metrics: {result['region_metrics_updated']}")
    else:
        print(f"✗ Backfill failed: {result.get('error')}")

    return result

# 사용
backfill_analytics('2024-01-01', '2024-01-07')

# 또는 지난 30일
end_date = datetime.now().strftime('%Y-%m-%d')
start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
backfill_analytics(start_date, end_date)
```

## 성능 특성

### 예상 실행 시간
- **5개 테넌트, 1일**: ~2-3초
- **5개 테넌트, 7일**: ~15-20초
- **5개 테넌트, 30일**: ~60-90초

### 최적화 팁
1. **부분 재집계**: 90일 제한을 활용하여 필요한 범위만 처리
2. **시간대 선택**: 트래픽이 적은 시간(새벽 2-4시)에 실행
3. **모니터링**: Supabase 대시보드의 Function Logs에서 진행 상황 확인

## 에러 처리

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authorization header required"
}
```
**원인**: Authorization 헤더 누락
**해결**: Bearer 토큰 포함 필수

### 403 Forbidden
```json
{
  "success": false,
  "error": "Invalid or insufficient permissions"
}
```
**원인**: Service Role Key와 일치하지 않는 토큰
**해결**: 정확한 Service Role Key 사용

### 400 Bad Request
```json
{
  "success": false,
  "error": "Query parameters required: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)"
}
```
**원인**: 필수 파라미터 누락
**해결**: start_date, end_date 파라미터 추가

### 400 Bad Request (날짜 형식)
```json
{
  "success": false,
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```
**원인**: 날짜 형식이 YYYY-MM-DD가 아님
**해결**: 정확한 형식으로 변경

### 400 Bad Request (범위 초과)
```json
{
  "success": false,
  "error": "Date range exceeds maximum of 90 days"
}
```
**원인**: 90일을 초과하는 범위 요청
**해결**: 90일 이내의 범위로 분할하여 요청

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database connection failed"
}
```
**원인**: Supabase 연결 오류 또는 쿼리 실패
**해결**:
- Supabase 상태 페이지 확인
- 데이터베이스 가용성 확인
- 함수 로그에서 상세 오류 확인

## 유지보수

### 로그 확인
Supabase 대시보시:
1. **프로젝트 선택** → **Edge Functions**
2. **analytics-backfill** 클릭
3. **Logs** 탭에서 실행 이력 확인

### 데이터 무결성 검증
```sql
-- 특정 날짜의 매장 통계 확인
SELECT
  tenant_id,
  date_kst,
  student_count,
  revenue,
  updated_at
FROM analytics.daily_store_metrics
WHERE date_kst = '2024-01-15'
ORDER BY updated_at DESC;

-- 지역별 통계 확인
SELECT
  region_code,
  region_level,
  date_kst,
  tenant_count,
  student_count,
  updated_at
FROM analytics.daily_region_metrics
WHERE date_kst = '2024-01-15'
ORDER BY updated_at DESC;
```

## 문제 해결

### 일부 테넌트만 업데이트되는 경우
- 해당 테넌트의 `status = 'active'` 확인
- attendance_logs, invoices 테이블 데이터 존재 여부 확인

### 지역별 통계가 업데이트되지 않는 경우
- 지역의 테넌트 수가 3개 이상인지 확인
- tenant_settings의 location 정보가 올바르게 설정되었는지 확인

### 타임아웃 발생
- 단축된 날짜 범위로 재시도 (예: 30일 → 10일 단위)
- 새벽 시간대에 실행 (트래픽 최소화)

## 참고 사항

- **다중 실행 안전**: `onConflict` 옵션으로 중복 실행 시 마지막 값으로 업데이트
- **트랜잭션 없음**: 날짜별 독립적 실행으로 부분 성공 가능
- **KST 기준**: 모든 날짜는 KST(한국 표준시) 기준으로 처리
- **읽기 전용**: 과거 데이터만 재집계, 새로운 데이터는 daily-statistics-update에서 생성

## 관련 함수

- `daily-statistics-update`: 매일 새로운 통계 생성 (자동)
- `analytics-backfill`: 과거 통계 재집계 (수동)

## 보안 고려사항

1. **Service Role Key 보호**: 절대 클라이언트 사이드에 노출하지 않기
2. **API 레이트 제한**: 필요시 Supabase 설정에서 Rate limiting 추가
3. **감사 로깅**: 함수 로그에 모든 실행 기록이 남음
4. **타임스탐프**: `updated_at` 필드로 마지막 수정 시간 추적 가능
