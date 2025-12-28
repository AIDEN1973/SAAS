-- students View PostgREST 인식 보장
-- [중요] PostgREST가 View를 인식하지 못하는 경우를 대비한 강제 설정

-- 1. View 존재 확인 및 재생성
DO $$
BEGIN
  -- View가 존재하는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'students'
  ) THEN
    -- View가 없으면 생성
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
      p.created_at,
      p.updated_at,
      s.created_by,
      s.updated_by
    FROM public.persons p
    LEFT JOIN public.academy_students s ON s.person_id = p.id
    WHERE p.person_type = 'student';

    RAISE NOTICE '✅ students View가 생성되었습니다.';
  ELSE
    RAISE NOTICE '✅ students View가 이미 존재합니다.';
  END IF;
END $$;

-- 2. View 권한 재부여 (PostgREST 인식 보장)
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.students TO anon;
GRANT SELECT ON public.students TO service_role;

-- 3. security_invoker 설정 (RLS 정책 상속)
ALTER VIEW public.students SET (security_invoker = true);

-- 4. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 5. View 메타데이터 확인
DO $$
DECLARE
  view_exists boolean;
  has_anon_select boolean;
  has_auth_select boolean;
BEGIN
  -- View 존재 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name = 'students'
  ) INTO view_exists;

  -- 권한 확인
  SELECT has_table_privilege('anon', 'public.students', 'SELECT') INTO has_anon_select;
  SELECT has_table_privilege('authenticated', 'public.students', 'SELECT') INTO has_auth_select;

  RAISE NOTICE '=== students View PostgREST 인식 진단 ===';
  RAISE NOTICE 'View 존재: %', view_exists;
  RAISE NOTICE 'anon SELECT 권한: %', has_anon_select;
  RAISE NOTICE 'authenticated SELECT 권한: %', has_auth_select;

  IF view_exists AND (has_anon_select OR has_auth_select) THEN
    RAISE NOTICE '✅ students View가 PostgREST에서 인식될 수 있어야 합니다.';
    RAISE NOTICE '⚠️  만약 여전히 404가 발생한다면:';
    RAISE NOTICE '   1. Supabase Dashboard → Settings → API → "Reload schema" 클릭';
    RAISE NOTICE '   2. 브라우저 캐시 삭제 후 다시 시도';
    RAISE NOTICE '   3. Supabase 프로젝트 재시작 고려';
  ELSE
    RAISE WARNING '❌ students View 설정에 문제가 있을 수 있습니다.';
  END IF;
END $$;

-- 6. 테스트 쿼리 (선택사항)
-- SELECT COUNT(*) FROM public.students;

