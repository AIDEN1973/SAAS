# 학년 자동 상향 시스템 가이드

## 📋 개요

매년 1월 1일 자정에 모든 학생의 학년을 자동으로 한 단계씩 상향 조정하는 시스템입니다.

### 학년 진급 규칙
- **4세** → 5세 → 6세 → 7세
- **7세** → 초등 1학년
- **초등 1학년** → ... → 초등 6학년
- **초등 6학년** → 중등 1학년
- **중등 1학년** → ... → 중등 3학년
- **중등 3학년** → 고등 1학년
- **고등 1학년** → ... → 고등 3학년
- **고등 3학년** → 변경 없음 (졸업)
- **기타** → 변경 없음

## 🚀 초기 설정

### 1. 마이그레이션 실행

```bash
# Supabase 마이그레이션 실행
supabase db push
```

실행되는 마이그레이션:
- `1000_add_grade_constraint_and_auto_upgrade.sql`: 학년 제약조건 + 자동 상향 함수
- `1001_verify_pg_cron_setup.sql`: pg_cron 상태 확인
- `1002_setup_pg_cron_schedule.sql`: 스케줄 자동 등록

### 2. pg_cron 확장 활성화

1. Supabase Dashboard 접속
2. **Database** → **Extensions** 메뉴로 이동
3. 검색창에 `pg_cron` 입력
4. **Enable** 버튼 클릭

### 3. 스케줄 등록 확인

**방법 1: 자동 등록 (권장)**
```bash
# 마이그레이션 1002번이 자동으로 등록함
supabase db push
```

**방법 2: 수동 등록**

Supabase SQL Editor에서 다음 스크립트 실행:
```sql
-- scripts/register-grade-upgrade-schedule.sql
SELECT cron.schedule(
  'upgrade-student-grades-yearly',
  '0 0 1 1 *',
  $$SELECT public.upgrade_student_grades();$$
);
```

## 🔍 상태 확인

### Supabase SQL Editor에서 실행

```sql
-- scripts/check-pg-cron-status.sql 파일 내용 복사하여 실행
```

확인 항목:
- ✅ pg_cron 확장 설치 여부
- ✅ upgrade_student_grades() 함수 존재 여부
- ✅ 스케줄 등록 여부
- 📊 현재 학년 분포
- 📜 마지막 실행 기록

## 🧪 테스트

### ⚠️ 주의: 실제 데이터가 변경됩니다!

테스트 환경에서만 실행하세요:

```sql
-- scripts/test-grade-upgrade-function.sql 파일 내용 복사하여 실행
```

테스트 절차:
1. 변경 전 학년 분포 확인
2. 백업 테이블 생성 (선택사항)
3. 학년 자동 상향 함수 실행
4. 변경 후 학년 분포 확인
5. 필요시 롤백

## 📅 실행 스케줄

- **실행 시간**: 매년 1월 1일 00:00:00 (서버 시간 기준)
- **Cron 표현식**: `0 0 1 1 *`
  - 분: 0
  - 시: 0
  - 일: 1
  - 월: 1
  - 요일: * (모든 요일)

## 🛠️ 문제 해결

### 스케줄이 등록되지 않는 경우

1. pg_cron 확장 확인:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. 수동 등록:
   ```sql
   -- scripts/register-grade-upgrade-schedule.sql 실행
   ```

### 함수가 실행되지 않는 경우

1. 함수 존재 확인:
   ```sql
   SELECT proname FROM pg_proc
   WHERE proname = 'upgrade_student_grades';
   ```

2. 수동 실행 테스트:
   ```sql
   SELECT public.upgrade_student_grades();
   ```

### 실행 기록 확인

```sql
SELECT * FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job
  WHERE jobname = 'upgrade-student-grades-yearly'
)
ORDER BY start_time DESC
LIMIT 10;
```

## 📂 관련 파일

### 마이그레이션
- `infra/supabase/supabase/migrations/1000_add_grade_constraint_and_auto_upgrade.sql`
- `infra/supabase/supabase/migrations/1001_verify_pg_cron_setup.sql`
- `infra/supabase/supabase/migrations/1002_setup_pg_cron_schedule.sql`

### 스크립트
- `scripts/check-pg-cron-status.sql`: 상태 확인
- `scripts/register-grade-upgrade-schedule.sql`: 수동 스케줄 등록
- `scripts/test-grade-upgrade-function.sql`: 함수 테스트

### 프론트엔드
- `apps/academy-admin/src/schemas/student.schema.ts`: 학년 필드 스키마
- `packages/constants/src/grades.ts`: 학년 상수 및 로직

## 🔐 보안

- 함수는 `SECURITY DEFINER`로 설정되어 관리자 권한으로 실행됩니다.
- 학년 필드에 CHECK 제약조건이 적용되어 유효하지 않은 값은 입력할 수 없습니다.

## 📝 수동 실행

필요시 언제든지 수동으로 실행할 수 있습니다:

```sql
SELECT public.upgrade_student_grades();
```

## 🔄 스케줄 삭제

스케줄을 삭제하려면:

```sql
SELECT cron.unschedule('upgrade-student-grades-yearly');
```

## 📞 문의

문제가 발생하면 다음을 확인하세요:
1. pg_cron 확장이 활성화되어 있는지
2. 함수가 정상적으로 생성되었는지
3. 스케줄이 등록되어 있는지
4. 최근 실행 기록에 에러가 없는지
