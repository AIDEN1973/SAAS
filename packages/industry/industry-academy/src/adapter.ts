/**
 * Industry Academy Adapter
 *
 * [불변 규칙] Automation & AI Industry-Neutral Rule (SSOT) 준수
 * - Core Engine의 중립 Policy Key를 Academy 업종 Label로 변환
 * - 업종별 차이는 Label/UI 표현에서만 허용
 * - 로직은 Core Engine에만 존재
 */

/**
 * Policy Key를 Academy 업종 Label로 변환
 *
 * @param policyKey - 중립 Policy Key (예: 'attendance_anomaly', 'payment_overdue')
 * @returns Academy 업종 Label
 */
export function getAcademyLabel(policyKey: string): string {
  const labelMap: Record<string, string> = {
    // Automation Policy Keys (업종 중립 Policy Key → Academy Label 변환)
    attendance_anomaly: '출결 이상 감지', // Academy Label (업종별 변환 예시)
    payment_overdue: '미납 알림', // Academy Label (업종별 변환 예시)
    ai_suggestion: 'AI 업무 카드',
    dashboard_priority: '대시보드 우선순위',
    report_generation: '리포트 생성',

    // Automation Settings Keys (업종 중립 Policy Key → Academy Label 변환)
    attendance_anomaly_detection_enabled: '출결 이상 감지 활성화', // Academy Label
    attendance_anomaly_detection_threshold: '이상 패턴 감지 임계값 (일)',
    auto_message_suggestion_enabled: '자동 추천 메시지 생성 활성화',
    attendance_absence_threshold_days: '결석 감지 임계값 (일)', // Academy Label (업종별 변환 예시)
    auto_notification_overdue_enabled: '미납 알림 자동 발송 활성화', // Academy Label (업종별 변환 예시)
    auto_notification_overdue_channel: '미납 알림 채널', // Academy Label (업종별 변환 예시)
  };

  return labelMap[policyKey] || policyKey;
}

/**
 * i18n 키를 Academy 업종 Label로 변환
 *
 * @param i18nKey - i18n 키 (예: 'AUTOMATION.ANOMALY_DETECTION.ENABLED')
 * @returns Academy 업종 Label
 */
export function getAcademyLabelFromI18n(i18nKey: string): string {
  const i18nLabelMap: Record<string, string> = {
    // i18n 키 → Academy Label 변환 (업종별 변환 예시)
    'AUTOMATION.ANOMALY_DETECTION.ENABLED': '이상 패턴 감지 활성화', // Academy Label
    'AUTOMATION.ANOMALY_DETECTION.DESCRIPTION': '이상 패턴을 자동으로 감지하여 TaskCard를 생성합니다.', // Academy Label
    'AUTOMATION.ANOMALY_DETECTION.THRESHOLD': '이상 패턴 감지 임계값 (일)',
    'AUTOMATION.ANOMALY_DETECTION.THRESHOLD_DESCRIPTION': '이 일수 이상 연속 이상 패턴 시 감지합니다.',
    'AUTOMATION.MESSAGE_SUGGESTION.ENABLED': '자동 추천 메시지 생성 활성화',
    'AUTOMATION.MESSAGE_SUGGESTION.DESCRIPTION': '이상 패턴 감지 시 서버가 메시지 초안을 생성합니다 (AI 호출 포함).', // Academy Label (업종별 변환 예시)
    'AUTOMATION.ANOMALY.THRESHOLD_DAYS': '이상 패턴 감지 임계값 (일)', // Academy Label (업종별 변환 예시)
    'AUTOMATION.ANOMALY.THRESHOLD_DAYS_DESCRIPTION': '이 일수 이상 이상 패턴이 지속될 때 메시지 초안을 생성합니다.', // Academy Label (업종별 변환 예시)
    'AUTOMATION.PAYMENT_OVERDUE.ENABLED': '미결제 알림 자동 발송 활성화', // Academy Label (업종별 변환 예시)
    'AUTOMATION.PAYMENT_OVERDUE.DESCRIPTION': '미결제 청구서 감지 시 서버가 알림을 발송합니다.', // Academy Label (업종별 변환 예시)
    'AUTOMATION.PAYMENT_OVERDUE.CHANNEL': '미결제 알림 채널', // Academy Label (업종별 변환 예시)
    'AUTOMATION.PAYMENT_OVERDUE.CHANNEL_DESCRIPTION': '미결제 알림을 발송할 채널을 선택합니다.', // Academy Label (업종별 변환 예시)

    // Guardian Form i18n 키 → Academy Label 변환
    'GUARDIAN.FORM.NAME.LABEL': '이름',
    'GUARDIAN.FORM.RELATIONSHIP.LABEL': '관계',
    'GUARDIAN.FORM.RELATIONSHIP.PARENT': '부모',
    'GUARDIAN.FORM.RELATIONSHIP.GUARDIAN': '보호자',
    'GUARDIAN.FORM.RELATIONSHIP.OTHER': '기타',
    'GUARDIAN.FORM.PHONE.LABEL': '전화번호',
    'GUARDIAN.FORM.EMAIL.LABEL': '이메일',
    'GUARDIAN.FORM.IS_PRIMARY.LABEL': '주 보호자',
    'GUARDIAN.FORM.NOTES.LABEL': '메모',

    // Consultation Form i18n 키 → Academy Label 변환
    'CONSULTATION.FORM.DATE.LABEL': '상담일자',
    'CONSULTATION.FORM.TYPE.LABEL': '상담 유형',
    'CONSULTATION.FORM.TYPE.COUNSELING': '상담',
    'CONSULTATION.FORM.TYPE.LEARNING': '학습',
    'CONSULTATION.FORM.TYPE.BEHAVIOR': '행동',
    'CONSULTATION.FORM.TYPE.OTHER': '기타',
    'CONSULTATION.FORM.CONTENT.LABEL': '상담 내용',

    // Tag Form i18n 키 → Academy Label 변환
    'TAG.FORM.NAME.LABEL': '태그 이름',

    // Class Assignment Form i18n 키 → Academy Label 변환
    'CLASS_ASSIGNMENT.FORM.CLASS_ID.LABEL': '수업 선택',
    'CLASS_ASSIGNMENT.FORM.ENROLLED_AT.LABEL': '배정일',
  };

  return i18nLabelMap[i18nKey] || i18nKey;
}

