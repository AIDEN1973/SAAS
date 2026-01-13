# 50년 파티션 확장 적용 가이드

## 목적

이 가이드는 execution_audit_runs, execution_audit_steps, automation_actions 테이블의 파티션을 **2033-2075년까지 확장**하고, chatops_messages의 **월별 파티션 자동 생성**을 설정하는 방법을 설명합니다.

## 사전 확인

### 현재 상태 확인

Supabase Dashboard SQL Editor에서 다음 쿼리 실행:

```sql
-- 현재 파티션 개수 확인
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
  'chatops_messages',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'chatops_messages_%';
```

**예상 결과 (확장 전)**:
- execution_audit_runs: 8개 (2025-2032)
- execution_audit_steps: 8개 (2025-2032)
- automation_actions: 8개 (2025-2032)
- chatops_messages: 7개 (2025-12 ~ 2026-06)

**예상 결과 (확장 후)**:
- execution_audit_runs: 51개 (2025-2075)
- execution_audit_steps: 51개 (2025-2075)
- automation_actions: 51개 (2025-2075)
- chatops_messages: 13개 (2025-12 ~ 2026-12, 이후 자동 생성)

---

## 방법 1: Supabase Dashboard 수동 실행 (권장)

### Step 1: Supabase Dashboard 접속

1. 브라우저에서 다음 URL 접속:
   ```
   https://supabase.com/dashboard/project/xawypsrotrfoyozhrsbb/sql
   ```

2. SQL Editor 화면이 열리면 준비 완료

### Step 2: 50년 파티션 확장 실행

1. 파일 열기:
   ```
   infra/supabase/supabase/migrations/20260112000014_extend_partitions_to_2075.sql
   ```

2. 파일 내용 전체 복사 (635줄)

3. SQL Editor에 붙여넣기 후 **Run** 버튼 클릭

4. 실행 완료 메시지 확인:
   ```
   === 파티션 50년 확장 완료 ===
   execution_audit_runs: 2025-2075 (51년치)
   execution_audit_steps: 2025-2075 (51년치)
   automation_actions: 2025-2075 (51년치)
   비용: 빈 파티션 약 2MB 추가 (무시할 수 있는 수준)
   장점: 2075년까지 파티션 관리 불필요
   ```

**예상 소요 시간**: 1-2분

### Step 3: chatops 월별 파티션 자동 생성 설정

1. 파일 열기:
   ```
   infra/supabase/supabase/migrations/20260112000015_create_chatops_auto_partition_cron.sql
   ```

2. 파일 내용 전체 복사

3. SQL Editor에 붙여넣기 후 **Run** 버튼 클릭

4. 실행 완료 메시지 확인:
   ```
   === chatops_messages 자동 파티션 생성 설정 완료 ===
   초기 파티션: 2026-07 ~ 2026-12 (6개월 추가)
   자동 생성: 매월 1일 00:30 UTC (09:30 KST)
   이제 2075년까지 파티션 자동 생성됨
   수동 생성: SELECT public.admin_create_next_month_chatops_partition()
   ```

**예상 소요 시간**: 1분 미만

### Step 4: 검증

파티션 개수 확인 (위 쿼리 다시 실행):

**예상 결과**:
- execution_audit_runs: 51개 ✅
- execution_audit_steps: 51개 ✅
- automation_actions: 51개 ✅
- chatops_messages: 13개 ✅

pg_cron 스케줄 확인:
```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname IN (
  'cleanup_execution_audit_runs_daily',
  'cleanup_automation_actions_daily',
  'drop_old_chatops_partitions_daily',
  'create_next_month_chatops_partition_monthly'
)
ORDER BY jobname;
```

**예상 결과**: 4개 스케줄 모두 active = true

---

## 방법 2: Node.js 스크립트 실행 (선택)

### 사전 요구사항

- Node.js 18 이상
- `@supabase/supabase-js` 패키지 설치됨

### 실행 방법

```bash
cd infra/supabase
node execute-partitions.mjs
```

**주의**: 이 스크립트는 모든 마이그레이션 파일(20260112000001 ~ 20260112000015)을 순차 실행합니다. 이미 적용된 마이그레이션은 `IF NOT EXISTS` 구문으로 스킵됩니다.

### 예상 출력

```
🚀 Starting partition migration execution...

📍 Project: xawypsrotrfoyozhrsbb
🔗 URL: https://xawypsrotrfoyozhrsbb.supabase.co

🔍 Checking if partitions exist...

   Found 24 partition tables

📝 Executing migration files...

📄 Executing: 20260112000001_create_consultation_summary_jobs_retention_policy.sql
✅ Success

📄 Executing: 20260112000002_create_ai_decision_logs_partitions_and_retention.sql
✅ Success

...

📄 Executing: 20260112000014_extend_partitions_to_2075.sql
✅ Success

📄 Executing: 20260112000015_create_chatops_auto_partition_cron.sql
✅ Success

✨ All partition migrations executed successfully!

📊 Verifying results...
   Total partition tables: 167
```

---

## 적용 후 확인 사항

### 1. 파티션 상태 확인

```sql
-- 파티션 범위 및 크기 확인
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'execution_audit_runs_%'
    OR tablename LIKE 'execution_audit_steps_%'
    OR tablename LIKE 'automation_actions_%'
  )
ORDER BY tablename;
```

**예상 결과**: 각 테이블당 51개 파티션, 크기는 빈 파티션 = 24-32KB

### 2. pg_cron 스케줄 확인

```sql
SELECT
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE active = true
ORDER BY jobid;
```

