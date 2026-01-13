# 파티션 및 보존 정책 완전 검증 체크리스트

## 목적

이 문서는 모든 파티션 및 보존 정책 마이그레이션이 올바르게 적용되었는지 완전히 검증하는 체크리스트입니다.

---

## 검증 순서

### 1단계: 파티션 생성 확인
### 2단계: 보존 정책 함수 확인
### 3단계: pg_cron 스케줄 확인
### 4단계: 통합 테스트

---

## 1단계: 파티션 생성 확인

### 실행 스크립트

Supabase Dashboard SQL Editor에서 실행:
```
https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql
```

#### 1-1. 파티션 개수 확인

```sql
SELECT
  'execution_audit_runs' as table_name,
  COUNT(*) as partition_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'execution_audit_runs_%'
UNION ALL
SELECT
  'execution_audit_steps',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'execution_audit_steps_%'
UNION ALL
SELECT
  'automation_actions',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'automation_actions_%'
UNION ALL
SELECT
  'ai_decision_logs',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'ai_decision_logs_%'
UNION ALL
SELECT
  'chatops_messages',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_%';
```

**예상 결과**:

| table_name | partition_count | 상태 |
|-----------|-----------------|------|
| execution_audit_runs | 51 | ✅ 2025-2075 (51년) |
| execution_audit_steps | 51 | ✅ 2025-2075 (51년) |
| automation_actions | 51 | ✅ 2025-2075 (51년) |
| ai_decision_logs | 51 | ✅ 2025-2075 (51년) |
| chatops_messages | 13+ | ✅ 2025-12 ~ 2026-12+ (월별, 자동 증가) |

**실제 결과**: ____________

**체크**: ☐ 모든 테이블의 파티션 개수가 예상과 일치

---

#### 1-2. 파티션 범위 상세 확인

```sql
-- execution_audit_runs 파티션 범위
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'execution_audit_runs_%'
ORDER BY tablename
LIMIT 5;

-- 마지막 파티션 확인
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'execution_audit_runs_%'
ORDER BY tablename DESC
LIMIT 5;
```

**예상 결과**:
- 첫 번째 파티션: `execution_audit_runs_2025`
- 마지막 파티션: `execution_audit_runs_2075`
- 크기: 각 파티션 약 24-32KB (빈 파티션)

**실제 결과**: ____________

**체크**:
- ☐ 2025년 파티션 존재
- ☐ 2075년 파티션 존재
- ☐ 파티션 크기 합리적 (빈 파티션 = 24-32KB)

---

#### 1-3. 파티션 인덱스 확인

```sql
-- execution_audit_runs 2026년 파티션 인덱스 확인
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'execution_audit_runs_2026'
ORDER BY indexname;
```

**예상 결과**: 3개 인덱스
1. `idx_execution_audit_runs_2026_tenant_occurred`
2. `idx_execution_audit_runs_2026_operation`
3. `idx_execution_audit_runs_2026_status`

**실제 결과**: ____________

**체크**: ☐ 모든 필수 인덱스 존재

---

## 2단계: 보존 정책 함수 확인

### 실행 스크립트

```bash
# 로컬에서 스크립트 확인
cat infra/supabase/verify-retention-functions.sql
```

Supabase Dashboard SQL Editor에서 실행:
```sql
-- infra/supabase/verify-retention-functions.sql 내용 복사 후 실행
```

#### 2-1. 함수 존재 확인

```sql
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%cleanup%'
    OR routine_name LIKE '%drop%'
    OR routine_name LIKE '%create_next%'
  )
ORDER BY routine_name;
```

**예상 결과**: 15개 함수

**자동 실행 함수 (7개)**:
1. cleanup_old_consultation_summary_jobs
2. cleanup_old_ai_decision_logs
3. cleanup_old_automation_safety_state
4. cleanup_old_execution_audit_runs
5. cleanup_old_automation_actions
6. drop_old_chatops_message_partitions
7. create_next_month_chatops_partition

**관리자 함수 (7개)**:
8. admin_cleanup_consultation_summary_jobs
9. admin_cleanup_ai_decision_logs
10. admin_cleanup_automation_safety_state
11. admin_cleanup_execution_audit_runs
12. admin_cleanup_automation_actions
13. admin_drop_old_chatops_partitions
14. admin_create_next_month_chatops_partition

**기타 (1개)**:
15. cleanup_orphaned_execution_audit_steps

