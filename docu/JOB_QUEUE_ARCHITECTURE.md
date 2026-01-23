# Job Queue 아키텍처 (ARCHIVED)

> **상태**: 비활성화 (2026-01-23)
> **이유**: 현재 사용되지 않음 (job_executions 테이블 비어있음)
> **재활성화**: 필요시 이 문서 참조하여 복원 가능

---

## 1. 개요

SAMDLE의 Job Queue 아키텍처는 비동기 작업 처리를 위해 설계되었으나, 현재는 다음과 같은 이유로 비활성화 상태입니다:

- **ChatOps**: Streaming 방식 사용 (`sendChatOpsMessageStreaming`)
- **StudentTask**: `execute-student-task` Edge Function 직접 호출
- **job_executions 테이블**: 완전히 비어있음 (프론트엔드에서 INSERT 하지 않음)

하지만 향후 다음과 같은 경우 재활성화가 필요할 수 있습니다:
- 대량 작업 처리 (일괄 알림 발송, 데이터 마이그레이션 등)
- 실패 재시도가 필요한 작업
- 스케줄링된 작업 실행

---

## 2. 아키텍처 구성 요소

### 2.1 데이터베이스

#### `job_executions` 테이블
```sql
CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  intent_key TEXT NOT NULL,  -- 예: 'attendance.exec.notify_guardians_late'
  intent_params JSONB,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

#### Cron Job
- **이름**: `worker-process-job`
- **스케줄**: 1분마다 (`* * * * *`)
- **현재 상태**: 비활성화 (`active = false`)
- **위치**: [202001010000157_create_worker_cron_job.sql](../infra/supabase/supabase/migrations/202001010000157_create_worker_cron_job.sql)

### 2.2 Edge Functions

#### `worker-process-job`
- **경로**: `infra/supabase/supabase/functions/worker-process-job/`
- **역할**: Cron에 의해 호출되어 `job_executions` 테이블의 pending 작업 처리
- **현재 상태**: 보관됨 (503 에러 발생 중이나 영향 없음)
- **주의사항**: 70+ handlers 동적 import 패턴 적용 필요 (Cold start 최적화)

#### `execute-student-task`
- **경로**: `infra/supabase/supabase/functions/execute-student-task/`
- **역할**: 프론트엔드에서 직접 호출하여 StudentTask 실행
- **현재 상태**: **활성화** (실제 사용 중)
- **호출 위치**:
  - [useStudentTaskCard.ts](../packages/hooks/use-student/src/useStudentTaskCard.ts) (approve, execute)

### 2.3 Intent Handlers (70+ handlers)

#### 위치
- `infra/supabase/supabase/functions/execute-student-task/handlers/`
- `registry.ts`에 70+ handlers 등록

#### 예시
```typescript
// attendance-notify-guardians-late.ts
export const attendanceNotifyGuardiansLate: IntentHandler = {
  intentKey: 'attendance.exec.notify_guardians_late',
  description: '지각 학생 보호자에게 알림 전송',
  async execute(params, context) {
    // 구현...
  }
};
```

#### 주요 Intent 카테고리
- `attendance.*`: 출결 관련
- `billing.*`: 결제 관련
- `class.*`: 수업 관리
- `student.*`: 학생 관리
- `communication.*`: 알림/메시지
- `report.*`: 보고서 생성

### 2.4 Intent Patterns (ChatOps)

#### 관리 페이지
- **위치**: [IntentPatternsPage.tsx](../apps/academy-admin/src/pages/IntentPatternsPage.tsx)
- **기능**: ChatOps 질문 패턴과 Tool 매핑 관리
- **테이블**: `chatops_intent_patterns`
- **현재 사용**: UI만 존재, 실제 Job Queue와 연결 안 됨

---

## 3. 재활성화 가이드

### 3.1 Cron Job 활성화

```sql
-- 1. Cron job 활성화
UPDATE cron.job
SET active = true
WHERE jobname = 'worker-process-job';

-- 2. 확인
SELECT jobid, schedule, jobname, active
FROM cron.job
WHERE jobname = 'worker-process-job';
```

### 3.2 프론트엔드에서 Job 생성

```typescript
// 예시: 지각 학생 보호자 알림
import { apiClient } from '@api-sdk/core';

const createJob = async (studentId: string) => {
  await apiClient.insert('job_executions', {
    intent_key: 'attendance.exec.notify_guardians_late',
    intent_params: {
      student_id: studentId,
      notify_time: new Date().toISOString()
    }
  });
};
```

### 3.3 worker-process-job Edge Function 최적화

**현재 문제**: Cold start 시 70+ handlers를 모두 import하여 503 에러 발생

**해결책**: 동적 import 패턴 적용 (이미 작성됨, 배포 필요)

```typescript
// worker-process-job/index.ts (수정된 버전)
const handlerPathMap: Record<string, string> = {
  'attendance.exec.notify_guardians_late': './attendance-notify-guardians-late.ts',
  // ... 70+ mappings
};

