-- 강사 가입 신청 테이블 생성
-- 초대링크를 통한 신청은 즉시 teachers에 삽입하지 않고, 이 테이블에 대기 상태로 저장
-- 관리자 승인 시 실제 teachers + persons + auth.users 생성

-- 1. teacher_registration_requests 테이블 생성
CREATE TABLE IF NOT EXISTS public.teacher_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invitation_id UUID NOT NULL REFERENCES public.teacher_invitations(id) ON DELETE CASCADE,

  -- 신청자 정보 (승인 전까지 임시 저장)
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  login_id TEXT NOT NULL,
  password_encoded TEXT NOT NULL,  -- base64 인코딩으로 저장 (Edge Function에서 복호화)
  position TEXT NOT NULL CHECK (position IN ('vice_principal', 'manager', 'teacher', 'assistant', 'other')),

  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,

  -- 승인 관련
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- 생성된 teacher_id (승인 후 채워짐)
  created_teacher_id UUID,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_teacher_reg_requests_tenant ON public.teacher_registration_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_reg_requests_status ON public.teacher_registration_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_teacher_reg_requests_invitation ON public.teacher_registration_requests(invitation_id);

-- 테넌트 내 login_id 유니크 (pending 상태만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_reg_requests_login_id
ON public.teacher_registration_requests(tenant_id, login_id)
WHERE status = 'pending';

-- RLS 정책
ALTER TABLE public.teacher_registration_requests ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회/관리 가능
DROP POLICY IF EXISTS "Admins can manage registration requests" ON public.teacher_registration_requests;
CREATE POLICY "Admins can manage registration requests" ON public.teacher_registration_requests
  FOR ALL USING (
    tenant_id = (
      SELECT tenant_id FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM public.user_tenant_roles
      WHERE user_id = auth.uid()
      AND tenant_id = teacher_registration_requests.tenant_id
      AND role IN ('owner', 'admin', 'sub_admin')
    )
  );

-- 익명 사용자도 INSERT 가능 (신청 시)
DROP POLICY IF EXISTS "Anyone can submit registration request" ON public.teacher_registration_requests;
CREATE POLICY "Anyone can submit registration request" ON public.teacher_registration_requests
  FOR INSERT WITH CHECK (true);

-- 2. 가입 신청 제출 RPC (중복 체크 포함)
CREATE OR REPLACE FUNCTION public.submit_teacher_registration(
  p_token TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_login_id TEXT,
  p_password TEXT  -- 평문 비밀번호 (base64 인코딩하여 저장)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_request_id UUID;
  v_password_encoded TEXT;
BEGIN
  -- 1. 초대 토큰 검증
  SELECT ti.id, ti.tenant_id, ti.position, ti.expires_at, ti.used_at
  INTO v_invitation
  FROM public.teacher_invitations ti
  WHERE ti.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '유효하지 않은 초대 링크입니다.');
  END IF;

  IF v_invitation.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 사용된 초대 링크입니다.');
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', '만료된 초대 링크입니다.');
  END IF;

  -- 2. 중복 검사: login_id (기존 teachers + 대기 중 신청)
  IF EXISTS (
    SELECT 1 FROM public.academy_teachers
    WHERE tenant_id = v_invitation.tenant_id
      AND login_id = p_login_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 사용 중인 아이디입니다.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teacher_registration_requests
    WHERE tenant_id = v_invitation.tenant_id
      AND login_id = p_login_id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 신청된 아이디입니다. 관리자 승인을 기다려주세요.');
  END IF;

  -- 3. 중복 검사: phone (기존 teachers)
  IF EXISTS (
    SELECT 1 FROM public.persons p
    JOIN public.academy_teachers at ON at.person_id = p.id
    WHERE p.tenant_id = v_invitation.tenant_id
      AND p.phone = p_phone
      AND p.person_type = 'teacher'
      AND at.status IN ('active', 'on_leave', 'pending')
      AND at.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 등록된 전화번호입니다.');
  END IF;

  -- 4. 비밀번호 base64 인코딩 (Edge Function에서 복호화하여 auth.users 생성)
  v_password_encoded := encode(p_password::bytea, 'base64');

  -- 5. 신청 데이터 저장
  INSERT INTO public.teacher_registration_requests (
    tenant_id,
    invitation_id,
    name,
    phone,
    email,
    login_id,
    password_encoded,
    position,
    status
  ) VALUES (
    v_invitation.tenant_id,
    v_invitation.id,
    p_name,
    p_phone,
    p_email,
    p_login_id,
    v_password_encoded,
    v_invitation.position,
    'pending'
  )
  RETURNING id INTO v_request_id;

  -- 6. 초대 링크 사용 처리
  UPDATE public.teacher_invitations
  SET used_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', '신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. 가입 신청 승인 RPC (실제 teachers + auth.users 생성)
-- 주의: auth.users 생성은 Edge Function에서 처리해야 함 (admin API 필요)
-- 이 RPC는 teacher_registration_requests 상태만 업데이트
CREATE OR REPLACE FUNCTION public.approve_teacher_registration(
  p_request_id UUID,
  p_approved_by UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- 1. 신청 정보 조회
  SELECT *
  INTO v_request
  FROM public.teacher_registration_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '존재하지 않는 신청입니다.');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 처리된 신청입니다.');
  END IF;

  -- 2. 상태 업데이트 (실제 teacher 생성은 Edge Function에서)
  UPDATE public.teacher_registration_requests
  SET
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_approved_by,
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'tenant_id', v_request.tenant_id,
    'name', v_request.name,
    'phone', v_request.phone,
    'email', v_request.email,
    'login_id', v_request.login_id,
    'password_encoded', v_request.password_encoded,
    'position', v_request.position
  );
END;
$$;

-- 4. 가입 신청 거절 RPC
CREATE OR REPLACE FUNCTION public.reject_teacher_registration(
  p_request_id UUID,
  p_rejected_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- 1. 신청 정보 조회
  SELECT *
  INTO v_request
  FROM public.teacher_registration_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '존재하지 않는 신청입니다.');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', '이미 처리된 신청입니다.');
  END IF;

  -- 2. 상태 업데이트
  UPDATE public.teacher_registration_requests
  SET
    status = 'rejected',
    rejected_reason = p_reason,
    approved_by = p_rejected_by,  -- rejected_by 역할
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  -- 3. 초대 링크 재사용 가능하도록 used_at 초기화
  UPDATE public.teacher_invitations
  SET used_at = NULL
  WHERE id = v_request.invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', '신청이 거절되었습니다.'
  );
END;
$$;

-- 5. 대기 중인 신청 목록 조회 (관리자용)
CREATE OR REPLACE FUNCTION public.get_pending_teacher_registrations(
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  login_id TEXT,
  teacher_position TEXT,  -- position은 예약어라 teacher_position으로 반환
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    trr.id,
    trr.name,
    trr.phone,
    trr.email,
    trr.login_id,
    trr."position" AS teacher_position,
    trr.created_at
  FROM public.teacher_registration_requests trr
  WHERE trr.tenant_id = p_tenant_id
    AND trr.status = 'pending'
  ORDER BY trr.created_at DESC;
END;
$$;

-- pgcrypto 확장은 더 이상 비밀번호 해싱에 사용하지 않음
-- (base64 인코딩 사용으로 변경)

-- 권한 부여
GRANT ALL ON public.teacher_registration_requests TO authenticated;
GRANT INSERT ON public.teacher_registration_requests TO anon;

-- RPC 권한
GRANT EXECUTE ON FUNCTION public.submit_teacher_registration TO anon;
GRANT EXECUTE ON FUNCTION public.submit_teacher_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_teacher_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_teacher_registration TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_teacher_registrations TO authenticated;

-- 코멘트
COMMENT ON TABLE public.teacher_registration_requests IS '강사 가입 신청 대기 테이블. 관리자 승인 전까지 임시 저장.';
COMMENT ON FUNCTION public.submit_teacher_registration IS '초대링크를 통한 강사 가입 신청. 중복 체크 후 대기 테이블에 저장.';
COMMENT ON FUNCTION public.approve_teacher_registration IS '관리자의 가입 신청 승인. 실제 teacher 생성은 Edge Function에서 처리.';
COMMENT ON FUNCTION public.reject_teacher_registration IS '관리자의 가입 신청 거절.';
COMMENT ON FUNCTION public.get_pending_teacher_registrations IS '대기 중인 가입 신청 목록 조회 (관리자용).';
