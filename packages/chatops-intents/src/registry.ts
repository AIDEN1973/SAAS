// LAYER: SSOT_REGISTRY
/**
 * ChatOps Intent Registry (SSOT)
 *
 * 챗봇.md 8.2, 12.1 참조
 * 목적: "새 기능 추가 = Intent 한 줄 추가"가 되게 만드는 핵심
 *
 * [불변 규칙] Intent Registry는 코드 단일 소스(SSOT)로 고정
 * [불변 규칙] L2-A intent는 event_type 결정적 매핑 필수
 * [불변 규칙] L2-B intent는 Domain Action Catalog의 action_key 필수 (SSOT 확정 완료)
 * [불변 규칙] L0 intent는 responseSchema 필수
 */

import { z } from 'zod';
// Domain Action Catalog import (상대 경로 사용 - workspace 의존성 해결 전까지)
// TODO: workspace 의존성 해결 후 @core/automation에서 직접 import하도록 변경 예정
const DOMAIN_ACTION_CATALOG = [
  // attendance (4)
  'attendance.correct_record',
  'attendance.mark_excused',
  'attendance.bulk_update',
  'attendance.schedule_recheck',
  // billing (9)
  'billing.issue_invoices',
  'billing.reissue_invoice',
  'billing.record_manual_payment',
  'billing.apply_discount',
  'billing.apply_refund',
  'billing.create_installment_plan',
  'billing.fix_duplicate_invoices',
  'billing.sync_gateway',
  'billing.close_month',
  // message (3)
  'message.cancel_scheduled',
  'message.create_template',
  'message.update_template',
  // student (12)
  'student.register',
  'student.update_profile',
  'student.change_class',
  'student.pause',
  'student.resume',
  'student.discharge',
  'student.merge_duplicates',
  'student.update_guardian_contact',
  'student.assign_tags',
  'student.bulk_register',
  'student.bulk_update',
  'student.data_quality_apply_fix',
  'student.reactivate_from_discharged',
  // class (4)
  'class.create',
  'class.update',
  'class.close',
  'class.bulk_reassign_teacher',
  // schedule (4)
  'schedule.add_session',
  'schedule.move_session',
  'schedule.cancel_session',
  'schedule.bulk_shift',
  // note (2)
  'note.create',
  'note.update',
  // report (2)
  'report.generate_monthly_report',
  'report.generate_daily_brief',
  // system (4)
  'system.run_healthcheck',
  'system.rebuild_search_index',
  'system.backfill_reports',
  'system.retry_failed_actions',
  // policy (3)
  'policy.enable_automation',
  'policy.update_threshold',
  'rbac.assign_role',
] as const;

// Event Catalog 검증용 상수 (SSOT 동기화 필수)
// 중요: 이 상수는 packages/core/core-automation/src/automation-event-catalog.ts의
// AUTOMATION_EVENT_CATALOG와 동기화되어야 합니다.
// 현재 Registry에 사용된 event_type만 포함 (전체 목록은 SSOT 참조)
// 빌드타임 검증을 위해 별도 스크립트(scripts/verify-ssot-sync.ts)에서 전체 동기화를 검증합니다.
// TODO: workspace 의존성 해결 후 @core/automation에서 직접 import하도록 변경 예정
const EVENT_CATALOG_FOR_VALIDATION = [
  'absence_first_day', // customer_retention
  'announcement_digest', // safety_compliance
  'announcement_urgent', // safety_compliance
  'class_change_or_cancel', // safety_compliance
  'overdue_outstanding_over_limit', // financial_health
  'payment_due_reminder', // financial_health
  'new_member_drop', // customer_retention
  'consultation_summary_ready', // customer_retention
  'monthly_business_report', // growth_marketing
] as const;

/**
 * Field Rule 타입 (조건부 필수/선택 전략)
 * Inline Execution에서 필드 자동 판정에 사용
 */
export type FieldRule =
  | { type: 'required_if'; field: string; equals: unknown; required: string[] }
  | { type: 'required_unless'; field: string; equals: unknown; required: string[] }
  | { type: 'one_of_required'; fields: string[] };

/**
 * Intent Registry Item 타입
 * 챗봇.md 8.2 참조
 */
export interface IntentRegistryItem {
  intent_key: string;
  description: string;

  automation_level: 'L0' | 'L1' | 'L2';
  execution_class?: 'A' | 'B'; // required if L2

  paramsSchema: z.ZodTypeAny; // zod schema (z.ZodObject, z.ZodString 등)
  responseSchema?: z.ZodTypeAny; // zod schema, required for L0

  // L2-A only
  event_type?: string; // 단일 event_type 매핑
  event_type_by_purpose?: Record<string, string>; // purpose→event_type 완전 매핑 테이블

  // L2-B only
  action_key?: string; // Domain Action Catalog의 action_key (L2-B 필수)

  taskcard: {
    task_type: string; // SSOT 허용 집합을 그대로 사용
    trigger: string;
    entity_type: string;
    window: 'YYYY-MM-DD' | 'YYYY-MM' | 'session_id' | 'iso_hour' | 'batch';
    subtype: string;
  };

  warnings?: string[]; // 선택, Plan에 자동 경고 노출

  // 발화 예시 (LLM 학습 및 후보 추출용)
  // 업종 중립: "학생" 대신 "대상", "원생" 등 업종별 표현 포함
  examples?: string[]; // 사용자가 실제로 입력할 수 있는 자연어 예시

  // Inline Execution 관련 메타 (선택)
  execution_mode?: 'taskcard' | 'inline'; // 기본값: 'taskcard'
  requires_confirmation?: boolean; // inline일 때 기본 true 권장
  risk_level?: 'low' | 'medium' | 'high'; // 실행 위험도
  field_rules?: FieldRule[]; // 조건부 필수/선택 전략
  ask_priority_optional?: string[]; // 선택 필드 중 "한 번 제안할" 필드 키 목록
}

/**
 * Intent Registry
 *
 * [SSOT] 이 Registry가 코드 단일 소스입니다.
 * 문서(챗봇.md)는 참조 문서로만 사용됩니다.
 */
