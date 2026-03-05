# Phase 3: Edge Function 안정성 강화

> **기간**: 2주 | **우선순위**: P1 | **담당**: 1명
> **선행 조건**: Phase 0 완료
> **목표**: 금융/결제 Edge Function에 재시도, DLQ, 알림 체계 구축

---

## 현재 상태

### Edge Function 에러 복구 점수표

| Function | 재시도 | DLQ | 알림 | Audit | 멱등성 | 점수 |
|----------|--------|-----|------|-------|--------|------|
| auto-billing-generation | ❌ | ❌ | ❌ | ✅ | N/A | 1/4 |
| financial-automation-batch | ❌ | ❌ | ❌ | ❌ | N/A | 0/4 |
| payment-webhook-handler | ❌ | ❌ | ❌ | ✅ | ❌ | 1/5 |
| overdue-notification-scheduler | ❌ | ❌ | ❌ | ✅ | ✅ | 2/5 |
| daily-statistics-update | ❌ | ❌ | ❌ | ✅ | N/A | 1/4 |
| **평균** | | | | | | **27%** |

**목표: 평균 80%+ 달성**

---

## 3-1. 공통 에러 복구 인프라 구축 (3일)

### 3-1-1. 재시도 유틸리티 (신규)

```
infra/supabase/supabase/functions/_shared/retry.ts (신규)
```

구현 사항:
- 지수 백오프(exponential backoff) + 지터(jitter)
- 최대 재시도 횟수 설정 (기본 3회)
- 재시도 가능 에러 판별 (네트워크 에러, 5xx만 재시도, 4xx는 즉시 실패)
- 재시도 로그 기록

```typescript
// 사용 예시
const result = await withRetry(
  () => supabase.from('invoices').insert(invoice),
  {
    maxRetries: 3,
    baseDelay: 1000, // 1초 → 2초 → 4초
    retryableErrors: ['PGRST301', 'FetchError', '23505'],
  }
);
```

### 3-1-2. Dead Letter Queue 테이블 (신규)

```
infra/supabase/supabase/migrations/XXX_create_dead_letter_queue.sql (신규)
```

구현 사항:

```sql
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  function_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_retried_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- RLS 적용
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON dead_letter_queue
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 인덱스
CREATE INDEX idx_dlq_status ON dead_letter_queue(status) WHERE status = 'pending';
CREATE INDEX idx_dlq_function ON dead_letter_queue(function_name, status);
```

### 3-1-3. DLQ 처리 유틸리티 (신규)

```
infra/supabase/supabase/functions/_shared/dlq.ts (신규)
```

구현 사항:
- `enqueueDLQ(functionName, tenantId, payload, error)` — 실패한 작업을 DLQ에 추가
- `dequeueDLQ(functionName, limit)` — 재처리 대상 조회
- `resolveDLQ(id)` — 처리 완료 표시
- `getDLQStats()` — 모니터링용 통계

### 3-1-4. 알림 유틸리티 (신규)

```
infra/supabase/supabase/functions/_shared/alerting.ts (신규)
```

구현 사항:
- Sentry 연동 (`@sentry/node` 또는 HTTP API)
- 심각도별 분류: `info`, `warning`, `error`, `critical`
- 임계값 기반 알림: "10분 내 동일 에러 5건 이상 → critical 알림"
- 알림 채널: Sentry + console (추후 Slack 확장 가능)

```typescript
// 사용 예시
await alertIfThresholdExceeded({
  functionName: 'auto-billing-generation',
  errorType: 'invoice_creation_failed',
  threshold: 5,
  windowMinutes: 10,
  severity: 'critical',
  context: { tenantId, batchId },
});
```

---

## 3-2. auto-billing-generation 안정화 (2일)

### 대상

```
infra/supabase/supabase/functions/auto-billing-generation/index.ts (322줄)
```

### 수정 사항

1. **재시도 적용** (Line 220~227)
   - 인보이스 INSERT 실패 시 `withRetry()` 적용
   - 3회 실패 후 DLQ 적재

2. **DLQ 연동** (Line 234)
   - 에러 로그만 남기던 부분 → `enqueueDLQ()` 호출 추가
   - DLQ에 `{ tenantId, studentId, billingPlan, failReason }` 저장

3. **알림 연동** (Line 280~315)
   - 배치 실패율 모니터링
   - 전체 테넌트 중 10% 이상 실패 시 critical 알림
   - 개별 테넌트 전체 실패 시 warning 알림

4. **amount: 0 버그** — Phase 0-2에서 수정 완료 전제

### 수정 후 에러 복구 플로우

```
인보이스 생성 시도
  ↓ 실패
withRetry (3회)
  ↓ 3회 모두 실패
enqueueDLQ (payload 저장)
  ↓
alertIfThresholdExceeded (임계값 확인)
  ↓ 임계값 초과
Sentry critical 알림
```

---

## 3-3. financial-automation-batch 안정화 (2일)

### 대상

```
infra/supabase/supabase/functions/financial-automation-batch/index.ts (892줄)
```

### 수정 사항

