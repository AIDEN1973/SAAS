/**
 * Industry Academy Adapter Unit Tests
 *
 * Covers all exported functions:
 * - getAcademyLabel: known keys, unknown keys (fallback)
 * - getAcademyLabelFromI18n: known keys, unknown keys (fallback)
 */

import { describe, it, expect } from 'vitest';
import { getAcademyLabel, getAcademyLabelFromI18n } from '../adapter';

describe('getAcademyLabel', () => {
  it('returns correct label for attendance_anomaly', () => {
    expect(getAcademyLabel('attendance_anomaly')).toBe('출결 이상 감지');
  });

  it('returns correct label for payment_overdue', () => {
    expect(getAcademyLabel('payment_overdue')).toBe('미납 알림');
  });

  it('returns correct label for ai_suggestion', () => {
    expect(getAcademyLabel('ai_suggestion')).toBe('AI 업무 카드');
  });

  it('returns correct label for dashboard_priority', () => {
    expect(getAcademyLabel('dashboard_priority')).toBe('대시보드 우선순위');
  });

  it('returns correct label for report_generation', () => {
    expect(getAcademyLabel('report_generation')).toBe('리포트 생성');
  });

  it('returns correct label for attendance_anomaly_detection_enabled', () => {
    expect(getAcademyLabel('attendance_anomaly_detection_enabled')).toBe('출결 이상 감지 활성화');
  });

  it('returns correct label for attendance_anomaly_detection_threshold', () => {
    expect(getAcademyLabel('attendance_anomaly_detection_threshold')).toBe('이상 패턴 감지 임계값 (일)');
  });

  it('returns correct label for auto_message_suggestion_enabled', () => {
    expect(getAcademyLabel('auto_message_suggestion_enabled')).toBe('자동 추천 메시지 생성 활성화');
  });

  it('returns correct label for attendance_absence_threshold_days', () => {
    expect(getAcademyLabel('attendance_absence_threshold_days')).toBe('결석 감지 임계값 (일)');
  });

  it('returns correct label for auto_notification_overdue_enabled', () => {
    expect(getAcademyLabel('auto_notification_overdue_enabled')).toBe('미납 알림 자동 발송 활성화');
  });

  it('returns correct label for auto_notification_overdue_channel', () => {
    expect(getAcademyLabel('auto_notification_overdue_channel')).toBe('미납 알림 채널');
  });

  it('returns key itself for unknown policy key', () => {
    expect(getAcademyLabel('unknown_policy_key')).toBe('unknown_policy_key');
  });

  it('returns key itself for empty string', () => {
    expect(getAcademyLabel('')).toBe('');
  });
});

