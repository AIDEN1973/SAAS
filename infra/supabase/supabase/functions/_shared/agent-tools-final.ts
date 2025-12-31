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
      description: '학생 검색, 정보 조회, 등록, 수정, 휴원, 복귀, 퇴원 등 학생 관련 모든 작업. 학생 이름으로 전화번호나 프로필을 조회할 때도 이 Tool을 사용.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [
              'search',           // student.query.search - 학생 이름으로 검색
              'get_profile',      // student.query.profile - 학생 상세 정보 조회
              'register',         // student.exec.register - 신규 학생 등록
              'update',           // student.exec.update_profile - 학생 정보 수정
              'update_contact',   // student.exec.update_guardian_contact - 연락처 수정
              'pause',            // student.exec.pause - 휴원 처리
              'resume',           // student.exec.resume - 복귀 처리
              'discharge',        // student.exec.discharge - 퇴원 처리
              'change_class',     // student.exec.change_class - 반 변경
              'merge',            // student.exec.merge_duplicates - 중복 병합
            ],
            description: '수행할 작업. 학생 이름으로 전화번호나 정보를 조회할 때는 search 또는 get_profile 사용.',
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (예: "마이콜", "김철수"). 사용자가 언급한 이름이 학생 이름인지 반 이름인지 불확실하면 학생 이름으로 우선 처리.',
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
      description: '출결 기록 조회. 지각/결석/미체크 학생 확인, 특정 반이나 학생의 출결 현황 조회. "오늘 지각", "결석자", "마이콜 출석" 등의 질문에 사용.',
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
      description: '출결 관리 작업. 결석/지각 학부모 알림, 사유 요청, 출결 정정, 일괄 수정 등. "결석자에게 알림", "출석 정정" 등의 요청에 사용.',
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
      description: '발송한 메시지 이력 조회. 발송 성공/실패 로그, 특정 날짜나 학생에게 보낸 메시지 확인. "어제 보낸 메시지", "발송 실패" 등의 질문에 사용.',
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
      description: '메시지 발송 실행. 개별/일괄/예약 발송, 실패 메시지 재발송, 예약 취소. "마이콜에게 메시지 보내", "전체 공지" 등의 요청에 사용.',
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
      description: '메시지 초안 작성 및 미리보기. 일반 공지, 결석 안내, 연체 안내 초안 생성. "결석 안내 초안 작성", "공지 메시지 만들어" 등의 요청에 사용.',
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
      description: '수납 내역 조회. 연체 목록, 청구서 상태, 미발행 청구서, 학생별 수납 현황 확인. "연체자", "마이콜 수납 내역", "이번 달 미수금" 등의 질문에 사용.',
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
      description: '수납 관리 작업. 청구서 발행, 결제 링크 발송, 연체 안내 예약, 수동 입금 기록. "청구서 발행", "결제 링크 보내", "입금 확인" 등의 요청에 사용.',
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
      description: '반 정보 조회. 전체 반 목록 또는 특정 반의 학생 명단 확인. 주의: 사용자가 "반 목록"이나 "~반 명단"처럼 명확히 반을 언급할 때만 사용. 단순히 이름만 언급하면 학생 이름으로 간주하고 manage_student 사용.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'list',     // class.query.list - 전체 반 목록
              'roster',   // class.query.roster - 특정 반의 학생 명단
            ],
            description: '조회 유형. list: 전체 반 목록, roster: 특정 반의 학생 명단',
          },
          class_name: {
            type: 'string',
            description: '반 이름 (roster 타입일 때만 필요). 예: "초등 1반", "중등 A반". 사용자가 "~반"이라고 명확히 언급한 경우에만 사용.',
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
      description: '통계 리포트 조회. 대시보드 KPI, 출결 요약, 수납 요약 등 집계 데이터 확인. "오늘 통계", "이번 달 출석률", "수납 현황" 등의 질문에 사용.',
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
      description: '사용자가 "네/예/확인/실행/진행/좋아/응" 등으로 동의했을 때 대기 중인 Draft 작업을 실행. 반드시 사용자의 명시적 동의 후에만 호출.',
      parameters: {
        type: 'object',
        properties: {
          draft_id: {
            type: 'string',
            description: 'Draft ID (선택, 지정하지 않으면 최근 READY draft 실행)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_action',
      description: '사용자가 "아니/취소/중단/그만/안해" 등으로 거부했을 때 대기 중인 Draft 작업을 취소. 사용자가 명시적으로 취소 의사를 밝혔을 때만 호출.',
      parameters: {
        type: 'object',
        properties: {
          draft_id: {
            type: 'string',
            description: 'Draft ID (선택, 지정하지 않으면 최근 READY draft 취소)',
          },
        },
      },
    },
  },
];

/**
 * Tool 사용 가이드 (참고용)
 *
 * 1. manage_student: 학생 이름이 언급되면 무조건 사용
 * 2. query_attendance: "오늘 지각", "결석자", "출석 확인" 등
 * 3. manage_attendance: "결석자에게 알림", "출석 정정" 등
 * 4. query_message: "어제 보낸 메시지", "발송 실패" 등
 * 5. send_message: "메시지 보내", "공지" 등
 * 6. draft_message: "초안 작성", "메시지 만들어" 등
 * 7. query_billing: "연체자", "수납 내역", "미수금" 등
 * 8. manage_billing: "청구서 발행", "결제 링크", "입금 확인" 등
 * 9. query_class: "반 목록", "반 명단" 등
 * 10. get_report: "통계", "현황", "요약" 등
 * 11. confirm_action: 사용자 동의 시에만
 * 12. cancel_action: 사용자 거부 시에만
 */

/**
 * Tool 이름으로 Tool 정의 조회
 */
export function getToolByName(toolName: string): AgentTool | undefined {
  return AGENT_TOOLS.find(tool => tool.function.name === toolName);
}