**실제 결과**: ____________개

**체크**: ☐ 15개 함수 모두 존재

---

#### 2-2. 함수 파라미터 확인

```sql
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'cleanup_old_execution_audit_runs';
```

**예상 결과**:
```
parameters: general_retention_days integer DEFAULT 730, financial_retention_days integer DEFAULT 1825
```

**실제 결과**: ____________

**체크**: ☐ 파라미터 기본값 정확 (730, 1825)

---

## 3단계: pg_cron 스케줄 확인

### 실행 스크립트

```bash
# 로컬에서 스크립트 확인
cat infra/supabase/verify-cron-jobs.sql
```

Supabase Dashboard SQL Editor에서 실행:
```sql
-- infra/supabase/verify-cron-jobs.sql 내용 복사 후 실행
```

#### 3-1. pg_cron 확장 확인

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_cron';
```

**예상 결과**:
```
extname  | extversion
---------|------------
pg_cron  | 1.x
```

**실제 결과**: ____________

**체크**: ☐ pg_cron 확장 설치됨

---

#### 3-2. 등록된 스케줄 확인

```sql
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE active = true
ORDER BY jobname;
```

**예상 결과**: 7개 스케줄

| jobname | schedule | 설명 |
|---------|----------|------|
| cleanup_consultation_summary_jobs_daily | 0 18 * * * | 매일 03:00 KST |
| cleanup_ai_decision_logs_daily | 0 18 * * * | 매일 03:00 KST |
| cleanup_automation_safety_state_daily | 0 18 * * * | 매일 03:00 KST |
| cleanup_execution_audit_runs_daily | 0 18 * * * | 매일 03:00 KST |
| cleanup_automation_actions_daily | 0 18 * * * | 매일 03:00 KST |
| drop_old_chatops_partitions_daily | 0 18 * * * | 매일 03:00 KST |
| create_next_month_chatops_partition_monthly | 30 0 1 * * | 매월 1일 09:30 KST |

**실제 결과**: ____________개

**체크**:
- ☐ 7개 스케줄 모두 존재
- ☐ 모든 스케줄 active = true
- ☐ 스케줄 시간 정확

---

#### 3-3. 스케줄 명령어 확인

```sql
SELECT
  jobname,
  command
FROM cron.job
WHERE jobname = 'cleanup_execution_audit_runs_daily';
```

**예상 결과**:
```sql
command: SELECT public.cleanup_old_execution_audit_runs(730, 1825)
```

**실제 결과**: ____________

**체크**: ☐ 명령어 파라미터 정확 (730, 1825)

---

## 4단계: 통합 테스트

#### 4-1. 데이터 삽입 테스트

```sql
-- execution_audit_runs 2026년 파티션 테스트
INSERT INTO public.execution_audit_runs (
  tenant_id, occurred_at, operation_type, status, source,
  actor_type, summary, reference
) VALUES (
  (SELECT id FROM public.tenants LIMIT 1),
  '2026-06-15 12:00:00+00',
  'test-partition-insert',
  'success',
  'manual',
  'system',
  'Partition insertion test',
  '{"test": true, "verification_time": "2026-01-12"}'::jsonb
);

-- 삽입 확인
SELECT COUNT(*) as inserted_count
FROM public.execution_audit_runs
WHERE operation_type = 'test-partition-insert';

-- 올바른 파티션에 삽입되었는지 확인
SELECT COUNT(*) as partition_count
FROM public.execution_audit_runs_2026
WHERE operation_type = 'test-partition-insert';

-- 테스트 데이터 삭제
DELETE FROM public.execution_audit_runs
WHERE operation_type = 'test-partition-insert';
```

**예상 결과**:
- inserted_count: 1
- partition_count: 1 (2026년 파티션에 정확히 삽입됨)
- 삭제 성공

**실제 결과**: ____________

**체크**:
- ☐ 데이터 삽입 성공
- ☐ 올바른 파티션에 삽입됨
- ☐ 삭제 성공

---

#### 4-2. 보존 정책 함수 실행 테스트 (DRY RUN)

```sql
-- 삭제 대상 개수만 확인 (실제 삭제 X)
SELECT COUNT(*) as deletion_target
FROM public.execution_audit_runs
WHERE occurred_at < now() - interval '730 days'
  AND operation_type NOT IN (
    'send-invoice', 'process-payment', 'issue-refund',
    'generate-billing', 'update-billing', 'cancel-payment'
  );
