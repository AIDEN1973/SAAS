/**
 * Agent Tools for ChatOps
 *
 * OpenAI Function Calling을 위한 Tool 정의
 * L0 (조회) 및 L1 (TaskCard) Intent를 Tool로 전환
 * L2 (실행) Intent는 기존 방식 유지 (안전성)
 */

export interface AgentTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

/**
 * Tool 정의
 * 60개 L0 Intent + 18개 L1 Intent → 약 15개 Tool로 통합
 */
export const agentTools: AgentTool[] = [
  // ========================================
  // 조회 (Query) Tools - L0 Intent 통합
  // ========================================

  {
    type: 'function',
    function: {
      name: 'search_student',
      description: '학생/원생/회원을 이름, 전화번호, 이메일로 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '검색어 (이름, 전화번호, 이메일 등)',
          },
          status: {
            type: 'string',
            description: '상태 필터 (active, paused, discharged)',
            enum: ['active', 'paused', 'discharged', 'all'],
          },
        },
        required: ['query'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_student_profile',
      description: '특정 학생의 상세 프로필 정보를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          student_id: {
            type: 'string',
            description: '학생 ID (UUID)',
          },
          name: {
            type: 'string',
            description: '학생 이름 (ID가 없을 경우)',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_attendance',
      description: '출결 정보를 조회합니다 (지각, 결석, 조퇴 등).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '조회 유형',
            enum: ['late', 'absent', 'early_leave', 'unchecked', 'by_student', 'by_class'],
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (by_student 타입일 때)',
          },
          class_name: {
            type: 'string',
            description: '수업 이름 (by_class 타입일 때)',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD)',
          },
          period: {
            type: 'string',
            description: '기간 (today, week, month)',
            enum: ['today', 'week', 'month'],
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_billing',
      description: '수납/청구 정보를 조회합니다 (미수금, 청구서, 결제 등).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '조회 유형',
            enum: ['overdue', 'by_student', 'invoice_status', 'failed_payments', 'kpi_summary'],
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (by_student 타입일 때)',
          },
          month: {
            type: 'string',
            description: '월 (YYYY-MM)',
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_class',
      description: '수업 정보를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '조회 유형',
            enum: ['list', 'roster'],
          },
          class_name: {
            type: 'string',
            description: '수업 이름 (roster 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_schedule',
      description: '일정/시간표를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '조회 유형',
            enum: ['today', 'by_teacher', 'by_class'],
          },
          teacher_name: {
            type: 'string',
            description: '강사 이름 (by_teacher 타입일 때)',
          },
          class_name: {
            type: 'string',
            description: '수업 이름 (by_class 타입일 때)',
          },
          date: {
            type: 'string',
            description: '날짜 (YYYY-MM-DD)',
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'query_message_log',
      description: '발송된 메시지 로그를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '조회 유형',
            enum: ['sent', 'failed'],
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

  {
    type: 'function',
    function: {
      name: 'get_dashboard_kpi',
      description: '대시보드 KPI 및 통계를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'KPI 유형',
            enum: ['attendance', 'billing', 'overall'],
          },
          period: {
            type: 'string',
            description: '기간',
            enum: ['today', 'week', 'month'],
          },
        },
        required: ['type'],
      },
    },
  },

  // ========================================
  // AI 보조 Tools - L0 AI Intent 통합
  // ========================================

  {
    type: 'function',
    function: {
      name: 'ai_summarize',
      description: 'AI로 학생 히스토리, 반 히스토리 등을 요약합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '요약 유형',
            enum: ['student_history', 'class_history'],
          },
          student_name: {
            type: 'string',
            description: '학생 이름 (student_history 타입일 때)',
          },
          class_name: {
            type: 'string',
            description: '수업 이름 (class_history 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'ai_generate',
      description: 'AI로 메시지, 상담 안건 등을 생성합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '생성 유형',
            enum: ['followup_message', 'counseling_agenda'],
          },
          context: {
            type: 'string',
            description: '생성 컨텍스트 (학생 이름, 상황 등)',
          },
        },
        required: ['type', 'context'],
      },
    },
  },

  // ========================================
  // 작업 생성 (TaskCard) Tools - L1 Intent 통합
  // ========================================

  {
    type: 'function',
    function: {
      name: 'create_notification_task',
      description: '알림 발송 작업(TaskCard)을 생성합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '알림 유형',
            enum: ['late', 'absent', 'overdue', 'general'],
          },
          target: {
            type: 'string',
            description: '대상 (학생 이름, 수업 이름, 또는 "전체")',
          },
          message: {
            type: 'string',
            description: '메시지 내용 (general 타입일 때)',
          },
        },
        required: ['type'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'draft_message',
      description: '메시지 초안을 작성합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: '메시지 유형',
            enum: ['absence_notice', 'overdue_notice', 'general_notice', 'payment_link'],
          },
          target: {
            type: 'string',
            description: '대상 (학생 이름, 수업 이름, 또는 "전체")',
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
  // L2 실행 Intent 트리거 Tool
  // ========================================

  {
    type: 'function',
    function: {
      name: 'execute_l2_intent',
      description: 'L2 실행 작업을 시작합니다 (퇴원, 등록, 수정 등). 이 Tool은 Draft를 생성하고 사용자 확인을 요청합니다.',
      parameters: {
        type: 'object',
        properties: {
          intent_key: {
            type: 'string',
            description: 'L2 Intent 키 (예: student.exec.discharge)',
          },
          params: {
            type: 'object',
            description: '파라미터 (name, date 등)',
          },
        },
        required: ['intent_key'],
      },
    },
  },
];

/**
 * Tool 이름으로 Tool 정의 조회
 */
export function getToolByName(toolName: string): AgentTool | undefined {
  return agentTools.find(tool => tool.function.name === toolName);
}

/**
 * Tool 이름 목록 반환
 */
export function getToolNames(): string[] {
  return agentTools.map(tool => tool.function.name);
}

