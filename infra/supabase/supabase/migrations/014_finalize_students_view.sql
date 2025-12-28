-- ============================================
-- students View 최종 설정 및 PostgREST 인식 보장
-- ============================================
-- [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
-- [불변 규칙] 별도 테이블이 아닌 View 사용
-- [불변 규칙] 기존 코드 호환성을 위해 students View 제공

-- 1. 기존 View/테이블 정리 (안전하게)
-- 기존 students 테이블이 있다면 주의 깊게 처리
DO $$
BEGIN
  -- students 테이블이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'students'
    AND table_type = 'BASE TABLE'
  ) THEN
    -- 테이블이 존재하면 View로 전환하기 전에 경고
    RAISE NOTICE '⚠️ 경고: students 테이블이 존재합니다. View로 전환하기 전에 데이터 마이그레이션이 필요할 수 있습니다.';
  END IF;
END $$;

-- 2. 기존 View 삭제 (안전하게)
DROP VIEW IF EXISTS public.students CASCADE;

-- 3. students View 생성 (persons + academy_students 조인)
-- ⚠️ 중요: 이 View는 Student 타입과 완전히 일치하도록 설계되었습니다.
-- 모든 필드가 포함되어 있어 기존 코드와 호환됩니다.
CREATE VIEW public.students AS
SELECT 
  p.id,
  p.tenant_id,
  'academy'::text AS industry_type,
  p.name,
  s.birth_date,
  s.gender,
  p.phone,
  p.email,
  p.address,
  s.school_name,
  s.grade,
  s.status,
  s.notes,
  s.profile_image_url,
  p.created_at,                -- for order=created_at.desc
  p.updated_at,
  s.created_by,
  s.updated_by
FROM public.persons p
LEFT JOIN public.academy_students s ON s.person_id = p.id
WHERE p.person_type = 'student';

-- 4. View에 security_invoker 설정 (기본 테이블의 RLS 정책 상속)
-- ⚠️ 중요: View는 테이블이 아니므로 RLS를 직접 활성화할 수 없습니다.
-- 대신 security_invoker = true로 설정하여 기본 테이블의 RLS 정책을 상속받습니다.
ALTER VIEW public.students SET (security_invoker = true);

-- 5. View에 대한 권한 부여 (PostgREST가 인식할 수 있도록)
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.students TO anon;
GRANT SELECT ON public.students TO service_role;

-- 6. View 생성 확인
DO $$
DECLARE
  view_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'students'
  ) INTO view_exists;
  
  IF view_exists THEN
    RAISE NOTICE '✅ students View가 성공적으로 생성되었습니다.';
  ELSE
    RAISE EXCEPTION '❌ students View 생성에 실패했습니다.';
  END IF;
END $$;

-- 7. RLS 정책 확인 (기본 테이블의 RLS가 View에 상속되는지 확인)
-- ⚠️ 중요: View는 security_invoker = true로 설정되어 있으므로,
-- 기본 테이블(persons, academy_students)의 RLS 정책이 자동으로 적용됩니다.
-- 다음 쿼리로 RLS 정책이 제대로 설정되어 있는지 확인할 수 있습니다:
-- SELECT * FROM pg_policies WHERE tablename IN ('persons', 'academy_students');

-- ============================================
-- ⚠️ 중요: 이 View는 읽기 전용입니다.
-- INSERT/UPDATE/DELETE는 Service Layer를 통해 
-- persons + academy_students 테이블에 직접 수행해야 합니다.
-- ============================================
--
-- ============================================
-- 실행 후 반드시 수행할 작업:
-- ============================================
-- 1. RLS 정책 확인 (선택사항):
--    infra/supabase/RLS_정책_확인.sql 파일을 실행하여
--    기본 테이블의 RLS 정책이 제대로 설정되어 있는지 확인하세요.
--
-- 2. PostgREST 스키마 갱신 (필수):
--    Supabase Dashboard > Settings > API 메뉴로 이동
--    "Reload schema" 버튼 클릭
--    몇 초 대기 후 API가 View를 인식합니다
--
-- 3. 테스트:
--    GET /rest/v1/students?select=*&order=created_at.desc
--    이 엔드포인트가 정상 작동하는지 확인하세요.
-- ============================================

