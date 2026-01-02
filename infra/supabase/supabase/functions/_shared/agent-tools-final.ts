/**
 * Agent Tools - Final Design
 *
 * 147개 Intent → 15개 Tool로 통합
 * OpenAI Function Calling 기반
 */

export interface AgentTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * 15개 Agent Tools
 * 실무 필수 49개 Intent를 Tool로 통합
 */
export const AGENT_TOOLS: AgentTool[] = [
  // ========================================
  // 1. 학생 관리 (10개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'manage_student',
      description: '학생 관리',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'search',           // student.query.search
              'get_profile',      // student.query.profile
              'register',         // student.exec.register
              'update',           // student.exec.update_profile
              'update_contact',   // student.exec.update_guardian_contact
              'pause',            // student.exec.pause
              'resume',           // student.exec.resume
              'discharge',        // student.exec.discharge
              'change_class',     // student.exec.change_class
              'merge',            // student.exec.merge_duplicates
              'assign_tags',      // student.exec.assign_tags
            ],
            description: '수행할 작업',
          },
          student_name: {
            type: 'string',
            description: '학생 이름',
          },
          student_id: {
            type: 'string',
            description: '학생 ID (UUID, 선택)',
          },
          phone: {
            type: 'string',
            description: '학생 전화번호',
          },
          birth_date: {
            type: 'string',
            description: '생년월일 (YYYY-MM-DD 또는 YYYY.MM.DD 형식, register 시 필요)',
          },
          guardian_phone: {
            type: 'string',
            description: '보호자 전화번호 (register 시)',
          },
          address: {
            type: 'string',
            description: '주소 (선택)',
          },
          email: {
            type: 'string',
            description: '이메일 (선택)',
          },
          grade: {
            type: 'string',
            description: '학년 (선택)',
          },
          school_name: {
            type: 'string',
            description: '학교명 (선택)',
          },
          class_name: {
            type: 'string',
            description: '반 이름 (register, change_class 시)',
          },
          reason: {
            type: 'string',
            description: '사유 (discharge, pause 시)',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD, discharge, pause 시)',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: '태그 ID 목록 (assign_tags 시)',
          },
          tag_names: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: '태그 이름 목록 (assign_tags 시, tags 대신 사용 가능)',
          },
        },
        required: ['action'],
      },
    },
  },

  // ========================================
  // 2. 출결 조회 (5개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'query_attendance',
      description: '출결 조회',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'late',         // attendance.query.late
              'absent',       // attendance.query.absent
              'unchecked',    // attendance.query.unchecked
              'by_class',     // attendance.query.by_class
              'by_student',   // attendance.query.by_student
            ],
            description: '조회 유형',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD, 기본: 오늘)',
          },
          class_name: {
            type: 'string',
            description: '반 이름 (by_class 타입일 때)',
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (by_student 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 3. 출결 관리 (6개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'manage_attendance',
      description: '출결 관리',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'notify_absent',    // attendance.exec.notify_guardians_absent
              'notify_late',      // attendance.exec.notify_guardians_late
              'request_reason',   // attendance.exec.request_reason_message
              'correct',          // attendance.exec.correct_record
              'bulk_update',      // attendance.exec.bulk_update
              'mark_excused',     // attendance.exec.mark_excused
            ],
            description: '수행할 작업',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD)',
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (correct 시)',
          },
          status: {
            type: 'string',
            enum: ['present', 'late', 'absent', 'excused'],
            description: '출결 상태 (correct 시)',
          },
        },
        required: ['action'],
      },
    },
  },

  // ========================================
  // 4. 메시지 조회 (3개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'query_message',
      description: '메시지 조회',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'sent_log',      // message.query.sent_log
              'failed_log',    // message.query.failed_log
              'preview',       // message.preview.audience
            ],
            description: '조회 유형',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD)',
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (필터)',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 5. 메시지 발송 (8개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: '메시지 발송',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'single',           // message.exec.send_to_guardian
              'bulk',             // message.exec.send_bulk
              'scheduled',        // message.exec.schedule_bulk
              'resend_failed',    // message.exec.resend_failed
              'cancel_scheduled', // message.exec.cancel_scheduled
            ],
            description: '발송 유형',
          },
          recipient: {
            type: 'string',
            description: '수신자 (학생 이름, single 타입일 때)',
          },
          recipients: {
            type: 'array',
            items: { type: 'string' },
            description: '수신자 목록 (bulk 타입일 때)',
          },
          message: {
            type: 'string',
            description: '메시지 내용',
          },
          schedule_time: {
            type: 'string',
            description: '예약 시간 (YYYY-MM-DD HH:mm, scheduled 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 6. 메시지 초안 (3개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'draft_message',
      description: '메시지 초안 작성',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'general',    // message.draft.general_notice
              'absence',    // message.draft.absence_notice
              'overdue',    // message.draft.overdue_notice
            ],
            description: '초안 유형',
          },
          target: {
            type: 'string',
            description: '대상 (학생 이름, 반 이름, 또는 "전체")',
          },
          content: {
            type: 'string',
            description: '메시지 내용',
          },
        },
        required: ['type', 'target'],
      },
    },
  },

  // ========================================
  // 7. 수납 조회 (5개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'query_billing',
      description: '수납 조회',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'overdue_list',      // billing.query.overdue_list
              'invoice_status',    // billing.query.invoice_status
              'unissued',          // billing.query.unissued_invoices
              'by_student',        // billing.query.by_student
            ],
            description: '조회 유형',
          },
          month: {
            type: 'string',
            description: '월 (YYYY-MM)',
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (by_student 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 8. 수납 처리 (4개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'manage_billing',
      description: '수납 처리',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'issue_invoice',       // billing.exec.issue_invoices
              'send_payment_link',   // billing.exec.send_payment_link
              'schedule_notice',     // billing.exec.schedule_overdue_notice
              'record_payment',      // billing.exec.record_manual_payment
            ],
            description: '수행할 작업',
          },
          month: {
            type: 'string',
            description: '월 (YYYY-MM, issue_invoice 시)',
          },
          student_name: {
            type: 'string',
            description: '학생 이름',
          },
          amount: {
            type: 'number',
            description: '금액 (record_payment 시)',
          },
        },
        required: ['action'],
      },
    },
  },

  // ========================================
  // 9. 반 관리 (2개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'query_class',
      description: '반 조회',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'list',     // class.query.list
              'roster',   // class.query.roster
            ],
            description: '조회 유형',
          },
          class_name: {
            type: 'string',
            description: '반 이름 (roster 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 10. 리포트 (4개 Intent → 1개 Tool)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'get_report',
      description: '리포트 조회',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'dashboard',    // report.query.dashboard_kpi
              'attendance',   // report.query.attendance_summary
              'billing',      // report.query.billing_summary
            ],
            description: '리포트 유형',
          },
          period: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            description: '기간',
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // 11-15. 메타/확인 Tools
  // ========================================
  {
    type: 'function',
    function: {
      name: 'confirm_action',
      description: '대기 중인 작업 실행 확인',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_action',
      description: '대기 중인 작업 취소',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

/**
 * Tool 이름으로 Tool 정의 조회
 */
export function getToolByName(toolName: string): AgentTool | undefined {
  return AGENT_TOOLS.find(tool => tool.function.name === toolName);
}

/**
 * Tool 이름 목록
 */
export function getToolNames(): string[] {
  return AGENT_TOOLS.map(tool => tool.function.name);
}