async function loadHandler(intentKey: string): Promise<IntentHandler | null> {
  const handlerPath = handlerPathMap[intentKey];
  if (!handlerPath) return null;

  const modulePath = `../execute-student-task/handlers/${handlerPath.replace('./', '')}`;
  const module = await import(modulePath);
  return module[handlerName] as IntentHandler;
}
```

**배포 방법**:
```bash
cd infra/supabase
npx supabase functions deploy worker-process-job
```

### 3.4 전체 재활성화 체크리스트

- [ ] Cron job 활성화 (`UPDATE cron.job SET active = true`)
- [ ] worker-process-job Edge Function 최적화 배포
- [ ] 프론트엔드 코드에서 `job_executions` INSERT 추가
- [ ] 테스트: 샘플 job 생성 후 1분 대기, 처리 확인
- [ ] 모니터링: `SELECT * FROM cron.job_run_details` 확인

---

## 4. 현재 대안 아키텍처

### 4.1 ChatOps (Streaming)

**구현**:
```typescript
import { sendChatOpsMessageStreaming } from '@hooks/use-chatops';

await sendChatOpsMessageStreaming(
  tenantId,
  sessionId,
  message,
  async (chunk) => {
    // 실시간 응답 처리
  },
  async (status) => {
    // 진행 상황 처리
  }
);
```

**위치**: [App.tsx:362](../apps/academy-admin/src/App.tsx#L362)

### 4.2 StudentTask (동기 실행)

**구현**:
```typescript
import { apiClient } from '@api-sdk/core';

const response = await apiClient.invokeFunction(
  'execute-student-task',
  { action: 'approve-and-execute', task_id: taskId }
);
```

**위치**: [useStudentTaskCard.ts](../packages/hooks/use-student/src/useStudentTaskCard.ts)

---

## 5. 트러블슈팅

### 5.1 worker-process-job 503 에러

**증상**: Cron job 로그에 503 에러 발생

**원인**: Cold start 시 70+ handlers import로 타임아웃

**해결**: 동적 import 패턴 적용 (3.3 참조)

### 5.2 job_executions 테이블 비어있음

**현재 상태**: 정상 (프론트엔드에서 사용하지 않음)

**재활성화시**: 프론트엔드 코드에서 INSERT 추가 필요

### 5.3 Intent handlers 찾기

**경로**: `infra/supabase/supabase/functions/execute-student-task/handlers/`

**검색 방법**:
```bash
# Intent key로 handler 찾기
grep -r "attendance.exec.notify_guardians_late" handlers/
```

---

## 6. 관련 파일

### Migrations
- [202001010000157_create_worker_cron_job.sql](../infra/supabase/supabase/migrations/202001010000157_create_worker_cron_job.sql) - Cron job 생성
- [20260123120000_disable_worker_cron_job.sql](../infra/supabase/supabase/migrations/20260123120000_disable_worker_cron_job.sql) - Cron job 비활성화

### Edge Functions
- [worker-process-job/index.ts](../infra/supabase/supabase/functions/worker-process-job/index.ts)
- [execute-student-task/handlers/registry.ts](../infra/supabase/supabase/functions/execute-student-task/handlers/registry.ts)

### Frontend
- [IntentPatternsPage.tsx](../apps/academy-admin/src/pages/IntentPatternsPage.tsx)
- [useStudentTaskCard.ts](../packages/hooks/use-student/src/useStudentTaskCard.ts)
- [useChatOps.ts](../packages/hooks/use-chatops/src/useChatOps.ts)

---

## 7. 참고 문서

- [계약붕괴방지_Intent기반.md](./legacy/계약붕괴방지_Intent기반.md) - 원래 설계 문서
- [챗봇_성능최적화.md](./챗봇_성능최적화.md) - Streaming 아키텍처
- [SECURITY_IMPROVEMENTS.md](./SECURITY_IMPROVEMENTS.md) - 보안 개선 사항

---

## 8. 결론

Job Queue 아키텍처는 현재 사용되지 않지만, 향후 비동기 작업 처리가 필요할 경우를 대비해 보관합니다.

**재활성화 필요 시나리오**:
- 대량 알림 발송 (100명 이상의 학생/학부모)
- 데이터 마이그레이션 작업
- 외부 API 호출 실패 재시도 필요
- 스케줄링된 정기 작업 (월말 결산, 주간 보고서 등)

**비활성화 유지 이유**:
- 현재 모든 기능이 동기 실행 또는 Streaming으로 처리 가능
- 불필요한 Cron 실행으로 인한 리소스 낭비 방지
- 503 에러 로그 제거로 모니터링 노이즈 감소
