/**
 * Migration: Fix attendance_type to be nullable
 *
 * [문제]
 * attendance_type 컬럼이 NOT NULL 제약조건을 가지고 있어서
 * 수업 출석 레코드(attendance_type=null)를 저장할 수 없음
 *
 * [해결]
 * attendance_type 컬럼을 nullable로 변경
 *
 * [이중 레코드 패턴]
 * 1. check_in/check_out 이벤트: attendance_type != null, class_id = null, status = null
 * 2. 수업 출석 레코드: attendance_type = null, class_id != null, status != null
 */

-- 1. attendance_type 컬럼을 nullable로 변경
ALTER TABLE attendance_logs
ALTER COLUMN attendance_type DROP NOT NULL;

-- 2. 컬럼 코멘트 업데이트
COMMENT ON COLUMN attendance_logs.attendance_type IS
'출결 이벤트 타입: check_in(등원), check_out(하원), null(수업 출석). 이중 레코드 패턴 사용.';
