/**
 * 초기 Super Admin 생성 (간단한 버전)
 * 
 * [불변 규칙] 개발 환경에서 현재 로그인한 사용자를 Super Admin으로 설정
 * [불변 규칙] 프로덕션에서는 수동으로 관리해야 함
 * 
 * ⚠️ 주의: 이 스크립트는 현재 로그인한 사용자를 Super Admin으로 설정합니다.
 *          실행 전에 올바른 사용자로 로그인했는지 확인하세요.
 */

-- 현재 사용자 확인
DO $$
DECLARE
  v_user_id uuid;
  v_user_email text;
BEGIN
  v_user_id := auth.uid();
  v_user_email := auth.email();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '사용자가 로그인하지 않았습니다. 로그인 후 다시 실행하세요.';
  END IF;
  
  RAISE NOTICE '현재 사용자 ID: %', v_user_id;
  RAISE NOTICE '현재 사용자 이메일: %', v_user_email;
  
  -- 이미 역할이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = v_user_id
  ) THEN
    RAISE NOTICE '이미 플랫폼 역할이 설정되어 있습니다.';
    
    -- 현재 역할 확인
    SELECT role INTO v_user_email
    FROM public.user_platform_roles
    WHERE user_id = v_user_id;
    
    RAISE NOTICE '현재 역할: %', v_user_email;
  ELSE
    -- Super Admin 역할 부여
    INSERT INTO public.user_platform_roles (user_id, role, created_by)
    VALUES (v_user_id, 'super_admin', v_user_id)
    ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin', updated_at = now();
    
    RAISE NOTICE '✅ Super Admin 역할이 부여되었습니다!';
  END IF;
END $$;

-- 최종 확인
SELECT 
  'Super Admin 확인' AS check_type,
  upr.user_id,
  u.email,
  upr.role,
  upr.created_at
FROM public.user_platform_roles upr
LEFT JOIN auth.users u ON upr.user_id = u.id
WHERE upr.user_id = auth.uid();

