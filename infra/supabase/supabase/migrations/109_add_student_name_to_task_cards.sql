/**
 * task_cards 테이블에 레거시 컬럼 추가
 *
 * 문제: 트리거 함수들에서 사용하는 레거시 컬럼들이 테이블에 없어서 에러 발생
 *      - create_absence_task_card: student_name, absence_days, parent_contact_needed
 *      - create_counseling_task_card: student_name, counseling_type, urgency
 *      - create_new_signup_task_card: student_name, signup_date, initial_setup_needed
 *      - create_risk_task_card: student_name, risk_level, risk_reason, recommended_action
 *
 * 해결: 모든 레거시 컬럼을 추가하여 트리거와 테이블 스키마를 일치시킴
 *      레거시 필드이지만 하위 호환성을 위해 유지
 *
 * ⚠️ 주의: 이 마이그레이션은 113번 마이그레이션(RENAME) 이전에 실행되었을 수 있습니다.
 * 113번 마이그레이션에서 테이블명이 task_cards로 변경되므로, 이 파일은 레거시 참고용으로만 유지됩니다.
 */

-- student_name 컬럼 추가 (선택적, 레거시 필드)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS student_name TEXT;

COMMENT ON COLUMN task_cards.student_name IS '학생 이름 (레거시 필드, 하위 호환성 유지용)';

-- absence 관련 레거시 컬럼 추가
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS absence_days INTEGER;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS parent_contact_needed BOOLEAN;

COMMENT ON COLUMN task_cards.absence_days IS '결석 일수 (레거시 필드, create_absence_task_card에서 사용)';
COMMENT ON COLUMN task_cards.parent_contact_needed IS '학부모 연락 필요 여부 (레거시 필드, create_absence_task_card에서 사용)';

-- counseling 관련 레거시 컬럼 추가
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS counseling_type TEXT;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS urgency TEXT;

COMMENT ON COLUMN task_cards.counseling_type IS '상담 유형 (레거시 필드, create_counseling_task_card에서 사용)';
COMMENT ON COLUMN task_cards.urgency IS '긴급도 (레거시 필드, create_counseling_task_card에서 사용)';

-- new_signup 관련 레거시 컬럼 추가
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS signup_date TIMESTAMPTZ;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS initial_setup_needed BOOLEAN;

COMMENT ON COLUMN task_cards.signup_date IS '등록일 (레거시 필드, create_new_signup_task_card에서 사용)';
COMMENT ON COLUMN task_cards.initial_setup_needed IS '초기 설정 필요 여부 (레거시 필드, create_new_signup_task_card에서 사용)';

-- risk 관련 레거시 컬럼 추가
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS risk_level TEXT;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS risk_reason TEXT;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS recommended_action TEXT;

COMMENT ON COLUMN task_cards.risk_level IS '위험 수준 (레거시 필드, create_risk_task_card에서 사용)';
COMMENT ON COLUMN task_cards.risk_reason IS '위험 사유 (레거시 필드, create_risk_task_card에서 사용)';
COMMENT ON COLUMN task_cards.recommended_action IS '권장 조치 (레거시 필드, create_risk_task_card에서 사용)';

-- 추가 레거시 필드 (useStudentTaskCard.ts 타입 정의에 있지만 사용되지 않는 필드)
ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS last_attendance_date DATE;

ALTER TABLE task_cards
ADD COLUMN IF NOT EXISTS welcome_message_sent BOOLEAN;

COMMENT ON COLUMN task_cards.last_attendance_date IS '마지막 출석일 (레거시 필드, 하위 호환성 유지용)';
COMMENT ON COLUMN task_cards.welcome_message_sent IS '환영 메시지 발송 여부 (레거시 필드, 하위 호환성 유지용)';

