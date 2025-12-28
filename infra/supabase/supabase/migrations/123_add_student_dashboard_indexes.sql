-- 123_add_student_dashboard_indexes.sql

-- attendance_logs: tenant_id + occurred_at range + status + student_id 커버
CREATE INDEX IF NOT EXISTS idx_attendance_logs_tenant_time_status_student
  ON public.attendance_logs (tenant_id, occurred_at, status, student_id)
  WHERE status IN ('present', 'late', 'absent');

-- student_classes: teacher scope EXISTS 최적화 (둘 다 유지)
CREATE INDEX IF NOT EXISTS idx_student_classes_student_active
  ON public.student_classes (student_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_classes_class_active_student
  ON public.student_classes (class_id, is_active, student_id)
  WHERE is_active = true;

-- consultations: tenant_id 인덱스 (status 컬럼이 없으므로 tenant_id만 인덱싱)
-- TODO: status 컬럼이 추가되면 (tenant_id, status) 복합 인덱스로 변경
CREATE INDEX IF NOT EXISTS idx_student_consultations_tenant
  ON public.student_consultations (tenant_id);

-- SECURITY DEFINER 내부 role 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_tenant
  ON public.user_tenant_roles (user_id, tenant_id);

-- teacher의 class_ids 조회 최적화
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher_tenant
  ON public.class_teachers (teacher_id, tenant_id);

-- (확인용)
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE tablename LIKE 'attendance_logs%'
-- ORDER BY tablename, indexname;

