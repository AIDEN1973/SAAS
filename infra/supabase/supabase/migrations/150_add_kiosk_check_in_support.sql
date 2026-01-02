-- 키오스크 출석 체크 지원 스키마 추가
-- [목적] 태블릿 단말기에서 학생 본인 휴대폰 번호 입력으로 출석 체크
-- [불변 규칙] 키오스크 기능은 Policy로 제어됨 (kiosk.enabled)

-- 1. academy_students 테이블에 학생 본인 휴대폰 번호 추가
-- ⚠️ 중요: students는 VIEW이므로 실제 테이블인 academy_students에 컬럼 추가
ALTER TABLE public.academy_students
ADD COLUMN IF NOT EXISTS student_phone TEXT;

-- 2. student_phone 유니크 인덱스 (동일 테넌트 내에서 중복 방지)
-- ⚠️ 중요: academy_students 테이블에 인덱스 생성 (VIEW가 아닌 실제 테이블)
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_students_tenant_phone
ON public.academy_students(tenant_id, student_phone)
WHERE student_phone IS NOT NULL;

-- 3. students VIEW 업데이트 (student_phone 컬럼 추가)
-- ⚠️ 중요: VIEW를 재생성하여 student_phone 컬럼 노출
-- ⚠️ 중요: 기존 컬럼 순서를 유지하고 새 컬럼은 마지막에 추가
CREATE OR REPLACE VIEW public.students AS
SELECT
  p.id,
  p.tenant_id,
  'academy'::text AS industry_type,
  p.name,
  s.birth_date,
  s.gender,
  p.phone,
  p.email,
  p.address,
  s.school_name,
  s.grade,
  s.status,
  s.notes,
  s.profile_image_url,
  p.created_at,
  p.updated_at,
  s.created_by,
  s.updated_by,
  s.student_phone  -- 키오스크 출석 체크용 학생 본인 휴대폰 번호 (마지막에 추가)
FROM public.persons p
LEFT JOIN public.academy_students s ON s.person_id = p.id
WHERE p.person_type = 'student';

-- VIEW에 security_invoker 설정 유지
ALTER VIEW public.students SET (security_invoker = true);

-- 4. attendance_logs에 체크인 방법 컬럼 추가
ALTER TABLE public.attendance_logs
ADD COLUMN IF NOT EXISTS check_in_method TEXT DEFAULT 'manual'
CHECK (check_in_method IN ('phone_auth', 'qr_scan', 'manual', 'kiosk_phone'));

-- 4. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_check_in_method
ON public.attendance_logs(tenant_id, check_in_method, occurred_at)
WHERE check_in_method = 'kiosk_phone';

-- 5. 컬럼 주석
-- ⚠️ 중요: VIEW가 아닌 실제 테이블에 주석 추가
COMMENT ON COLUMN public.academy_students.student_phone IS
'학생 본인 휴대폰 번호 (키오스크 출석 체크용). 테넌트 내 유니크. 형식: 01012345678 (하이픈 없음)';

COMMENT ON COLUMN public.attendance_logs.check_in_method IS
'체크인 방법: manual(관리자 수동), kiosk_phone(키오스크 휴대폰), qr_scan(QR), phone_auth(SMS 인증)';

-- 6. 기존 데이터 백필 (check_in_method = 'manual')
UPDATE public.attendance_logs
SET check_in_method = 'manual'
WHERE check_in_method IS NULL;

-- 7. RLS 정책은 기존 것 유지 (키오스크 컬럼은 필터 조건에 사용되지 않음)
-- students, attendance_logs 모두 이미 tenant_id 기반 RLS가 설정되어 있음
