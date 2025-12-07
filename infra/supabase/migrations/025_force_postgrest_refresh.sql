-- PostgREST 강제 스키마 새로고침 및 테이블 노출 확인
-- [중요] PostgREST가 테이블을 인식하지 못하는 경우 강제 새로고침

-- 1. 테이블 존재 확인 및 권한 재부여
DO $$
BEGIN
  -- user_tenant_roles 테이블이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_tenant_roles'
  ) THEN
    -- 권한 재부여
    GRANT SELECT ON public.user_tenant_roles TO authenticated, anon;
    RAISE NOTICE 'user_tenant_roles 테이블 권한 재부여 완료';
  ELSE
    RAISE EXCEPTION 'user_tenant_roles 테이블이 존재하지 않습니다';
  END IF;
END $$;

-- 2. tenants 테이블 권한 확인
GRANT SELECT ON public.tenants TO authenticated, anon;

-- 3. Foreign Key 관계 확인 (조인을 위해 필요)
-- user_tenant_roles.tenant_id -> tenants.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'user_tenant_roles'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%tenant_id%'
  ) THEN
    RAISE NOTICE 'Foreign Key 관계 확인됨: user_tenant_roles.tenant_id -> tenants.id';
  ELSE
    RAISE WARNING 'Foreign Key 관계를 찾을 수 없습니다';
  END IF;
END $$;

-- 4. RLS 정책 재생성 (순환 참조 방지)
-- [중요] tenants 정책이 user_tenant_roles를 참조하므로, 
-- 조인 시에는 user_tenant_roles의 RLS가 먼저 적용되어야 함

-- 5. PostgREST 스키마 캐시 강제 새로고침
-- [중요] Supabase Dashboard에서 "Reload schema" 버튼을 클릭해야 합니다.
NOTIFY pgrst, 'reload schema';

-- 6. 테이블 메타데이터 확인
SELECT 
  table_name,
  table_type,
  is_insertable_into,
  is_updatable,
  is_triggered
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('user_tenant_roles', 'tenants')
ORDER BY table_name;

