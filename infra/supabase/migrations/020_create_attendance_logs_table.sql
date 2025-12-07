-- 출결 로그 테이블 생성
-- [불변 규칙] 로그성 테이블이므로 파티셔닝 적용 (Phase 1: 단일 RANGE 파티션)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스가 적용되어야 합니다.

-- 1. 출결 로그 마스터 테이블 (파티션)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id bigserial NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.academy_classes(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL,
  attendance_type text NOT NULL CHECK (attendance_type IN ('check_in', 'check_out', 'absent', 'late')),
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- 2. 2025년 파티션 (Phase 1: 단일 RANGE 파티션)
CREATE TABLE IF NOT EXISTS public.attendance_logs_2025
  PARTITION OF public.attendance_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 3. 인덱스 생성 (필수)
-- [불변 규칙] 모든 파티션에는 반드시 (tenant_id, occurred_at DESC) 복합 인덱스가 적용되어야 합니다.
CREATE INDEX IF NOT EXISTS idx_attendance_logs_2025_tenant_occurred 
  ON public.attendance_logs_2025(tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2025_student 
  ON public.attendance_logs_2025(student_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_2025_class 
  ON public.attendance_logs_2025(class_id, occurred_at DESC) WHERE class_id IS NOT NULL;

-- 4. RLS 정책 (JWT claim 기반)
-- [불변 규칙] JWT claim 기반 RLS 사용 (PgBouncer Transaction Pooling 호환)
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_attendance_logs ON public.attendance_logs
  FOR ALL TO authenticated
  USING (
    tenant_id = (auth.jwt() -> 'tenant_id')::uuid
  )
  WITH CHECK (
    tenant_id = (auth.jwt() -> 'tenant_id')::uuid
  );

-- 5. 개발 환경 RLS 우회 (선택적, 개발 환경에서만 사용)
-- [주의] 프로덕션에서는 이 정책을 제거해야 합니다.
CREATE POLICY dev_bypass_attendance_logs ON public.attendance_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

