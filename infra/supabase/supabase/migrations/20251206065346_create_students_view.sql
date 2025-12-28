-- students View 생성 (기존 코드 호환성)
-- [불변 규칙] 기술문서 정책: "Core Party 테이블 + 업종별 확장 테이블" 패턴 사용
-- [불변 규칙] 별도 테이블을 만들지 않고 View를 사용하여 persons + academy_students 조인
-- [불변 규칙] 기존 코드가 students를 참조하므로 View로 호환성 제공

-- 기존 View가 있으면 삭제
DROP VIEW IF EXISTS public.students CASCADE;

-- students View (persons + academy_students 조인)
CREATE VIEW public.students AS
SELECT 
  p.id,
  p.tenant_id,
  'academy'::text AS industry_type,
  p.name,
  a.birth_date,
  a.gender,
  p.phone,
  p.email,
  p.address,
  a.school_name,
  a.grade,
  a.status,
  a.notes,
  a.profile_image_url,
  p.created_at,
  p.updated_at,
  a.created_by,
  a.updated_by
FROM public.persons p
LEFT JOIN public.academy_students a ON p.id = a.person_id
WHERE p.person_type = 'student';

-- View에 대한 권한 부여 (PostgREST가 인식할 수 있도록)
-- ⚠️ 중요: View는 테이블이 아니므로 RLS를 직접 활성화할 수 없습니다.
-- 대신 security_invoker = true로 설정하여 기본 테이블의 RLS 정책을 상속받습니다.
ALTER VIEW public.students SET (security_invoker = true);

-- View에 대한 권한 부여 (PostgREST가 인식할 수 있도록)
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.students TO anon;
GRANT SELECT ON public.students TO service_role;

-- ⚠️ 중요: 이 View는 읽기 전용입니다.
-- INSERT/UPDATE/DELETE는 Service Layer를 통해 persons + academy_students 테이블에 직접 수행해야 합니다.

