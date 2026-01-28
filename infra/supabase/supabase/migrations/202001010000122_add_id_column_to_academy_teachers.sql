-- academy_teachers 테이블에 id 컬럼 추가
--
-- 문제: PostgREST가 INSERT 시 자동으로 id 컬럼을 RETURNING 하려고 시도
--       academy_teachers 테이블은 person_id만 PRIMARY KEY로 사용하여 id 컬럼이 없어 오류 발생 가능
-- 해결: id 컬럼을 추가하고 PRIMARY KEY로 변경, person_id는 UNIQUE 제약조건으로 변경
--
-- ⚠️ 주의: 이 마이그레이션은 기존 데이터에 영향을 미칩니다.
--          person_id는 여전히 persons.id를 참조하는 FOREIGN KEY로 유지됩니다.

-- 1. academy_teachers를 참조하는 FOREIGN KEY 제약조건 임시 제거
--    class_teachers.teacher_id가 academy_teachers.person_id를 참조
ALTER TABLE public.class_teachers
  DROP CONSTRAINT IF EXISTS class_teachers_teacher_id_fkey;

-- 2. 기존 PRIMARY KEY 제약조건 제거 (person_id)
ALTER TABLE public.academy_teachers
  DROP CONSTRAINT IF EXISTS academy_teachers_pkey;

-- 3. id 컬럼 추가 (PRIMARY KEY)
ALTER TABLE public.academy_teachers
  ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();

-- 4. person_id에 UNIQUE 제약조건 추가 (1:1 관계 유지)
ALTER TABLE public.academy_teachers
  ADD CONSTRAINT academy_teachers_person_id_unique UNIQUE (person_id);

-- 5. 기존 데이터의 id 값 생성 (이미 있는 경우 건너뜀)
-- 주의: 이미 id 컬럼이 있고 값이 있다면 이 단계는 건너뜁니다.
UPDATE public.academy_teachers
SET id = gen_random_uuid()
WHERE id IS NULL;

-- 6. FOREIGN KEY 제약조건 재생성 [수정 2026-01-27: person_id → id]
--    class_teachers.teacher_id는 academy_teachers.id를 참조
ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_teacher_id_fkey
  FOREIGN KEY (teacher_id)
  REFERENCES public.academy_teachers(id)
  ON DELETE CASCADE;

-- 7. 인덱스 확인 및 최적화
-- person_id 인덱스는 이미 FOREIGN KEY로 인해 자동 생성됨
-- id 인덱스는 PRIMARY KEY로 인해 자동 생성됨

-- 8. 설명 추가
COMMENT ON COLUMN public.academy_teachers.id IS
'PRIMARY KEY. PostgREST 호환성을 위해 추가됨. person_id는 여전히 persons.id를 참조하는 UNIQUE FOREIGN KEY입니다.';

COMMENT ON COLUMN public.academy_teachers.person_id IS
'persons.id를 참조하는 UNIQUE FOREIGN KEY. 1:1 관계를 유지합니다.';

