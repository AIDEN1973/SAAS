/**
 * Agent Tools - Final Design
 *
 * 147개 Intent → 11개 Tool로 통합
 * OpenAI Function Calling 기반
 *
 * [성능 최적화]
 * - description 최소화 (기능에 영향 없음 - name과 parameters로 충분히 인식)
 * - 모든 Tool 포함 (기능 손실 방지)
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
 * 전체 Agent Tools
 * description 최소화로 토큰 절약, 기능은 완전히 유지
 */
export const AGENT_TOOLS: AgentTool[] = [
  // 1. 학생 관리
  {
    type: 'function',
    function: {
      name: 'manage_student',
      description: '학생 관리',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['search', 'get_profile', 'register', 'update', 'pause', 'resume', 'discharge', 'change_class', 'assign_tags'] },
          student_name: { type: 'string' },
          student_id: { type: 'string' },
          phone: { type: 'string' },
          birth_date: { type: 'string' },
          guardian_phone: { type: 'string' },
          class_name: { type: 'string' },
          reason: { type: 'string' },
          date: { type: 'string' },
          tag_names: { type: 'array', items: { type: 'string' } },
        },
        required: ['action'],
      },
    },
  },
  // 2. 출결 조회
  {
    type: 'function',
    function: {
      name: 'query_attendance',
      description: '출결 조회',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['late', 'absent', 'unchecked', 'by_class', 'by_student'] },
          date: { type: 'string' },
          class_name: { type: 'string' },
          student_name: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  // 3. 출결 관리
  {
    type: 'function',
    function: {
      name: 'manage_attendance',
      description: '출결 관리',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['notify_absent', 'notify_late', 'correct', 'mark_excused'] },
          date: { type: 'string' },
          student_name: { type: 'string' },
          status: { type: 'string', enum: ['present', 'late', 'absent', 'excused'] },
        },
        required: ['action'],
      },
    },
  },
  // 4. 반 조회
  {
    type: 'function',
    function: {
      name: 'query_class',
      description: '반 조회',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['list', 'roster'] },
          class_name: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  // 5. 수납 조회
  {
    type: 'function',
    function: {
      name: 'query_billing',
      description: '수납 조회',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['overdue_list', 'invoice_status', 'by_student'] },
          month: { type: 'string' },
          student_name: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  // 6. 수납 처리
  {
    type: 'function',
    function: {
      name: 'manage_billing',
      description: '수납 처리',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['issue_invoice', 'record_payment'] },
          month: { type: 'string' },
          student_name: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['action'],
      },
    },
  },
  // 7. 메시지 조회
  {
    type: 'function',
    function: {
      name: 'query_message',
      description: '메시지 조회',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['sent_log', 'failed_log'] },
          date: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  // 8. 메시지 발송
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: '메시지 발송',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['single', 'bulk'] },
          recipient: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['type'],
      },
    },
  },
  // 9. 리포트
  {
    type: 'function',
    function: {
      name: 'get_report',
      description: '리포트 조회',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['dashboard', 'attendance', 'billing'] },
          period: { type: 'string', enum: ['today', 'week', 'month'] },
        },
        required: ['type'],
      },
    },
  },
  // 10. 작업 확인
  {
    type: 'function',
    function: {
      name: 'confirm_action',
      description: '작업 실행',
      parameters: { type: 'object', properties: {} },
    },
  },
  // 11. 작업 취소
  {
    type: 'function',
    function: {
      name: 'cancel_action',
      description: '작업 취소',
      parameters: { type: 'object', properties: {} },
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
