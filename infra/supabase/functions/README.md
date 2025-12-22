# Supabase Edge Functions

Zero-Management Platform을 위한 자동화 배치 작업들입니다.

## ✅ 현재 상태

- **배포 상태**: 모든 Edge Functions 배포 완료 (6개)
- **Cron 작업**: 모든 스케줄 작업 생성 완료 (5개, 모두 활성화)
- **확장**: pg_cron, pg_net 활성화 완료

## 배치 작업 목록

### 1. 자동 청구 생성 (auto-billing-generation)
- **스케줄**: 매일 04:00 KST
- **기능**: 모든 활성 테넌트의 학생들에게 월 청구서 자동 생성
- **아키텍처 문서**: 3.4.6 섹션 (2617줄)

### 2. StudentTaskCard 배치 생성 (student-task-card-generation)
- **스케줄**: 매일 06:00 KST
- **기능**: 결석 3일 이상, 신규 등록 학생에 대한 업무 카드 생성
- **아키텍처 문서**: 3.1.3 섹션 (785줄)

### 3. AI 브리핑 카드 생성 (ai-briefing-generation)
- **스케줄**: 매일 07:00 KST
- **기능**: 오늘의 AI 인사이트 및 요약 카드 생성 (서버가 생성하며 AI 호출 포함)
- **아키텍처 문서**: 3.7.1 섹션 (3911줄)

### 4. 일일 통계 업데이트 (daily-statistics-update)
- **스케줄**: 매일 23:59 KST
- **기능**: 어제 날짜의 통계 데이터 집계 및 업데이트
- **아키텍처 문서**: 6.10 섹션 (5699줄)

### 5. 미납 알림 자동 발송 (overdue-notification-scheduler)
- **스케줄**: 매일 09:00 KST
- **기능**: 기한이 지난 미납 청구서에 대한 알림 자동 발송
- **아키텍처 문서**: 3.4.3 섹션

### 6. 학생 이탈 위험 분석 (student-risk-analysis)
- **스케줄**: 실시간 호출 (프론트엔드에서 요청 시)
- **기능**: 서버가 ChatGPT API를 호출하여 학생의 출결·상담 패턴을 종합 분석하여 이탈 위험도 평가
- **아키텍처 문서**: 3.7.3 섹션
- **Zero-Trust 준수**: JWT에서 tenant_id 추출 (요청 본문에서 받지 않음)

### 7. 상담일지 AI 요약 생성 (consultation-ai-summary)
- **스케줄**: 실시간 호출 (프론트엔드에서 요청 시)
- **기능**: 서버가 ChatGPT API를 호출하여 상담일지 내용을 요약
- **아키텍처 문서**: 3.1.5, 3.7.1 섹션
- **Zero-Trust 준수**: JWT에서 tenant_id 추출 (요청 본문에서 받지 않음)
- **PII 마스킹**: 상담일지 요약 시 개인정보 마스킹 필수 (아키텍처 문서 3.1.5, 898-950줄)

## 배포 방법

### 방법 1: 배포 스크립트 사용 (권장)

```bash
# Linux/Mac
cd infra/supabase/functions
./deploy.sh YOUR_PROJECT_REF

# Windows PowerShell
cd infra/supabase/functions
.\deploy.ps1 YOUR_PROJECT_REF
```

### 방법 2: 개별 배포

```bash
# 프로젝트 ref를 직접 지정하여 배포 (Docker 없이)
supabase functions deploy auto-billing-generation --project-ref YOUR_PROJECT_REF --use-api
supabase functions deploy student-task-card-generation --project-ref YOUR_PROJECT_REF --use-api
supabase functions deploy ai-briefing-generation --project-ref YOUR_PROJECT_REF --use-api
supabase functions deploy daily-statistics-update --project-ref YOUR_PROJECT_REF --use-api
supabase functions deploy overdue-notification-scheduler --project-ref YOUR_PROJECT_REF --use-api
supabase functions deploy student-risk-analysis --project-ref YOUR_PROJECT_REF --use-api
```

### 방법 3: 프로젝트 링크 후 배포

```bash
# 1. 프로젝트 링크
cd infra/supabase
supabase link --project-ref YOUR_PROJECT_REF

# 2. 각 함수 배포
supabase functions deploy auto-billing-generation
supabase functions deploy student-task-card-generation
supabase functions deploy ai-briefing-generation
supabase functions deploy daily-statistics-update
supabase functions deploy overdue-notification-scheduler
supabase functions deploy student-risk-analysis
```

**참고**: 프로젝트 ref는 Supabase Dashboard → Settings → General에서 확인할 수 있습니다.

## Cron 설정

### 방법 1: Supabase Dashboard에서 설정 (권장)

**⚠️ 중요:** Cron 작업은 Edge Functions 페이지가 아닌 **Integrations > Cron** 섹션에서 관리됩니다.

1. Dashboard → **Integrations** → **Cron** 이동
2. **Create job** 버튼 클릭
3. 작업 설정:
   - **Job name**: 함수명 입력 (예: `auto-billing-generation`)
   - **Schedule**: Cron 표현식 입력 (UTC 기준)
   - **Command type**: **HTTP Request** 선택
   - **URL**: `https://{project-ref}.supabase.co/functions/v1/{function-name}`
   - **Method**: POST
   - **Headers**:
     ```json
     {
       "Content-Type": "application/json",
       "Authorization": "Bearer {SERVICE_ROLE_KEY}"
     }
     ```
   - **Body**: `{}` (필요시)