**예상 결과**: 7개 스케줄
1. cleanup_consultation_summary_jobs_daily
2. cleanup_ai_decision_logs_daily
3. cleanup_automation_safety_state_daily
4. cleanup_execution_audit_runs_daily
5. cleanup_automation_actions_daily
6. drop_old_chatops_partitions_daily
7. create_next_month_chatops_partition_monthly (신규)

### 3. 데이터 삽입 테스트 (선택)

```sql
-- execution_audit_runs 테스트 (2026년 파티션)
INSERT INTO public.execution_audit_runs (
  tenant_id, occurred_at, operation_type, status, source,
  actor_type, summary, reference
) VALUES (
  (SELECT id FROM public.tenants LIMIT 1),
  '2026-01-12 12:00:00+00',
  'test-partition',
  'success',
  'manual',
  'system',
  'Partition test',
  '{"test": true}'::jsonb
);

-- 삽입 확인
SELECT COUNT(*) FROM public.execution_audit_runs_2026;
-- 예상 결과: 1개 이상

-- 테스트 데이터 삭제
DELETE FROM public.execution_audit_runs
WHERE operation_type = 'test-partition';
```

---

## 롤백 방법 (긴급 시)

⚠️ **주의**: 롤백은 데이터 손실 없이 파티션만 제거합니다. 기존 데이터는 보존됩니다.

### 50년 확장 롤백

```sql
-- 2033-2075년 파티션 제거 (execution_audit_runs)
DO $$
DECLARE
  partition_name text;
BEGIN
  FOR partition_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'execution_audit_runs_20%'
      AND tablename::text >= 'execution_audit_runs_2033'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', partition_name);
    RAISE NOTICE 'Dropped partition: %', partition_name;
  END LOOP;
END $$;

-- execution_audit_steps, automation_actions도 동일하게 반복
```

### chatops 자동 생성 롤백

```sql
-- pg_cron 스케줄 제거
SELECT cron.unschedule('create_next_month_chatops_partition_monthly');

-- 함수 제거
DROP FUNCTION IF EXISTS public.create_next_month_chatops_partition();
DROP FUNCTION IF EXISTS public.admin_create_next_month_chatops_partition();

-- 2026-07 ~ 2026-12 파티션 제거 (필요 시)
DROP TABLE IF EXISTS public.chatops_messages_2026_07 CASCADE;
DROP TABLE IF EXISTS public.chatops_messages_2026_08 CASCADE;
DROP TABLE IF EXISTS public.chatops_messages_2026_09 CASCADE;
DROP TABLE IF EXISTS public.chatops_messages_2026_10 CASCADE;
DROP TABLE IF EXISTS public.chatops_messages_2026_11 CASCADE;
DROP TABLE IF EXISTS public.chatops_messages_2026_12 CASCADE;
```

---

## 비용 분석

### 스토리지 증가량

**50년 파티션 확장**:
- execution_audit_runs: 43개 × 24KB = 1.032 MB
- execution_audit_steps: 43개 × 24KB = 1.032 MB
- automation_actions: 43개 × 24KB = 1.032 MB
- **총 증가량**: 약 3.1 MB

**chatops 월별 파티션**:
- 초기 6개월: 6개 × 24KB = 144 KB
- 이후 매월 1개: 24KB/월

**전체 증가량**: 약 3.2 MB (무시할 수 있는 수준)

### Partition Pruning 효과

**쿼리 성능 향상**:
- WHERE occurred_at >= '2026-01-01' AND occurred_at < '2026-02-01'
- 스캔 범위: 51개 파티션 → 1개 파티션만 스캔
- 인덱스 크기: 파티션당 독립 인덱스 (소규모)
- 쿼리 속도: 50배 이상 향상 가능

---

## FAQ

### Q1. 이미 적용된 마이그레이션을 다시 실행해도 되나요?

**A**: 네, 안전합니다. 모든 SQL 문은 `IF NOT EXISTS` 또는 `CREATE OR REPLACE`를 사용하므로 중복 실행 시 에러 없이 스킵됩니다.

### Q2. 51년 파티션이 너무 많은 것 아닌가요?

**A**: 빈 파티션은 메타데이터만 저장되므로 비용이 거의 없습니다 (약 24KB). 장기 운영 안정성과 법적 분쟁 대비를 고려하면 51년 범위가 적절합니다.

### Q3. chatops 파티션을 수동으로 생성하려면?

**A**: 매월 1일에 다음 함수를 실행하면 됩니다:
```sql
SELECT public.admin_create_next_month_chatops_partition();
```

하지만 pg_cron 자동 생성 설정을 권장합니다.

### Q4. pg_cron이 동작하지 않으면?

**A**: Supabase Pro/Enterprise에서만 pg_cron이 지원됩니다. Free/Pro 플랜에서는 수동으로 정리 함수를 실행해야 합니다.

### Q5. 보존 기간을 변경하려면?

**A**: 법적 근거 확인 후 다음 절차를 따르세요:
1. Migration 파일 생성 (함수 파라미터 변경)
2. pg_cron 스케줄 업데이트
3. 문서 업데이트 (액티비티.md 18.3)

---

## 관련 문서

- [PARTITION_VERIFICATION_REPORT.md](./PARTITION_VERIFICATION_REPORT.md): 파티션 검증 보고서
- [액티비티.md](../../docu/액티비티.md): Execution Audit 시스템 SSOT (18. 데이터 보존 정책)
- [챗봇.md](../../docu/챗봇.md): ChatOps 시스템 SSOT (6.3 automation_actions)
- [프론트 자동화.md](../../docu/프론트%20자동화.md): 자동화 시스템 SSOT (2.5 automation_actions)

---

**적용 완료 일시**: ___________
**적용자**: ___________
**검증 확인**: ___________