describe('getAcademyLabelFromI18n', () => {
  // Automation keys
  it('returns correct label for AUTOMATION.ANOMALY_DETECTION.ENABLED', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY_DETECTION.ENABLED')).toBe('이상 패턴 감지 활성화');
  });

  it('returns correct label for AUTOMATION.ANOMALY_DETECTION.DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY_DETECTION.DESCRIPTION')).toBe('이상 패턴을 자동으로 감지하여 TaskCard를 생성합니다.');
  });

  it('returns correct label for AUTOMATION.ANOMALY_DETECTION.THRESHOLD', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY_DETECTION.THRESHOLD')).toBe('이상 패턴 감지 임계값 (일)');
  });

  it('returns correct label for AUTOMATION.ANOMALY_DETECTION.THRESHOLD_DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY_DETECTION.THRESHOLD_DESCRIPTION')).toBe('이 일수 이상 연속 이상 패턴 시 감지합니다.');
  });

  it('returns correct label for AUTOMATION.MESSAGE_SUGGESTION.ENABLED', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.MESSAGE_SUGGESTION.ENABLED')).toBe('자동 추천 메시지 생성 활성화');
  });

  it('returns correct label for AUTOMATION.MESSAGE_SUGGESTION.DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.MESSAGE_SUGGESTION.DESCRIPTION')).toBe('이상 패턴 감지 시 서버가 메시지 초안을 생성합니다 (AI 호출 포함).');
  });

  it('returns correct label for AUTOMATION.ANOMALY.THRESHOLD_DAYS', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY.THRESHOLD_DAYS')).toBe('이상 패턴 감지 임계값 (일)');
  });

  it('returns correct label for AUTOMATION.ANOMALY.THRESHOLD_DAYS_DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.ANOMALY.THRESHOLD_DAYS_DESCRIPTION')).toBe('이 일수 이상 이상 패턴이 지속될 때 메시지 초안을 생성합니다.');
  });

  it('returns correct label for AUTOMATION.PAYMENT_OVERDUE.ENABLED', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.PAYMENT_OVERDUE.ENABLED')).toBe('미결제 알림 자동 발송 활성화');
  });

  it('returns correct label for AUTOMATION.PAYMENT_OVERDUE.DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.PAYMENT_OVERDUE.DESCRIPTION')).toBe('미결제 청구서 감지 시 서버가 알림을 발송합니다.');
  });

  it('returns correct label for AUTOMATION.PAYMENT_OVERDUE.CHANNEL', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.PAYMENT_OVERDUE.CHANNEL')).toBe('미결제 알림 채널');
  });

  it('returns correct label for AUTOMATION.PAYMENT_OVERDUE.CHANNEL_DESCRIPTION', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.PAYMENT_OVERDUE.CHANNEL_DESCRIPTION')).toBe('미결제 알림을 발송할 채널을 선택합니다.');
  });

  // Guardian Form keys
  it('returns correct label for GUARDIAN.FORM.NAME.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.NAME.LABEL')).toBe('이름');
  });

  it('returns correct label for GUARDIAN.FORM.RELATIONSHIP.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.RELATIONSHIP.LABEL')).toBe('관계');
  });

  it('returns correct label for GUARDIAN.FORM.RELATIONSHIP.PARENT', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.RELATIONSHIP.PARENT')).toBe('부모');
  });

  it('returns correct label for GUARDIAN.FORM.RELATIONSHIP.GUARDIAN', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.RELATIONSHIP.GUARDIAN')).toBe('보호자');
  });

  it('returns correct label for GUARDIAN.FORM.RELATIONSHIP.OTHER', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.RELATIONSHIP.OTHER')).toBe('기타');
  });

  it('returns correct label for GUARDIAN.FORM.PHONE.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.PHONE.LABEL')).toBe('전화번호');
  });

  it('returns correct label for GUARDIAN.FORM.EMAIL.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.EMAIL.LABEL')).toBe('이메일');
  });

  it('returns correct label for GUARDIAN.FORM.IS_PRIMARY.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.IS_PRIMARY.LABEL')).toBe('주 보호자');
  });

  it('returns correct label for GUARDIAN.FORM.NOTES.LABEL', () => {
    expect(getAcademyLabelFromI18n('GUARDIAN.FORM.NOTES.LABEL')).toBe('메모');
  });

  // Consultation Form keys
  it('returns correct label for CONSULTATION.FORM.DATE.LABEL', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.DATE.LABEL')).toBe('상담일자');
  });

  it('returns correct label for CONSULTATION.FORM.TYPE.LABEL', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.TYPE.LABEL')).toBe('상담 유형');
  });

  it('returns correct label for CONSULTATION.FORM.TYPE.COUNSELING', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.TYPE.COUNSELING')).toBe('상담');
  });

  it('returns correct label for CONSULTATION.FORM.TYPE.LEARNING', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.TYPE.LEARNING')).toBe('학습');
  });

  it('returns correct label for CONSULTATION.FORM.TYPE.BEHAVIOR', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.TYPE.BEHAVIOR')).toBe('행동');
  });

  it('returns correct label for CONSULTATION.FORM.TYPE.OTHER', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.TYPE.OTHER')).toBe('기타');
  });

  it('returns correct label for CONSULTATION.FORM.CONTENT.LABEL', () => {
    expect(getAcademyLabelFromI18n('CONSULTATION.FORM.CONTENT.LABEL')).toBe('상담 내용');
  });

  // Tag Form keys
  it('returns correct label for TAG.FORM.NAME.LABEL', () => {
    expect(getAcademyLabelFromI18n('TAG.FORM.NAME.LABEL')).toBe('태그 이름');
  });

  // Class Assignment Form keys
  it('returns correct label for CLASS_ASSIGNMENT.FORM.CLASS_ID.LABEL', () => {
    expect(getAcademyLabelFromI18n('CLASS_ASSIGNMENT.FORM.CLASS_ID.LABEL')).toBe('수업 선택');
  });

  it('returns correct label for CLASS_ASSIGNMENT.FORM.ENROLLED_AT.LABEL', () => {
    expect(getAcademyLabelFromI18n('CLASS_ASSIGNMENT.FORM.ENROLLED_AT.LABEL')).toBe('배정일');
  });

  // Unknown keys (fallback)
  it('returns key itself for unknown i18n key', () => {
    expect(getAcademyLabelFromI18n('UNKNOWN.KEY')).toBe('UNKNOWN.KEY');
  });

  it('returns key itself for empty string', () => {
    expect(getAcademyLabelFromI18n('')).toBe('');
  });

  it('returns key itself for partial match that does not exist', () => {
    expect(getAcademyLabelFromI18n('AUTOMATION.UNKNOWN.KEY')).toBe('AUTOMATION.UNKNOWN.KEY');
  });
});
