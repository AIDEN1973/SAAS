-- PostgREST 테이블 가시성 확인 및 강제 노출
-- [중요] RLS를 비활성화해도 404가 발생하면 PostgREST 설정 문제입니다.

-- 1. 테이블이 실제로 존재하는지 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'user_tenant_roles';

-- 2. tenants 테이블과 비교 (tenants는 작동하는 것으로 보임)
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user_tenant_roles', 'tenants')
ORDER BY tablename;

-- 3. 스키마 권한 확인
SELECT 
  nspname as schema_name,
  nspowner::regrole as owner
FROM pg_namespace
WHERE nspname = 'public';

-- 4. 테이블 소유자 확인 및 변경 (필요시)
-- [중요] PostgREST는 테이블 소유자가 중요할 수 있습니다.
ALTER TABLE public.user_tenant_roles OWNER TO postgres;

-- 5. 모든 권한 재부여 (명시적으로)
REVOKE ALL ON public.user_tenant_roles FROM authenticated, anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenant_roles TO authenticated, anon;

-- 6. 테이블이 뷰가 아닌지 확인
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'user_tenant_roles';

-- 7. Foreign Key 제약조건 확인 (테이블 구조 확인)
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'user_tenant_roles';

-- 8. 테이블 재생성 (최후의 수단)
-- [주의] 이는 데이터를 삭제할 수 있으므로 주의해서 사용하세요.
-- 먼저 데이터를 백업하세요.

-- 9. PostgREST 스키마 캐시 강제 새로고침
NOTIFY pgrst, 'reload schema';

-- 10. 테이블 통계 업데이트 (PostgREST가 테이블을 인식하도록)
ANALYZE public.user_tenant_roles;



