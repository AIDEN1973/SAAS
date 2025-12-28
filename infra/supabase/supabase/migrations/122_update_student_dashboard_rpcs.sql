-- 122_update_student_dashboard_rpcs.sql
-- 목적:
-- 1) SECURITY DEFINER 공통 가드: request.jwt.claims 안전 파싱 + Access denied 일반화 + search_path set_config
-- 2) p_role/p_class_ids 제거: 서버에서 user_tenant_roles / class_teachers로 결정
-- 3) KST 날짜 필터: 항상 [start, end) timestamptz range
-- 4) teacher 스코프: student_stats / attendance_stats / alerts 모두 동일 적용

-- ------------------------------------------------------------
-- student_stats(p_tenant_id uuid)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_stats(
  p_tenant_id uuid
)
RETURNS TABLE (
  total bigint,
  active bigint,
  inactive bigint,
  new_this_month bigint,
  by_status jsonb
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

  -- ✅ 서버에서 role 결정 (Fail-closed: role 없으면 차단)
  SELECT utr.role
    INTO v_user_role
  FROM public.user_tenant_roles utr
  WHERE utr.user_id = auth.uid()
    AND utr.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  -- ✅ teacher면 class_ids 서버에서 결정 (없으면 빈 배열)
  IF v_user_role = 'teacher' THEN
    SELECT COALESCE(array_agg(ct.class_id), '{}'::uuid[])
      INTO v_class_ids
    FROM public.class_teachers ct
    WHERE ct.teacher_id = auth.uid()
      AND ct.tenant_id = p_tenant_id;
  ELSE
    v_class_ids := NULL; -- teacher가 아니면 제한 없음(tenant 내)
  END IF;

  RETURN QUERY
  WITH filtered_students AS (
    SELECT
      p.id,
      p.created_at,
      ac.status
    FROM public.persons p
    JOIN public.academy_students ac
      ON p.id = ac.person_id
    WHERE p.tenant_id = p_tenant_id
      AND p.person_type = 'student'
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
    (SELECT COUNT(*)::bigint FROM filtered_students) AS total,
    (SELECT COUNT(*)::bigint FROM filtered_students WHERE status = 'active') AS active,
    (SELECT COUNT(*)::bigint FROM filtered_students WHERE status = 'inactive') AS inactive,
    (SELECT COUNT(*)::bigint
       FROM filtered_students
      WHERE (timezone('Asia/Seoul', created_at))::date >= kst_month_start
        AND (timezone('Asia/Seoul', created_at))::date <= kst_today
    ) AS new_this_month,
    COALESCE((
      SELECT jsonb_object_agg(s.status, s.cnt)
      FROM (
        SELECT status, COUNT(*)::bigint AS cnt
        FROM filtered_students
        GROUP BY status
      ) s
    ), '{}'::jsonb) AS by_status;
END;
$$;

-- ------------------------------------------------------------
-- attendance_stats(p_tenant_id uuid, p_date date)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_stats(
  p_tenant_id uuid,
  p_date date
)
RETURNS TABLE (
  total_students bigint,
  present bigint,
  late bigint,
  absent bigint,
  not_checked bigint,
  attendance_rate numeric
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

  kst_date_start timestamptz;
  kst_date_end timestamptz;
BEGIN
  PERFORM set_config('search_path', 'public, pg_temp', true);

  jwt_claims_json := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_tenant_text := jwt_claims_json ->> 'tenant_id';

  IF jwt_tenant_text IS NULL OR jwt_tenant_text = '' THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  jwt_tenant_id := jwt_tenant_text::uuid;

  IF p_tenant_id IS NULL OR p_date IS NULL OR jwt_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  SELECT utr.role
    INTO v_user_role
  FROM public.user_tenant_roles utr
  WHERE utr.user_id = auth.uid()
    AND utr.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_user_role = 'teacher' THEN
    SELECT COALESCE(array_agg(ct.class_id), '{}'::uuid[])
      INTO v_class_ids
    FROM public.class_teachers ct
    WHERE ct.teacher_id = auth.uid()
      AND ct.tenant_id = p_tenant_id;
  ELSE
    v_class_ids := NULL;
  END IF;

  -- ✅ KST [start, end)
  kst_date_start := (p_date::timestamp) AT TIME ZONE 'Asia/Seoul';
  kst_date_end   := ((p_date + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';

  RETURN QUERY
  WITH target_students AS (
    SELECT p.id
    FROM public.persons p
    JOIN public.academy_students ac
      ON p.id = ac.person_id
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
  ),
  logs AS (
    SELECT
      COUNT(*) FILTER (WHERE al.status = 'present')::bigint AS present,
      COUNT(*) FILTER (WHERE al.status = 'late')::bigint AS late,
      COUNT(*) FILTER (WHERE al.status = 'absent')::bigint AS absent
    FROM public.attendance_logs al
    JOIN target_students ts
      ON ts.id = al.student_id
    WHERE al.tenant_id = p_tenant_id
      AND al.occurred_at >= kst_date_start
      AND al.occurred_at <  kst_date_end
  ),
  denom AS (
    SELECT COUNT(*)::bigint AS total_students
    FROM target_students
  )
  SELECT
    d.total_students,
    COALESCE(l.present, 0),
    COALESCE(l.late, 0),
    COALESCE(l.absent, 0),
    (d.total_students - COALESCE(l.present,0) - COALESCE(l.late,0) - COALESCE(l.absent,0))::bigint AS not_checked,
    CASE
      WHEN d.total_students > 0
        THEN ROUND((COALESCE(l.present,0)::numeric / d.total_students::numeric) * 100, 1)
      ELSE 0
    END AS attendance_rate
  FROM denom d
  CROSS JOIN logs l;
END;
$$;

-- ------------------------------------------------------------
-- student_alerts_summary(p_tenant_id uuid)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_alerts_summary(
  p_tenant_id uuid
)
RETURNS TABLE (
  risk_count bigint,
  absent_count bigint,
  consultation_pending_count bigint
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

  kst_3days_ago_start timestamptz;
  kst_7days_ago_start timestamptz;
  kst_today_end timestamptz;
BEGIN
  PERFORM set_config('search_path', 'public, pg_temp', true);

  jwt_claims_json := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  jwt_tenant_text := jwt_claims_json ->> 'tenant_id';

  IF jwt_tenant_text IS NULL OR jwt_tenant_text = '' THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  jwt_tenant_id := jwt_tenant_text::uuid;

  IF p_tenant_id IS NULL OR jwt_tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  SELECT utr.role
    INTO v_user_role
  FROM public.user_tenant_roles utr
  WHERE utr.user_id = auth.uid()
    AND utr.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'P0001';
  END IF;

  IF v_user_role = 'teacher' THEN
    SELECT COALESCE(array_agg(ct.class_id), '{}'::uuid[])
      INTO v_class_ids
    FROM public.class_teachers ct
    WHERE ct.teacher_id = auth.uid()
      AND ct.tenant_id = p_tenant_id;
  ELSE
    v_class_ids := NULL;
  END IF;

  -- ✅ KST [start, end)
  kst_3days_ago_start := (((timezone('Asia/Seoul', now())::date - 3)::timestamp) AT TIME ZONE 'Asia/Seoul');
  kst_7days_ago_start := (((timezone('Asia/Seoul', now())::date - 7)::timestamp) AT TIME ZONE 'Asia/Seoul');
  kst_today_end       := (((timezone('Asia/Seoul', now())::date + 1)::timestamp) AT TIME ZONE 'Asia/Seoul');

  RETURN QUERY
  WITH target_students AS (
    SELECT p.id
    FROM public.persons p
    JOIN public.academy_students ac
      ON p.id = ac.person_id
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
    -- risk_count: 최근 3일 결석 3회 이상 학생 수 (스코프 적용)
    (
      SELECT COUNT(*)::bigint
      FROM (
        SELECT al.student_id
        FROM public.attendance_logs al
        JOIN target_students ts ON ts.id = al.student_id
        WHERE al.tenant_id = p_tenant_id
          AND al.status = 'absent'
          AND al.occurred_at >= kst_3days_ago_start
          AND al.occurred_at <  kst_today_end
        GROUP BY al.student_id
        HAVING COUNT(*) >= 3
      ) r
    ) AS risk_count,
    -- absent_count: 최근 7일 결석 3회 이상 학생 수 (스코프 적용)
    (
      SELECT COUNT(*)::bigint
      FROM (
        SELECT al.student_id
        FROM public.attendance_logs al
        JOIN target_students ts ON ts.id = al.student_id
        WHERE al.tenant_id = p_tenant_id
          AND al.status = 'absent'
          AND al.occurred_at >= kst_7days_ago_start
          AND al.occurred_at <  kst_today_end
        GROUP BY al.student_id
        HAVING COUNT(*) >= 3
      ) a
    ) AS absent_count,
    (
      SELECT COUNT(*)::bigint
      FROM public.student_consultations sc
      JOIN target_students ts ON ts.id = sc.student_id
      WHERE sc.tenant_id = p_tenant_id
      -- ✅ student_consultations 테이블에는 status 컬럼이 없으므로 모든 상담을 카운트
      -- TODO: status 컬럼이 추가되면 sc.status = 'pending' 조건 추가
    ) AS consultation_pending_count;
END;
$$;

-- (선택) 실행권한 정리: 환경 정책에 맞춰 적용
-- REVOKE ALL ON FUNCTION public.student_stats(uuid) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.attendance_stats(uuid, date) FROM PUBLIC;
-- REVOKE ALL ON FUNCTION public.student_alerts_summary(uuid) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.student_stats(uuid) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.attendance_stats(uuid, date) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.student_alerts_summary(uuid) TO authenticated;