1. **재시도 적용** (Line 234~237, 872~874)
   - 개별 테넌트 자동화 실행 실패 시 재시도
   - 재시도 가능 에러(DB 타임아웃, 네트워크)와 불가 에러(검증 실패) 구분

2. **DLQ 연동**
   - 재시도 소진 후 DLQ 적재
   - 페이로드: `{ tenantId, automationType, policyId, failReason }`

3. **알림 연동** (Line 881~889)
   - 배치 전체 실패 시 critical
   - 테넌트별 실패 집계 → 임계값 초과 시 warning

4. **Execution Audit 연동**
   - 현재 audit 로깅 없음 → 기존 패턴(auto-billing-generation 참조) 적용

### 기존 장점 유지

- ✅ Safety throttling (checkAndUpdateAutomationSafety) — 유지
- ✅ Fail-closed policy checks — 유지
- ✅ Per-tenant error isolation — 유지 + DLQ 강화

---

## 3-4. payment-webhook-handler 안정화 (2일)

### 대상

```
infra/supabase/supabase/functions/payment-webhook-handler/index.ts (200줄)
```

### 수정 사항 (Phase 0-1과 연계)

1. **멱등성 처리** (Phase 0에서 기본 구현, 여기서 강화)
   - `webhook_events` 테이블에 이벤트 ID + 처리 결과 저장
   - 동일 이벤트 재수신 시 기존 결과 반환 (재처리 안 함)

2. **재시도 적용** (Line 118~141)
   - 인보이스/학생 조회 실패 시 재시도
   - DB 응답 타임아웃 구분

3. **DLQ 연동**
   - 웹훅 처리 완전 실패 시 DLQ 적재
   - 페이로드: `{ eventId, eventType, rawPayload, failReason }`

4. **웹훅 리플레이 기능**
   - DLQ에 저장된 웹훅을 수동 재처리하는 엔드포인트
   - super-admin에서 "재처리" 버튼 연동 가능

### 수정 후 웹훅 처리 플로우

```
웹훅 수신
  ↓
서명 검증 (Phase 0-1)
  ↓ 실패 → 403
멱등성 체크 (이미 처리됨?)
  ↓ 이미 처리됨 → 200 (기존 결과 반환)
비즈니스 로직 실행
  ↓ 실패
withRetry (3회)
  ↓ 3회 모두 실패
enqueueDLQ
  ↓
Sentry critical 알림 (결제 관련이므로 즉시)
  ↓
200 반환 (PG사에 재전송 방지)
```

---

## 3-5. overdue-notification-scheduler 안정화 (1일)

### 대상

```
infra/supabase/supabase/functions/overdue-notification-scheduler/index.ts (366줄)
```

### 수정 사항

1. **재시도 적용** (Line 198~202)
   - 알림 생성 실패 시 재시도

2. **DLQ 연동**
   - 알림 발송 실패 시 DLQ 적재 (재발송 가능)

3. **알림 연동**
   - 발송 실패율 20% 초과 시 warning

### 기존 장점 유지

- ✅ Execution Audit — 유지
- ✅ Per-tenant error isolation — 유지
- ✅ Policy-based execution — 유지

---

## 3-6. DLQ 재처리 Edge Function (1일)

### 신규

```
infra/supabase/supabase/functions/worker-process-dlq/index.ts (신규)
```

구현 사항:
- Cron 기반 (매시간 실행) 또는 수동 트리거
- `status = 'pending'`인 DLQ 항목 조회
- `function_name`별 핸들러 라우팅
- 재처리 성공 시 `status = 'resolved'`, 실패 시 `retry_count++`
- `retry_count >= max_retries` → `status = 'failed'` + critical 알림

---

## Phase 3 완료 기준

### 에러 복구 점수표 (목표)

| Function | 재시도 | DLQ | 알림 | Audit | 멱등성 | 점수 |
|----------|--------|-----|------|-------|--------|------|
| auto-billing-generation | ✅ | ✅ | ✅ | ✅ | N/A | **4/4** |
| financial-automation-batch | ✅ | ✅ | ✅ | ✅ | N/A | **4/4** |
| payment-webhook-handler | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| overdue-notification-scheduler | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| daily-statistics-update | ✅ | ✅ | ✅ | ✅ | N/A | **4/4** |
| **평균** | | | | | | **88%** |

### 신규 파일 목록

```
infra/supabase/supabase/functions/_shared/retry.ts
infra/supabase/supabase/functions/_shared/dlq.ts
infra/supabase/supabase/functions/_shared/alerting.ts
infra/supabase/supabase/functions/worker-process-dlq/index.ts
infra/supabase/supabase/migrations/XXX_create_dead_letter_queue.sql
```

### 검증

- [ ] DLQ 테이블 생성 + RLS 적용
- [ ] 각 Function 배포 후 정상 동작
- [ ] 의도적 에러 주입 시 DLQ 적재 확인
- [ ] DLQ 재처리 Function 동작 확인
- [ ] Sentry 알림 수신 확인

---

## 다음 Phase

← [Phase 2: 타입 안전성 복원](./RISK_REMEDIATION_PHASE_2.md)
→ [Phase 4: 성능 최적화 및 TODO 정리](./RISK_REMEDIATION_PHASE_4.md)
