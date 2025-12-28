-- 출결 로그 RLS 정책 (프로덕션용)
-- [불변 규칙] JWT claim 기반 RLS 사용

-- 개발 환경 우회 정책 제거 (프로덕션 배포 시)
-- DROP POLICY IF EXISTS dev_bypass_attendance_logs ON public.attendance_logs;

-- 프로덕션 RLS 정책 (이미 020에서 생성됨, 여기서는 확인용)
-- tenant_isolation_attendance_logs 정책이 이미 적용되어 있음

