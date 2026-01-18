# 출결번호 및 보호자 연락처 기능 가이드

## 개요

학생 정보에 출결 키오스크용 번호와 보호자(부모) 연락처를 추가하는 기능입니다.

### 추가된 필드
- **출결번호** (`attendance_number`): 4자리 이상의 숫자, 출결 키오스크에 입력하는 번호
- **아버지 전화번호** (`father_phone`): 아버지 연락처
- **어머니 전화번호** (`mother_phone`): 어머니 연락처

## 출결번호 자동 생성 로직

### 기본 동작
1. 학생 등록 시 출결번호를 입력하지 않으면 **학생 전화번호 뒷 4자리**가 자동으로 설정됩니다
2. 중복 체크가 자동으로 수행됩니다
3. 중복이 발견되면 자동으로 고유 번호를 생성합니다

### 중복 처리 전략

**시나리오 1: 중복 없음**
- 학생 전화번호: `010-1234-5678`
- 출결번호: `5678` (자동 설정)

**시나리오 2: 형제자매 (동일한 전화번호 뒷 4자리)**
- 첫 번째 학생 (형/누나): `010-1234-5678` → 출결번호 `5678`
- 두 번째 학생 (동생): `010-1234-5678` → 출결번호 `56781` (자동 증가)
- 세 번째 학생: `010-1234-5678` → 출결번호 `56782` (자동 증가)

**시나리오 3: 수동 입력**
- 관리자가 직접 출결번호를 입력하면 해당 번호를 사용합니다
- 중복 체크는 데이터베이스 레벨에서 수행됩니다 (UNIQUE 제약조건)

## 데이터베이스 스키마

### 테이블 컬럼
```sql
ALTER TABLE public.academy_students
ADD COLUMN attendance_number text,
ADD COLUMN father_phone text,
ADD COLUMN mother_phone text;
```

### 제약조건
1. **형식 제약**: 출결번호는 4자리 이상 숫자만 허용
   ```sql
   CHECK (attendance_number ~ '^[0-9]{4,}$')
   ```

2. **유니크 제약**: tenant 내에서 출결번호는 고유해야 함
   ```sql
   CREATE UNIQUE INDEX idx_academy_students_attendance_number_unique
   ON academy_students(tenant_id, attendance_number)
   WHERE attendance_number IS NOT NULL;
   ```

### 도우미 함수
```sql
SELECT public.generate_attendance_number(
  'tenant-id-here',
  '010-1234-5678'
);
-- 결과: 중복되지 않는 출결번호 반환
```

## 프론트엔드 구현

### 학생 등록 폼
[student.schema.ts](apps/academy-admin/src/schemas/student.schema.ts)에 다음 필드가 추가되었습니다:

```typescript
{
  name: 'phone',
  kind: 'phone',
  ui: { label: '전화번호', colSpan: 1 },
},
{
  name: 'attendance_number',
  kind: 'text',
  ui: {
    label: '출결번호',
    colSpan: 1,
    placeholder: '4자리 이상 숫자',
  },
  validation: {
    pattern: '^[0-9]{4,}$',
    patternMessage: '4자리 이상의 숫자만 입력 가능합니다',
  },
},
{
  name: 'father_phone',
  kind: 'phone',
  ui: { label: '아버지 전화번호', colSpan: 1 },
},
{
  name: 'mother_phone',
  kind: 'phone',
  ui: { label: '어머니 전화번호', colSpan: 1 },
},
```

### Hook 사용법

**학생 생성 시**
```typescript
const { mutate: createStudent } = useCreateStudent();

createStudent({
  name: '홍길동',
  phone: '010-1234-5678',
  // attendance_number를 입력하지 않으면 '5678'이 자동 설정됨
  father_phone: '010-1111-2222',
  mother_phone: '010-3333-4444',
  // ... 기타 필드
});
```

**학생 수정 시**
```typescript
const { mutate: updateStudent } = useUpdateStudent();

updateStudent({
  studentId: 'student-id-here',
  input: {
    attendance_number: '1234',  // 수동으로 변경 가능
    father_phone: '010-5555-6666',
    mother_phone: '010-7777-8888',
  },
});
```

