/**
 * 사용자 ID로 Super Admin 생성
 * 
 * [불변 규칙] 사용자 ID를 직접 지정하여 Super Admin 역할 부여
 * [불변 규칙] SQL Editor에서 직접 실행 가능 (auth.uid() 불필요)
 * 
 * 사용 방법:
 * 1. Supabase Dashboard → Authentication → Users에서 사용자 ID 확인
 * 2. 아래 'YOUR_USER_ID'를 실제 사용자 ID로 변경
 * 3. SQL 실행
 */

-- ⚠️ 중요: 아래 사용자 ID를 실제 사용자 ID로 변경하세요
DO $$
DECLARE
  v_user_id uuid := 'YOUR_USER_ID'::uuid;  -- ⚠️ 여기를 실제 사용자 ID로 변경하세요
  v_user_email text;
  v_existing_role text;
BEGIN
  -- 사용자 존재 확인
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', v_user_id;
  END IF;
  
  RAISE NOTICE '사용자 ID: %', v_user_id;
  RAISE NOTICE '사용자 이메일: %', v_user_email;
  
  -- 이미 역할이 있는지 확인
  SELECT role INTO v_existing_role
  FROM public.user_platform_roles
  WHERE user_id = v_user_id;
  
  IF v_existing_role IS NOT NULL THEN
    RAISE NOTICE '이미 플랫폼 역할이 설정되어 있습니다: %', v_existing_role;
    
    -- Super Admin이 아니면 업데이트
    IF v_existing_role != 'super_admin' THEN
      UPDATE public.user_platform_roles
      SET role = 'super_admin', updated_at = now()
      WHERE user_id = v_user_id;
      
      RAISE NOTICE '✅ 역할이 super_admin으로 변경되었습니다!';
    ELSE
      RAISE NOTICE '✅ 이미 Super Admin입니다!';
    END IF;
  ELSE
    -- Super Admin 역할 부여
    INSERT INTO public.user_platform_roles (user_id, role, created_by)
    VALUES (v_user_id, 'super_admin', v_user_id)
    ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin', updated_at = now();
    
    RAISE NOTICE '✅ Super Admin 역할이 부여되었습니다!';
  END IF;
END $$;

-- 최종 확인: 모든 Super Admin 목록
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

