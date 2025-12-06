-- student_classes 테이블의 student_id FK를 person_id로 변경
-- [불변 규칙] 기존 student_id는 person_id를 참조하도록 변경

-- 1. 기존 FK 제약 조건 삭제
ALTER TABLE IF EXISTS public.student_classes
  DROP CONSTRAINT IF EXISTS student_classes_student_id_fkey;

-- 2. FK를 persons 테이블을 참조하도록 변경
-- 주의: 컬럼명은 그대로 유지하고 FK만 persons 테이블을 참조하도록 변경
ALTER TABLE IF EXISTS public.student_classes
  ADD CONSTRAINT student_classes_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.persons(id) ON DELETE CASCADE;

-- 인덱스는 이미 student_id를 사용하므로 변경 불필요