**스케줄 설정 (UTC 기준):**
- `auto-billing-generation`: `0 19 * * *` (매일 04:00 KST)
- `student-task-card-generation`: `0 21 * * *` (매일 06:00 KST)
- `ai-briefing-generation`: `0 22 * * *` (매일 07:00 KST)
- `daily-statistics-update`: `59 14 * * *` (매일 23:59 KST)
- `overdue-notification-scheduler`: `0 0 * * *` (매일 09:00 KST)

### 방법 2: pg_cron 확장 활성화 후 SQL로 확인

**⚠️ 중요:** `cron.job` 테이블을 사용하려면 먼저 `pg_cron` 확장을 활성화해야 합니다.

**확장 활성화 방법:**
1. Supabase Dashboard > Database > Extensions로 이동
2. "pg_cron" 확장 찾기
3. "Enable" 버튼 클릭
4. 스키마 선택: **"extensions"** (권장) 또는 "pg_cron"
5. 활성화 완료 후 `cron.job` 테이블이 생성됩니다

**참고:**
- `pg_cron` 확장은 PostgreSQL 함수를 스케줄링하는 용도입니다
- Edge Functions의 cron 작업은 Dashboard에서 별도로 관리됩니다
- 두 시스템은 독립적으로 작동합니다

**확인 쿼리 (테이블이 있는 경우에만):**
```sql
-- pg_cron 확장 확인
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ 활성화됨'
    ELSE '❌ 비활성화됨'
  END AS status;

-- cron.job 테이블 존재 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'cron' AND table_name = 'job'
) AS cron_table_exists;

-- Edge Functions 관련 cron 작업 확인 (테이블이 있는 경우)
SELECT
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job
WHERE jobname IN (
  'auto-billing-generation',
  'student-task-card-generation',
  'ai-briefing-generation',
  'daily-statistics-update',
  'overdue-notification-scheduler'
)
ORDER BY jobname;
```

**참고:** `cron.job` 테이블이 없으면 Supabase Dashboard에서만 확인 가능합니다.
마이그레이션 파일 `073_verify_cron_jobs.sql`을 실행하면 자동으로 확인합니다.

### 방법 3: Edge Functions Cron 작업 설정

**현재 상태 확인:**
```sql
-- Edge Functions cron 작업 개수 확인
SELECT COUNT(*) FROM cron.job
WHERE jobname IN (
  'auto-billing-generation',
  'student-task-card-generation',
  'ai-briefing-generation',
  'daily-statistics-update',
  'overdue-notification-scheduler'
);
```

**설정 방법:**

1. **Supabase Dashboard에서 설정** (가장 권장)
   - Dashboard > **Integrations** > **Cron** 이동
   - **Create job** 버튼 클릭
   - 작업 설정:
     - Job name: 함수명
     - Schedule: Cron 표현식 (UTC 기준)
     - Command type: **HTTP Request**
     - URL: `https://{project-ref}.supabase.co/functions/v1/{function-name}`
     - Method: POST
     - Headers: `Authorization: Bearer {SERVICE_ROLE_KEY}`

2. **SQL로 설정** (고급)
   - 마이그레이션 파일 참고: `077_setup_edge_functions_cron_sql.sql`
   - `pg_net` 확장이 필요합니다
   - 실제 SUPABASE_URL과 SERVICE_ROLE_KEY를 설정해야 합니다
   - Dashboard 설정이 더 간편하고 안전합니다

**Cron 작업 스케줄:**
- `auto-billing-generation`: 매일 04:00 KST = `0 19 * * *` (UTC)
- `student-task-card-generation`: 매일 06:00 KST = `0 21 * * *` (UTC)
- `ai-briefing-generation`: 매일 07:00 KST = `0 22 * * *` (UTC)
- `daily-statistics-update`: 매일 23:59 KST = `59 14 * * *` (UTC)
- `overdue-notification-scheduler`: 매일 09:00 KST = `0 0 * * *` (UTC)

**참고:**
- 마이그레이션 파일 `072_create_cron_jobs.sql`과 `073_verify_cron_jobs.sql`을 참고하세요.
- Supabase는 Edge Functions를 직접 호출하는 방법을 제공하므로, Dashboard에서 설정하는 것이 더 안정적입니다.
- SQL로 설정하려면 Supabase의 실제 구현에 따라 다를 수 있습니다.

## 환경 변수

각 함수는 다음 환경 변수가 필요합니다:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (RLS 우회)

추가 환경 변수:
- `student-risk-analysis`: `OPENAI_API_KEY` (ChatGPT API 키)

## 실시간 트리거

데이터베이스 트리거는 마이그레이션 파일에 정의되어 있습니다:

**070_create_realtime_triggers.sql:**
- 결석 이벤트 → StudentTaskCard 생성
- 상담일지 저장 → StudentTaskCard 생성
- 신규 학생 등록 → StudentTaskCard 생성
- 상담일지 저장 → 서버가 AI 요약 생성 (아키텍처 문서 324줄)

**072_create_payment_notification_triggers.sql:**
- 결제 완료 → 결제 완료 알림 발송 (아키텍처 문서 2451줄, 영수증은 알림뱅킹에서 자동 발송)
- 청구서 생성 → 청구 알림 자동 발송 (설정 활성화 시)

