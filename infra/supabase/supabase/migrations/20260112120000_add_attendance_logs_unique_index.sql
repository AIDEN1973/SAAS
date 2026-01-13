-- attendance_logs 테이블에 UNIQUE 인덱스 추가
-- ON CONFLICT 문제 해결을 위한 인덱스
--
-- 파티션 테이블에서는 파티션 키(occurred_at)가 포함된 UNIQUE 제약이 필요합니다.
-- 이 인덱스는 동일 학생의 동일 시간 중복 출결 기록을 방지합니다.

-- 2025년 파티션에 UNIQUE 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_logs_2025_student_occurred_type
ON public.attendance_logs_2025 (tenant_id, student_id, occurred_at, attendance_type);

-- 2026년 파티션에 UNIQUE 인덱스 추가 (존재하는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'attendance_logs_2026'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_logs_2026_student_occurred_type
    ON public.attendance_logs_2026 (tenant_id, student_id, occurred_at, attendance_type);
  END IF;
END $$;

-- 향후 파티션 생성 시에도 동일한 인덱스를 추가해야 합니다.
-- 파티션 생성 스크립트에 이 인덱스 추가를 포함해야 합니다.

-- 검증
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'ux_attendance_logs_2025_student_occurred_type'
  ) THEN
    RAISE NOTICE '✅ attendance_logs_2025 UNIQUE 인덱스 생성 완료';
  ELSE
    RAISE WARNING '❌ attendance_logs_2025 UNIQUE 인덱스 생성 실패';
  END IF;
END $$;

COMMENT ON INDEX ux_attendance_logs_2025_student_occurred_type IS
'동일 학생의 동일 시간/타입 중복 출결 방지 및 ON CONFLICT 지원용 UNIQUE 인덱스';
