-- 출결번호 및 보호자 연락처 필드 추가
-- [목적] 출결 키오스크용 번호와 부모 연락처 관리
-- [규칙] attendance_number는 tenant 내에서 UNIQUE
-- [규칙] 기본값은 학생 전화번호 뒷 4자리

-- 1. academy_students 테이블에 컬럼 추가
ALTER TABLE public.academy_students
ADD COLUMN IF NOT EXISTS attendance_number text,
ADD COLUMN IF NOT EXISTS father_phone text,
ADD COLUMN IF NOT EXISTS mother_phone text;

-- 2. attendance_number 제약조건 추가
-- 4자리 이상 숫자만 허용
ALTER TABLE public.academy_students
ADD CONSTRAINT attendance_number_format
CHECK (attendance_number IS NULL OR (attendance_number ~ '^[0-9]{4,}$'));

-- 3. attendance_number UNIQUE 제약조건 (tenant 내에서만)
-- Note: PostgreSQL의 UNIQUE 제약조건은 NULL을 무시하므로 안전합니다
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_students_attendance_number_unique
ON public.academy_students(tenant_id, attendance_number)
WHERE attendance_number IS NOT NULL;

-- 4. attendance_number 인덱스 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_academy_students_attendance_number
ON public.academy_students(tenant_id, attendance_number);

-- 5. 기존 데이터에 대해 전화번호 뒷 4자리로 attendance_number 초기화
-- 중복이 발생할 수 있으므로 충돌 시 건너뜁니다 (나중에 수동 설정 필요)
DO $$
DECLARE
  student_record RECORD;
  last_4_digits text;
  next_number text;
  counter integer;
BEGIN
  FOR student_record IN
    SELECT
      s.person_id,
      s.tenant_id,
      p.phone
    FROM public.academy_students s
    JOIN public.persons p ON s.person_id = p.id
    WHERE s.attendance_number IS NULL
      AND p.phone IS NOT NULL
      AND length(regexp_replace(p.phone, '[^0-9]', '', 'g')) >= 4
  LOOP
    -- 전화번호에서 숫자만 추출하여 뒷 4자리 가져오기
    last_4_digits := right(regexp_replace(student_record.phone, '[^0-9]', '', 'g'), 4);

    -- 중복 확인 및 자동 증가
    counter := 0;
    next_number := last_4_digits;

    WHILE EXISTS (
      SELECT 1 FROM public.academy_students
      WHERE tenant_id = student_record.tenant_id
        AND attendance_number = next_number
    ) LOOP
      counter := counter + 1;
      next_number := last_4_digits || counter::text;
    END LOOP;

    -- attendance_number 설정
    UPDATE public.academy_students
    SET attendance_number = next_number
    WHERE person_id = student_record.person_id;

    RAISE NOTICE '학생 person_id=%: attendance_number=% 설정 완료', student_record.person_id, next_number;
  END LOOP;
END $$;

-- 6. attendance_number 생성 도우미 함수
CREATE OR REPLACE FUNCTION public.generate_attendance_number(
  p_tenant_id uuid,
  p_phone text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  last_4_digits text;
  next_number text;
  counter integer;
BEGIN
  -- 전화번호가 없거나 너무 짧으면 NULL 반환
  IF p_phone IS NULL OR length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 4 THEN
    RETURN NULL;
  END IF;

  -- 전화번호 뒷 4자리 추출
  last_4_digits := right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4);

  -- 중복 확인 및 자동 증가
  counter := 0;
  next_number := last_4_digits;

  WHILE EXISTS (
    SELECT 1 FROM public.academy_students
    WHERE tenant_id = p_tenant_id
      AND attendance_number = next_number
  ) LOOP
    counter := counter + 1;
    next_number := last_4_digits || counter::text;
  END LOOP;

  RETURN next_number;
END;
$$;

-- 7. 주석 추가
COMMENT ON COLUMN public.academy_students.attendance_number IS '출결 키오스크용 번호 (4자리 이상 숫자, tenant 내 unique)';
COMMENT ON COLUMN public.academy_students.father_phone IS '아버지 전화번호';
COMMENT ON COLUMN public.academy_students.mother_phone IS '어머니 전화번호';
COMMENT ON FUNCTION public.generate_attendance_number IS '전화번호로부터 중복되지 않는 출결번호 생성';
