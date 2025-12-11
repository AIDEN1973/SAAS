# Supabase Edge Functions

Zero-Management Platform을 위한 자동화 배치 작업들입니다.

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
- **기능**: 오늘의 AI 인사이트 및 요약 카드 자동 생성
- **아키텍처 문서**: 3.7.1 섹션 (3911줄)

### 4. 일일 통계 업데이트 (daily-statistics-update)
- **스케줄**: 매일 23:59 KST
- **기능**: 어제 날짜의 통계 데이터 집계 및 업데이트
- **아키텍처 문서**: 6.10 섹션 (5699줄)

### 5. 미납 알림 자동 발송 (overdue-notification-scheduler)
- **스케줄**: 매일 09:00 KST
- **기능**: 기한이 지난 미납 청구서에 대한 알림 자동 발송
- **아키텍처 문서**: 3.4.3 섹션

## 배포 방법

```bash
# 각 함수 배포
supabase functions deploy auto-billing-generation
supabase functions deploy student-task-card-generation
supabase functions deploy ai-briefing-generation
supabase functions deploy daily-statistics-update
supabase functions deploy overdue-notification-scheduler
```

## Cron 설정

Supabase Dashboard에서 각 함수에 대한 cron 작업을 설정해야 합니다:

1. Dashboard → Edge Functions → 각 함수 선택
2. Cron Jobs 탭에서 스케줄 설정
3. UTC 시간 기준으로 설정 (KST = UTC+9)

## 환경 변수

각 함수는 다음 환경 변수가 필요합니다:
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (RLS 우회)

## 실시간 트리거

데이터베이스 트리거는 마이그레이션 파일에 정의되어 있습니다:

**070_create_realtime_triggers.sql:**
- 결석 이벤트 → StudentTaskCard 생성
- 상담일지 저장 → StudentTaskCard 생성
- 신규 학생 등록 → StudentTaskCard 생성
- 상담일지 저장 → AI 자동 요약 생성 (아키텍처 문서 324줄)

**072_create_payment_notification_triggers.sql:**
- 결제 완료 → 결제 완료 알림 발송 (아키텍처 문서 2451줄, 영수증은 알림뱅킹에서 자동 발송)
- 청구서 생성 → 청구 알림 자동 발송 (설정 활성화 시)

