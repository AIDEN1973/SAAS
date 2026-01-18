-- students VIEW 업데이트: 출결번호 및 보호자 연락처 필드 추가
-- [목적] 1003 마이그레이션에서 추가된 필드들을 VIEW에 반영
-- [규칙] VIEW 재생성으로 PostgREST가 새 필드를 인식하도록 함

-- 1. 기존 VIEW 삭제
DROP VIEW IF EXISTS public.students CASCADE;

-- 2. students VIEW 재생성 (새 필드 포함)
CREATE VIEW public.students AS
SELECT
  p.id,
  p.tenant_id,
  'academy'::text AS industry_type,
  p.name,
  s.birth_date,
  s.gender,
  p.phone,
  s.attendance_number,    -- 신규 필드: 출결번호
  p.email,
  s.father_phone,         -- 신규 필드: 아버지 전화번호
  s.mother_phone,         -- 신규 필드: 어머니 전화번호
  p.address,
  s.school_name,
  s.grade,
  s.status,
  s.notes,
  s.profile_image_url,
  p.created_at,
  p.updated_at,
  s.created_by,
  s.updated_by
FROM public.persons p
LEFT JOIN public.academy_students s ON s.person_id = p.id
WHERE p.person_type = 'student';

-- 3. security_invoker 설정 (기본 테이블의 RLS 정책 상속)
ALTER VIEW public.students SET (security_invoker = true);

-- 4. 권한 부여
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.students TO anon;
GRANT SELECT ON public.students TO service_role;

-- 5. 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'students'
  ) THEN
    RAISE NOTICE '✅ students VIEW가 성공적으로 업데이트되었습니다 (출결번호 및 보호자 연락처 필드 포함).';
  ELSE
    RAISE EXCEPTION '❌ students VIEW 업데이트에 실패했습니다.';
  END IF;
END $$;

-- ============================================
-- 실행 후 수행할 작업:
-- ============================================
-- 1. Supabase Dashboard > Settings > API 메뉴로 이동
-- 2. "Reload schema" 버튼 클릭
-- 3. 테스트:
--    GET /rest/v1/students?select=*&limit=1
--    응답에 attendance_number, father_phone, mother_phone이 포함되는지 확인
-- ============================================
