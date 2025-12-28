-- anon 사용자 권한 제한 (보안 강화)
-- [중요] anon 사용자는 SELECT만 필요하며, INSERT/UPDATE/DELETE는 보안상 위험합니다
-- [해결] 이전 마이그레이션에서 부여된 과도한 권한을 제거합니다

-- 1. anon 사용자의 불필요한 권한 제거
-- [중요] user_tenant_roles 테이블은 민감한 정보이므로 anon은 SELECT만 허용
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_tenant_roles FROM anon;

-- 2. 최종 권한 확인
-- [기대 결과] anon은 SELECT만, authenticated는 SELECT/INSERT/UPDATE/DELETE
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles'
  AND grantee IN ('authenticated', 'anon')
ORDER BY grantee, privilege_type;

-- 3. PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';

