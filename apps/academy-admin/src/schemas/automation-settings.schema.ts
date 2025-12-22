/**
 * Automation Settings Form Schema
 *
 * [불변 규칙] 스키마 엔진 기반 FormSchema 정의
 * [요구사항] 자동화 설정 (Policy / Threshold / Toggle 기반)
 * [문서 준수] docu/프론트 자동화.md, docu/AI_자동화_기능_정리.md 엄격 준수
 *
 * ⚠️ Automation Config First 원칙:
 * - 모든 자동화는 사용자 설정값(Policy / Threshold / Toggle)을 통해 활성·비활성 및 강도가 결정됨
 * - 기본값은 Default Policy이며, 테넌트 생성 시 설정값으로 저장됨
 * - 설정이 없으면 실행하지 않음 (Fail Closed)
 */

import type { FormSchema } from '@schema-engine';

export const automationSettingsFormSchema: FormSchema = {
  version: '1.0.0',
  minSupportedClient: '1.0.0',
  entity: 'automation_settings',
  type: 'form',
  form: {
    layout: {
      columns: 1,
      columnGap: 'md',
      rowGap: 'lg',
    },
    fields: [
      // ============================================
      // 섹션 1: AI 기능 활성화 (tenant_features)
      // ============================================
      {
        name: 'ai_enabled',
        kind: 'checkbox',
        ui: {
          label: 'AI 기능 사용',
          description: 'AI 기능 전체를 활성화합니다. 이 설정이 꺼져 있으면 모든 AI 자동화가 실행되지 않습니다. (SSOT: tenant_features.feature_key="ai")',
          colSpan: 1,
        },
      },

      // ============================================
      // 섹션 2: 자동 상담 요약
      // ============================================
      {
        name: 'auto_consultation_summary_enabled',
        kind: 'checkbox',
        ui: {
          label: '자동 상담 요약 활성화',
          description: '상담일지 저장 시 서버가 AI 요약을 생성합니다. (SSOT 경로: auto_notification.consultation_summary_ready.enabled, 레거시 경로: auto_consultation_summary.enabled - 읽기 fallback 허용, 쓰기 금지, 저장 위치는 tenant_settings(key=\'config\').value(JSONB))',
          colSpan: 1,
        },
      },
      {
        name: 'auto_consultation_summary_min_length',
        kind: 'number',
        ui: {
          label: '최소 상담 내용 길이 (자)',
          description: '이 길이 이상의 상담 내용에만 서버가 AI 요약을 생성합니다. (Default Policy: 테넌트 생성 시 50자로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 50,
        condition: {
          field: 'auto_consultation_summary_enabled',
          op: 'eq',
          value: true,
        },
      },

      // ============================================
      // 섹션 3: 자동 추천 메시지 생성
      // ============================================
      {
        name: 'auto_message_suggestion_enabled',
        kind: 'checkbox',
        ui: {
          labelKey: 'AUTOMATION.MESSAGE_SUGGESTION.ENABLED',
          label: '자동 추천 메시지 생성 활성화', // 하위 호환성
          descriptionKey: 'AUTOMATION.MESSAGE_SUGGESTION.DESCRIPTION',
          description: '이상 패턴 감지 시 메시지 초안을 자동 생성합니다. (SSOT 경로: auto_notification.attendance_pattern_anomaly.enabled, 레거시 경로: auto_message_suggestion.enabled - 읽기 fallback 허용, 쓰기 금지, 저장 위치는 tenant_settings(key=\'config\').value(JSONB))',
          colSpan: 1,
        },
      },
      {
        name: 'attendance_absence_threshold_days',
        kind: 'number',
        ui: {
          labelKey: 'AUTOMATION.ANOMALY.THRESHOLD_DAYS',
          label: '이상 패턴 감지 임계값 (일)', // 하위 호환성
          descriptionKey: 'AUTOMATION.ANOMALY.THRESHOLD_DAYS_DESCRIPTION',
          description: '이 일수 이상 이상 패턴이 지속될 때 메시지 초안을 생성합니다. (Default Policy: 테넌트 생성 시 3일로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 3,
        condition: {
          field: 'auto_message_suggestion_enabled',
          op: 'eq',
          value: true,
        },
      },
      {
        name: 'auto_message_suggestion_priority',
        kind: 'number',
        ui: {
          label: '메시지 초안 우선순위 (0-100)',
          description: '생성된 메시지 초안의 우선순위입니다. (Default Policy: 테넌트 생성 시 80으로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 0,
          max: 100,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 80,
        condition: {
          field: 'auto_message_suggestion_enabled',
          op: 'eq',
          value: true,
        },
      },
      {
        name: 'auto_message_suggestion_ttl_days',
        kind: 'number',
        ui: {
          label: '메시지 초안 유효기간 (일)',
          description: '생성된 메시지 초안이 만료되는 기간입니다. (Default Policy: 테넌트 생성 시 7일로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 7,
        condition: {
          field: 'auto_message_suggestion_enabled',
          op: 'eq',
          value: true,
        },
      },
      {
        name: 'auto_message_suggestion_daily_limit',
        kind: 'number',
        ui: {
          label: '하루 최대 메시지 초안 생성 건수',
          description: '하루에 생성할 수 있는 메시지 초안의 최대 건수입니다. (Default Policy: 테넌트 생성 시 20건으로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 20,
        condition: {
          field: 'auto_message_suggestion_enabled',
          op: 'eq',
          value: true,
        },
      },

      // ============================================
      // 섹션 4: 이상 패턴 감지 (업종 중립: 출결 이상 → 이상 패턴)
      // ============================================
      {
        name: 'attendance_anomaly_detection_enabled',
        kind: 'checkbox',
        ui: {
          labelKey: 'AUTOMATION.ANOMALY_DETECTION.ENABLED',
          label: '이상 패턴 감지 활성화', // 하위 호환성
          descriptionKey: 'AUTOMATION.ANOMALY_DETECTION.DESCRIPTION',
          description: '이상 패턴을 자동으로 감지하여 TaskCard를 생성합니다. (경로: tenant_settings KV 구조의 key=\'config\' row의 value(JSONB) 내부 경로 `auto_notification.attendance_pattern_anomaly.enabled`)',
          colSpan: 1,
        },
      },
      {
        name: 'attendance_anomaly_detection_threshold',
        kind: 'number',
        ui: {
          labelKey: 'AUTOMATION.ANOMALY_DETECTION.THRESHOLD',
          label: '이상 패턴 감지 임계값 (일)', // 하위 호환성
          descriptionKey: 'AUTOMATION.ANOMALY_DETECTION.THRESHOLD_DESCRIPTION',
          description: '이 일수 이상 연속 이상 패턴 시 감지합니다. (Default Policy: 테넌트 생성 시 3일로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 3,
        condition: {
          field: 'attendance_anomaly_detection_enabled',
          op: 'eq',
          value: true,
        },
      },

      // ============================================
      // 섹션 5: 자동 청구 생성
      // ============================================
      {
        name: 'auto_billing_enabled',
        kind: 'checkbox',
        ui: {
          label: '자동 청구 생성 활성화',
          description: '설정된 주기에 따라 서버가 청구서를 생성합니다. (SSOT 경로: billing.auto_generation.enabled, 레거시 경로: auto_billing.enabled - 읽기 fallback 허용, 쓰기 금지, 저장 위치는 tenant_settings(key=\'config\').value(JSONB))',
          colSpan: 1,
        },
      },
      {
        name: 'auto_billing_cycle',
        kind: 'select',
        ui: {
          label: '청구 주기',
          description: '청구서를 생성하는 주기입니다. (Default Policy: 테넌트 생성 시 월 1회로 설정값 저장 (없으면 실행 안 함))',
          colSpan: 1,
        },
        options: [
          { value: 'monthly', label: '월 1회' },
          { value: 'weekly', label: '주 1회' },
        ],
        validation: {
          required: true,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 'monthly',
        condition: {
          field: 'auto_billing_enabled',
          op: 'eq',
          value: true,
        },
      },
      {
        name: 'auto_billing_daily_limit',
        kind: 'number',
        ui: {
          label: '하루 최대 청구서 생성 건수',
          description: '하루에 생성할 수 있는 청구서의 최대 건수입니다. (Default Policy: 테넌트 생성 시 1건으로 설정값 저장 (없으면 실행 안 함), 월 1회 배치)',
          colSpan: 1,
        },
        validation: {
          required: true,
          min: 1,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 1,
        condition: {
          field: 'auto_billing_enabled',
          op: 'eq',
          value: true,
        },
      },

      // ============================================
      // 섹션 6: 미결제 알림 자동 발송 (업종 중립: 미납 → 미결제)
      // ============================================
      {
        name: 'auto_notification_overdue_enabled',
        kind: 'checkbox',
        ui: {
          labelKey: 'AUTOMATION.PAYMENT_OVERDUE.ENABLED',
          label: '미결제 알림 자동 발송 활성화', // 하위 호환성
          descriptionKey: 'AUTOMATION.PAYMENT_OVERDUE.DESCRIPTION',
          description: '미결제 청구서 감지 시 서버가 알림을 발송합니다. (신규 경로: auto_notification.overdue_outstanding_over_limit.enabled, 레거시 경로: auto_notification.overdue.enabled)',
          colSpan: 1,
        },
      },
      {
        name: 'auto_notification_overdue_channel',
        kind: 'select',
        ui: {
          labelKey: 'AUTOMATION.PAYMENT_OVERDUE.CHANNEL',
          label: '미결제 알림 채널', // 하위 호환성
          descriptionKey: 'AUTOMATION.PAYMENT_OVERDUE.CHANNEL_DESCRIPTION',
          description: '미결제 알림을 발송할 채널을 선택합니다. (Default Policy: SMS)',
          colSpan: 1,
        },
        options: [
          { value: 'sms', label: 'SMS' },
          { value: 'kakao_at', label: '카카오 알림톡' },  // SSOT-3: 저장/실행용 코드는 'kakao_at', UI 표시명은 '카카오 알림톡'
        ],
        validation: {
          required: true,
        },
        // ⚠️ UI 편의성을 위한 defaultValue (자동화 실행과 무관)
        // Automation Config First 원칙: 실제 자동화 실행은 Policy에서 조회한 값만 사용
        // SchemaForm의 defaultValues prop이 우선순위가 높으므로 Policy 값이 사용됨
        defaultValue: 'sms',
        condition: {
          field: 'auto_notification_overdue_enabled',
          op: 'eq',
          value: true,
        },
      },

      // ============================================
      // 섹션 7: Daily Automation Digest
      // ============================================
      {
        name: 'auto_digest_enabled',
        kind: 'checkbox',
        ui: {
          label: '일일 자동화 요약 활성화',
          description: '하루 동안 실행된 자동화 결과를 요약하여 표시합니다. (SSOT 경로: auto_notification.daily_automation_digest.enabled, 레거시 경로: auto_digest.enabled - 읽기 fallback 허용, 쓰기 금지, 저장 위치는 tenant_settings(key=\'config\').value(JSONB))',
          colSpan: 1,
        },
      },
    ],
    submit: {
      label: '저장',
      variant: 'solid',
      color: 'primary',
      size: 'md',
    },
    // ⚠️ 주의: actions는 사용하지 않음. 페이지 컴포넌트에서 직접 tenant_features와 tenant_settings를 업데이트함
    // automation-settings 테이블은 존재하지 않으며, tenant_features와 tenant_settings 테이블을 직접 업데이트함
    actions: [],
  },
};

