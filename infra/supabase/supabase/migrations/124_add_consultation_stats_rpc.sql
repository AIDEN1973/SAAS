-- 124_add_consultation_stats_rpc.sql
-- 목적: 상담 통계 RPC 함수 생성 (이번 달 상담 건수, 대기 중인 상담 건수, 긴급 상담 건수)
-- SECURITY DEFINER 공통 가드 적용

-- ------------------------------------------------------------
-- consultation_stats(p_tenant_id uuid)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consultation_stats(
  p_tenant_id uuid
)
RETURNS TABLE (
  this_month_count bigint,
  pending_count bigint,
  urgent_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  jwt_claims_json jsonb;
  jwt_tenant_text text;
  jwt_tenant_id uuid;
  v_user_role text;
  v_class_ids uuid[];
  kst_today date := (timezone('Asia/Seoul', now()))::date;
  kst_month_start date := date_trunc('month', timezone('Asia/Seoul', now()))::date;
BEGIN
  PERFORM set_config('search_path', 'public, pg_temp', true);

  -- ✅ P0-SEC-1: request.jwt.claims 안전 파싱
  jwt_claims_json := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_tenant_text := jwt_claims_json ->> 'tenant_id';

  IF jwt_tenant_text IS NULL OR jwt_tenant_text = '' THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  jwt_tenant_id := jwt_tenant_text::uuid;

  IF p_tenant_id IS NULL OR jwt_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  -- 사용자 역할 확인
  SELECT utr.role INTO v_user_role
  FROM public.user_tenant_roles utr
  WHERE utr.user_id = auth.uid() AND utr.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  -- Teacher인 경우 class_ids 조회
  IF v_user_role = 'teacher' THEN
    SELECT COALESCE(array_agg(ct.class_id), '{}'::uuid[]) INTO v_class_ids
    FROM public.class_teachers ct
    WHERE ct.teacher_id = auth.uid() AND ct.tenant_id = p_tenant_id;
  ELSE
    v_class_ids := NULL;
  END IF;

  RETURN QUERY
  WITH target_students AS (
    SELECT p.id
    FROM public.persons p
    JOIN public.academy_students ac ON p.id = ac.person_id
    WHERE p.tenant_id = p_tenant_id
      AND p.person_type = 'student'
      AND ac.status = 'active'
      AND (
        v_user_role <> 'teacher'
        OR EXISTS (
          SELECT 1
          FROM public.student_classes sc
          WHERE sc.student_id = p.id
            AND sc.class_id = ANY(v_class_ids)
            AND sc.is_active = true
        )
      )
  )
  SELECT
    -- 이번 달 상담 건수
    (
      SELECT COUNT(*)::bigint
      FROM public.student_consultations sc
      JOIN target_students ts ON ts.id = sc.student_id
      WHERE sc.tenant_id = p_tenant_id
        AND (timezone('Asia/Seoul', sc.consultation_date))::date >= kst_month_start
        AND (timezone('Asia/Seoul', sc.consultation_date))::date <= kst_today
    ) AS this_month_count,
    -- 대기 중인 상담 건수 (student_alerts_summary의 consultation_pending_count와 동일한 로직)
    (
      SELECT COUNT(*)::bigint
      FROM public.student_consultations sc
      JOIN target_students ts ON ts.id = sc.student_id
      WHERE sc.tenant_id = p_tenant_id
      -- TODO: status 컬럼이 추가되면 sc.status = 'pending' 조건 추가
    ) AS pending_count,
    -- 긴급 상담 건수 (현재는 urgency 필드가 없으므로 0 반환, 추후 구현)
    (
      SELECT 0::bigint
      -- TODO: urgency 필드가 추가되면 긴급 상담 건수 계산 로직 추가
    ) AS urgent_count;
END;
$$;

-- 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.consultation_stats(uuid) TO authenticated;

