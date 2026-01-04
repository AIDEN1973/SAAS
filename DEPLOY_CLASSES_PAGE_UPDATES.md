# Classes Page 업데이트 배포 가이드

## 🚀 빠른 배포 (Supabase Dashboard 사용)

### 1단계: SQL Editor에서 Migration 실행

Supabase Dashboard → SQL Editor로 이동하여 아래 파일들을 **순서대로** 실행하세요:

#### Migration 1: Schedule Conflict Detection
**파일**: `infra/supabase/supabase/migrations/160_create_schedule_conflict_detection.sql`

```sql
-- 파일 내용을 복사하여 SQL Editor에 붙여넣고 실행
-- 완료 후 "Success" 확인
```

#### Migration 2: Auto Color Assignment
**파일**: `infra/supabase/supabase/migrations/161_auto_assign_class_colors.sql`

```sql
-- 파일 내용을 복사하여 SQL Editor에 붙여넣고 실행
-- 완료 후 "Success" 확인
```

#### Migration 3: Teacher Role Support
**파일**: `infra/supabase/supabase/migrations/162_add_teacher_role_to_create_class_rpc.sql`

```sql
-- 파일 내용을 복사하여 SQL Editor에 붙여넣고 실행
-- 완료 후 "Success" 확인
```

### 2단계: 검증

SQL Editor에서 다음 쿼리로 확인:

```sql
-- 1. RPC 함수 생성 확인
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_schedule_conflicts',
    'get_next_class_color',
    'create_class_with_teachers'
  );

-- 예상 결과: 3개 함수 모두 표시되어야 함

-- 2. 트리거 생성 확인
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_assign_class_color';

-- 예상 결과: trigger_auto_assign_class_color | academy_classes
```

### 3단계: Frontend 재배포

```bash
# 로컬 개발 환경
npm run dev:admin

# 프로덕션 빌드
npm run build
```

---

## 🧪 기능 테스트

### Test 1: 일정 충돌 감지

1. 반 생성:
   - 이름: "테스트 A반"
   - 요일: 월요일
   - 시간: 14:00 ~ 15:30
   - 강사: 아무 강사나 선택
   - 강의실: "301호"

2. 충돌 반 생성 시도:
   - 이름: "테스트 B반"
   - 요일: 월요일
   - 시간: 14:30 ~ 16:00
   - 강사: **같은 강사** 선택
   - 강의실: "301호"

3. **예상 동작**:
   - 팝업 표시: "다음 충돌이 발견되었습니다..."
   - 강사 충돌 메시지
   - 강의실 충돌 메시지
   - [확인] 클릭 시 생성 진행
   - [취소] 클릭 시 생성 중단

### Test 2: 자동 색상 할당

1. 첫 번째 반 생성 (색상 미지정)
   - 자동 할당된 색상 확인 (빨강 계열)

2. 두 번째 반 생성 (색상 미지정)
   - 다른 색상 자동 할당 확인 (주황 계열)

3. 세 번째 반 생성 (색상 직접 입력: #3b82f6)
   - 지정한 파란색으로 생성됨 확인

### Test 3: 강사 배정 수정

1. 반 생성 시 강사 1명 배정
2. 반 수정 → 강사 선택 변경
3. 저장 후 반 상세 확인 → 새로운 강사 배정됨

### Test 4: 시간 범위 검증

1. 반 생성 시도:
   - 시작 시간: 18:00
   - 종료 시간: 14:00

2. **예상 동작**:
   - 오류 메시지: "시작 시간은 종료 시간보다 빨라야 합니다"
   - 생성 차단

---

## 🔧 트러블슈팅

### 문제: RPC 함수가 보이지 않음

**해결:**
```sql
-- 권한 확인
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_name = 'check_schedule_conflicts';

-- authenticated 권한이 없으면 재실행
GRANT EXECUTE ON FUNCTION public.check_schedule_conflicts TO authenticated;
```

### 문제: 색상이 자동 할당되지 않음

**해결:**
```sql
-- 트리거 확인
SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_assign_class_color';

-- 없으면 161번 migration 재실행
```

### 문제: 충돌 감지가 작동하지 않음

**해결:**
- 브라우저 콘솔에서 에러 확인
- Network 탭에서 RPC 호출 확인
- 응답 데이터 구조 확인

---

## 📊 Migration 상태 확인

```sql
-- 적용된 migration 확인
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

-- 160, 161, 162가 있는지 확인
```

---

## ⚠️ 주의사항

1. **Migration 순서 엄수**
   - 160 → 161 → 162 순서로 실행
   - 161이 162에서 사용되므로 순서 중요

2. **기존 데이터 영향 없음**
   - 모든 migration은 기존 테이블 구조 변경 없음
   - 함수/트리거만 추가
   - Rollback 불필요

3. **캐시 클리어**
   - Frontend 배포 후 브라우저 캐시 클리어 권장
   - Hard Reload: Ctrl + Shift + R (Windows) / Cmd + Shift + R (Mac)

---

## 📞 문제 발생 시

1. Migration 실패 시:
   - SQL Editor에서 에러 메시지 확인
   - 해당 함수/테이블 존재 여부 확인
   - Drop 후 재실행

2. Frontend 오류 시:
   - 브라우저 콘솔 확인
   - TypeScript 타입 오류 확인
   - npm install 재실행

3. 데이터 이슈 시:
   - Supabase Dashboard → Table Editor에서 확인
   - RLS 정책 확인
   - authenticated 역할 권한 확인

---

**배포 체크리스트:**
- [ ] Migration 160 실행 완료
- [ ] Migration 161 실행 완료
- [ ] Migration 162 실행 완료
- [ ] RPC 함수 3개 확인
- [ ] 트리거 1개 확인
- [ ] Frontend 빌드 완료
- [ ] 기능 테스트 4가지 완료

배포 완료 후 위 체크리스트를 모두 확인하세요!
