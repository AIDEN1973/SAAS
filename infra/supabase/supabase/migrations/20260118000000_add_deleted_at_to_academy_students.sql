-- Migration: Add deleted_at column to academy_students for soft delete
--
-- [소프트 삭제 vs 퇴원 구분]
-- - deleted_at IS NOT NULL: 삭제된 학생 (조회 불가)
-- - status = 'withdrawn': 퇴원한 학생 (조회 가능, 필터 가능)
--
-- 삭제된 학생과 동일한 정보(이름+전화번호)로 재등록 시 기존 데이터 복원 가능

-- 1. deleted_at 컬럼 추가
ALTER TABLE public.academy_students
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. deleted_at 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_academy_students_deleted_at
ON public.academy_students(deleted_at)
WHERE deleted_at IS NULL;

-- 3. 삭제된 학생 조회 함수 (복원용)
CREATE OR REPLACE FUNCTION public.find_deleted_student(
  p_tenant_id uuid,
  p_name text,
  p_phone text DEFAULT NULL
)
RETURNS TABLE (
  person_id uuid,
  name text,
  phone text,
  deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as person_id,
    p.name,
    p.phone,
    a.deleted_at
  FROM public.persons p
  INNER JOIN public.academy_students a ON a.person_id = p.id
  WHERE p.tenant_id = p_tenant_id
    AND p.person_type = 'student'
    AND a.deleted_at IS NOT NULL
    AND p.name = p_name
    AND (p_phone IS NULL OR p.phone = p_phone);
END;
$$;

-- 4. 삭제된 학생 복원 함수
CREATE OR REPLACE FUNCTION public.restore_deleted_student(
  p_person_id uuid,
  p_status text DEFAULT 'active'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.academy_students
  SET
    deleted_at = NULL,
    status = p_status,
    updated_at = now()
  WHERE person_id = p_person_id;
END;
$$;

-- 5. 학생 소프트 삭제 함수
CREATE OR REPLACE FUNCTION public.soft_delete_student(
  p_person_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.academy_students
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE person_id = p_person_id;
END;
$$;

COMMENT ON COLUMN public.academy_students.deleted_at IS '소프트 삭제 일시. NULL이면 활성 상태, NOT NULL이면 삭제됨';
