# Agent 기반 계약 검증 가이드

**작성일**: 2025-01-29
**버전**: 2.0.0 (Agent 기반)
**상태**: ✅ 운영 중
**이전 문서**: `docu/legacy/계약붕괴방지_Intent기반.md` (참고용)

---

## 📋 목차

1. [개요](#개요)
2. [Agent 기반 계약 검증](#agent-기반-계약-검증)
3. [Tool 실행 전 검증](#tool-실행-전-검증)
4. [6대 계약 카테고리](#6대-계약-카테고리)
5. [검증 체크리스트](#검증-체크리스트)
6. [에러 처리](#에러-처리)

---

## 개요

### 전환 배경

**Intent 기반 (레거시)**:
- 147개 Intent별 계약 검증
- Intent Registry, L0 Handlers, Domain Gate, Contract Gate 등 복잡한 Gate 시스템
- 유지보수 비용 높음

**Agent 기반 (현재)**:
- 15개 Tool별 계약 검증
- Tool 실행 함수 내 검증 로직 통합
- 단순하고 명확한 검증 체계

---

### 핵심 원칙

**"계약 붕괴"란?**
- 시스템이 가정한 전제 조건이 실행 시점에 위반되는 상황
- 예: 필수 파라미터 누락, 권한 없음, DB 스키마 불일치 등

**Agent 기반 검증 원칙**:
1. **Tool 실행 함수에서 검증** - Gate 시스템 불필요
2. **Fail-Fast** - 문제 발견 즉시 중단
3. **사용자 친화적 에러 메시지** - 기술적 오류 숨김
4. **Tenant Isolation** - 반드시 tenant_id 검증

---

## Agent 기반 계약 검증

### 검증 흐름

```
사용자 메시지
    ↓
LLM (OpenAI Function Calling)
    ↓
Tool 선택 + 파라미터 추출
    ↓
┌─────────────────────────────────┐
│  Tool 실행 함수                  │
│  ├─ 1. 인증/권한 검증            │
│  ├─ 2. 파라미터 검증             │
│  ├─ 3. Tenant Isolation 검증    │
│  ├─ 4. DB 스키마 검증            │
│  ├─ 5. 비즈니스 로직 검증        │
│  └─ 6. 실행                     │
└─────────────────────────────────┘
    ↓
결과 반환 (성공/실패)
    ↓
LLM 응답 생성
```

---

### 예시: manage_student Tool 검증

```typescript
// agent-engine-final.ts
async function executeManageStudent(
  args: any,
  context: AgentContext
): Promise<ToolResult> {

  // ===== 1. 인증/권한 검증 =====
  if (!context.user_id) {
    return {
      success: false,
      error: '사용자 인증 정보가 없습니다.',
    };
  }

  // ===== 2. 파라미터 검증 =====
  const { action, student_name } = args;

  if (!action) {
    return {
      success: false,
      error: '작업 유형(action)이 필요합니다.',
    };
  }

  // 액션별 필수 파라미터 검증
  const requiredParamsByAction: Record<string, string[]> = {
    register: ['student_name', 'phone', 'birth_date'],
    discharge: ['student_name', 'date'],
    pause: ['student_name', 'date'],
    resume: ['student_name'],
  };

  const requiredParams = requiredParamsByAction[action] || [];
  const missingParams = requiredParams.filter(param => !args[param]);

  if (missingParams.length > 0) {
    // 누락된 파라미터 → Draft 생성 (collecting 상태)
    return {
      success: true,
      result: {
        message: `다음 정보가 필요합니다: ${missingParams.join(', ')}`,
        status: 'collecting',
        missing_params: missingParams,
      },
    };
  }

  // ===== 3. Tenant Isolation 검증 =====
  const tenantId = requireTenantScope(context.tenant_id);
  // → tenant_id가 없거나 유효하지 않으면 예외 발생

  // ===== 4. DB 스키마 검증 (암묵적) =====
  // Supabase 쿼리 실행 시 자동으로 스키마 검증
  // 컬럼이 없으면 PGRST204 오류 발생

  // ===== 5. 비즈니스 로직 검증 =====
  if (action === 'search' || action === 'get_profile') {
    // 학생 조회
    const { data: students } = await context.supabase
      .from('academy_students')
      .select(`
        person_id,
        persons!inner(id, name, phone, email)
      `)
      .eq('tenant_id', tenantId)
      .ilike('persons.name', `%${student_name}%`);

    if (!students || students.length === 0) {
      return {
        success: false,
        error: `"${student_name}" 학생을 찾을 수 없습니다.`,
      };
    }

    if (students.length > 1) {
      return {
        success: true,
        result: {
          message: `"${student_name}" 학생이 ${students.length}명 있습니다. 더 구체적으로 입력해주세요.`,
          candidates: students.map(s => s.persons.name),
        },
      };
    }

    // ===== 6. 실행 =====
    return {
      success: true,
      result: {
        student: students[0],
      },
    };
  }

  // L2 작업 (등록, 수정, 퇴원 등) → Draft 생성
  const { data: draft, error: draftError } = await context.supabase
    .from('chatops_drafts')
    .insert({
      tenant_id: requireTenantScope(context.tenant_id),
      user_id: context.user_id,
      session_id: context.session_id,
      intent_key: `student.exec.${action}`,
      draft_params: args,
      status: 'ready',
      confirm_required: true,
    })
    .select()
    .single();

  if (draftError) {
    return {
      success: false,
      error: '작업 준비 중 오류가 발생했습니다.',
    };
  }

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

## Tool 실행 전 검증

### chatops/index.ts에서의 검증

```typescript
// chatops/index.ts
try {
  // ===== 1. 환경 변수 검증 =====
  const supabaseUrl = envServer.SUPABASE_URL;
  const supabaseServiceRoleKey = envServer.SERVICE_ROLE_KEY;
  const openaiApiKey = envServer.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ error: 'SERVER_CONFIG_ERROR', message: 'OpenAI API 키가 설정되지 않았습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 2. JWT 검증 =====
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: '인증이 필요합니다.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 3. Tenant ID 추출 및 검증 =====
  const { tenant_id, user_id } = await getTenantIdFromVerifiedUser(supabaseSvc, authHeader);

  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'FORBIDDEN', message: 'Tenant 정보가 없습니다.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 4. User ID 검증 (P0-SEC) =====
  if (!user_id) {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED',
        message: '사용자 인증 정보를 확인할 수 없습니다. 다시 로그인해주세요.'
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 5. UUID 형식 검증 =====
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user_id)) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_USER_ID',
        message: '잘못된 사용자 ID 형식입니다. 다시 로그인해주세요.'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 6. 요청 파싱 검증 =====
  const body: ChatOpsRequest = await req.json();
  const { session_id, message } = body;

  if (!session_id || !message) {
    return new Response(
      JSON.stringify({ error: 'INVALID_REQUEST', message: 'session_id와 message는 필수입니다.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 7. Agent 실행 =====
  const agentResult = await runAgent(message, conversationHistory, context, 5);

  // ===== 8. 응답 저장 (대화 히스토리) =====
  await supabaseSvc.from('chatops_messages').insert([
    {
      session_id: session_id,
      tenant_id: requireTenantScope(tenant_id),
      user_id: user_id,
      role: 'user',
      content: message,
    },
    {
      session_id: session_id,
      tenant_id: requireTenantScope(tenant_id),
      user_id: user_id,
      role: 'assistant',
      content: agentResult.response,
    },
  ]);

  return new Response(
    JSON.stringify({
      response: agentResult.response,
      agent_mode: true,
      tool_results: agentResult.tool_results,
      usage: agentResult.usage,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

} catch (error) {
  console.error('[ChatOps] 오류 발생:', maskErr(error));

  return new Response(
    JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: '요청을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.',
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## 6대 계약 카테고리

### A. 입력/정규화 계약

**검증 항목**:
- 필수 파라미터 존재 여부
- 파라미터 타입 검증
- 파라미터 형식 검증 (날짜, 전화번호, 이메일 등)

**검증 위치**: Tool 실행 함수 시작 부분

```typescript
// 예시
const { action, student_name, phone, birth_date } = args;

if (!action) {
  return { success: false, error: 'action이 필요합니다.' };
}

if (action === 'register' && !phone) {
  return { success: false, error: '전화번호가 필요합니다.' };
}

// 날짜 형식 검증
if (birth_date && !isValidDate(birth_date)) {
  return { success: false, error: '생년월일 형식이 올바르지 않습니다. (예: 1973-10-16)' };
}
```

---

### B. 상태 머신/세션 계약

**검증 항목**:
- Draft 상태 검증 (collecting, ready, executing, completed)
- 세션 유효성 검증
- 멀티턴 대화 문맥 유지

**검증 위치**: Draft 관련 Tool (`confirm_action`, `cancel_action`)

```typescript
// 예시: confirm_action
async function executeConfirmAction(args: any, context: AgentContext) {
  // Draft 조회
  const { data: draft } = await context.supabase
    .from('chatops_drafts')
    .select('*')
    .eq('session_id', context.session_id)
    .eq('tenant_id', requireTenantScope(context.tenant_id))
    .eq('status', 'ready')  // ✅ 상태 검증
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) {
    return {
      success: false,
      error: '실행할 작업이 없습니다.',
    };
  }

  // Draft 상태 변경: ready → executing
  await context.supabase
    .from('chatops_drafts')
    .update({ status: 'executing' })
    .eq('id', draft.id);

  // 실제 작업 실행
  const result = await executeL2Action(draft);

  // Draft 상태 변경: executing → completed
  await context.supabase
    .from('chatops_drafts')
    .update({ status: 'completed' })
    .eq('id', draft.id);

  return { success: true, result };
}
```

---

### C. 권한/정책/테넌트 경계 계약

**검증 항목**:
- Tenant ID 검증 (모든 DB 쿼리)
- User ID 검증 (UUID 형식)
- RBAC 권한 검증 (필요 시)

**검증 위치**: 모든 Tool 실행 함수

```typescript
// ✅ P0-SEC: requireTenantScope 사용
const { data: students } = await context.supabase
  .from('academy_students')
  .select('*')
  .eq('tenant_id', requireTenantScope(context.tenant_id))  // ✅ 필수
  .eq('person_id', personId);

// ✅ P0-SEC: user_id UUID 검증
if (!context.user_id || !isValidUUID(context.user_id)) {
  return { success: false, error: '유효하지 않은 사용자 ID입니다.' };
}

// ✅ P0-SEC: Draft 생성 시 tenant_id, user_id 검증
await context.supabase
  .from('chatops_drafts')
  .insert({
    tenant_id: requireTenantScope(context.tenant_id),  // ✅ 필수
    user_id: context.user_id,  // ✅ UUID 검증 완료
    session_id: context.session_id,
    // ...
  });
```

---

### D. 데이터베이스/스키마 계약

**검증 항목**:
- 테이블 존재 여부
- 컬럼 존재 여부
- FK 관계 유효성

**검증 위치**: Supabase 쿼리 실행 시 자동 검증

```typescript
// Supabase가 자동으로 스키마 검증
const { data, error } = await context.supabase
  .from('academy_students')  // 테이블 없으면 PGRST204
  .select('name, phone')     // 컬럼 없으면 PGRST204
  .eq('tenant_id', tenantId);

if (error) {
  console.error('[Tool] DB 쿼리 오류:', error);

  // 사용자 친화적 에러 메시지
  return {
    success: false,
    error: '데이터를 조회하는 중 오류가 발생했습니다.',
  };
}
```

---

### E. 외부 사이드이펙트 계약

**검증 항목**:
- 메시지 발송 전 수신자 검증
- 결제 처리 전 금액 검증
- 외부 API 호출 전 인증 검증

**검증 위치**: L2 실행 함수 (`executeSendMessageAction`, `executePayment` 등)

```typescript
// 예시: 메시지 발송
async function executeSendMessageAction(draft: Draft, context: AgentContext) {
  const { recipient, message } = draft.draft_params;

  // ✅ 수신자 검증
  if (!recipient) {
    return { success: false, error: '수신자가 지정되지 않았습니다.' };
  }

  // ✅ 메시지 내용 검증
  if (!message || message.trim() === '') {
    return { success: false, error: '메시지 내용이 비어있습니다.' };
  }

  // ✅ 전화번호 형식 검증
  const phone = await resolveRecipientPhone(recipient, context);
  if (!isValidPhoneNumber(phone)) {
    return { success: false, error: '유효하지 않은 전화번호입니다.' };
  }

  // 메시지 발송 (외부 API)
  try {
    await sendSMS(phone, message);

    // 발송 로그 저장
    await context.supabase
      .from('message_logs')
      .insert({
        tenant_id: requireTenantScope(context.tenant_id),
        recipient: phone,
        content: message,
        status: 'sent',
        created_by: context.user_id,
      });

    return { success: true, result: '메시지를 발송했습니다.' };
  } catch (error) {
    console.error('[SendMessage] 발송 실패:', error);
    return { success: false, error: '메시지 발송에 실패했습니다.' };
  }
}
```

---

### F. 관측/감사/재현성 계약

**검증 항목**:
- 모든 L2 작업 로그 저장
- PII 마스킹
- 에러 로그 저장

**검증 위치**: 모든 Tool 실행 함수

```typescript
// ✅ P1-OBS: 로그 출력 (PII 마스킹)
console.log('[executeManageStudent] 호출:', {
  action: args.action,
  student_name: maskPII(args.student_name),
  tenant: await tenantLogKey(context.tenant_id),
});

// ✅ P1-OBS: 에러 로그 (PII 마스킹)
console.error('[executeManageStudent] 오류:', maskErr(error));

// ✅ P1-OBS: Draft 생성 로그
console.log('[executeManageStudent] Draft 생성:', {
  draft_id: draft.id,
  status: draft.status,
  missing_params: draft.missing_required,
});

// ✅ P1-AUDIT: 실행 감사 로그 (선택적)
await context.supabase
  .from('audit_logs')
  .insert({
    tenant_id: requireTenantScope(context.tenant_id),
    user_id: context.user_id,
    action: 'student.register',
    target_id: student.id,
    details: { name: maskPII(student.name) },
    created_at: toKSTDate(),
  });
```

---

## 검증 체크리스트

### Tool 실행 함수 작성 시

- [ ] **P0-SEC**: `requireTenantScope(context.tenant_id)` 사용
- [ ] **P0-SEC**: `context.user_id` UUID 형식 검증
- [ ] **P0-INPUT**: 필수 파라미터 검증
- [ ] **P0-INPUT**: 파라미터 타입 검증
- [ ] **P1-INPUT**: 파라미터 정규화 (날짜, 전화번호 등)
- [ ] **P1-BIZ**: 비즈니스 로직 검증 (예: 학생 존재 여부)
- [ ] **P1-OBS**: 로그 출력 (PII 마스킹)
- [ ] **P1-ERROR**: 에러 처리 (사용자 친화적 메시지)
- [ ] **P2-AUDIT**: 감사 로그 저장 (L2 작업)

---

### Draft 생성 시

- [ ] **P0-SEC**: `tenant_id` = `requireTenantScope(context.tenant_id)`
- [ ] **P0-SEC**: `user_id` = `context.user_id` (UUID 검증 완료)
- [ ] **P0-STATE**: `status` = `'collecting'` 또는 `'ready'`
- [ ] **P1-STATE**: `missing_required` = 누락된 파라미터 배열
- [ ] **P1-STATE**: `confirm_required` = true (L2 작업)

---

### DB 쿼리 실행 시

- [ ] **P0-SEC**: `.eq('tenant_id', requireTenantScope(context.tenant_id))`
- [ ] **P1-ERROR**: `error` 체크 및 처리
- [ ] **P1-OBS**: 쿼리 결과 로그 출력
- [ ] **P2-PERF**: 필요한 컬럼만 SELECT

---

## 에러 처리

### 에러 타입별 처리

```typescript
// 1. 파라미터 검증 실패 → 400 Bad Request
if (!requiredParam) {
  return {
    success: false,
    error: '필수 정보가 누락되었습니다.',
    error_code: 'MISSING_PARAM',
  };
}

// 2. 권한 없음 → 403 Forbidden
if (!hasPermission) {
  return {
    success: false,
    error: '이 작업을 수행할 권한이 없습니다.',
    error_code: 'FORBIDDEN',
  };
}

// 3. 리소스 없음 → 404 Not Found
if (!student) {
  return {
    success: false,
    error: '학생을 찾을 수 없습니다.',
    error_code: 'NOT_FOUND',
  };
}

// 4. DB 오류 → 500 Internal Server Error
if (dbError) {
  console.error('[Tool] DB 오류:', maskErr(dbError));
  return {
    success: false,
    error: '데이터 처리 중 오류가 발생했습니다.',
    error_code: 'DB_ERROR',
  };
}

// 5. 외부 API 오류 → 502 Bad Gateway
if (apiError) {
  console.error('[Tool] API 오류:', maskErr(apiError));
  return {
    success: false,
    error: '외부 서비스와 통신 중 오류가 발생했습니다.',
    error_code: 'API_ERROR',
  };
}
```

---

### 에러 메시지 가이드

```typescript
// ❌ 나쁜 예: 기술적 오류 노출
return {
  success: false,
  error: 'PGRST204: column "name" does not exist in table "academy_students"',
};

// ✅ 좋은 예: 사용자 친화적 메시지
return {
  success: false,
  error: '학생 정보를 조회하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

// ❌ 나쁜 예: 모호한 메시지
return {
  success: false,
  error: '오류가 발생했습니다.',
};

// ✅ 좋은 예: 구체적이고 실행 가능한 메시지
return {
  success: false,
  error: '학생 이름을 입력해주세요.',
};
```

---

## 참고 자료

- **Agent 아키텍처**: `docu/Agent_아키텍처_전환.md`
- **파라미터 추출**: `docu/Agent_파라미터_추출.md`
- **Tool 정의**: `infra/supabase/supabase/functions/_shared/agent-tools-final.ts`
- **Agent Engine**: `infra/supabase/supabase/functions/_shared/agent-engine-final.ts`
- **레거시 문서**: `docu/legacy/계약붕괴방지_Intent기반.md`

---

**작성자**: AI Assistant
**최종 업데이트**: 2025-01-29

