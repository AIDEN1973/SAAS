-- Operation Registry 초기 데이터 등록
-- 액티비티.md 8.A.1, 8.A.2, 8.A.3 섹션 참조
-- 목적: 모든 사용 중인 operation_type을 meta.operation_registry에 등록

-- ============================================================================
-- 학생 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('student.register', '학생 등록', 'low', '학생 등록 완료', '{"student_id": true}'::jsonb),
  ('student.update', '학생 정보 수정', 'low', '학생 정보 수정 완료', '{"student_id": true, "changed_fields": true}'::jsonb),
  ('student.delete', '학생 퇴원 처리', 'low', '학생 퇴원 처리 완료', '{"student_id": true}'::jsonb),
  ('student.update-tags', '학생 태그 업데이트', 'low', '학생 태그 업데이트 완료', '{"student_id": true, "tag_count": true}'::jsonb),
  ('student.assign-class', '학생 반 배정', 'low', '학생 반 배정 완료', '{"student_id": true, "class_id": true}'::jsonb),
  ('student.unassign-class', '학생 반 배정 제거', 'low', '학생 반 배정 제거 완료', '{"student_id": true, "class_id": true}'::jsonb),
  ('student.update-class-enrolled-at', '학생 반 등록일 수정', 'low', '학생 반 등록일 수정 완료', '{"student_class_id": true, "new_enrolled_at": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 반 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('class.register', '반 등록', 'low', '반 등록 완료', '{"class_id": true}'::jsonb),
  ('class.update', '반 정보 수정', 'low', '반 정보 수정 완료', '{"class_id": true, "changed_fields": true}'::jsonb),
  ('class.delete', '반 삭제 (archived)', 'low', '반 삭제 완료 (archived)', '{"class_id": true, "new_status": true}'::jsonb),
  ('class.assign-teacher', '강사 배정', 'low', '강사 배정 완료', '{"class_id": true, "teacher_id": true}'::jsonb),
  ('class.unassign-teacher', '강사 배정 제거', 'low', '강사 배정 제거 완료', '{"class_id": true, "teacher_id": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 강사 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('teacher.register', '강사 등록', 'low', '강사 등록 완료', '{"teacher_id": true}'::jsonb),
  ('teacher.update', '강사 정보 수정', 'low', '강사 정보 수정 완료', '{"teacher_id": true, "changed_fields": true}'::jsonb),
  ('teacher.delete', '강사 퇴직 처리', 'low', '강사 퇴직 처리 완료', '{"teacher_id": true, "new_status": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 보호자 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('guardian.register', '보호자 등록', 'medium', '보호자 등록 완료', '{"guardian_id": true, "student_id": true}'::jsonb),
  ('guardian.update', '보호자 정보 수정', 'medium', '보호자 정보 수정 완료', '{"guardian_id": true, "student_id": true, "changed_fields": true}'::jsonb),
  ('guardian.delete', '보호자 삭제', 'medium', '보호자 삭제 완료', '{"guardian_id": true, "student_id": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 상담기록 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('consultation.create', '상담기록 생성', 'low', '상담기록 생성 완료', '{"consultation_id": true, "student_id": true, "consultation_type": true}'::jsonb),
  ('consultation.update', '상담기록 수정', 'low', '상담기록 수정 완료', '{"consultation_id": true, "student_id": true, "changed_fields": true}'::jsonb),
  ('consultation.delete', '상담기록 삭제', 'low', '상담기록 삭제 완료', '{"consultation_id": true, "student_id": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 출결 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('attendance.create', '출결 로그 생성', 'low', '출결 로그 생성 완료', '{"attendance_log_id": true, "student_id": true, "attendance_type": true}'::jsonb),
  ('attendance.update', '출결 로그 수정', 'low', '출결 로그 수정 완료', '{"attendance_log_id": true, "student_id": true, "changed_fields": true}'::jsonb),
  ('attendance.delete', '출결 로그 삭제', 'low', '출결 로그 삭제 완료', '{"attendance_log_id": true, "student_id": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 결제 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('payment.process', '결제 처리', 'high', '결제 처리 완료', '{"invoice_id": true, "payment_method": true, "amount": true, "payment_id": true}'::jsonb),
  ('payment.webhook-failed', '결제 실패 웹훅 처리', 'high', '결제 실패 웹훅 처리 완료', '{"invoice_id": true, "payment_id": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 설정 관리 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('config.update', '테넌트 설정 업데이트', 'low', '테넌트 설정 업데이트 완료', '{"changed_sections": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 메시징 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('messaging.send-sms', 'SMS 발송', 'high', '메시지 발송 요청 완료', '{"student_id": true, "recipient_count": true, "channel": true, "message_id": true, "vendor_message_id": true, "notification_id": true}'::jsonb),
  ('messaging.send-bulk', '일괄 메시지 발송', 'high', '일괄 메시지 발송 요청 완료', '{"recipient_count": true, "total_count": true, "channel": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- 스케줄러 operation_type
-- ============================================================================

INSERT INTO meta.operation_registry (operation_type, description, pii_risk, default_summary_template, allowed_details_keys)
VALUES
  ('scheduler.auto-billing-generation', '청구서 자동 생성 배치', 'low', '청구서 자동 생성 배치 작업 완료', '{"generated_count": true, "tenant_count": true, "execution_period": true, "errors": true}'::jsonb),
  ('scheduler.overdue-notification', '미납 알림 자동 발송 배치', 'medium', '미납 알림 자동 발송 배치 작업 완료', '{"sent_count": true, "tenant_count": true, "execution_date": true}'::jsonb)
ON CONFLICT (operation_type) DO UPDATE SET
  description = EXCLUDED.description,
  pii_risk = EXCLUDED.pii_risk,
  default_summary_template = EXCLUDED.default_summary_template,
  allowed_details_keys = EXCLUDED.allowed_details_keys,
  updated_at = now();

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON TABLE meta.operation_registry IS 'Operation Registry 테이블 (액티비티.md 8.A.1, 8.A.2 참조) - 초기 데이터 등록 완료';

