/**
 * 현재 사용자로 RPC 함수 테스트
 * 
 * [불변 규칙] 실제 로그인한 사용자로 RPC 함수를 테스트하여 오류 원인 확인
 */

-- 1. 현재 사용자 정보
SELECT 
  '현재 사용자' AS check_type,
  auth.uid() AS user_id,
  auth.email() AS email;

-- 2. 현재 사용자의 플랫폼 역할
SELECT 
  '플랫폼 역할' AS check_type,
  upr.user_id,
  upr.role,
  upr.created_at
FROM public.user_platform_roles upr
WHERE upr.user_id = auth.uid();

-- 3. RPC 함수 직접 호출 테스트
-- ⚠️ 주의: 이 쿼리는 실제로 RPC 함수를 호출합니다
DO $$
DECLARE
  v_result jsonb;
  v_error text;
  v_error_code text;
BEGIN
  RAISE NOTICE '=== RPC 함수 테스트 시작 ===';
  RAISE NOTICE '현재 사용자 ID: %', auth.uid();
  RAISE NOTICE '현재 사용자 이메일: %', auth.email();
  
  -- user_platform_roles 확인
  IF EXISTS (
    SELECT 1 FROM public.user_platform_roles
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'developer', 'qa')
  ) THEN
    RAISE NOTICE '✅ 플랫폼 역할 확인: OK';
  ELSE
    RAISE WARNING '❌ 플랫폼 역할 없음: user_platform_roles 테이블에서 역할을 찾을 수 없습니다.';
  END IF;
  
  BEGIN
    -- get_schema_registry_list 함수 테스트
    SELECT jsonb_agg(row_to_json(t)) INTO v_result
    FROM (
      SELECT * FROM public.get_schema_registry_list(NULL, NULL, NULL) LIMIT 1
    ) t;
    
    IF v_result IS NOT NULL THEN
      RAISE NOTICE '✅ RPC 함수 호출 성공';
      RAISE NOTICE '결과 개수: %', jsonb_array_length(v_result);
    ELSE
      RAISE NOTICE '✅ RPC 함수 호출 성공 (결과 없음)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    v_error_code := SQLSTATE;
    RAISE WARNING '❌ RPC 함수 호출 실패';
    RAISE WARNING '오류 코드: %', v_error_code;
    RAISE WARNING '오류 메시지: %', v_error;
    
    -- 상세 오류 정보
    IF v_error LIKE '%Access denied%' THEN
      RAISE NOTICE '💡 원인: 권한 검증 실패';
      RAISE NOTICE '   → user_platform_roles 테이블에서 super_admin, developer, qa 역할을 확인하세요.';
    ELSIF v_error LIKE '%relation%does not exist%' THEN
      RAISE NOTICE '💡 원인: 테이블이 존재하지 않음';
      RAISE NOTICE '   → meta.schema_registry 테이블이 생성되었는지 확인하세요.';
    ELSIF v_error LIKE '%function%does not exist%' THEN
      RAISE NOTICE '💡 원인: RPC 함수가 존재하지 않음';
      RAISE NOTICE '   → 048_create_schema_registry_rpc.sql을 실행하세요.';
    ELSE
      RAISE NOTICE '💡 원인: 알 수 없는 오류';
      RAISE NOTICE '   → 브라우저 콘솔에서 상세 오류 메시지를 확인하세요.';
    END IF;
  END;
  
  RAISE NOTICE '=== RPC 함수 테스트 완료 ===';
END $$;

-- 4. user_platform_roles 테이블의 모든 Super Admin 확인
SELECT 
  '모든 Super Admin' AS check_type,
  upr.user_id,
  u.email,
  upr.role,
  upr.created_at
FROM public.user_platform_roles upr
LEFT JOIN auth.users u ON upr.user_id = u.id
WHERE upr.role = 'super_admin'
ORDER BY upr.created_at DESC;

