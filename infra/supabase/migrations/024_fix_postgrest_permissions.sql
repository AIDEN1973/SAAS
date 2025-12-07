-- PostgREST가 Core 테이블을 인식하도록 권한 부여 (최신 Supabase/PostgREST 방식)
-- [불변 규칙] 최신 PostgREST는 스키마 등록 방식이 아닌 권한 기반 자동 탐색을 사용합니다.
-- [불변 규칙] 권한(usage/select) + RLS 정책이 없으면 API에 보이지 않습니다.

-- 1️⃣ 스키마 접근 권한 부여 (필수)
-- [중요] PostgREST는 authenticated, anon 역할의 권한을 확인하여 테이블을 자동 탐색합니다.
GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- 2️⃣ 스키마 내 모든 테이블 SELECT 권한 부여 (필수)
-- [중요] 이 권한이 없으면 PostgREST가 테이블을 API에 노출하지 않습니다.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- 3️⃣ 향후 생성되는 테이블에 대한 기본 권한 설정
-- [중요] 앞으로 생성되는 테이블도 자동으로 권한이 부여되도록 설정
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO authenticated, anon;

-- 4️⃣ RLS 정책 확인
-- [중요] RLS가 활성화되어 있지만 정책이 없으면 PostgREST가 테이블을 숨깁니다.
-- 정책은 000_create_core_rls.sql에서 이미 설정되어 있어야 합니다.
-- user_tenant_roles 테이블의 RLS 정책이 올바르게 설정되어 있는지 확인:
-- - SELECT 정책: user_tenant_roles_isolation (이미 존재)

-- 5️⃣ PostgREST 스키마 캐시 새로고침
-- [중요] 권한 변경 후 PostgREST가 스키마를 다시 스캔하도록 해야 합니다.
-- Supabase Dashboard → Settings → API → "Reload schema" 버튼 클릭 필요
NOTIFY pgrst, 'reload schema';