## 마이그레이션 실행

### 1. 데이터베이스 마이그레이션 적용
```bash
supabase db push
```

실행되는 마이그레이션:
- `1003_add_attendance_number_and_guardian_phones.sql`: 컬럼 추가, 제약조건, 도우미 함수 생성

### 2. 기존 데이터 자동 처리
마이그레이션은 기존 학생 데이터에 대해 자동으로 출결번호를 생성합니다:
- 전화번호가 있는 학생: 뒷 4자리로 출결번호 자동 생성
- 중복이 있으면 자동으로 증가 번호 사용 (`5678` → `56781` → `56782`)

## 보호자 정보 통합

기존에 별도 탭으로 관리되던 보호자 정보가 학생 정보 폼에 통합되었습니다.

### 변경 사항
- **이전**: 보호자 정보 별도 탭 (여러 보호자 등록 가능)
- **이후**: 학생 정보에 부/모 전화번호만 입력 (간소화)

### 데이터 마이그레이션
기존 `guardians` 테이블 데이터는 그대로 유지되며, 새로운 학생부터는 `father_phone`, `mother_phone` 필드를 사용합니다.

## 중복 번호 처리 가이드

### 관리자 화면에서 중복 발견 시
1. 데이터베이스 제약조건에 의해 저장이 거부됩니다
2. 사용자에게 다른 번호를 입력하도록 안내합니다
3. 자동 생성된 번호(예: `56781`)를 제안할 수 있습니다

### 수동으로 중복 확인
```sql
-- 중복된 출결번호 조회
SELECT attendance_number, COUNT(*) as count
FROM public.academy_students
WHERE attendance_number IS NOT NULL
GROUP BY attendance_number
HAVING COUNT(*) > 1;
```

## 참고 파일

### 마이그레이션
- [1003_add_attendance_number_and_guardian_phones.sql](../infra/supabase/supabase/migrations/1003_add_attendance_number_and_guardian_phones.sql)

### 타입 정의
- [packages/industry/industry-academy/src/types.ts](../packages/industry/industry-academy/src/types.ts)

### Hook
- [packages/hooks/use-student/src/useStudent.ts](../packages/hooks/use-student/src/useStudent.ts)
  - `useCreateStudent`: 학생 생성 (출결번호 자동 생성 로직 포함)
  - `useUpdateStudent`: 학생 수정

### 스키마
- [apps/academy-admin/src/schemas/student.schema.ts](../apps/academy-admin/src/schemas/student.schema.ts)

## 문제 해결

### 출결번호가 자동 생성되지 않음
1. 전화번호가 입력되었는지 확인
2. 전화번호가 4자리 이상의 숫자를 포함하는지 확인
3. 마이그레이션이 정상 실행되었는지 확인:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'generate_attendance_number';
   ```

### 중복 번호 오류
1. 데이터베이스에서 중복 확인:
   ```sql
   SELECT * FROM academy_students
   WHERE attendance_number = '1234';
   ```
2. 다른 번호를 입력하거나 자동 생성 로직을 활용

### 기존 데이터 출결번호 재생성
```sql
-- 모든 학생의 출결번호를 재생성
UPDATE public.academy_students
SET attendance_number = NULL;

-- 그 다음 마이그레이션의 자동 생성 로직을 다시 실행
-- (1003 마이그레이션의 DO $$ 블록 부분만 다시 실행)
```

## 추가 고려사항

### 보안
- 출결번호는 민감정보가 아니지만, 4자리 이상으로 설정하여 추측하기 어렵게 함
- 부모 전화번호는 개인정보이므로 적절한 접근 제어 필요 (RLS 정책 적용됨)

### 확장성
- 필요시 `generate_attendance_number` 함수를 수정하여 다른 생성 전략 적용 가능
- 예: 순차 번호(`0001`, `0002`), 랜덤 번호 등
