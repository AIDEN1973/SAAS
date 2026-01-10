# Agent 기반 파라미터 추출 가이드

**작성일**: 2025-01-29
**버전**: 2.0.0 (Agent 기반)
**상태**: ✅ 운영 중
**이전 문서**: `docu/legacy/ChatOps_파라미터_추출_종합_대책_Intent기반.md` (참고용)

---

## 📋 목차

1. [개요](#개요)
2. [Agent 기반 파라미터 추출](#agent-기반-파라미터-추출)
3. [OpenAI Function Calling](#openai-function-calling)
4. [Tool 파라미터 정의](#tool-파라미터-정의)
5. [파라미터 검증](#파라미터-검증)
6. [에러 처리](#에러-처리)
7. [모범 사례](#모범-사례)

---

## ⚠️ 업종 중립성 (Industry Neutrality)

**이 시스템은 다양한 업종의 테넌트를 관리하는 SaaS 플랫폼입니다.**

Tool 명칭은 업종에 독립적이지만 (`manage_student`), 실제 데이터 처리는 업종별로 동적 매핑됩니다.

**📖 자세한 내용은 정본 문서를 참조하세요**: **[Industry_Neutrality.md](./Industry_Neutrality.md)** ⭐

**핵심 요약**:
- **Tool 명칭**: `manage_student` (고정)
- **사용자 입력**: "학생", "고객", "회원" 등 (다양) → LLM이 `student_name`으로 추출
- **Industry Adapter**: `industry_type`에 따라 올바른 테이블로 자동 라우팅
  - 학원 → `academy_students`
  - 미용실 → `salon_customers`
  - 네일샵 → `nail_members`

---

## 개요

### 전환 배경

**Intent 기반 (레거시)**:
```
사용자 메시지 → Intent 분류 (147개) → 파라미터 추출 (Fast-Path/LLM) → 정규화
```
- 복잡한 3단계 파이프라인
- Intent별 파라미터 추출 로직 필요
- 유지보수 비용 높음

**Agent 기반 (현재)**:
```
사용자 메시지 → LLM (OpenAI Function Calling) → Tool 선택 + 파라미터 추출 → 실행
```
- LLM이 Tool과 파라미터를 동시에 결정
- 단일 단계 처리
- 자연스러운 대화 지원

---

## Agent 기반 파라미터 추출

### 핵심 원리

**LLM이 모든 것을 처리합니다**:
1. 사용자 의도 이해
2. 적절한 Tool 선택
3. 필요한 파라미터 추출
4. 누락된 정보 요청

### 예시 1: 단순 조회

**사용자**: "박소영 전화번호"

**LLM 처리**:
```json
{
  "tool_call": {
    "name": "manage_student",
    "arguments": {
      "action": "get_profile",
      "student_name": "박소영"
    }
  }
}
```

**결과**:
- ✅ Tool: `manage_student` 자동 선택
- ✅ 파라미터: `action`, `student_name` 자동 추출
- ✅ "전화번호"는 키워드로 인식, 이름으로 추출 안 함

---

### 예시 2: 복잡한 요청

**사용자**: "박소영이 오늘 결석했는데 보호자한테 연락 좀 해줘"

**LLM 처리 (멀티 턴)**:

**Turn 1**: 학생 검색
```json
{
  "tool_call": {
    "name": "manage_student",
    "arguments": {
      "action": "search",
      "student_name": "박소영"
    }
  }
}
```

**Turn 2**: 출결 확인
```json
{
  "tool_call": {
    "name": "query_attendance",
    "arguments": {
      "type": "by_student",
      "student_name": "박소영",
      "date": "2025-01-29"
    }
  }
}
```

**Turn 3**: 메시지 발송
```json
{
  "tool_call": {
    "name": "send_message",
    "arguments": {
      "type": "single",
      "recipient": "박소영",
      "message": "박소영 학생이 오늘 결석했습니다."
    }
  }
}
```

**최종 응답**: "박소영 학생의 보호자님께 결석 안내를 발송했습니다."

---

### 예시 3: 누락된 정보 요청

**사용자**: "메롱 학생등록"

**LLM 처리**:
```json
{
  "tool_call": {
    "name": "manage_student",
    "arguments": {
      "action": "register",
      "student_name": "메롱"
    }
  }
}
```

**Tool 실행 결과**:
```json
{
  "success": true,
  "result": {
    "message": "메롱 학생 등록을 위해 다음 정보가 필요합니다:\n\n전화번호, 생년월일 (예: 1973.10.16)\n\n정보를 입력해주세요.",
    "draft_id": "...",
    "status": "collecting",
    "missing_params": ["phone", "birth_date"]
  }
}
```

**LLM 응답**: "메롱 학생 등록을 위해 전화번호와 생년월일을 알려주세요."

**사용자**: "19731016 01029484417"

**LLM 처리** (대화 문맥 유지):
```json
{
  "tool_call": {
    "name": "manage_student",
    "arguments": {
      "action": "register",
      "student_name": "메롱",
      "birth_date": "1973-10-16",
      "phone": "010-2948-4417"
    }
  }
}
```

**Tool 실행**: Draft 업데이트 → 실행 확인 요청

---

## OpenAI Function Calling

### System Prompt

```typescript
const systemPrompt = `당신은 학원/교육기관 관리 시스템의 AI 어시스턴트입니다.

**역할**:
- 사용자와 자연스럽게 대화하며 요청을 이해하고 처리합니다
- 필요시 제공된 Tool을 사용하여 정보를 조회하거나 작업을 생성합니다

**중요: 대화 문맥 유지 규칙**:
1. 학생 등록/수정 요청 시:
   - 즉시 manage_student Tool을 호출하세요 (부족한 정보는 빈 값으로 두세요)
   - Tool이 "필요한 정보" 메시지를 반환하면, 사용자에게 자연스럽게 전달하세요

2. 사용자가 단순 값(날짜, 전화번호, 이름 등)만 입력하면:
   - 이전 대화에서 요청한 정보일 가능성이 높습니다
   - ✅ 이전에 입력받은 모든 정보와 함께 manage_student Tool을 다시 호출하세요

3. 사용자가 "네", "예", "맞아요" 등 확인 응답을 하면:
   - 이전 대화에서 확인을 요청했는지 확인하세요
   - ✅ "실행하시겠습니까?" 후 "네"라고 답하면 → confirm_action() 호출

**Tool 사용 원칙**:
- 조회 요청 → query Tool 사용
- 등록/수정/삭제 → manage Tool 사용 (Draft 생성)
- 실행 확인 → confirm_action 사용
- 취소 → cancel_action 사용

**응답 스타일**:
- 친절하고 전문적인 톤
- 간결하고 명확한 정보 전달
- 이전 대화 문맥을 항상 고려
- 필요시 추가 정보 요청`;
```

---

### Tool 정의 예시

```typescript
// agent-tools-final.ts
{
  type: 'function',
  function: {
    name: 'manage_student',
    description: '학생/원생/회원 관리 (검색, 조회, 등록, 수정, 퇴원, 휴원, 복귀, 반변경)',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'get_profile', 'register', 'update', 'discharge', 'pause', 'resume', 'change_class'],
          description: '수행할 작업',
        },
        student_name: {
          type: 'string',
          description: '학생 이름',
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
        // ... 기타 파라미터
      },
      required: ['action'],
    },
  },
}
```

---

### LLM 호출 로직

```typescript
// agent-engine-final.ts
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    tools: AGENT_TOOLS,  // 15개 Tool 정의
    tool_choice: 'auto',  // LLM이 자동으로 Tool 선택
  }),
});

const data = await response.json();

// Tool 호출 감지
if (data.choices[0].message.tool_calls) {
  for (const toolCall of data.choices[0].message.tool_calls) {
    const toolName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    // Tool 실행
    const result = await executeTool(toolName, args, context);

    // 결과를 대화 히스토리에 추가
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });
  }

  // LLM에게 Tool 결과 전달하여 최종 응답 생성
  // (재귀 호출)
}
```

---

## Tool 파라미터 정의

### 필수 파라미터 vs 선택 파라미터

**필수 파라미터**:
- Tool 정의에서 `required` 배열에 포함
- LLM이 반드시 제공해야 함
- 예: `action` (모든 Tool에서 필수)

**선택 파라미터**:
- Tool 정의에서 `required` 배열에 미포함
- LLM이 선택적으로 제공
- 예: `student_name`, `phone`, `date` 등

### 파라미터 타입

```typescript
// 문자열
student_name: {
  type: 'string',
  description: '학생 이름',
}

// 열거형 (Enum)
action: {
  type: 'string',
  enum: ['search', 'get_profile', 'register'],
  description: '수행할 작업',
}

// 배열
recipients: {
  type: 'array',
  items: { type: 'string' },
  description: '수신자 목록',
}

// 객체
filters: {
  type: 'object',
  properties: {
    class_name: { type: 'string' },
    date: { type: 'string' },
  },
}
```

---

## 파라미터 검증

### Tool 실행 전 검증

```typescript
// agent-engine-final.ts - executeManageStudent 예시

async function executeManageStudent(args: any, context: AgentContext) {
  const { action, student_name, phone, birth_date } = args;

  // ✅ 액션별 필수 파라미터 정의
  const requiredParamsByAction: Record<string, string[]> = {
    register: ['student_name', 'phone', 'birth_date'],
    discharge: ['student_name', 'date'],
    pause: ['student_name', 'date'],
    resume: ['student_name'],
  };

  const requiredParams = requiredParamsByAction[action] || [];

  // ✅ 누락된 필수 파라미터 확인
  const missingParams = requiredParams.filter(param => {
    const value = args[param];
    return !value || (typeof value === 'string' && value.trim() === '');
  });

  // ✅ 상태 결정: 필수 정보가 모두 있으면 ready, 없으면 collecting
  const draftStatus = missingParams.length === 0 ? 'ready' : 'collecting';

  if (draftStatus === 'collecting') {
    // 필수 정보가 부족한 경우
    const paramNameMap: Record<string, string> = {
      student_name: '학생 이름',
      phone: '전화번호',
      birth_date: '생년월일 (예: 1973.10.16)',
      date: '날짜 (예: 2025.12.29)',
    };

    const missingList = missingParams
      .map(p => paramNameMap[p] || p)
      .join(', ');

    return {
      success: true,
      result: {
        message: `${student_name || '학생'} ${action}을 위해 다음 정보가 필요합니다:\n\n${missingList}\n\n정보를 입력해주세요.`,
        draft_id: draft.id,
        status: 'collecting',
        missing_params: missingParams,
      },
    };
  }

  // ready 상태 - 실행 확인 요청
  return {
    success: true,
    result: {
      message: `${student_name} 학생 ${action} 처리를 준비했습니다. 실행하시겠습니까?`,
      draft_id: draft.id,
      requires_confirmation: true,
    },
  };
}
```

---

### 파라미터 정규화

```typescript
// 날짜 정규화
function normalizeDateParam(dateStr: string): string {
  // "2025.01.29" → "2025-01-29"
  // "20250129" → "2025-01-29"
  // "오늘" → "2025-01-29" (KST 기준)
  return toKSTDate(dateStr);
}

// 전화번호 정규화
function normalizePhoneParam(phoneStr: string): string {
  // "01012345678" → "010-1234-5678"
  // "010 1234 5678" → "010-1234-5678"
  return phoneStr.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

// 이름 정규화
function normalizeNameParam(nameStr: string): string {
  // 공백 제거, 트림
  return nameStr.trim().replace(/\s+/g, ' ');
}
```

---

## 에러 처리

### Tool 실행 실패

```typescript
// agent-engine-final.ts
async function executeTool(toolName: string, args: any, context: AgentContext) {
  try {
    switch (toolName) {
      case 'manage_student':
        return await executeManageStudent(args, context);
      case 'query_attendance':
        return await executeQueryAttendance(args, context);
      // ... 기타 Tool
      default:
        return {
          success: false,
          error: `알 수 없는 Tool: ${toolName}`,
        };
    }
  } catch (error) {
    console.error(`[AgentEngine] Tool 실행 오류:`, error);
    return {
      success: false,
      error: `Tool 실행 중 오류가 발생했습니다: ${error.message}`,
    };
  }
}
```

### LLM 응답 오류

```typescript
// OpenAI API 호출 실패
if (!response.ok) {
  throw new Error(`OpenAI API 오류: ${response.status} ${response.statusText}`);
}

// Tool 호출 파싱 실패
try {
  const args = JSON.parse(toolCall.function.arguments);
} catch (error) {
  console.error('[AgentEngine] Tool 파라미터 파싱 실패:', error);
  return {
    success: false,
    error: 'Tool 파라미터 형식이 올바르지 않습니다.',
  };
}
```

---

## 모범 사례

### 1. Tool 파라미터는 명확하게 정의

```typescript
// ❌ 나쁜 예
{
  name: 'do_something',
  description: '뭔가 함',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string' },  // 모호함
    },
  },
}

// ✅ 좋은 예
{
  name: 'manage_student',
  description: '학생 정보 관리 (검색, 조회, 등록, 수정, 퇴원, 휴원, 복귀)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get_profile', 'register', 'update', 'discharge'],
        description: '수행할 작업',
      },
      student_name: {
        type: 'string',
        description: '학생 이름 (필수: register, update, discharge 시)',
      },
    },
    required: ['action'],
  },
}
```

---

### 2. System Prompt에 명확한 지침 제공

```typescript
// ✅ 좋은 예
const systemPrompt = `
**중요: 대화 문맥 유지 규칙**:
1. 학생 등록 요청 시:
   - 즉시 manage_student Tool을 호출하세요
   - 부족한 정보는 빈 값으로 두세요
   - Tool이 "필요한 정보" 메시지를 반환하면, 사용자에게 전달하세요

2. 사용자가 단순 값만 입력하면:
   - 이전 대화에서 요청한 정보일 가능성이 높습니다
   - 이전 정보와 함께 Tool을 다시 호출하세요
`;
```

---

### 3. 대화 히스토리 관리

```typescript
// ✅ 최근 10턴만 유지 (토큰 비용 절감)
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory.slice(-10),
  { role: 'user', content: userMessage },
];

// ✅ Tool 결과도 히스토리에 포함 (문맥 유지)
messages.push({
  role: 'tool',
  tool_call_id: toolCall.id,
  content: JSON.stringify(result),
});
```

---

### 4. 파라미터 검증은 Tool 실행 함수에서

```typescript
// ✅ Tool 실행 함수에서 검증
async function executeManageStudent(args: any, context: AgentContext) {
  // 1. 필수 파라미터 검증
  const missingParams = checkRequiredParams(args);

  // 2. 파라미터 정규화
  const normalizedArgs = normalizeParams(args);

  // 3. DB 조회/변경
  const result = await performAction(normalizedArgs);

  return { success: true, result };
}
```

---

### 5. 에러 메시지는 사용자 친화적으로

```typescript
// ❌ 나쁜 예
return {
  success: false,
  error: 'PGRST204: column "name" does not exist',
};

// ✅ 좋은 예
return {
  success: false,
  error: '학생 정보를 조회하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};
```

---

## 참고 자료

- **Agent 아키텍처**: `docu/Agent_아키텍처_전환.md`
- **Tool 정의**: `infra/supabase/supabase/functions/_shared/agent-tools-final.ts`
- **Agent Engine**: `infra/supabase/supabase/functions/_shared/agent-engine-final.ts`
- **레거시 문서**: `docu/legacy/ChatOps_파라미터_추출_종합_대책_Intent기반.md`

---

**작성자**: AI Assistant
**최종 업데이트**: 2025-01-29

