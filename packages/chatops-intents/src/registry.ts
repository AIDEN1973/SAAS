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
  },

  'attendance.query.by_class': {
    intent_key: 'attendance.query.by_class',
    description: '반별 출결 조회',
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
      message_purpose: z.enum(['announcement_urgent', 'announcement_digest', 'class_change_or_cancel']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'send_bulk',
    },
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
      message_purpose: z.enum(['announcement_urgent', 'announcement_digest', 'class_change_or_cancel']),
    }),
    taskcard: {
      task_type: 'ai_suggested',
      trigger: 'message',
      entity_type: 'tenant',
      window: 'YYYY-MM-DD',
      subtype: 'schedule_bulk',
    },
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
  },

  // 반/수업/시간표(Class/Schedule) 도메인 - L0 조회 Intent
  'class.query.list': {
    intent_key: 'class.query.list',
    description: '반 목록 조회',
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
  },

  'schedule.query.by_class': {
    intent_key: 'schedule.query.by_class',
    description: '반별 시간표 조회',
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

