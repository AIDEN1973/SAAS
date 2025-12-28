/**
 * 모든 사용자 목록 조회
 * 
 * [불변 규칙] 사용자 ID와 이메일을 확인하여 Super Admin 생성에 사용
 */

-- 모든 사용자 목록 (이메일과 ID)
SELECT 
  '사용자 목록' AS check_type,
  u.id AS user_id,
  u.email,
  u.created_at AS user_created_at,
  upr.role AS platform_role,
  upr.created_at AS role_created_at
FROM auth.users u
LEFT JOIN public.user_platform_roles upr ON u.id = upr.user_id
ORDER BY u.created_at DESC;

-- 플랫폼 역할이 없는 사용자만 표시
SELECT 
  '역할 없는 사용자' AS check_type,
  u.id AS user_id,
  u.email,
  u.created_at
FROM auth.users u
LEFT JOIN public.user_platform_roles upr ON u.id = upr.user_id
WHERE upr.user_id IS NULL
ORDER BY u.created_at DESC;

