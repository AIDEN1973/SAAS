-- PostgREST 스키마 캐시 문제 최종 해결
-- [중요] DB에는 테이블이 존재하지만 PostgREST 캐시가 갱신되지 않은 상태
-- [해결] 이 순서대로 실행하면 100% 해결됩니다

-- 1️⃣ PostgREST 스키마 캐시 강제 리로드
-- [중요] 이 명령으로 PostgREST가 DB 구조를 다시 읽습니다
NOTIFY pgrst, 'reload schema';

-- 2️⃣ 권한 부여 (없으면 API가 숨김 처리)
-- [중요] 멀티테넌트 환경이면 UPDATE/INSERT도 필요합니다
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON TABLE public.user_tenant_roles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON TABLE public.user_tenant_roles TO authenticated;

-- 3️⃣ 존재 여부 최종 체크
SELECT 
  table_schema, 
  table_name
FROM information_schema.tables
WHERE table_name = 'user_tenant_roles';

-- 4️⃣ RLS 켜져있다면 최소 정책 1개 필요
-- [중요] RLS 활성화되어 있고 정책이 없으면 PostgREST는 테이블이 없는 것처럼 굴기도 합니다
ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS user_tenant_roles_isolation ON public.user_tenant_roles;
DROP POLICY IF EXISTS "tenant read" ON public.user_tenant_roles;

-- 최소 정책 생성 (테스트용 - 모든 사용자가 자신의 레코드만 조회)
CREATE POLICY user_tenant_roles_isolation ON public.user_tenant_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5️⃣ 테이블 통계 업데이트
ANALYZE public.user_tenant_roles;

-- 6️⃣ 최종 확인: 권한 확인
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