export const intentRegistry: Record<string, IntentRegistryItem> = {
  // 예시: L0 조회 Intent
  'attendance.query.late': {
    intent_key: 'attendance.query.late',
    description: '지각한 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      class_id: z.string().uuid().optional(),
      date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string(),
          late_time: z.string(), // HH:mm 형식
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      // L0 조회는 TaskCard를 생성하지 않지만, Registry 구조상 필수 필드
      // 실제 TaskCard 생성 시에는 이 값이 사용되지 않음
      task_type: 'ai_suggested', // SSOT 허용 집합 사용 (실제로는 TaskCard 생성 안 함)
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_late',
    },
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '지각한 원생 리스트',
      '늦은 회원 목록',
      '최근 지각한 수강생',
    ],
  },

  // 예시: L1 TaskCard 생성 Intent
  'attendance.create.notify_guardians_late': {
    intent_key: 'attendance.create.notify_guardians_late',
    description: '지각 대상 보호자 알림 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      student_ids: z.array(z.string().uuid()),
      message_template: z.string().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'absence',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'notify_guardians_late',
    },
    examples: [
      '지각한 학생 목록 생성',
      '오늘 늦게 온 애들 알림',
      '이번 주 지각자 리스트 만들어 줘',
      '지각학생조회 해줘',
      '늦은 대상들 보호자에게 알림',
      '지각한 원생들 알려줘',
      '지각한 수강생들 목록 생성해 줘',
      '이번 주 지각한 회원들 알려줘',
    ],
  },

  // 예시: L2-A 실행 Intent
  'attendance.exec.notify_guardians_late': {
    intent_key: 'attendance.exec.notify_guardians_late',
    description: '지각 대상 보호자 알림 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'absence_first_day', // 결정적 매핑 (챗봇.md 8.2.1 참조)
    paramsSchema: z.object({
      student_ids: z.array(z.string().uuid()),
      channel: z.enum(['sms', 'kakao']).optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'absence',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'notify_guardians_late',
    },
    examples: [
      '지각 학생 보호자에게 알림 보내기',
      '오늘 늦게 온 원생들 체크해줘',
      '이번 주 지각자 목록 알려줘',
      '지각한 회원들에게 메시지 발송해',
      '늦은 대상들 알림 보내기',
      '지각학생 조회해줘',
      '오늘 지각한 수강생들 보여줘',
      '늦은 아이들 보호자에게 알림 보내기',
    ],

    warnings: ['심야 발송 주의', '대량 발송 시 비용 확인'],
  },

  // 출결(Attendance) 도메인 - L2-A 실행 Intent
  'attendance.exec.notify_guardians_absent': {
    intent_key: 'attendance.exec.notify_guardians_absent',
    description: '결석 대상 보호자 알림 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'absence_first_day', // 결정적 매핑
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD
      student_ids: z.array(z.string().uuid()).optional(),
      channel: z.enum(['sms', 'kakao']).optional(),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'absence',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'notify_absent',
    },
    examples: [
      '결석한 대상 알림 보내줘',
      '오늘 결석한 원생들 알려줘',
      '결석자 목록 전송해',
      '결석한 수강생들 찾아줘',
      '이번 주 결석자들 리스트',
      '결석한 회원들에게 알림 보내',
      '결석한 애들 연락처 조회해',
      '결석한 학생들한테 알림 전송',
    ],

    warnings: ['심야 발송 주의', '대량 발송 시 비용 확인'],
  },

  'attendance.exec.request_reason_message': {
    intent_key: 'attendance.exec.request_reason_message',
    description: '결석 사유 요청 메시지 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'absence_first_day', // 결정적 매핑
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD
      student_ids: z.array(z.string().uuid()).optional(),
      channel: z.enum(['sms', 'kakao']).optional(),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'absence',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'request_reason_message',
    },
    examples: [
      '결석 사유 요청해줘',
      '이번 주 결석한 원생들 목록',
      '결석한 학생들 사유 알려줘',
      '오늘 결석한 대상 확인',
      '결석자 사유 리스트 보여줘',
      '결석한 수강생들 사유 요청',
      '결석한 애들 사유 좀 보내줘',
      '결석 사유 메시지 발송해줘',
    ],

    warnings: ['심야 발송 주의'],
  },

  'attendance.exec.send_staff_summary': {
    intent_key: 'attendance.exec.send_staff_summary',
    description: '직원용 출결 요약 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'announcement_digest', // 결정적 매핑
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD
      recipients: z.array(z.string().uuid()),
      channel: z.enum(['sms', 'kakao', 'email']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'attendance_summary',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'staff_summary',
    },
    examples: [
      '직원 출결 요약 보내줘',
      '이번 주 출결 요약 좀 확인해봐',
      '출결 요약 발송 부탁해',
      '오늘 출결 정리해서 보내줘',
      '지각한 직원 목록 보여줘',
      '이번 달 지각자들 요약해줘',
      '늦은 직원들 리스트 보내줘',
      '출결 상태 요약해서 발송해줘',
    ],
  },

  // 학생 라이프사이클(Student) 도메인 - L0 조회 Intent
  'student.query.search': {
    intent_key: 'student.query.search',
    description: '학생 검색',
    automation_level: 'L0',
    paramsSchema: z.object({
      q: z.string(), // 검색어 (이름, 학번 등)
      limit: z.number().int().positive().optional(), // 최대 결과 수
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          grade: z.string().optional(),
          status: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_search',
    },
    examples: [
      '박소영 검색',
      '박소영 찾기',
      '박소영 조회',
      '학생 검색',
      '대상 검색',
      '회원 검색',
      '원생 검색',
      '수강생 찾기',
    ],
  },

  // 출결(Attendance) 도메인 - L0 조회 Intent
  'attendance.query.by_student': {
    intent_key: 'attendance.query.by_student',
    description: '특정 학생의 출결 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      records: z.array(
        z.object({
          date: z.string(), // YYYY-MM-DD
          status: z.enum(['present', 'absent', 'late', 'early_leave', 'excused']),
          time: z.string().optional(), // HH:mm 형식 (지각/조퇴 시)
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_by_student',
    },
    examples: [
      '오늘 지각한 학생',
      '이번 주 지각자 목록',
      '지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '지각한 원생들 확인해',
      '최근 지각한 수강생',
      '늦은 학생 목록',
    ],
  },

  'attendance.query.absent': {
    intent_key: 'attendance.query.absent',
    description: '결석한 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string().optional(), // YYYY-MM-DD 형식
      include_excused: z.boolean().optional(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_absent',
    },
    examples: [
      '오늘 결석한 대상 조회',
      '결석한 애들 보여줘',
      '결석자 리스트',
      '이번 주 결석한 원생들',
      '결석학생조회',
      '오늘 지각한 수강생',
      '늦게 온 사람들 목록',
      '지각한 회원 리스트',
    ],
  },

  'attendance.query.early_leave': {
    intent_key: 'attendance.query.early_leave',
    description: '조퇴한 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          leave_time: z.string(), // HH:mm 형식
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_early_leave',
    },
    examples: [
      '조퇴한 원생 리스트',
      '오늘 조퇴한 대상 보여줘',
      '이번 주 조퇴자 조회',
      '조퇴 학생 목록',
      '조퇴한 애들 확인해',
      '조퇴한 회원들',
      '조퇴한 수강생 조회해 줘',
      '조퇴자 리스트',
    ],
  },

  'attendance.query.unchecked': {
    intent_key: 'attendance.query.unchecked',
    description: '출결 미체크 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_unchecked',
    },
    examples: [
      '오늘 지각한 대상 조회',
      '지각한 원생 리스트 보여줘',
      '이번 주 지각자 확인해줘',
      '지각학생조회',
      '늦게 온 수강생들',
      '지각한 회원들 목록',
      '오늘 늦은 학생들',
      '이번 주 지각한 애들',
    ],
  },

  'attendance.query.by_class': {
    intent_key: 'attendance.query.by_class',
    description: '수업별 출결 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      records: z.array(
        z.object({
          student_id: z.string().uuid(),
          student_name: z.string(),
          status: z.enum(['present', 'absent', 'late', 'early_leave', 'excused']),
          time: z.string().optional(), // HH:mm 형식
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_by_class',
    },
    examples: [
      '수업별 출결 조회',
      '수학A 수업 출결 확인',
      '수학 수업 출석 현황',
      '영어 수업 출결 조회',
      '수업별 출석률 확인',
      '특정 수업 출결 조회',
      '수업 출결 내역',
      '수업 출석 현황 보여줘',
    ],
  },

  'attendance.query.streak_absent': {
    intent_key: 'attendance.query.streak_absent',
    description: '연속 결석 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      streak_days: z.number().int().positive(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          streak_days: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_streak_absent',
    },
    examples: [
      '연속 결석한 대상 조회',
      '최근에 결석한 수강생 목록 보여줘',
      '지각한 회원들 확인',
      '이번 주 결석한 애들 리스트',
      '지각자 조회해 줘',
      '결석 대상 리스트',
      '연속으로 결석한 원생들',
      '오늘 지각한 회원들',
    ],
  },

  'attendance.query.rate_summary': {
    intent_key: 'attendance.query.rate_summary',
    description: '출결률 요약 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      group_by: z.enum(['class', 'grade']).optional(),
    }),
    responseSchema: z.object({
      summary: z.array(
        z.object({
          group_key: z.string(), // class_id 또는 grade
          group_name: z.string(),
          attendance_rate: z.number(), // 0-100
          total_students: z.number(),
        })
      ),
      overall_rate: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_rate_summary',
    },
    examples: [
      '출결률 요약 보여줘',
      '이번 주 출결 상황 확인',
      '지각한 원생 리스트',
      '오늘 지각자들',
      '지각 학생들 알려줘',
      '이번 달 출결 요약',
      '지각한 회원 목록',
      '최근 출결 현황',
    ],
  },

  'attendance.query.rate_drop': {
    intent_key: 'attendance.query.rate_drop',
    description: '출결률 하락 대상 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      drop_pp: z.number(), // 하락 퍼센트포인트
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          previous_rate: z.number(),
          current_rate: z.number(),
          drop_pp: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_rate_drop',
    },
    examples: [
      '지각한 원생 조회',
      '이번 주 지각자 리스트 보여줘',
      '늦은 학생 목록',
      '오늘 지각한 대상 확인해줘',
      '지각학생조회',
      '지각한 애들 리스트',
      '이번 달 지각자들',
      '늦게 온 수강생들 보여줘',
    ],
  },

  'attendance.query.late_rank': {
    intent_key: 'attendance.query.late_rank',
    description: '지각 랭킹 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      top_n: z.number().int().positive(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          late_count: z.number(),
          rank: z.number(),
        })
      ),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_late_rank',
    },
    examples: [
      '지각 랭킹 조회해줘',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 명단은?',
      '늦게 온 회원들 확인할 수 있어?',
      '지각한 애들 리스트',
      '늦은 학생 목록 알고 싶어',
      '지각학생조회 해줘',
      '최근 지각자 랭킹은 어떻게 돼?',
    ],
  },

  'attendance.query.export_csv': {
    intent_key: 'attendance.query.export_csv',
    description: '출결 데이터 CSV 내보내기',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      download_url: z.string().url(),
      expires_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'attendance_export_csv',
    },
    examples: [
      '출결 데이터 CSV로 내보내기',
      '지각한 대상들 CSV로 저장해줘',
      '지각학생 목록을 CSV로',
      '이번 주 늦은 학생들 CSV 파일로',
      '오늘 지각한 원생들 내보내기',
      '늦게 온 수강생들 CSV로 export',
      '지각자 CSV 파일로 만들어줘',
      '지각한 회원들 리스트를 CSV로',
    ],
  },

  // 출결(Attendance) 도메인 - L1 업무화 Intent
  'attendance.task.flag_absence_followup': {
    intent_key: 'attendance.task.flag_absence_followup',
    description: '결석 후속 조치 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
      audience: z.enum(['class', 'teacher', 'all']).optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'absence_followup',
    },
    examples: [
      '결석한 대상 목록 생성',
      '결석자 후속 조치 하기',
      '오늘 결석한 원생 보여줘',
      '이번 주 결석 학생 조회',
      '결석한 회원들 리스트',
      '결석자 관리 태스크 카드 만들기',
      '결석한 수강생 목록 확인',
      '결석한 애들 후속 처리',
    ],
  },

  'attendance.task.flag_late_followup': {
    intent_key: 'attendance.task.flag_late_followup',
    description: '지각 후속 조치 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'risk',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'late_followup',
    },
    examples: [
      '지각한 원생 조회',
      '오늘 늦게 온 회원 리스트',
      '이번 주 지각자 확인해줘',
      '늦은 대상 목록 보여줘',
      '지각학생조회 해줘',
      '지각한 수강생들 정보',
      '지각자 목록 생성',
      '이번 달 지각한 애들 보여줘',
    ],
  },

  'attendance.task.create_contact_list': {
    intent_key: 'attendance.task.create_contact_list',
    description: '연락처 목록 생성 TaskCard',
    automation_level: 'L1',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
      status: z.enum(['absent', 'late']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'contact_list',
    },
    examples: [
      '지각한 대상 목록 생성해줘',
      '이번 주 지각자들 보여줘',
      '지각학생 리스트 만들어',
      '늦은 원생들 리스트 필요해',
      '오늘 지각한 수강생들 확인할래',
      '지각한 애들 연락처 목록 필요해',
      '늦게 온 회원들 조회해줘',
      '이번 달 지각한 대상들 정리해줘',
    ],
  },

  // 출결(Attendance) 도메인 - L2-B 실행 Intent
  'attendance.exec.correct_record': {
    intent_key: 'attendance.exec.correct_record',
    description: '출결 기록 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'attendance.correct_record', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD 형식
      from_status: z.enum(['present', 'absent', 'late', 'early_leave', 'excused']),
      to_status: z.enum(['present', 'absent', 'late', 'early_leave', 'excused']),
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'absence',
      trigger: 'absence',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'correct_record',
    },
    examples: [
      '지각한 학생 조회',
      '이번 주 지각자 목록 보여줘',
      '늦은 원생들 확인해',
      '오늘 지각자',
      '지각학생조회',
      '오늘 지각한 대상',
      '늦게 온 회원들 리스트',
      '이번 주 지각한 수강생들',
    ],
  },

  'attendance.exec.mark_excused': {
    intent_key: 'attendance.exec.mark_excused',
    description: '출결 기록 사유 처리 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'attendance.mark_excused', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD 형식
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'absence',
      trigger: 'absence',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'mark_excused',
    },
    examples: [
      '출결 사유 처리해줘',
      '지각 사유 처리하기',
      '결석 사유 처리',
      '출결 기록 사유 처리',
      '사유 처리 실행',
      '출결 사유 등록',
      '지각 사유 등록해줘',
      '결석 사유 등록하기',
    ],
  },

  'attendance.exec.bulk_update': {
    intent_key: 'attendance.exec.bulk_update',
    description: '출결 기록 일괄 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'attendance.bulk_update', // Domain Action Catalog
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
      updates: z.array(
        z.object({
          student_id: z.string().uuid(),
          to_status: z.enum(['present', 'absent', 'late', 'early_leave', 'excused']),
        })
      ),
    }),
    taskcard: {
      task_type: 'absence',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_update',
    },
    examples: [
      '전체 출결 기록 수정하기',
      '이번 주 지각자 목록 보여줘',
      '지각한 원생들 일괄 수정',
      '오늘 늦은 학생들 조회',
      '지각학생 수정해줘',
      '지각한 수강생들 한 번에 업데이트',
      '이번 달 지각자 일괄 처리',
      '늦게 온 대상들 수정하기',
    ],
  },

  'attendance.exec.schedule_recheck': {
    intent_key: 'attendance.exec.schedule_recheck',
    description: '출결 재확인 예약 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'attendance.schedule_recheck', // Domain Action Catalog
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
      run_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'absence',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'scheduled_recheck',
    },
    examples: [
      '지각자 목록 확인',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각한 대상 조회',
      '늦은 학생들 리스트',
      '지각학생조회 해줘',
      '오늘 늦게 온 수강생들',
      '이번 주 지각자 확인해',
      '지각자 재확인 예약',
    ],
  },

  // 수납/청구(Billing) 도메인 - L0 조회 Intent
  'billing.query.overdue_month': {
    intent_key: 'billing.query.overdue_month',
    description: '월별 연체 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          overdue_amount: z.number(),
          overdue_days: z.number(),
        })
      ),
      total_count: z.number(),
      total_amount: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'billing_overdue_month',
    },
    examples: [
      '이번 달 연체된 대상 확인',
      '지난달 지각자 리스트 보여줘',
      '지각한 수강생 목록',
      '이번 주 연체된 회원 목록',
      '연체된 원생 조회',
      '지각자 현황',
      '이번 달 늦은 학생들',
      '지각학생조회',
    ],
  },

  'billing.query.overdue_list': {
    intent_key: 'billing.query.overdue_list',
    description: '연체 목록 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      min_days: z.number().int().positive().optional(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          overdue_amount: z.number(),
          overdue_days: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_overdue_list',
    },
    examples: [
      '연체 목록 조회',
      '미납자 목록',
      '돈 안낸 사람',
      '돈 안낸 학생',
      '납부 안한 사람들',
      '결제 안한 학생',
      '미결제자 목록',
      '연체자 조회',
      '미결제자 조회',
      '연체자 목록',
      '미납 학생들',
      '납부 안된 사람',
    ],
  },

  'billing.query.by_student': {
    intent_key: 'billing.query.by_student',
    description: '특정 학생의 청구 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      invoices: z.array(
        z.object({
          id: z.string().uuid(),
          month: z.string(), // YYYY-MM 형식
          amount: z.number(),
          status: z.enum(['issued', 'unissued', 'paid', 'partial']),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'billing_by_student',
    },
    examples: [
      '학생 청구 내역 조회',
      '이번 달 청구서 확인할 수 있어?',
      '청구 내역 확인',
      '결제 내역 조회',
      '납부 내역 확인',
      '수납 내역 조회',
      '청구서 목록',
      '결제 내역 보여줘',
    ],
  },

  'billing.query.invoice_status': {
    intent_key: 'billing.query.invoice_status',
    description: '청구서 상태 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      status: z.enum(['issued', 'unissued', 'paid', 'partial']),
    }),
    responseSchema: z.object({
      invoices: z.array(
        z.object({
          id: z.string().uuid(),
          student_id: z.string().uuid(),
          student_name: z.string(),
          amount: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'billing_invoice_status',
    },
    examples: [
      '청구서 상태가 궁금해요',
      '내 청구서 확인해줄래?',
      '청구서조회',
      '현재 청구서 진행 상황 알려줘',
      '청구서 상태 어떤지 알고싶어',
      '이번 달 청구서 상태는 어때?',
      '청구서가 어떻게 되었는지 보여줘',
      '내 청구서 진행 상태 확인해줘',
    ],
  },

  'billing.query.failed_payments': {
    intent_key: 'billing.query.failed_payments',
    description: '결제 실패 목록 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      payments: z.array(
        z.object({
          id: z.string().uuid(),
          student_id: z.string().uuid(),
          student_name: z.string(),
          amount: z.number(),
          failed_at: z.string(), // ISO 8601 형식
          reason: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_failed_payments',
    },
    examples: [
      '결제 실패한 목록 좀 보여줘',
      '실패한 결제 내역 조회',
      '결제실패리스트',
      '결제 못한 회원들 확인해줘',
      '이번 달 결제 실패자',
      '최근 결제 실패한 원생 목록',
      '지금까지 결제 실패한 대상들',
      '결제 안 된 수강생 리스트',
    ],
  },

  'billing.query.refund_candidates': {
    intent_key: 'billing.query.refund_candidates',
    description: '환불 후보 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      candidates: z.array(
        z.object({
          student_id: z.string().uuid(),
          student_name: z.string(),
          refund_amount: z.number(),
          reason: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_refund_candidates',
    },
    examples: [
      '환불 받을 수 있는 대상 조회',
      '환불 후보 리스트 보여줘',
      '환불 가능한 원생들',
      '환불 대상 확인해줘',
      '이번 달 환불할 수 있는 수강생',
      '환불 가능한 애들 목록',
      '환불 후보 원생들 리스트',
      '환불 조건에 맞는 회원 조회',
    ],
  },

  'billing.query.kpi_summary': {
    intent_key: 'billing.query.kpi_summary',
    description: '수납 KPI 요약 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      group_by: z.enum(['class', 'grade']).optional(),
    }),
    responseSchema: z.object({
      summary: z.array(
        z.object({
          group_key: z.string(),
          group_name: z.string(),
          total_revenue: z.number(),
          collection_rate: z.number(),
        })
      ),
      overall_revenue: z.number(),
      overall_collection_rate: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_kpi_summary',
    },
    examples: [
      '수납 KPI 요약 조회해줘',
      '오늘 수납 KPI는 어때?',
      '이번 달 수납 성과 요약 부탁해',
      '최근 수납 KPI 정리해줘',
      '수납 KPI 요약 확인할 수 있을까?',
      '이번 주 수납 KPIs 알려줘',
      '수납 성과 보고서 보여줘',
      '회원 수납 KPI 현황 궁금해',
    ],
  },

  'billing.query.unissued_invoices': {
    intent_key: 'billing.query.unissued_invoices',
    description: '미발행 청구서 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          expected_amount: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'billing_unissued_invoices',
    },
    examples: [
      '미발행 청구서 확인해줘',
      '청구서 아직 안 나온 거 있나?',
      '안 나온 청구서 목록 보여줘',
      '발행되지 않은 청구서 조회할래',
      '이번 달 미발행 청구서 있나요?',
      '청구서 리스트 중 안 나온 것 찾아줘',
      '미발행된 청구서 좀 보여줘',
      '아직 발행 안 된 청구서 목록',
    ],
  },

  'billing.query.partial_payments': {
    intent_key: 'billing.query.partial_payments',
    description: '부분 결제 목록 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      payments: z.array(
        z.object({
          id: z.string().uuid(),
          student_id: z.string().uuid(),
          student_name: z.string(),
          paid_amount: z.number(),
          remaining_amount: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_partial_payments',
    },
    examples: [
      '부분 결제 내역 보여줘',
      '부분 결제 목록 조회해줘',
      '부분 결제한 원생들',
      '부분 결제한 대상 확인',
      '이번 달 부분 결제 내역',
      '최근 부분 결제한 수강생 목록',
      '부분 결제 내역 리스트',
      '부분 결제 현황 봐야해',
    ],
  },

  'billing.query.export_statement': {
    intent_key: 'billing.query.export_statement',
    description: '명세서 내보내기',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      format: z.enum(['csv', 'pdf', 'excel']).optional(),
    }),
    responseSchema: z.object({
      download_url: z.string().url(),
      expires_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'billing_export_statement',
    },
    examples: [
      '명세서 내보내기 해줄래?',
      '이번 달 명세서 가져와',
      '명세서 출력해줘',
      '나의 명세서 내보내줘',
      '지난주 명세서 파일로 내보내기',
      '명세서 좀 뽑아줘',
      '최근 명세서 내보내기 요청',
      '수강생 명세서 내보내주세요',
    ],
  },

  // 수납/청구(Billing) 도메인 - L1 업무화 Intent
  'billing.task.flag_overdue_followup': {
    intent_key: 'billing.task.flag_overdue_followup',
    description: '연체 후속 조치 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      threshold_days: z.number().int().positive().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'billing_overdue_followup',
    },
    examples: [
      '연체된 대상 조회해줘',
      '이번 달 연체자 목록 보여줘',
      '연체자 리스트 생성해',
      '지각한 회원들 확인',
      '오늘 연체된 수강생들',
      '늦은 원생들 리스트',
      '이번 주 연체자들 보여줘',
      '연체 후속 조치 카드 만들어',
    ],
  },

  'billing.task.prepare_invoice_batch': {
    intent_key: 'billing.task.prepare_invoice_batch',
    description: '청구서 일괄 준비 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'invoice_batch_prepare',
    },
    examples: [
      '청구서 일괄 준비해줘',
      '청구서 다 만들기',
      '청구서 준비',
      '청구서 일괄작성',
      '회원 청구서 한꺼번에 준비해줘',
      '이번 달 청구서 준비하기',
      '모든 대상 청구서 준비',
      '수강생 청구서 일괄 처리해',
    ],
  },

  'billing.task.prepare_refund_review': {
    intent_key: 'billing.task.prepare_refund_review',
    description: '환불 검토 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'refund_review',
    },
    examples: [
      '환불 검토 요청해줘',
      '환불 검토 TaskCard 만들어줘',
      '환불 리뷰 준비해',
      '환불 관련 검토 시작해',
      '환불 검토할 대상 리스트',
      '이번 달 환불 검토 요청',
      '환불 검토 TaskCard 생성해',
      '환불 검토할 수강생 목록 보여줘',
    ],
  },

  'billing.task.prepare_payment_link_batch': {
    intent_key: 'billing.task.prepare_payment_link_batch',
    description: '결제 링크 일괄 준비 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      audience: z.enum(['all', 'class', 'grade']).optional(),
      channel: z.enum(['sms', 'kakao']),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'payment_link_batch_prepare',
    },
    examples: [
      '결제 링크 일괄 준비해줘',
      '결제 링크 만들어줘',
      '결제링크 일괄 준비',
      '회원들 결제 링크 생성',
      '대상 결제 링크 준비 부탁해',
      '이번 주 결제 링크 일괄로 생성해줘',
      '수강생 결제 링크 한번에 준비해',
      '원생 결제 링크 일괄로 만들어줘',
    ],
  },

  'billing.task.flag_churn_risk_from_billing': {
    intent_key: 'billing.task.flag_churn_risk_from_billing',
    description: '수납 기반 이탈 위험 플래깅 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'churn_risk_from_billing',
    },
    examples: [
      '이탈 위험 대상 플래그 설정',
      '이탈 가능성 있는 회원 표시해줘',
      '수납 기반 이탈 리스크 플래그',
      '위험한 수강생 목록 보여줘',
      '오늘 수납 못한 대상 플래그',
      '이번 달 이탈 위험 회원들',
      '연체된 원생 플래그 생성',
      '지금 이탈 위험한 대상 확인',
    ],
  },

  // 수납/청구(Billing) 도메인 - L2-A 실행 Intent
  'billing.exec.send_overdue_notice_1st': {
    intent_key: 'billing.exec.send_overdue_notice_1st',
    description: '1차 연체 안내 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'overdue_outstanding_over_limit',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      student_ids: z.array(z.string().uuid()).optional(),
      channel: z.enum(['sms', 'kakao']).optional(),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'overdue_notice_1st',
    },
    examples: [
      '1차 연체 안내 발송해 줘',
      '연체된 회원들한테 안내문 보내줘',
      '연체자에게 첫 안내 발송',
      '연체한 수강생들에게 연락해',
      '오늘 연체한 대상에게 안내문',
      '이번 달 연체자 목록 확인하고 발송',
      '연체한 원생들한테 첫 번째 공지 보내줘',
      '연체된 학생들 명단 보고 첫 안내 발송',
    ],

    warnings: ['심야 발송 주의', '대량 발송 시 비용 확인'],
  },

  'billing.exec.send_overdue_notice_2nd': {
    intent_key: 'billing.exec.send_overdue_notice_2nd',
    description: '2차 연체 안내 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'overdue_outstanding_over_limit',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      student_ids: z.array(z.string().uuid()).optional(),
      channel: z.enum(['sms', 'kakao']).optional(),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'overdue_notice_2nd',
    },
    examples: [
      '2차 연체 안내 발송해줘',
      '이번 주 연체자에게 알림 보내기',
      '연체 중인 회원 목록 조회',
      '지각한 대상들에게 두 번째 안내문 보내',
      '연체한 수강생들 보여줘',
      '연체자에게 2차 안내 발송할게',
      '오늘 연체된 원생들 확인해',
      '늦은 회원들에게 알림 보내기',
    ],

    warnings: ['심야 발송 주의', '대량 발송 시 비용 확인'],
  },

  'billing.exec.send_payment_link': {
    intent_key: 'billing.exec.send_payment_link',
    description: '결제 링크 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'payment_due_reminder',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      month: z.string(), // YYYY-MM 형식
      channel: z.enum(['sms', 'kakao']).optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'student',
      window: 'YYYY-MM',
      subtype: 'payment_link',
    },
    examples: [
      '결제 링크 보내줘',
      '지금 결제 링크 발송해',
      '결제링크전송',
      '결제 관련 링크 좀 보내주세요',
      '수강생들에게 결제 링크 발송해줘',
      '회원 결제 링크 전달 부탁해',
      '지금 당장 결제 링크 보내',
      '결제 링크를 오늘 꼭 보내줘',
    ],
  },

  'billing.exec.schedule_overdue_notice': {
    intent_key: 'billing.exec.schedule_overdue_notice',
    description: '연체 안내 예약 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'overdue_outstanding_over_limit',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      send_at: z.string(), // ISO 8601 형식
      channel: z.enum(['sms', 'kakao']).optional(),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'schedule_overdue_notice',
    },
    examples: [
      '연체 안내 예약해줘',
      '이번 달 연체된 회원들 알려줘',
      '연체자 목록 예약 발송해',
      '연체된 수강생들 보고 싶어',
      '오늘 연체된 대상들 발송',
      '연체 안내 문자 보내는 거 예약해',
      '이번 주 연체한 애들 보여줘',
      '연체 안내 문자 예약할게',
    ],
  },

  // 수납/청구(Billing) 도메인 - L2-B 실행 Intent
  'billing.exec.issue_invoices': {
    intent_key: 'billing.exec.issue_invoices',
    description: '청구서 발행 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.issue_invoices', // Domain Action Catalog
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      student_ids: z.array(z.string().uuid()).optional(),
      pricing_rule_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'issue_invoices',
    },
    examples: [
      '청구서 발행해 줘',
      '청구서 만들기 부탁해',
      '청구서 발행할게',
      '이번 달 청구서 발행해 주세요',
      '이번 주에 발행할 청구서 리스트',
      '지금 청구서 발행해',
      '청구서 발행 요청해요',
      '오늘 날짜로 청구서 발행',
    ],
  },

  'billing.exec.reissue_invoice': {
    intent_key: 'billing.exec.reissue_invoice',
    description: '청구서 재발행 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.reissue_invoice', // Domain Action Catalog
    paramsSchema: z.object({
      invoice_ids: z.array(z.string().uuid()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'billing',
      entity_type: 'billing',
      window: 'YYYY-MM',
      subtype: 'reissue_invoice',
    },
    examples: [
      '청구서 다시 발행해줘',
      '청구서 재발급 부탁해',
      '청구서 재발행할 수 있어?',
      '청구서 다시 만들어줘',
      '청구서 발행 다시 해줘',
      '재발행된 청구서 요청해',
      '청구서 재발행해줘',
      '청구서 다시 보내줘',
    ],
  },

  'billing.exec.record_manual_payment': {
    intent_key: 'billing.exec.record_manual_payment',
    description: '수동 결제 기록 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.record_manual_payment', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      amount: z.number().positive(),
      paid_at: z.string(), // ISO 8601 형식
      method: z.enum(['cash', 'transfer', 'card', 'other']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'billing',
      entity_type: 'student',
      window: 'YYYY-MM',
      subtype: 'manual_payment',
    },
    examples: [
      '수동 결제로 결제 기록하기',
      '오늘 결제한 것들 수동으로 입력해줘',
      '회원의 결제 내역 추가해',
      '원생 결제 기록을 수동으로 작성할래',
      '이번 달 수강생 결제 내역 입력해줘',
      '결제 내역을 수동으로 기록할 수 있을까?',
      '대상 결제 정보 추가하기',
      '지금까지의 결제 내역 수동으로 정리해줘',
    ],
  },

  'billing.exec.apply_discount': {
    intent_key: 'billing.exec.apply_discount',
    description: '할인 적용 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.apply_discount', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      month: z.string(), // YYYY-MM 형식
      amount: z.number().positive(),
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'student',
      window: 'YYYY-MM',
      subtype: 'discount_apply',
    },
    examples: [
      '할인 적용해줘',
      '할인 해주세요',
      '지금 할인 적용',
      '할인 적용하는 방법 알려줘',
      '할인 적용 요청합니다',
      '회원 할인 적용해줘',
      '수강생 할인 적용해줘',
      '이번 달 할인 적용해',
    ],
  },

  'billing.exec.apply_refund': {
    intent_key: 'billing.exec.apply_refund',
    description: '환불 적용 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.apply_refund', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      amount: z.number().positive(),
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'refund_apply',
    },
    examples: [
      '환불 신청해줘',
      '환불 처리 부탁해',
      '환불적용',
      '환불 진행할 수 있어?',
      '오늘 환불 요청한 건 있나요?',
      '이번 달 환불 신청 리스트 보여줘',
      '환불이 필요해, 어떻게 해야 돼?',
      '환불 절차 시작해줘',
    ],
  },

  'billing.exec.create_installment_plan': {
    intent_key: 'billing.exec.create_installment_plan',
    description: '할부 계획 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.create_installment_plan', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      total_amount: z.number().positive(),
      installments: z.number().int().positive(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'installment_plan',
    },
    examples: [
      '할부 계획 생성해줘',
      '할부 계획 만들어주세요',
      '할부로 결제할 수 있게 해줘',
      '이번 달 할부 계획 세워줘',
      '회원의 할부 계획을 설정해줘',
      '수강생 할부 계획 생성하기',
      '지금 할부 계획을 작성해줘',
      '할부 계획 등록해줘',
    ],
  },

  'billing.exec.fix_duplicate_invoices': {
    intent_key: 'billing.exec.fix_duplicate_invoices',
    description: '중복 청구서 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.fix_duplicate_invoices', // Domain Action Catalog
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'fix_duplicate_invoices',
    },
    examples: [
      '중복 청구서 수정해줘',
      '중복된 인보이스 고쳐주세요',
      '청구서 중복 수정 실행',
      '중복된 청구서 삭제하고 싶어',
      '청구서 중복 문제 해결 부탁해',
      '중복 청구서 다 처리해줘',
      '이중 청구서 수정 작업 해줘',
      '중복 인보이스 정리해 줘',
    ],
  },

  'billing.exec.sync_gateway': {
    intent_key: 'billing.exec.sync_gateway',
    description: '결제 게이트웨이 동기화 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.sync_gateway', // Domain Action Catalog
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'sync_gateway',
    },
    examples: [
      '결제 게이트웨이 동기화해줘',
      '지금 결제 시스템 동기화 실행해',
      '결제 게이트웨이 동기화 요청',
      '동기화 작업 해줘, 결제 게이트웨이',
      '결제 시스템 지금 바로 동기화',
      '결제 게이트웨이 동기화 부탁해',
      '결제 관련 데이터 동기화 시켜줘',
      '결제 게이트웨이 업데이트 실행해',
    ],
  },

  'billing.exec.close_month': {
    intent_key: 'billing.exec.close_month',
    description: '월 마감 처리 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'billing.close_month', // Domain Action Catalog
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'billing',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'close_month',
    },
    examples: [
      '이번 달 마감 처리 해줘',
      '월 마감 실행해',
      '이번 달 결산 진행 부탁',
      '이번 달 정산 처리해 줘',
      '마감 처리 시작해',
      '이번 달 결제 마감 부탁해',
      '월말 정산 시작해줘',
      '이번 월 마감 작업 진행해',
    ],
  },

  // 메시지/공지(Messaging) 도메인 - L0 조회/초안 Intent
  'message.query.sent_log': {
    intent_key: 'message.query.sent_log',
    description: '발송 로그 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      channel: z.enum(['sms', 'kakao', 'email']).optional(),
    }),
    responseSchema: z.object({
      messages: z.array(
        z.object({
          id: z.string().uuid(),
          student_id: z.string().uuid(),
          student_name: z.string(),
          channel: z.string(),
          sent_at: z.string(), // ISO 8601 형식
          status: z.string(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'message_sent_log',
    },
    examples: [
      '오늘 지각한 원생 조회',
      '이번 주 지각자 목록 보여줘',
      '늦게 온 회원들 확인해',
      '지각한 학생들 리스트',
      '지각학생조회',
      '최근 지각한 대상',
      '오늘 지각한 수강생',
      '늦은 학생들 리스트',
    ],
  },

  'message.query.failed_log': {
    intent_key: 'message.query.failed_log',
    description: '발송 실패 로그 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      messages: z.array(
        z.object({
          id: z.string().uuid(),
          student_id: z.string().uuid(),
          student_name: z.string(),
          channel: z.string(),
          failed_at: z.string(), // ISO 8601 형식
          error: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'message_failed_log',
    },
    examples: [
      '발송 실패 로그 확인해줘',
      '실패한 발송 내역 보여줘',
      '발송실패로그조회',
      '실패한 메시지 내역',
      '오늘 발송 실패한 목록',
      '최근에 실패한 로그',
      '지난주 발송 실패 내역',
      '어제 발송 실패 기록',
    ],
  },

  'message.draft.absence_notice': {
    intent_key: 'message.draft.absence_notice',
    description: '결석 안내 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD 형식
      tone: z.enum(['formal', 'friendly', 'casual']).optional(),
    }),
    responseSchema: z.object({
      draft: z.object({
        title: z.string(),
        body: z.string(),
        variables: z.array(z.string()),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'message_draft_absence',
    },
    examples: [
      '지각 학생 목록 보여줘',
      '오늘 늦게 온 원생들 확인해줘',
      '이번 주 지각한 수강생 조회',
      '지각자 리스트',
      '지각한 대상들',
      '이번 주 지각한 애들',
      '늦은 회원 목록',
      '지각학생조회',
    ],
  },

  'message.draft.overdue_notice': {
    intent_key: 'message.draft.overdue_notice',
    description: '연체 안내 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      month: z.string(), // YYYY-MM 형식
      tone: z.enum(['formal', 'friendly', 'casual']).optional(),
    }),
    responseSchema: z.object({
      draft: z.object({
        title: z.string(),
        body: z.string(),
        variables: z.array(z.string()),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM',
      subtype: 'message_draft_overdue',
    },
    examples: [
      '연체 안내 초안 작성해줘',
      '지각한 원생 목록 보여줘',
      '이번 주 지각자 리스트',
      '지각한 회원들 확인해',
      '오늘 늦게 온 학생들',
      '연체된 대상 조회',
      '지각학생정보',
      '늦은 수강생들 리스트',
    ],
  },

  'message.draft.general_notice': {
    intent_key: 'message.draft.general_notice',
    description: '일반 공지 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      title: z.string(),
      body_hint: z.string(),
      audience: z.enum(['all', 'class', 'grade']),
    }),
    responseSchema: z.object({
      draft: z.object({
        title: z.string(),
        body: z.string(),
        variables: z.array(z.string()),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'message_draft_general',
    },
    examples: [
      '이번 주 지각한 원생 목록',
      '지각자 리스트 보여줘',
      '지각한 학생 조회해줘',
      '오늘 지각한 대상들',
      '늦게 온 회원들 확인',
      '이번 주 늦은 수강생',
      '지각학생조회 해주세요',
      '지각한 애들 리스트',
    ],
  },

  'message.preview.audience': {
    intent_key: 'message.preview.audience',
    description: '수신 대상 미리보기',
    automation_level: 'L0',
    paramsSchema: z.object({
      audience: z.enum(['all', 'class', 'grade']),
      id: z.string().uuid().optional(),
    }),
    responseSchema: z.object({
      recipients: z.array(
        z.object({
          student_id: z.string().uuid(),
          student_name: z.string(),
          guardian_name: z.string().optional(),
          contact: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'message_preview_audience',
    },
    examples: [
      '지각한 학생 조회',
      '이번 주 지각자 리스트',
      '늦게 온 원생들 보여줘',
      '지각학생조회',
      '오늘 지각한 대상',
      '지각한 수강생 목록',
      '최근 지각자 확인',
      '늦은 회원들 리스트',
    ],
  },

  'message.preview.template_render': {
    intent_key: 'message.preview.template_render',
    description: '템플릿 렌더링 미리보기',
    automation_level: 'L0',
    paramsSchema: z.object({
      template_id: z.string().uuid(),
      sample_student_ids: z.array(z.string().uuid()),
    }),
    responseSchema: z.object({
      samples: z.array(
        z.object({
          student_id: z.string().uuid(),
          student_name: z.string(),
          rendered_text: z.string(),
        })
      ),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'message',
      window: 'YYYY-MM-DD',
      subtype: 'message_preview_template',
    },
    examples: [
      '지각한 원생 조회',
      '오늘 지각자 리스트 보여줘',
      '지각학생목록',
      '늦게 온 수강생들',
      '이번 주 지각한 대상',
      '지각한 회원 확인해줘',
      '이번 주 늦은 학생들',
      '지각한 애들 리스트',
    ],
  },

  'message.draft.payment_link_notice': {
    intent_key: 'message.draft.payment_link_notice',
    description: '결제 링크 안내 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      month: z.string(), // YYYY-MM 형식
      tone: z.enum(['formal', 'friendly', 'casual']).optional(),
    }),
    responseSchema: z.object({
      draft: z.object({
        title: z.string(),
        body: z.string(),
        variables: z.array(z.string()),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM',
      subtype: 'message_draft_payment_link',
    },
    examples: [
      '결제 링크 보내줘',
      '결제할 수 있는 링크 알려줘',
      '결제 링크 좀 주세요',
      '결제 관련 링크 정리해줘',
      '오늘 결제 링크 공유해',
      '결제링크',
      '결제 링크 안내해줘',
      '이번 달 결제 링크 정보',
    ],
  },

  'message.query.variables_check': {
    intent_key: 'message.query.variables_check',
    description: '템플릿 변수 검증',
    automation_level: 'L0',
    paramsSchema: z.object({
      template_id: z.string().uuid(),
    }),
    responseSchema: z.object({
      valid: z.boolean(),
      errors: z.array(z.string()),
      variables: z.array(z.string()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'message',
      window: 'YYYY-MM-DD',
      subtype: 'message_variables_check',
    },
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '오늘 수업에 늦은 원생',
      '지각한 회원 리스트',
      '지각한 수강생 목록',
    ],
  },

  // 메시지/공지(Messaging) 도메인 - L1 업무화 Intent
  'message.task.prepare_bulk_send': {
    intent_key: 'message.task.prepare_bulk_send',
    description: '일괄 발송 준비 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      audience: z.enum(['all', 'class', 'grade']),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_send_prepare',
    },
    examples: [
      '지각한 회원 목록 준비해줘',
      '이번 주 지각한 수강생들 보여줘',
      '지각한 대상 조회',
      '오늘 늦게 온 원생들 리스트',
      '지각학생리스트',
      '늦은 수강생들 확인해',
      '이번 달 지각자들 조회하기',
      '지각한 사람들 준비해줘',
    ],
  },

  'message.task.test_send_request': {
    intent_key: 'message.task.test_send_request',
    description: '테스트 발송 요청 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      channel: z.enum(['sms', 'kakao', 'email']),
      to: z.string(),
      text: z.string(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'message',
      entity_type: 'message',
      window: 'YYYY-MM-DD',
      subtype: 'test_send',
    },
    examples: [
      '테스트 발송 요청 해줘',
      '테스트 발송해 줘',
      '테스트 요청 보내기',
      '테스트발송요청',
      '테스트 발송할 수 있어?',
      '이번 주 테스트 발송 요청',
      '상황별 테스트 발송하기',
      '지금 테스트 요청 해줘',
    ],
  },

  // 메시지/공지(Messaging) 도메인 - L2-A 실행 Intent
  'message.exec.send_to_guardian': {
    intent_key: 'message.exec.send_to_guardian',
    description: '보호자 메시지 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type_by_purpose: {
      absence: 'absence_first_day',
      overdue: 'overdue_outstanding_over_limit',
      general: 'announcement_urgent',
    },
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
      text: z.string().optional(),
      message_purpose: z.enum(['absence', 'overdue', 'general']).optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'send_to_guardian',
    },
    examples: [
      '오늘 지각한 원생들에게 메시지 보내줘',
      '지각학생 목록 전송해줘',
      '이번 주 늦은 학생들한테 연락해',
      '지각한 수강생들 보여줘',
      '지각한 애들한테 메시지 보내',
      '늦게 온 대상들한테 알림 전송',
      '오늘 지각한 회원들 리스트',
      '지각자들에게 메시지 보내주세요',
    ],
  },

  'message.exec.send_bulk': {
    intent_key: 'message.exec.send_bulk',
    description: '일괄 메시지 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type_by_purpose: {
      announcement_urgent: 'announcement_urgent',
      announcement_digest: 'announcement_digest',
      class_change_or_cancel: 'class_change_or_cancel',
    },
    paramsSchema: z.object({
      audience: z.enum(['all', 'class', 'grade']),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
      text: z.string().optional(),
      message_purpose: z.enum([
        'announcement_urgent',
        'announcement_digest',
        'class_change_or_cancel',
      ]),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'send_bulk',
    },
    examples: [
      '이번 주 지각한 대상에게 메시지 보내기',
      '지각한 원생들한테 일괄 발송해줘',
      '지각학생조회 하고 일괄 메시지 발송',
      '오늘 지각한 애들한테 연락해',
      '늦게 온 사람들에게 메시지 전송',
      '지각자 목록에 메시지 보내기',
      '지각한 수강생들에게 일괄적으로 메시지 보내',
      '이번 주 지각자에게 공지사항 보내기',
    ],
  },

  'message.exec.schedule_bulk': {
    intent_key: 'message.exec.schedule_bulk',
    description: '일괄 메시지 예약 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type_by_purpose: {
      announcement_urgent: 'announcement_urgent',
      announcement_digest: 'announcement_digest',
      class_change_or_cancel: 'class_change_or_cancel',
    },
    paramsSchema: z.object({
      send_at: z.string(), // ISO 8601 형식
      audience: z.enum(['all', 'class', 'grade']),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
      message_purpose: z.enum([
        'announcement_urgent',
        'announcement_digest',
        'class_change_or_cancel',
      ]),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_bulk',
    },
    examples: [
      '지각한 원생 목록 조회',
      '오늘 지각한 학생들 보여줘',
      '이번 주 지각자 리스트',
      '지각학생조회',
      '늦게 온 대상 확인',
      '오늘 지각한 회원들',
      '지각자 관리하기',
      '이번 주 지각자들 조회',
    ],
  },

  'message.exec.resend_failed': {
    intent_key: 'message.exec.resend_failed',
    description: '실패 메시지 재발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    // event_type은 original_event_type을 재사용하므로 event_type_by_purpose 사용 불가
    // 원본 발송의 event_type을 params로 받아 동일 event_type 재사용
    event_type: 'announcement_urgent', // 기본값 (원본 event_type이 없을 경우)
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      original_event_type: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'resend_failed',
    },
    examples: [
      '실패한 메시지 다시 보내줘',
      '재발송 해주세요',
      '메시지 재전송 해줘',
      '실패했던 메시지 다시 보내는 거야',
      '이전 실패 메시지 다시 보내',
      '다시 한번 그 메시지 보내줄래?',
      '안됐던 메시지 재전송 부탁해',
      '그 실패 메시지 다시 보내줘',
    ],
  },

  'message.exec.optout_respect_audit': {
    intent_key: 'message.exec.optout_respect_audit',
    description: '수신거부 감사 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'announcement_digest',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'optout_audit',
    },
    examples: [
      '수신 거부 감사 실시해 줘',
      '오늘 수신 거부한 회원 목록 보여줘',
      '최근 수신 거부한 대상 확인할 수 있어?',
      '이번 주 수신 거부한 수강생 리스트',
      '수신 거부자 감사 실행해',
      '지금까지 수신 거부한 사람들 조회',
      '지난 달 수신 거부한 원생들',
      '지금 수신 거부 감사 진행할 수 있어?',
    ],
  },

  'message.exec.staff_broadcast': {
    intent_key: 'message.exec.staff_broadcast',
    description: '직원 브로드캐스트 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'announcement_urgent',
    paramsSchema: z.object({
      recipients: z.array(z.string().uuid()),
      channel: z.enum(['sms', 'kakao', 'email']),
      text: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'staff_broadcast',
    },
    examples: [
      '지각한 대상 조회',
      '늦게 온 애들 보여줘',
      '당일 지각자 리스트',
      '이번 주 지각학생 목록',
      '오늘 지각한 수강생들',
      '지각한 회원 리스트',
      '지각자 조회하기',
      '이번 주 늦은 학생들',
    ],
  },

  'message.exec.class_schedule_change_notice': {
    intent_key: 'message.exec.class_schedule_change_notice',
    description: '수업 일정 변경 안내 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'class_change_or_cancel',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      session_id: z.string().uuid().optional(),
      channel: z.enum(['sms', 'kakao', 'email']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_change_notice',
    },
    examples: [
      '수업 일정 변경 안내 해줘',
      '수업 시간 바뀐 거 알려줘',
      '변경된 수업 일정 봐야 해',
      '이번 주 수업 스케줄 변경',
      '수업 일정 변경사항 확인',
      '수업 시간 변동사항 알려줘',
      '수업 일정 수정된 거 보여줘',
      '오늘 변경된 수업 시간',
    ],
  },

  'message.exec.emergency_notice': {
    intent_key: 'message.exec.emergency_notice',
    description: '긴급 공지 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'announcement_urgent',
    paramsSchema: z.object({
      audience: z.enum(['all', 'class', 'grade']),
      channel: z.enum(['sms', 'kakao', 'email']),
      text: z.string(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'emergency_notice',
    },
    examples: [
      '지각한 원생 조회',
      '오늘 지각한 수강생 목록 보여줘',
      '이번 주 늦은 대상 확인해줘',
      '늦었거나 지각한 회원 리스트',
      '지각자 목록 불러와',
      '지각학생조회',
      '오늘 늦게 온 사람들',
      '이번 주 지각한 애들 보여줘',
    ],
  },

  // 메시지/공지(Messaging) 도메인 - L2-B 실행 Intent
  'message.exec.cancel_scheduled': {
    intent_key: 'message.exec.cancel_scheduled',
    description: '예약 발송 취소 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'message.cancel_scheduled', // Domain Action Catalog
    paramsSchema: z.object({
      schedule_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'cancel_scheduled',
    },
    examples: [
      '예약 발송 취소해줘',
      '발송 예약 취소할게',
      '예약취소',
      '예약한 발송 없애줘',
      '그냥 예약 취소해',
      '발송 취소 부탁해',
      '예약 취소할 수 있어?',
      '이번 주 발송 예약 취소',
    ],
  },

  'message.exec.create_template': {
    intent_key: 'message.exec.create_template',
    description: '메시지 템플릿 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'message.create_template', // Domain Action Catalog
    paramsSchema: z.object({
      channel: z.enum(['sms', 'kakao', 'email']),
      title: z.string(),
      body: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'message',
      window: 'YYYY-MM',
      subtype: 'create_template',
    },
    examples: [
      '메시지 템플릿 만들기',
      '새로운 메시지 템플릿 생성해줘',
      '메시지템플릿생성',
      '알림 템플릿 추가하고 싶어',
      '새 템플릿 생성할 수 있어?',
      '원생들에게 보낼 메시지 템플릿 만들어줘',
      '오늘의 공지사항 템플릿 생성',
      '이번 주 공지용 메시지 템플릿 제작',
    ],
  },

  'message.exec.update_template': {
    intent_key: 'message.exec.update_template',
    description: '메시지 템플릿 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'message.update_template', // Domain Action Catalog
    paramsSchema: z.object({
      template_id: z.string().uuid(),
      patch: z.object({
        title: z.string().optional(),
        body: z.string().optional(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'message',
      window: 'YYYY-MM-DD',
      subtype: 'update_template',
    },
    examples: [
      '메시지 템플릿 수정해줘',
      '템플릿 업데이트 해주세요',
      '메시지 양식 바꿔줘',
      '기존 템플릿 수정하기',
      '템플릿 수정할 대상 알려줘',
      '메시지 템플릿 변경해주렴',
      '템플릿 업데이트를 진행해줘',
      '현재 템플릿 고쳐줘',
    ],
  },

  // 학생 라이프사이클(Student) 도메인 - L0 조회 Intent (student.query.search는 이미 등록됨)
  'student.query.profile': {
    intent_key: 'student.query.profile',
    description: '학생 프로필 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
    }),
    responseSchema: z.object({
      student: z.object({
        id: z.string().uuid(),
        name: z.string(),
        grade: z.string().optional(),
        class_name: z.string().optional(),
        status: z.string().optional(),
        guardian_name: z.string().optional(),
        guardian_contact: z.string().optional(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_profile',
    },
    examples: [
      '박소영 프로필',
      '박소영 정보',
      '박소영 전화번호',
      '박소영 연락처',
      '박소영 학생 정보',
      '박소영 대상 정보',
      '박소영 상세 정보',
      '학생 프로필 조회',
    ],
  },

  'student.query.status_list': {
    intent_key: 'student.query.status_list',
    description: '상태별 학생 목록 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      status: z.enum(['active', 'paused', 'discharged']),
      class_id: z.string().uuid().optional(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
          status: z.string(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_status_list',
    },
    examples: [
      '지각한 학생 목록 조회',
      '오늘 지각한 수강생들 보여줘',
      '이번 주 늦게 온 애들',
      '늦은 학생들 리스트',
      '지각학생조회',
      '오늘 지각자 명단',
      '늦은 대상을 확인해줘',
      '이번 주 지각한 원생들',
    ],
  },

  'student.query.missing_guardian_contact': {
    intent_key: 'student.query.missing_guardian_contact',
    description: '보호자 연락처 누락 학생 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      scope: z.string().optional(),
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          class_name: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_missing_guardian',
    },
    examples: [
      '보호자 연락처 없는 학생 조회',
      '보호자 연락처 누락된 애들 보여줘',
      '보호자 연락처 결핍 원생 찾기',
      '연락처 없는 회원 리스트',
      '이번 주 보호자 연락처 없는 수강생',
      '연락처 미제출 학생 목록',
      '보호자 연락처 없는 대상 조회',
      '어제 보호자 연락처 누락된 학생들',
    ],
  },

  'student.query.duplicates_suspected': {
    intent_key: 'student.query.duplicates_suspected',
    description: '중복 의심 학생 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string().optional(), // YYYY-MM-DD 형식
      to: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      duplicates: z.array(
        z.object({
          primary_id: z.string().uuid(),
          primary_name: z.string(),
          duplicate_id: z.string().uuid(),
          duplicate_name: z.string(),
          similarity_score: z.number(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_duplicates',
    },
    examples: [
      '중복 의심 학생 조회',
      '중복된 회원 있나?',
      '중복학생리스트',
      '중복 의심되는 수강생들',
      '이번 달 중복된 대상',
      '중복된 원생 목록 보여줘',
      '중복 의심 학생들 확인해',
      '중복된 애들 리스트',
    ],
  },

  'student.query.onboarding_needed': {
    intent_key: 'student.query.onboarding_needed',
    description: '온보딩 필요 학생 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          registered_at: z.string(), // ISO 8601 형식
          missing_items: z.array(z.string()),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_onboarding_needed',
    },
    examples: [
      '온보딩이 필요한 학생 리스트',
      '지각 학생들 확인해줘',
      '지각한 원생 조회',
      '늦게 온 수강생 목록',
      '이번 주 늦은 학생들',
      '온보딩 필요 회원 보여줘',
      '오늘 지각한 대상',
      '지각학생조회',
    ],
  },

  'student.query.data_quality_scan': {
    intent_key: 'student.query.data_quality_scan',
    description: '학생 데이터 품질 검증',
    automation_level: 'L0',
    paramsSchema: z.object({
      fields: z.array(z.string()),
      scope: z.string().optional(),
    }),
    responseSchema: z.object({
      issues: z.array(
        z.object({
          student_id: z.string().uuid(),
          student_name: z.string(),
          field: z.string(),
          issue_type: z.string(),
          severity: z.enum(['error', 'warning', 'info']),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'student_data_quality',
    },
    examples: [
      '오늘 지각한 학생 리스트',
      '지각한 애들 보여줘',
      '이번 주 지각자 확인',
      '지각학생조회',
      '늦은 원생 목록',
      '이번 달 지각자',
      '늦게 온 사람들',
      '오늘 지각 리스트',
    ],
  },

  // 학생 라이프사이클(Student) 도메인 - L1 업무화 Intent
  'student.task.register_prefill': {
    intent_key: 'student.task.register_prefill',
    description: '학생 등록 사전 입력 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      name: z.string(),
      grade: z.string().optional(),
      phone: z.string().optional(),
      guardian_phone: z.string().optional(),
      class_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'register_prefill',
    },
    examples: [
      '대상 등록 사전 입력해줘',
      '신규 원생 정보 미리 채워줘',
      '회원 등록할 때 정보 미리 넣기',
      '수강생 등록할 때 필요한 정보 알려줘',
      '대상 등록할 때 미리 준비할 것',
      '신입생 정보 미리 입력해줘',
      '이번 주 수강생 등록 정보 미리 채우기',
      '원생 등록할 때 필요한 사항 정리해줘',
    ],
  },

  'student.task.collect_documents': {
    intent_key: 'student.task.collect_documents',
    description: '문서 수집 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      doc_type: z.string(),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'collect_documents',
    },
    examples: [
      '지각한 원생 목록',
      '이번 주 늦게 온 학생들',
      '오늘 지각한 수강생 조회해줘',
      '지각자 리스트 보여줘',
      '늦은 회원 확인',
      '이번 주 지각 학생들',
      '지각학생조회',
      '오늘 지각한 애들 보여줘',
    ],
  },

  // 학생 라이프사이클(Student) 도메인 - L2-A 실행 Intent
  'student.exec.send_welcome_message': {
    intent_key: 'student.exec.send_welcome_message',
    description: '신규 등록 환영 메시지 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'new_member_drop',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'welcome_message',
    },
    examples: [
      '신규 등록한 학생들에게 환영 메시지 보내줘',
      '새로 온 회원들한테 환영 인사 전송해',
      '신규 수강생들 환영 메시지 발송해줘',
      '오늘 등록한 원생들에게 메시지 보내기',
      '신규 대상들에게 환영 메세지 전송해',
      '새로 등록한 애들한테 환영 메시지 부탁해',
      '이번 주 신규 등록자들에게 환영 메시지 전발송',
      '신규 회원들한테 자동으로 환영 메시지 보내줘',
    ],
  },

  'student.exec.request_documents_message': {
    intent_key: 'student.exec.request_documents_message',
    description: '문서 요청 메시지 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'new_member_drop',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      channel: z.enum(['sms', 'kakao', 'email']),
      template_id: z.string().uuid().optional(),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'request_documents_message',
    },
    examples: [
      '지각한 회원 목록 요청',
      '오늘 지각한 수강생 리스트 보여줘',
      '이번 주 늦은 원생들 조회',
      '지각 학생 자료 보내줘',
      '늦게 온 대상 리스트 확인해줘',
      '지각자 명단 요청할게',
      '이번 주 지각한 애들 보여줘',
      '지각학생조회 해줘',
    ],
  },

  // 학생 라이프사이클(Student) 도메인 - L2-B 실행 Intent
  'student.exec.register': {
    intent_key: 'student.exec.register',
    description: '학생 등록 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.register', // Domain Action Catalog
    paramsSchema: z.object({
      form_values: z.record(z.unknown()),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'register_execute',
    },
    // Inline Execution 설정
    execution_mode: 'inline', // TaskCard 없이 즉시 실행
    requires_confirmation: true, // 실행 전 확인 필수
    risk_level: 'medium', // 학생 등록은 중간 위험도
    field_rules: [
      // 조건부 필수: guardians가 있으면 guardian.name은 필수
      {
        type: 'required_if',
        field: 'guardians',
        equals: true, // guardians 배열이 존재하면
        required: ['guardians[].name'], // guardian.name 필수 (실제로는 nested 필드 처리 필요)
      },
    ],
    ask_priority_optional: ['phone', 'email', 'birth_date'], // 한 번 제안할 선택 필드
    examples: [
      '신규 수강생 등록해줘',
      '회원 등록 리스트 보여줘',
      '대상 등록하기',
      '새로운 원생 추가해',
      '이번 학기 수강생 등록',
      '신규 학생 등록할게',
      '오늘 등록한 수강생 확인',
      '회원 추가 요청합니다',
      '박소영 학생 등록',
      '박소영 등록해줘',
    ],
  },

  'student.exec.update_profile': {
    intent_key: 'student.exec.update_profile',
    description: '학생 프로필 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.update_profile', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      patch: z.record(z.unknown()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'update_profile',
    },
    examples: [
      '프로필 수정하기',
      '내 정보 업데이트 해줘',
      '내 프로필 바꿔줘',
      '회원 정보 변경할게',
      '수강생 프로필 수정',
      '대상 정보 업데이트',
      '원생 프로필 수정해줘',
      '내 정보 수정하고 싶어',
    ],
  },

  'student.exec.change_class': {
    intent_key: 'student.exec.change_class',
    description: '반 변경 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.change_class', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      to_class_id: z.string().uuid(),
      effective_date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'change_class',
    },
    examples: [
      '반 변경해주세요',
      '수강생 반 바꿔줘',
      '회원 반 변경',
      '대상 클래스 변경 요청',
      '수업 반 바꾸고 싶어요',
      '원생 반 변경할 수 있나요?',
      '이번 학기 반 변경해 주세요',
      '클래스 변경 처리 부탁드립니다',
    ],
  },

  'student.exec.pause': {
    intent_key: 'student.exec.pause',
    description: '학생 휴원 처리 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.pause', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string().optional(), // YYYY-MM-DD 형식
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'pause',
    },
    examples: [
      '학생 휴원 처리해줘',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 목록',
      '지각한 회원 조회',
      '늦은 애들 리스트',
      '지각학생조회 해주세요',
      '늦게 온 대상들 확인',
      '오늘 지각한 수강생들',
    ],
  },

  'student.exec.resume': {
    intent_key: 'student.exec.resume',
    description: '학생 재개 처리 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.resume', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'resume',
    },
    examples: [
      '지각한 학생 리스트',
      '이번 주 지각자 보여줘',
      '지각학생조회 해줘',
      '늦게 온 회원들',
      '오늘 지각한 원생들',
      '지각자 목록 확인',
      '늦은 수강생들 리스트',
      '이번 달 지각한 대상',
    ],
  },

  'student.exec.discharge': {
    intent_key: 'student.exec.discharge',
    description: '학생 퇴원 처리 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.discharge', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD 형식
      reason: z.string().optional(),
      settlement_mode: z.enum(['full', 'partial', 'none']).optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'discharge',
    },
    // Inline Execution 설정
    execution_mode: 'inline', // TaskCard 없이 즉시 실행
    requires_confirmation: true, // 실행 전 확인 필수
    risk_level: 'high', // 퇴원 처리는 높은 위험도
    examples: [
      '학생 퇴원 처리해줘',
      '퇴원할 대상 목록 보여줘',
      '원생 퇴원 신청 진행',
      '퇴원 대상 확인 부탁해',
      '이번 주 퇴원한 수강생',
      '퇴원 처리할 회원 리스트',
      '대상 퇴원 요청 실행',
      '퇴원할 학생들 처리해줘',
    ],
  },

  'student.exec.merge_duplicates': {
    intent_key: 'student.exec.merge_duplicates',
    description: '중복 학생 병합 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.merge_duplicates', // Domain Action Catalog
    paramsSchema: z.object({
      primary_student_id: z.string().uuid(),
      duplicate_student_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'merge_duplicates',
    },
    examples: [
      '중복된 원생 병합해줘',
      '학생 A와 B 통합하기',
      '회원 정보 중복 제거 요청',
      '수강생 병합 작업 실행해',
      '중복된 대상 합치기',
      '원생 중복 확인하고 병합해',
      '중복된 학생들 통합해줘',
      '지금 중복된 수강생 병합해',
    ],
  },

  'student.exec.update_guardian_contact': {
    intent_key: 'student.exec.update_guardian_contact',
    description: '보호자 연락처 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.update_guardian_contact', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      guardian_name: z.string().optional(),
      guardian_phone: z.string().optional(),
      guardian_email: z.string().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'update_guardian',
    },
    examples: [
      '보호자 연락처 수정해줘',
      '보호자 전화번호 바꾸고 싶어',
      '학생 A의 보호자 연락처 업데이트',
      '원생 보호자 정보 수정 요청',
      '회원의 연락처를 변경할 수 있을까?',
      '수강생 보호자 연락처 변경해줘',
      '보호자 연락처 업데이트할 때 어떤 정보 필요해?',
      '대상 보호자 전화번호를 수정해 주세요',
    ],
  },

  'student.exec.assign_tags': {
    intent_key: 'student.exec.assign_tags',
    description: '학생 태그 할당 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.assign_tags', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      tags: z.array(z.string()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'assign_tags',
    },
    examples: [
      '지각한 학생 태그 달아줘',
      '이번 주 지각자들 보여줘',
      '지각학생조회 해줘',
      '늦게 온 원생 목록',
      '오늘 지각한 회원 태그 추가',
      '지각자들 리스트 업',
      '지각한 수강생들 확인',
      '이번 달 늦은 학생들 태그',
    ],
  },

  'student.exec.bulk_register': {
    intent_key: 'student.exec.bulk_register',
    description: '학생 일괄 등록 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.bulk_register', // Domain Action Catalog
    paramsSchema: z.object({
      rows: z.array(z.record(z.unknown())),
    }),
    taskcard: {
      task_type: 'new_signup',
      trigger: 'student',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_register',
    },
    examples: [
      '학생 일괄 등록해줘',
      '원생들 한꺼번에 등록하기',
      '수강생들 등록하기',
      '회원 일괄 등록 요청',
      '이번 주에 등록할 대상들',
      '대상 일괄 등록 실행해',
      '모든 학생 등록하기',
      '한 번에 수강생 등록해줘',
    ],
  },

  'student.exec.bulk_update': {
    intent_key: 'student.exec.bulk_update',
    description: '학생 일괄 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.bulk_update', // Domain Action Catalog
    paramsSchema: z.object({
      updates: z.array(
        z.object({
          student_id: z.string().uuid(),
          patch: z.record(z.unknown()),
        })
      ),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'student',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_update_student',
    },
    examples: [
      '지각한 학생 일괄 수정해줘',
      '이번 주 지각자들 업데이트 할게',
      '지각학생 일괄 수정',
      '오늘 늦게 온 애들 수정해',
      '늦은 학생 목록 한 번에 고치기',
      '지각한 원생들 한꺼번에 업데이트',
      '이번 주 지각자들 수정해줘',
      '지각한 수강생들 한 번에 수정하기',
    ],
  },

  'student.exec.data_quality_apply_fix': {
    intent_key: 'student.exec.data_quality_apply_fix',
    description: '데이터 품질 자동 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.data_quality_apply_fix', // Domain Action Catalog
    paramsSchema: z.object({
      job_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'student',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'data_quality_apply_fix',
    },
    examples: [
      '데이터 품질 자동 수정 실행해줘',
      '지금 데이터 품질 수정해',
      '데이터 품질 문제 해결해줘',
      '데이터 품질 체크하고 수정 부탁해',
      '수정할 데이터 품질 실행해줘',
      '지금 데이터 품질 자동으로 고쳐줘',
      '데이터 품질 문제 해결할 수 있어?',
      '데이터 품질 자동 수정 시작해',
    ],
  },

  'student.exec.reactivate_from_discharged': {
    intent_key: 'student.exec.reactivate_from_discharged',
    description: '퇴원 학생 재활성화 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'student.reactivate_from_discharged', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'student',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'reactivate',
    },
    examples: [
      '퇴원한 학생 재활성화 해줘',
      '대상 다시 활성화 시켜줘',
      '재활성화할 원생 목록 보여줘',
      '퇴원한 애들 다시 등록할 수 있게 해줘',
      '지금 퇴원한 수강생들 재활성화',
      '퇴원자 복원 부탁해',
      '재활성화 대상 조회해줘',
      '이번 달 퇴원한 회원 재활성화 요청',
    ],
  },

  // 반/수업/시간표(Class/Schedule) 도메인 - L0 조회 Intent
  'class.query.list': {
    intent_key: 'class.query.list',
    description: '수업 목록 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      active_only: z.boolean().optional(),
    }),
    responseSchema: z.object({
      classes: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          teacher_name: z.string().optional(),
          student_count: z.number(),
          status: z.string(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'class_list',
    },
    examples: [
      '지각한 대상 목록',
      '오늘 지각한 원생 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 회원 리스트',
      '지각학생조회',
      '지각한 수강생 리스트',
      '늦은 학생들 확인해줘',
      '어제 지각한 사람들',
    ],
  },

  'class.query.roster': {
    intent_key: 'class.query.roster',
    description: '반 명단 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      date: z.string().optional(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      students: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          status: z.string(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'class_roster',
    },
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들 목록',
      '이번 주 지각자 확인',
      '지각한 원생 리스트',
      '이번 수업에 늦은 수강생',
      '지각한 대상 명단',
    ],
  },

  'schedule.query.today': {
    intent_key: 'schedule.query.today',
    description: '오늘 시간표 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      sessions: z.array(
        z.object({
          id: z.string().uuid(),
          class_id: z.string().uuid(),
          class_name: z.string(),
          starts_at: z.string(), // ISO 8601 형식
          ends_at: z.string(), // ISO 8601 형식
          room: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_today',
    },
    examples: [
      '오늘 시간표 알아봐',
      '오늘 수업 일정 뭐야?',
      '지금 시간표 보여줘',
      '오늘의 수업 리스트',
      '오늘의 강의 확인',
      '오늘 수업이 어떻게 되지?',
      '오늘 강의 일정 알려줘',
      '오늘의 수업 내용',
    ],
  },

  'schedule.query.by_teacher': {
    intent_key: 'schedule.query.by_teacher',
    description: '강사별 시간표 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      teacher_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      sessions: z.array(
        z.object({
          id: z.string().uuid(),
          class_id: z.string().uuid(),
          class_name: z.string(),
          starts_at: z.string(), // ISO 8601 형식
          ends_at: z.string(), // ISO 8601 형식
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'teacher',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_by_teacher',
    },
    examples: [
      '강사별 시간표 확인해줘',
      '이번 주 강사 스케줄 보여줘',
      '선생님 시간표 조회할게',
      '강사 A의 수업 일정은?',
      '강사 B의 오늘 스케줄 알려줘',
      '이번 달 강사별 시간표',
      '선생님 수업 시간 언제야?',
      '강사별로 수업 시간표 정리해줘',
    ],
  },

  'schedule.query.by_class': {
    intent_key: 'schedule.query.by_class',
    description: '수업별 시간표 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      sessions: z.array(
        z.object({
          id: z.string().uuid(),
          starts_at: z.string(), // ISO 8601 형식
          ends_at: z.string(), // ISO 8601 형식
          room: z.string().optional(),
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_by_class',
    },
    examples: [
      '오늘 수업 시간표 조회',
      '이번 주 수업별 일정 보여줘',
      '수업별 시간표 확인해줘',
      '이번 주 수업 내용 알려줘',
      '오늘 수업 시간표는?',
      '각 수업 시간표는 어떻게 되나요?',
      '내 수업 시간표 확인하고 싶어',
      '이번 주 수업별 일정 리스트',
    ],
  },

  'schedule.query.export_timetable': {
    intent_key: 'schedule.query.export_timetable',
    description: '시간표 내보내기',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      download_url: z.string().url(),
      expires_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_export_timetable',
    },
    examples: [
      '시간표 내보내기',
      '시간표를 엑셀로 저장해줘',
      '시간표 출력할 수 있어?',
      '내 시간표를 다운받고 싶어',
      '이번 주 시간표 내보내기',
      '내가 만든 시간표 엑셀로 변환해',
      '시간표 파일로 받을 수 있나?',
      '수업 일정 내보내기',
    ],
  },

  // 반/수업/시간표(Class/Schedule) 도메인 - L1 업무화 Intent
  'schedule.task.propose_makeup_session': {
    intent_key: 'schedule.task.propose_makeup_session',
    description: '보강 수업 제안 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      reason: z.string(),
      candidate_slots: z.array(z.string()), // ISO 8601 형식 배열
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM',
      subtype: 'makeup_proposal',
    },
    examples: [
      '보강 수업 제안해주세요',
      '지각한 수강생에게 보강 수업 알림',
      '오늘 지각한 대상들 보강 수업 제안',
      '늦은 회원들한테 보강 수업 제안해줘',
      '이번 주 지각자 목록에서 보강 수업 제안',
      '지각학생 보강 수업 하자',
      '늦게 온 원생들 보강 수업 제안해',
      '지각한 애들 보강 수업 만들어줘',
    ],
  },

  // 반/수업/시간표(Class/Schedule) 도메인 - L2-A 실행 Intent
  'schedule.exec.notify_change': {
    intent_key: 'schedule.exec.notify_change',
    description: '시간표 변경 안내 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'class_change_or_cancel',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      session_id: z.string().uuid().optional(),
      channel: z.enum(['sms', 'kakao', 'email']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'notify_schedule_change',
    },
    examples: [
      '시간표 변경사항 알려줘',
      '이번 주 수업 변경된 거 있나요?',
      '시간표 바뀐 거 공지해줘',
      '변경된 시간표 확인',
      '새로운 시간표 내용 궁금해',
      '최근 시간표 변경사항',
      '시간표 변경된 부분 좀 알려줘',
      '오늘 수업 시간 바뀐 거 있어?',
    ],
  },

  // 반/수업/시간표(Class/Schedule) 도메인 - L2-B 실행 Intent
  'class.exec.create': {
    intent_key: 'class.exec.create',
    description: '반 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'class.create', // Domain Action Catalog
    paramsSchema: z.object({
      name: z.string(),
      teacher_id: z.string().uuid().optional(),
      grade: z.string().optional(),
      capacity: z.number().int().positive().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'class',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'class_create',
    },
    examples: [
      '반 생성해줘',
      '새로운 반 만들어',
      '반생성',
      '이번 학기 수강생 반 생성',
      '새 반 등록 부탁해',
      '원생 그룹 생성',
      '수강생 반 만들기',
      '회원 반 추가',
    ],
  },

  'class.exec.update': {
    intent_key: 'class.exec.update',
    description: '반 정보 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'class.update', // Domain Action Catalog
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      patch: z.record(z.unknown()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'class',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'class_update',
    },
    examples: [
      '지각한 학생 목록 업데이트',
      '오늘 지각한 원생들 보여줘',
      '이번 주 지각자 수정해줘',
      '지각학생정보 수정할래',
      '늦게 온 대상 수정하기',
      '지각자 리스트 변경해줘',
      '이번 주 지각한 애들 리스트',
      '지각한 수강생 조회해',
    ],
  },

  'class.exec.close': {
    intent_key: 'class.exec.close',
    description: '반 폐쇄 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'class.close', // Domain Action Catalog
    paramsSchema: z.object({
      class_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'class',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'class_close',
    },
    examples: [
      '지각학생 조회',
      '지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자',
      '오늘 지각한 학생',
      '지각한 수강생 리스트',
      '늦은 대상 목록',
    ],
  },

  'schedule.exec.add_session': {
    intent_key: 'schedule.exec.add_session',
    description: '수업 세션 추가 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'schedule.add_session', // Domain Action Catalog
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      starts_at: z.string(), // ISO 8601 형식
      ends_at: z.string(), // ISO 8601 형식
      room: z.string().optional(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'add_session',
    },
    examples: [
      '수업 세션 추가해줘',
      '새로운 강의 세션 만들어줘',
      '오늘 수업 추가할게',
      '다음 주 수업 등록해',
      '세션 추가하려고 하는데',
      '새로운 수업을 추가해줘',
      '수업 시간 정해줘',
      '강의 세션 추가하기',
    ],
  },

  'schedule.exec.move_session': {
    intent_key: 'schedule.exec.move_session',
    description: '수업 세션 이동 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'schedule.move_session', // Domain Action Catalog
    paramsSchema: z.object({
      session_id: z.string().uuid(),
      new_starts_at: z.string(), // ISO 8601 형식
      new_ends_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'move_session',
    },
    examples: [
      '수업 세션 이동해줘',
      '세션 옮기는 방법 알려줘',
      '이 수업 일정 변경할래',
      '다음 주 수업 일정 바꿔줘',
      '이번 주 세션 이동 요청',
      '원생 수업 시간 조정해',
      '수업 시간 이동하고 싶은데',
      '회원 세션 옮기는 법 알려줄래?',
    ],
  },

  'schedule.exec.cancel_session': {
    intent_key: 'schedule.exec.cancel_session',
    description: '수업 세션 취소 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'schedule.cancel_session', // Domain Action Catalog
    paramsSchema: z.object({
      session_id: z.string().uuid(),
      reason: z.string().optional(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'cancel_session',
    },
    examples: [
      '수업 세션 취소해줘',
      '이번 주 수업 없애줘',
      '세션 삭제 부탁해',
      '오늘 수업 취소할 수 있어?',
      '지금 예정된 수업을 취소하고 싶어',
      '다음 주 수업을 없애줘',
      '수업 세션 취소할게',
      '수업 일정 변경해줘',
    ],
  },

  'class.exec.bulk_reassign_teacher': {
    intent_key: 'class.exec.bulk_reassign_teacher',
    description: '강사 일괄 재배정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'class.bulk_reassign_teacher', // Domain Action Catalog
    paramsSchema: z.object({
      class_ids: z.array(z.string().uuid()),
      teacher_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'class',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_reassign_teacher',
    },
    examples: [
      '강사 재배정 해줘',
      '선생님들 일괄로 바꾸기',
      '교사 재배정 실행',
      '강사 한꺼번에 변경',
      '모든 강사 재배정 요청',
      '강사 교체할게요',
      '재배정할 강사 목록 보여줘',
      '강사들 일괄 재배정해줘',
    ],
  },

  'schedule.exec.bulk_shift': {
    intent_key: 'schedule.exec.bulk_shift',
    description: '시간표 일괄 이동 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'schedule.bulk_shift', // Domain Action Catalog
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      shift_minutes: z.number().int(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'schedule',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_shift',
    },
    examples: [
      '시간표 일괄 이동해줘',
      '시간표 옮기기 해줘',
      '이번 주 수업 시간 변경',
      '수업 시간표 조정 부탁해',
      '시간표 이동 요청',
      '시간표 변경해줘',
      '모든 수업 시간 일괄 변경',
      '시간표 일괄 수정해줘',
    ],
  },

  // 상담/학습/메모 + AI(Notes/AI) 도메인 - L0 조회/초안 Intent
  'note.query.by_student': {
    intent_key: 'note.query.by_student',
    description: '학생별 상담일지 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      notes: z.array(
        z.object({
          id: z.string().uuid(),
          type: z.string(),
          content: z.string(),
          created_at: z.string(), // ISO 8601 형식
        })
      ),
      total_count: z.number(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'note_by_student',
    },
    examples: [
      '오늘 상담일지 확인해줘',
      '상담일지 조회할 대상 알려줘',
      '이번 달 상담한 원생 리스트',
      '상담일지: 늦게 온 수강생',
      '지각한 회원들 목록 보여줘',
      '지각학생 목록 확인',
      '최근 상담한 대상들',
      '이번 주 상담받은 애들',
    ],
  },

  'note.draft.consult_summary': {
    intent_key: 'note.draft.consult_summary',
    description: '상담 요약 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      note_id: z.string().uuid(),
      format: z.enum(['bullets', 'short', 'detailed']),
    }),
    responseSchema: z.object({
      summary: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'note_consult_summary',
    },
    examples: [
      '상담 요약 초안 작성해줘',
      '상담 내용을 정리해줘',
      '이번 상담의 요약 필요해',
      '상담 요약 초안 만들기',
      '상담한 내용 간단히 정리해줘',
      '상담 결과 요약해줘',
      '상담 내용 요약해',
      '상담 요약서 작성 부탁해',
    ],
  },

  'ai.summarize.student_history': {
    intent_key: 'ai.summarize.student_history',
    description: '학생 이력 요약',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      summary: z.object({
        attendance_summary: z.string(),
        billing_summary: z.string(),
        notes_summary: z.string(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'ai_summarize_student',
    },
    examples: [
      '지각한 학생 조회',
      '오늘 지각한 애들 보여줘',
      '지각학생조회',
      '늦게 온 사람들',
      '이번 주 지각자 확인해줘',
      '지각한 원생 리스트',
      '지각한 수강생 정보',
      '이번 달 지각자 목록',
    ],
  },

  'ai.generate.followup_message': {
    intent_key: 'ai.generate.followup_message',
    description: '후속 메시지 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      reason: z.string(),
      tone: z.enum(['formal', 'friendly', 'casual']).optional(),
    }),
    responseSchema: z.object({
      message: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'ai_followup_message',
    },
    examples: [
      '오늘 지각한 대상 조회해줘',
      '이번 주 지각자 리스트 보여줘',
      '지각한 원생 목록 확인해',
      '늦은 학생들 알려줘',
      '지각학생조회 해줘',
      '이번 달 지각한 수강생들',
      '늦게 온 애들 리스트',
      '오늘 지각한 회원들 보여줘',
    ],
  },

  'ai.summarize.class_history': {
    intent_key: 'ai.summarize.class_history',
    description: '반 이력 요약',
    automation_level: 'L0',
    paramsSchema: z.object({
      class_id: z.string().uuid(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      summary: z.object({
        attendance_summary: z.string(),
        performance_summary: z.string(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'class',
      window: 'YYYY-MM-DD',
      subtype: 'ai_summarize_class',
    },
    examples: [
      '지각한 학생 목록',
      '오늘 지각한 원생 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 애들 리스트',
      '지각학생조회',
      '지각한 회원 확인해줘',
      '오늘 지각한 대상',
      '지각한 수강생들 리스트',
    ],
  },

  'ai.generate.counseling_agenda': {
    intent_key: 'ai.generate.counseling_agenda',
    description: '상담 안건 초안 생성',
    automation_level: 'L0',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
    }),
    responseSchema: z.object({
      agenda: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'ai_counseling_agenda',
    },
    examples: [
      '상담 안건 초안 만들어줘',
      '상담할 내용 정리해줘',
      '이번 주 상담 안건 리스트',
      '상담 주제 아이디어 있어?',
      '다음 상담 안건 작성해',
      '상담할 사항들 정리해줘',
      '상담 계획서 초안 작성',
      '상담 안건 리스트 보여줘',
    ],
  },

  'ai.query.export_ai_briefing': {
    intent_key: 'ai.query.export_ai_briefing',
    description: 'AI 브리핑 내보내기',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      download_url: z.string().url(),
      expires_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'ai_export_briefing',
    },
    examples: [
      'AI 브리핑 내보내줘',
      'AI briefing export 해줘',
      'AI 브리핑 자료 출력 부탁해',
      'AI 브리핑 결과를 내보내고 싶어',
      'AI 브리핑 파일 만들어줘',
      'AI 브리핑 내보내기',
      'AI 관련 자료를 export 해줘',
      'AI 브리핑 정보 출력해줘',
    ],
  },

  // 상담/학습/메모 + AI(Notes/AI) 도메인 - L1 업무화 Intent
  'ai.task.flag_risk_signals': {
    intent_key: 'ai.task.flag_risk_signals',
    description: '위험 신호 플래깅 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      signals: z.array(z.enum(['attendance', 'billing', 'behavior'])),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'ai',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'risk_signals',
    },
    examples: [
      '위험 신호 플래깅 해줘',
      '위험 신호가 있는 원생 목록 보여줘',
      '위험신호플래그',
      '위험 신호 플래깅할 대상',
      '오늘 위험 신호 있는 수강생',
      '이번 주 위험 신호 확인',
      '위험 신호 플래그링 해줄래?',
      '위험 신호가 있는 회원 목록',
    ],
  },

  'ai.task.create_recommendations': {
    intent_key: 'ai.task.create_recommendations',
    description: '일일 추천 생성 TaskCard',
    automation_level: 'L1',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'ai',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'daily_recommendations',
    },
    examples: [
      '오늘 추천 목록 생성',
      '추천 카드 만들어줘',
      '추천목록생성',
      '이번 주 추천 사항',
      '추천 리스트 작성해',
      '추천할 내용 보여줘',
      '내일의 추천 생성',
      '오늘의 추천 리스트',
    ],
  },

  'ai.task.bulk_generate_taskcards': {
    intent_key: 'ai.task.bulk_generate_taskcards',
    description: 'TaskCard 일괄 생성 TaskCard',
    automation_level: 'L1',
    paramsSchema: z.object({
      job_id: z.string().uuid(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'ai',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'bulk_generate_taskcards',
    },
    examples: [
      '일괄로 TaskCard 생성해줘',
      'TaskCard를 한꺼번에 만들어줄래?',
      'TaskCard 일괄 생성',
      '모든 대상에 대한 TaskCard 생성하기',
      '이번 달 과제 카드 한 번에 만들어줘',
      '수강생들의 TaskCard를 일괄적으로 생성해줘',
      '회원들 TaskCard 일괄로 생성',
      '대상별 TaskCard 한 번에 만들기',
    ],
  },

  // 상담/학습/메모 + AI(Notes/AI) 도메인 - L2-A 실행 Intent
  'ai.exec.request_staff_review': {
    intent_key: 'ai.exec.request_staff_review',
    description: '직원 검토 요청 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'consultation_summary_ready',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      topic: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'ai',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'staff_review',
    },
    examples: [
      '지각한 직원 목록 요청',
      '오늘 지각한 원생 보여줘',
      '이번 주 늦은 회원 리스트',
      '지각자 조회해줘',
      '늦게 온 대상 확인',
      '이번 달 지각자 목록',
      '지각한 수강생 리스트 부탁해',
      '오늘 지각한 애들 리스트',
    ],
  },

  'ai.exec.escalate_emergency': {
    intent_key: 'ai.exec.escalate_emergency',
    description: '긴급 에스컬레이션 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'announcement_urgent',
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      reason: z.string(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'ai',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'emergency_escalation',
    },
    examples: [
      '긴급 상황 에스컬레이션 실행해줘',
      '지금 즉시 에스컬레이션 해줘',
      '긴급 에스컬레이션 요청',
      '빨리 긴급 상황으로 올려줘',
      '지금 당장 에스컬레이션 부탁해',
      '긴급한 상황이니 에스컬레이션 해줘',
      '긴급 에스컬레이션 진행해',
      '즉시 에스컬레이션 실행해줘',
    ],
  },

  // 상담/학습/메모 + AI(Notes/AI) 도메인 - L2-B 실행 Intent
  'note.exec.create': {
    intent_key: 'note.exec.create',
    description: '상담일지 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'note.create', // Domain Action Catalog
    paramsSchema: z.object({
      student_id: z.string().uuid(),
      type: z.string(),
      content: z.string(),
    }),
    taskcard: {
      task_type: 'counseling',
      trigger: 'note',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'note_create',
    },
    examples: [
      '상담일지 작성해줘',
      '오늘 상담한 내용 기록하기',
      '상담일지 생성',
      '이번 주 상담한 대상 리스트',
      '상담 내용 추가할래',
      '상담일지 작성할게',
      '최근 상담한 원생들 기록',
      '상담일지 만들어줘',
    ],
  },

  'note.exec.update': {
    intent_key: 'note.exec.update',
    description: '상담일지 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'note.update', // Domain Action Catalog
    paramsSchema: z.object({
      note_id: z.string().uuid(),
      patch: z.record(z.unknown()),
    }),
    taskcard: {
      task_type: 'counseling',
      trigger: 'note',
      entity_type: 'student',
      window: 'YYYY-MM-DD',
      subtype: 'note_update',
    },
    examples: [
      '상담일지 수정해줘',
      '상담 내용 바꿔줄래?',
      '상담일지 업데이트',
      '상담기록 수정하기',
      '상담일지 내용 변경',
      '상담일지 다시 작성할게',
      '상담 내용 업데이트 해줘',
      '상담일지 수정 부탁해',
    ],
  },

  // 리포트/대시보드(Reports) 도메인 - L0 조회 Intent
  'report.query.dashboard_kpi': {
    intent_key: 'report.query.dashboard_kpi',
    description: '대시보드 KPI 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      kpi: z.object({
        total_students: z.number(),
        attendance_rate: z.number(),
        collection_rate: z.number(),
        revenue: z.number(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'report_dashboard_kpi',
    },
    examples: [
      'KPI 대시보드 확인해줘',
      '오늘의 성과 지표 보여줘',
      '이번 달 KPI 조회',
      '회원 KPI 현황 알려줘',
      '현재 학생들 KPI 상태는 어때?',
      '지금 원생들의 KPI 결과',
      '수강생 KPI 대시보드 좀 봐',
      '이번 주 KPI 분석해줘',
    ],
  },

  'report.query.attendance_summary': {
    intent_key: 'report.query.attendance_summary',
    description: '출결 요약 리포트 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      group_by: z.enum(['class', 'grade']).optional(),
    }),
    responseSchema: z.object({
      summary: z.object({
        total_days: z.number(),
        attendance_rate: z.number(),
        absent_count: z.number(),
        late_count: z.number(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'report_attendance_summary',
    },
    examples: [
      '오늘 출결 요약 리포트 보여줘',
      '이번 주 지각한 원생 리스트',
      '지각학생 조회해줘',
      '최근 지각한 대상 목록',
      '지각자 요약 리포트',
      '늦은 수강생들 정보',
      '지각한 애들 리스트',
      '오늘 늦게 온 회원들',
    ],
  },

  'report.query.billing_summary': {
    intent_key: 'report.query.billing_summary',
    description: '수납 요약 리포트 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      group_by: z.enum(['class', 'grade']).optional(),
    }),
    responseSchema: z.object({
      summary: z.object({
        total_revenue: z.number(),
        collection_rate: z.number(),
        overdue_amount: z.number(),
        paid_count: z.number(),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'report_billing_summary',
    },
    examples: [
      '수납 요약 리포트 보여줘',
      '오늘의 수납 요약은?',
      '이번 달 수납 내역 조회',
      '수납요약리포트',
      '회원 수납 현황 알려줘',
      '지난 주 수납 요약 리포트',
      '지금까지의 수납 내역 확인해줘',
      '원생 수납 상황 좀 보여줘',
    ],
  },

  'report.query.export_dataset': {
    intent_key: 'report.query.export_dataset',
    description: '데이터셋 내보내기',
    automation_level: 'L0',
    paramsSchema: z.object({
      dataset: z.string(),
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
      format: z.enum(['csv', 'excel', 'json']),
    }),
    responseSchema: z.object({
      download_url: z.string().url(),
      expires_at: z.string(), // ISO 8601 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'report_export_dataset',
    },
    examples: [
      '데이터셋 내보내기',
      '학생 데이터 내보내고 싶어',
      '내보낼 데이터셋 선택해줘',
      '원생 데이터 내보내기',
      '이번 주 수강생 목록 내보내기',
      '회원 데이터셋 export 해줘',
      '수강생 정보 내보내기',
      '대상 데이터 내보내기 요청',
    ],
  },

  'report.query.health_snapshot': {
    intent_key: 'report.query.health_snapshot',
    description: '헬스 스냅샷 조회',
    automation_level: 'L0',
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
    }),
    responseSchema: z.object({
      snapshot: z.object({
        system_health: z.string(),
        data_quality: z.string(),
        performance_metrics: z.record(z.number()),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'report_health_snapshot',
    },
    examples: [
      '헬스 스냅샷 조회',
      '내 헬스 상태 보여줘',
      '헬스 스냅샷 확인해',
      '현재 건강 상태',
      '오늘의 헬스 스냅샷',
      '최근 헬스 데이터',
      '회원 헬스 스냅샷',
      '원생 건강 상태 조회',
    ],
  },

  // 리포트/대시보드(Reports) 도메인 - L1 업무화 Intent
  'report.task.prepare_monthly_report': {
    intent_key: 'report.task.prepare_monthly_report',
    description: '월간 리포트 준비 TaskCard 생성',
    automation_level: 'L1',
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      sections: z.array(z.string()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'report',
      entity_type: 'report',
      window: 'YYYY-MM',
      subtype: 'monthly_report_prepare',
    },
    examples: [
      '이번 달 리포트 준비해줘',
      '월간 리포트 생성해',
      '이번 달 리포트 만들기',
      '월간 보고서 작성 부탁해',
      '이번 달 수강생 현황 리포트',
      '이번 달의 회원 리포트 준비',
      '이번 달 대상 통계 보고서',
      '월간 리포트 자동으로 만들어줘',
    ],
  },

  // 리포트/대시보드(Reports) 도메인 - L2-A 실행 Intent
  'report.exec.send_report': {
    intent_key: 'report.exec.send_report',
    description: '리포트 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'monthly_business_report',
    paramsSchema: z.object({
      report_id: z.string().uuid(),
      recipients: z.array(z.string().uuid()),
      channel: z.enum(['sms', 'kakao', 'email']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'report',
      entity_type: 'report',
      window: 'YYYY-MM-DD',
      subtype: 'send_report',
    },
    examples: [
      '오늘 지각한 원생 목록 보내줘',
      '이번 주 지각자 리포트 실행해',
      '지각한 학생들 리스트 보여줘',
      '지각자 조회해줘',
      '늦게 온 회원들 리포트 발송',
      '이번 달 지각학생들 정보 요청',
      '지각학생조회 해주세요',
      '늦은 수강생 명단 보내줘',
    ],
  },

  'report.exec.schedule_monthly_report': {
    intent_key: 'report.exec.schedule_monthly_report',
    description: '월간 리포트 예약 발송 실행',
    automation_level: 'L2',
    execution_class: 'A',
    event_type: 'monthly_business_report',
    paramsSchema: z.object({
      day_of_month: z.number().int().min(1).max(28),
      recipients: z.array(z.string().uuid()),
      channel: z.enum(['sms', 'kakao', 'email']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'report',
      entity_type: 'report',
      window: 'YYYY-MM',
      subtype: 'schedule_monthly_report',
    },
    examples: [
      '월간 리포트 발송해줘',
      '이번 달 리포트 보내줘',
      '매월 리포트 예약 실행',
      '이번 달 리포트 확인하고 보내',
      '다음 주 월간 리포트 실행해',
      '이번 달의 리포트 자동으로 보내줘',
      '월간 리포트 예약 발송 부탁해',
      '이번 달 리포트 진행해줘',
    ],
  },

  // 리포트/대시보드(Reports) 도메인 - L2-B 실행 Intent
  'report.exec.generate_monthly_report': {
    intent_key: 'report.exec.generate_monthly_report',
    description: '월간 리포트 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'report.generate_monthly_report', // Domain Action Catalog
    paramsSchema: z.object({
      month: z.string(), // YYYY-MM 형식
      sections: z.array(z.string()),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'report',
      entity_type: 'report',
      window: 'YYYY-MM',
      subtype: 'monthly_report_generate',
    },
    examples: [
      '이번 달 리포트 생성해줘',
      '월간 리포트 만들어줘',
      '이번 달 수강생 리포트',
      '최근 한 달간 회원 리포트',
      '이번 달 대상에 대한 리포트',
      '월간 보고서 생성 부탁해',
      '이달 수강생 통계 리포트',
      '지난 달 회원 리포트 생성',
    ],
  },

  'report.exec.generate_daily_brief': {
    intent_key: 'report.exec.generate_daily_brief',
    description: '일일 브리핑 생성 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'report.generate_daily_brief', // Domain Action Catalog
    paramsSchema: z.object({
      date: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'report',
      entity_type: 'report',
      window: 'YYYY-MM-DD',
      subtype: 'daily_brief_generate',
    },
    examples: [
      '오늘 지각한 수강생 목록 생성해줘',
      '늦게 온 회원들 브리핑 해줘',
      '지각자 리스트 보여줘',
      '이번 주 지각한 대상 보고서 작성해',
      '지각한 애들 오늘 브리핑하자',
      '지각학생조회 해줘',
      '오늘 지각한 원생 리스트 만들어줘',
      '늦은 학생들 정보 업데이트 해줘',
    ],
  },

  // 정책/권한/시스템(System) 도메인 - L0 조회 Intent
  'rbac.query.my_permissions': {
    intent_key: 'rbac.query.my_permissions',
    description: '내 권한 조회',
    automation_level: 'L0',
    paramsSchema: z.object({}),
    responseSchema: z.object({
      permissions: z.array(z.string()),
      role: z.string(),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'rbac_my_permissions',
    },
    examples: [
      '내 권한이 뭐야?',
      '내가 가진 권한 조회해줘',
      '내 권한 리스트 보여줘',
      '지금 내 권한 상태가 궁금해',
      '현재 내 권한은 어떻게 되지?',
      '내 권한 확인할 수 있을까?',
      '내가 어떤 권한이 있는지 알고 싶어',
      '내 권한 목록 좀 보여줘',
    ],
  },

  'policy.query.automation_rules': {
    intent_key: 'policy.query.automation_rules',
    description: '자동화 규칙 조회',
    automation_level: 'L0',
    paramsSchema: z.object({}),
    responseSchema: z.object({
      rules: z.array(
        z.object({
          event_type: z.string(),
          enabled: z.boolean(),
          threshold: z.record(z.unknown()).optional(),
        })
      ),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'policy_automation_rules',
    },
    examples: [
      '자동화 규칙 확인해줘',
      '자동화 룰 좀 보여줘',
      '자동화 규칙 리스트',
      '현재 설정된 자동화 규칙',
      '자동화 룰 조회해',
      '자동화 규칙 목록 어떤 게 있어?',
      '지금 적용된 자동화 규칙',
      '자동화 규칙들 다 볼 수 있을까?',
    ],
  },

  'system.query.health': {
    intent_key: 'system.query.health',
    description: '시스템 헬스 체크',
    automation_level: 'L0',
    paramsSchema: z.object({
      checks: z.array(z.string()).optional(),
    }),
    responseSchema: z.object({
      health: z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy']),
        checks: z.record(z.enum(['ok', 'warning', 'error'])),
      }),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'chatops_query',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'system_health',
    },
    examples: [
      '지각한 대상 조회',
      '오늘 지각한 원생들 보여줘',
      '이번 주 늦은 학생 목록',
      '늦게 온 회원들 확인해줘',
      '지각학생조회',
      '이번 주 지각자 리스트',
      '오늘 지각한 수강생들',
      '지각한 애들 리스트업',
    ],
  },

  // 정책/권한/시스템(System) 도메인 - L2-B 실행 Intent
  'policy.exec.enable_automation': {
    intent_key: 'policy.exec.enable_automation',
    description: '자동화 활성화 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'policy.enable_automation', // Domain Action Catalog
    paramsSchema: z.object({
      event_type: z.string(),
      enabled: z.boolean(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM',
      subtype: 'policy_enable',
    },
    examples: [
      '자동화 활성화 해줘',
      '자동화 켜줘',
      '자동화 기능 사용 시작',
      '지각 학생들을 자동으로 관리해',
      '오늘 지각한 대상을 자동으로 처리해',
      '이번 주 지각자 자동으로 활성화',
      '지각한 원생 목록 자동으로 보여줘',
      '지각자 자동 조회 시작',
    ],
  },

  'policy.exec.update_threshold': {
    intent_key: 'policy.exec.update_threshold',
    description: '정책 임계값 수정 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'policy.update_threshold', // Domain Action Catalog
    paramsSchema: z.object({
      event_type: z.string(),
      key: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'policy_threshold_update',
    },
    examples: [
      '정책 임계값을 수정해줘',
      '현재 설정된 임계값 변경할 수 있어?',
      '임계값 업데이트 부탁해',
      '기존 임계값을 고쳐줘',
      '임계값 수정해주세요',
      '새로운 임계값으로 바꿔줘',
      '지금 임계값을 변경하고 싶어',
      '정책의 임계값을 수정해줘',
    ],
  },

  'rbac.exec.assign_role': {
    intent_key: 'rbac.exec.assign_role',
    description: '역할 할당 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'rbac.assign_role', // Domain Action Catalog
    paramsSchema: z.object({
      user_id: z.string().uuid(),
      role: z.string(),
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'assign_role',
    },
    examples: [
      '오늘 지각한 대상 목록 보여줘',
      '이번 주 지각자 조회',
      '늦게 온 수강생 리스트',
      '지각한 원생 조회해줘',
      '이번 달 지각한 애들',
      '지각학생조회 실행해',
      '늦은 회원들 리스트',
      '이번 주에 지각한 사람들 확인',
    ],
  },

  'system.exec.run_healthcheck': {
    intent_key: 'system.exec.run_healthcheck',
    description: '헬스체크 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'system.run_healthcheck', // Domain Action Catalog
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'run_healthcheck',
    },
    examples: [
      '헬스체크 실행해줘',
      '오늘의 건강 상태 점검해',
      '현재 시스템 헬스체크 부탁',
      '시스템 상태 확인해줘',
      '헬스체크 실행하기',
      '지금 헬스체크 돌려줘',
      '시스템 점검 시작해',
      '헬스체크 결과 보여줘',
    ],
  },

  'system.exec.rebuild_search_index': {
    intent_key: 'system.exec.rebuild_search_index',
    description: '검색 인덱스 재구축 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'system.rebuild_search_index', // Domain Action Catalog
    paramsSchema: z.object({}),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'rebuild_index',
    },
    examples: [
      '검색 인덱스 재구축해줘',
      '인덱스 다시 만들어줘',
      '재구축 실행',
      '검색 인덱스 다시 설정',
      '인덱스 재구축 부탁해',
      '검색 인덱스 새로 고침',
      '인덱스 재구축하기',
      '검색 인덱스 업데이트 해줄래?',
    ],
  },

  'system.exec.backfill_reports': {
    intent_key: 'system.exec.backfill_reports',
    description: '리포트 백필 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'system.backfill_reports', // Domain Action Catalog
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'backfill_reports',
    },
    examples: [
      '리포트 백필 해줘',
      '리포트 데이터 채워줘',
      '백필 실행해줘',
      '리포트 재생성해줘',
      '과거 리포트 생성',
      '리포트 데이터 보완',
      '백필 작업 실행',
      '리포트 데이터 복구',
    ],
  },

  'system.exec.retry_failed_actions': {
    intent_key: 'system.exec.retry_failed_actions',
    description: '실패 액션 재시도 실행',
    automation_level: 'L2',
    execution_class: 'B',
    action_key: 'system.retry_failed_actions', // Domain Action Catalog
    paramsSchema: z.object({
      from: z.string(), // YYYY-MM-DD 형식
      to: z.string(), // YYYY-MM-DD 형식
    }),
    taskcard: {
      task_type: 'risk',
      trigger: 'system',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'retry_failed_actions',
    },
    examples: [
      '실패한 작업 다시 시도해줘',
      '실행 실패한 거 재시도',
      '실패한 액션 재실행',
      '작업이 실패했으니 다시 해줘',
      '실패한 작업들 다시 실행해',
      '업데이트 실패한 것들 재시도',
      '실패한 액션 다시 해보자',
      '실패한 요청 다시 시도해',
    ],
  },
};

/**
 * Intent Registry 조회 함수
 */
export function getIntent(intent_key: string): IntentRegistryItem | undefined {
  return intentRegistry[intent_key];
}

/**
 * 모든 Intent 목록 조회
 */
export function getAllIntents(): IntentRegistryItem[] {
  return Object.values(intentRegistry);
}

/**
 * Intent 존재 여부 확인
 */
export function hasIntent(intent_key: string): boolean {
  return intent_key in intentRegistry;
}

/**
 * L0 Intent 목록 조회
 */
export function getL0Intents(): IntentRegistryItem[] {
  return getAllIntents().filter((intent) => intent.automation_level === 'L0');
}

/**
 * L1 Intent 목록 조회
 */
export function getL1Intents(): IntentRegistryItem[] {
  return getAllIntents().filter((intent) => intent.automation_level === 'L1');
}

/**
 * L2 Intent 목록 조회
 */
export function getL2Intents(): IntentRegistryItem[] {
  return getAllIntents().filter((intent) => intent.automation_level === 'L2');
}

/**
 * L2-A Intent 목록 조회
 */
export function getL2AIntents(): IntentRegistryItem[] {
  return getL2Intents().filter((intent) => intent.execution_class === 'A');
}

/**
 * L2-B Intent 목록 조회
 */
export function getL2BIntents(): IntentRegistryItem[] {
  return getL2Intents().filter((intent) => intent.execution_class === 'B');
}

/**
 * Intent Registry 무결성 검증 (빌드타임 검증)
 *
 * [불변 규칙] L0 intent는 responseSchema 필수
 * [불변 규칙] L2 intent는 execution_class 필수
 * [불변 규칙] L2-A intent는 event_type 결정적 매핑 필수
 * [불변 규칙] L2-A intent의 event_type은 Event Catalog에 존재해야 함
 * [불변 규칙] L2-B intent는 action_key 필수
 * [불변 규칙] L2-B intent의 action_key는 Domain Action Catalog에 존재해야 함
 *
 * 이 함수는 빌드타임에 호출되어 Registry의 무결성을 보장합니다.
 * 런타임 오류를 방지하기 위해 모듈 로드 시점에 자동으로 실행됩니다.
 *
 * @throws Error Registry 무결성 검증 실패 시
 */
export function validateRegistryIntegrity(): void {
  const errors: string[] = [];
  const eventCatalogSet = new Set<string>(EVENT_CATALOG_FOR_VALIDATION);
  const domainActionCatalogSet = new Set<string>(DOMAIN_ACTION_CATALOG);

  for (const [intent_key, intent] of Object.entries(intentRegistry)) {
    // L0 Intent는 responseSchema 필수
    if (intent.automation_level === 'L0') {
      if (!intent.responseSchema) {
        errors.push(
          `Intent "${intent_key}": L0 Intent는 responseSchema가 필수입니다. (불변 규칙: "L0 intent는 responseSchema 필수")`
        );
      }
    }

    // L2 Intent는 execution_class 필수
    if (intent.automation_level === 'L2') {
      if (!intent.execution_class) {
        errors.push(
          `Intent "${intent_key}": L2 Intent는 execution_class가 필수입니다. (불변 규칙: "L2 intent는 execution_class 필수")`
        );
      } else if (intent.execution_class === 'A') {
        // L2-A Intent는 event_type 또는 event_type_by_purpose 필수
        if (!intent.event_type && !intent.event_type_by_purpose) {
          errors.push(
            `Intent "${intent_key}": L2-A Intent는 event_type 또는 event_type_by_purpose가 필수입니다. (불변 규칙: "L2-A intent는 event_type 결정적 매핑 필수")`
          );
        } else {
          // event_type이 있는 경우 Event Catalog 검증
          if (intent.event_type) {
            if (!eventCatalogSet.has(intent.event_type)) {
              errors.push(
                `Intent "${intent_key}": event_type "${intent.event_type}"이 Event Catalog에 존재하지 않습니다. (불변 규칙: "L2-A intent의 event_type은 Event Catalog에 존재해야 함")`
              );
            }
          }
          // event_type_by_purpose가 있는 경우 모든 값이 Event Catalog에 존재하는지 검증
          if (intent.event_type_by_purpose) {
            const purposeValues = Object.values(intent.event_type_by_purpose);
            for (const eventType of purposeValues) {
              if (!eventCatalogSet.has(eventType)) {
                errors.push(
                  `Intent "${intent_key}": event_type_by_purpose의 event_type "${eventType}"이 Event Catalog에 존재하지 않습니다. (불변 규칙: "L2-A intent의 event_type은 Event Catalog에 존재해야 함")`
                );
              }
            }
          }
        }
      } else if (intent.execution_class === 'B') {
        // L2-B Intent는 event_type이 없어야 함
        if (intent.event_type) {
          errors.push(
            `Intent "${intent_key}": L2-B Intent는 event_type이 없어야 합니다. (불변 규칙: "L2-B intent는 Domain Action Catalog 사용")`
          );
        }
        // L2-B Intent는 action_key 필수
        if (!intent.action_key) {
          errors.push(
            `Intent "${intent_key}": L2-B Intent는 action_key가 필수입니다. (불변 규칙: "L2-B intent는 Domain Action Catalog의 action_key 필수")`
          );
        } else {
          // action_key가 Domain Action Catalog에 존재하는지 검증
          if (!domainActionCatalogSet.has(intent.action_key)) {
            errors.push(
              `Intent "${intent_key}": action_key "${intent.action_key}"이 Domain Action Catalog에 존재하지 않습니다. (불변 규칙: "L2-B intent의 action_key는 Domain Action Catalog에 존재해야 함")`
            );
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Intent Registry 무결성 검증 실패:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

// 빌드타임 검증 자동 실행 (모듈 로드 시점)
validateRegistryIntegrity();