```

**예상 결과**:
- deletion_target: 0 (현재 시점에서는 삭제 대상 없음)

**실제 결과**: ____________

**체크**: ☐ 쿼리 정상 실행 (에러 없음)

---

#### 4-3. chatops 다음달 파티션 생성 테스트

```sql
-- 다음달 파티션 생성 (실제 실행)
SELECT public.admin_create_next_month_chatops_partition();

-- 생성 확인
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_%'
ORDER BY tablename DESC
LIMIT 3;
```

**예상 결과**:
- 함수 실행 성공
- 새 파티션 생성됨 (예: chatops_messages_2026_02)

**실제 결과**: ____________

**체크**: ☐ 다음달 파티션 자동 생성 성공

---

## 종합 점검 결과

### 필수 항목 (모두 체크 필요)

- ☐ 1-1. 파티션 개수 확인 (5개 테이블)
- ☐ 1-2. 파티션 범위 확인 (2025-2075)
- ☐ 1-3. 파티션 인덱스 확인
- ☐ 2-1. 보존 정책 함수 확인 (15개)
- ☐ 2-2. 함수 파라미터 확인
- ☐ 3-1. pg_cron 확장 확인
- ☐ 3-2. pg_cron 스케줄 확인 (7개)
- ☐ 3-3. 스케줄 명령어 확인
- ☐ 4-1. 데이터 삽입 테스트
- ☐ 4-2. 보존 정책 함수 테스트
- ☐ 4-3. chatops 파티션 자동 생성 테스트

### 선택 항목 (권장)

- ☐ 파티션별 크기 모니터링 설정
- ☐ pg_cron 실행 로그 확인 (cron.job_run_details)
- ☐ 월 1회 정기 점검 일정 등록

---

## 문제 발생 시 조치

### 문제 1: 파티션 개수 부족

**증상**: execution_audit_runs 파티션이 8개 (2025-2032)만 존재

**해결**:
```bash
# Supabase Dashboard에서 실행
# infra/supabase/supabase/migrations/20260112000014_extend_partitions_to_2075.sql
```

---

### 문제 2: chatops 파티션 자동 생성 미설정

**증상**: chatops_messages 파티션이 7개 (2025-12 ~ 2026-06)만 존재

**해결**:
```bash
# Supabase Dashboard에서 실행
# infra/supabase/supabase/migrations/20260112000015_create_chatops_auto_partition_cron.sql
```

---

### 문제 3: pg_cron 스케줄 누락

**증상**: 7개 스케줄 중 일부만 등록됨

**해결**:
```sql
-- 누락된 마이그레이션 파일 재실행
-- 예: cleanup_execution_audit_runs_daily 누락 시
-- 20260112000010_create_execution_audit_partitions_and_retention.sql 재실행
```

---

### 문제 4: 보존 정책 함수 누락

**증상**: 15개 함수 중 일부만 존재

**해결**:
```sql
-- 누락된 마이그레이션 파일 재실행
-- verify-retention-functions.sql의 "누락된 함수 확인" 섹션 참조
```

---

## 검증 완료 서명

**검증 일시**: _______________

**검증자**: _______________

**결과**: ☐ 모든 항목 통과 / ☐ 일부 항목 실패 (상세: _______________)

**비고**:
_______________________________________________
_______________________________________________
_______________________________________________

---

## 다음 점검 일정

**다음 점검 예정일**: _______________

**점검 항목**:
- ☐ 파티션 개수 확인
- ☐ pg_cron 스케줄 정상 작동 확인
- ☐ 보존 정책 실행 로그 확인
- ☐ 스토리지 사용량 확인

---

## 관련 문서

- [PARTITION_VERIFICATION_REPORT.md](./PARTITION_VERIFICATION_REPORT.md): 파티션 검증 보고서
- [APPLY_50_YEAR_EXTENSION.md](./APPLY_50_YEAR_EXTENSION.md): 50년 파티션 확장 가이드
- [액티비티.md](../../docu/액티비티.md): Execution Audit 시스템 SSOT
- [verify-cron-jobs.sql](./verify-cron-jobs.sql): pg_cron 스케줄 검증 스크립트
- [verify-retention-functions.sql](./verify-retention-functions.sql): 보존 정책 함수 검증 스크립트
