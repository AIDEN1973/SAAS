/**
 * 사용자 플랫폼 역할 확인
 * 
 * [불변 규칙] 현재 사용자가 user_platform_roles 테이블에 있는지 확인
 * [불변 규칙] Super Admin 권한이 있는지 확인
 */

-- 1. 현재 사용자 정보 확인
SELECT 
  '현재 사용자' AS check_type,
  auth.uid() AS user_id,
  auth.email() AS email;

-- 2. user_platform_roles 테이블 존재 확인
SELECT 
  '테이블 존재 확인' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_platform_roles'
  ) AS table_exists;

-- 3. 현재 사용자의 플랫폼 역할 확인
SELECT 
  '사용자 역할' AS check_type,
  upr.user_id,
  upr.role,
  upr.created_at
FROM public.user_platform_roles upr
WHERE upr.user_id = auth.uid();

-- 4. Super Admin 역할이 있는 사용자 목록
SELECT 
  'Super Admin 목록' AS check_type,
  upr.user_id,
  u.email,
  upr.role,
  upr.created_at
FROM public.user_platform_roles upr
LEFT JOIN auth.users u ON upr.user_id = u.id
WHERE upr.role = 'super_admin'
ORDER BY upr.created_at DESC;

-- 5. RPC 함수 권한 검증 테스트
-- ⚠️ 주의: 이 쿼리는 RPC 함수 내부에서 실행되는 것과 동일한 로직입니다
SELECT 
  'RPC 권한 검증 테스트' AS check_type,
  EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  ) AS has_access;

-- 6. 초기 Super Admin 생성 (필요한 경우)
-- ⚠️ 주의: 실제로 Super Admin을 생성하려면 주석을 해제하세요
/*
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 현재 사용자 ID 가져오기
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '사용자가 로그인하지 않았습니다.';
  END IF;
  
  -- 이미 역할이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = v_user_id
  ) THEN
    RAISE NOTICE '이미 플랫폼 역할이 설정되어 있습니다.';
  ELSE
    -- Super Admin 역할 부여
    INSERT INTO public.user_platform_roles (user_id, role)
    VALUES (v_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Super Admin 역할이 부여되었습니다: %', v_user_id;
  END IF;
END $$;
*/

-- 최종 확인 메시지
DO $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️  현재 사용자가 로그인하지 않았습니다.';
    RAISE NOTICE '   로그인 후 다시 실행하세요.';
  ELSE
    RAISE NOTICE '✅ 현재 사용자 ID: %', v_user_id;
    
    -- 역할 확인
    SELECT EXISTS (
      SELECT 1 FROM public.user_platform_roles
      WHERE user_id = v_user_id 
      AND role IN ('super_admin', 'developer', 'qa')
    ) INTO v_has_role;
    
    IF v_has_role THEN
      RAISE NOTICE '✅ 플랫폼 역할이 설정되어 있습니다.';
    ELSE
      RAISE NOTICE '❌ 플랫폼 역할이 설정되어 있지 않습니다.';
      RAISE NOTICE '';
      RAISE NOTICE '📌 해결 방법:';
      RAISE NOTICE '   1. 위의 "초기 Super Admin 생성" 쿼리의 주석을 해제하고 실행';
      RAISE NOTICE '   2. 또는 다른 Super Admin이 역할을 부여해야 합니다.';
    END IF;
  END IF;
END $$;

