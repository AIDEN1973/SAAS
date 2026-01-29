/**
 * Migration: Add 'scheduled' status to attendance_logs
 *
 * [목적] 키오스크 등원 시 오늘 모든 수업을 예비 출석 처리하여
 *        학생이 수업마다 터치하지 않아도 자동으로 출석 처리되도록 함
 *
 * [변경사항]
 * 1. attendance_logs.status에 'scheduled' 상태 추가
 * 2. status 컬럼을 nullable로 변경 (등원/하원 이벤트는 status = null)
 *
 * [설계 철학]
 * - 'scheduled': 등원했지만 아직 수업이 시작되지 않은 예비 출석 상태
 * - 수업 시작 시간이 되면 자동으로 'present' 또는 'late'로 전환
 * - 하원 시 'scheduled' 상태 수업은 자동으로 'absent'로 전환 (조퇴 감지)
 */

-- 1. 'scheduled' 상태 추가
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_status_check;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_status_check
CHECK (status IN ('present', 'late', 'absent', 'excused', 'scheduled'));

-- 2. status 컬럼을 nullable로 변경 (등원/하원 이벤트는 status = null)
ALTER TABLE attendance_logs
ALTER COLUMN status DROP NOT NULL;

-- 3. 컬럼 코멘트 업데이트
COMMENT ON COLUMN attendance_logs.status IS
'출석 상태: present(출석), late(지각), absent(결석), excused(사유), scheduled(예정), null(등원/하원 이벤트만)';

-- 4. attendance_type 컬럼 코멘트도 명확히
COMMENT ON COLUMN attendance_logs.attendance_type IS
'출결 이벤트 타입: check_in(등원), check_out(하원), null(수업 출석만). 등원/하원은 class_id=null, 수업 출석은 class_id 지정';

-- 5. 기존 데이터 검증 (status가 null인데 class_id가 있는 경우 = 잘못된 데이터)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM attendance_logs
    WHERE status IS NULL AND class_id IS NOT NULL
  ) THEN
    RAISE WARNING 'Found attendance_logs records with status=NULL but class_id IS NOT NULL. These should be fixed.';
  END IF;
END $$;

-- 6. 데이터 무결성 제약조건 추가
-- 규칙 1: attendance_type이 check_in/check_out이면 class_id는 null이어야 함
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_checkin_checkout_no_class;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_checkin_checkout_no_class
CHECK (
  (attendance_type IN ('check_in', 'check_out') AND class_id IS NULL)
  OR
  (attendance_type IS NULL)
);

-- 규칙 2: attendance_type이 check_in/check_out이면 status는 null이어야 함
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_checkin_checkout_no_status;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_checkin_checkout_no_status
CHECK (
  (attendance_type IN ('check_in', 'check_out') AND status IS NULL)
  OR
  (attendance_type IS NULL)
);

-- 규칙 3: attendance_type이 null이면 (수업 출석) class_id가 있어야 함
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_class_attendance_requires_class;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_class_attendance_requires_class
CHECK (
  (attendance_type IS NULL AND class_id IS NOT NULL)
  OR
  (attendance_type IS NOT NULL)
);

-- 규칙 4: attendance_type이 null이면 (수업 출석) status가 있어야 함
ALTER TABLE attendance_logs
DROP CONSTRAINT IF EXISTS attendance_logs_class_attendance_requires_status;

ALTER TABLE attendance_logs
ADD CONSTRAINT attendance_logs_class_attendance_requires_status
CHECK (
  (attendance_type IS NULL AND status IS NOT NULL)
  OR
  (attendance_type IS NOT NULL)
);

-- 7. 인덱스 최적화 (scheduled 상태 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_scheduled_status
ON attendance_logs (tenant_id, status, occurred_at)
WHERE status = 'scheduled';

-- 8. 인덱스 최적화 (등원/하원 이벤트 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_logs_checkin_checkout
ON attendance_logs (tenant_id, student_id, attendance_type, occurred_at)
WHERE attendance_type IN ('check_in', 'check_out');
