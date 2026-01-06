-- persons 테이블의 person_type 체크 제약 조건에 'teacher' 추가
-- [문제] 선생님(teacher)을 생성할 때 person_type='teacher'가 허용되지 않음
-- [해결] person_type 체크 제약 조건에 'teacher' 추가

-- 기존 체크 제약 조건 삭제
ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS persons_person_type_check;

-- 새로운 체크 제약 조건 생성 (teacher 추가)
ALTER TABLE public.persons ADD CONSTRAINT persons_person_type_check
CHECK (person_type IN ('student', 'customer', 'member', 'resident', 'donor', 'teacher'));

-- 제약 조건 확인
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.persons'::regclass
  AND conname = 'persons_person_type_check';

