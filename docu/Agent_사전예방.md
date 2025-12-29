# Agent 기반 사전예방 가이드

**작성일**: 2025-01-29
**버전**: 2.0.0 (Agent 기반)
**상태**: ✅ 운영 중
**이전 문서**: `docu/legacy/붕괴사전예방_Intent기반.md` (참고용)

---

## 📋 목차

1. [개요](#개요)
2. [Agent 기반 사전예방 체계](#agent-기반-사전예방-체계)
3. [3-Layer Preflight 시스템](#3-layer-preflight-시스템)
4. [Tool 실행 전 검증](#tool-실행-전-검증)
5. [배포 전 검증](#배포-전-검증)
6. [모니터링 및 알림](#모니터링-및-알림)

---

## 개요

### 전환 배경

**Intent 기반 (레거시)**:
- 147개 Intent별 Preflight 검증
- Schema Gate, Resolver Gate, Domain Gate 등 복잡한 Gate 시스템
- Intent Registry, L0 Handlers 등 대규모 코드베이스

**Agent 기반 (현재)**:
- 15개 Tool별 Preflight 검증
- Tool 실행 함수 내 검증 로직 통합
- 단순하고 명확한 검증 체계

---

### 핵심 원칙

**"문제가 터지기 전에 최대한 많이 잡는다"**

1. **Static 검증** (코드 작성 시): TypeScript, Linter
2. **Deploy-time 검증** (배포 전): 스키마 검증, 환경 변수 검증
3. **Boot-time 검증** (서버 시작 시): DB 연결, 필수 테이블 존재 여부
4. **Runtime 검증** (요청 처리 시): Tool 실행 전 파라미터 검증

---

## Agent 기반 사전예방 체계

### 검증 레이어

```
┌─────────────────────────────────────────┐
│  Layer 1: Static (코드 작성 시)          │
│  - TypeScript 타입 체크                  │
│  - ESLint 규칙 검증                      │
│  - Tool 파라미터 타입 정의               │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Layer 2: Deploy-time (배포 전)          │
│  - 환경 변수 존재 여부                   │
│  - DB 스키마 검증                        │
│  - Migration 실행 여부                   │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Layer 3: Boot-time (서버 시작 시)       │
│  - DB 연결 테스트                        │
│  - 필수 테이블 존재 여부                 │
│  - PostgREST schema cache 확인          │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Layer 4: Runtime (요청 처리 시)         │
│  - JWT 검증                              │
│  - Tenant ID 검증                        │
│  - Tool 파라미터 검증                    │
│  - 비즈니스 로직 검증                    │
└─────────────────────────────────────────┘
```

---

## 3-Layer Preflight 시스템

### Layer 1: Static 검증 (코드 작성 시)

**목적**: 컴파일 타임에 타입 오류 방지

**검증 항목**:
- TypeScript 타입 체크
- Tool 파라미터 타입 정의
- 함수 시그니처 일치 여부

**예시**:

```typescript
// agent-tools-final.ts
// ✅ Tool 파라미터 타입 정의
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
          enum: ['search', 'get_profile', 'register', 'update', 'discharge'],
          description: '수행할 작업',
        },
        student_name: {
          type: 'string',
          description: '학생 이름',
        },
        phone: {
          type: 'string',
          description: '전화번호',
        },
      },
      required: ['action'],
    },
  },
}

// agent-engine-final.ts
// ✅ Tool 실행 함수 타입 정의
async function executeManageStudent(
  args: {
    action: string;
    student_name?: string;
    phone?: string;
    birth_date?: string;
  },
  context: AgentContext
): Promise<ToolResult> {
  // ...
}

// ✅ AgentContext 타입 정의
interface AgentContext {
  tenant_id: string;
  user_id: string;
  session_id: string;
  supabase: SupabaseClient;
  openai_api_key: string;
}
```

---

### Layer 2: Deploy-time 검증 (배포 전)

**목적**: 배포 전 환경 설정 및 스키마 검증

**검증 항목**:
- 환경 변수 존재 여부
- DB 스키마 검증 (테이블, 컬럼)
- Migration 실행 여부

**검증 스크립트**:

```bash
#!/bin/bash
# scripts/preflight-check.sh

echo "===== Preflight 검증 시작 ====="

# 1. 환경 변수 검증
echo "[1/4] 환경 변수 검증..."
required_vars=("SUPABASE_URL" "SERVICE_ROLE_KEY" "OPENAI_API_KEY")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ 환경 변수 누락: $var"
    exit 1
  fi
done
echo "✅ 환경 변수 검증 완료"

# 2. DB 연결 테스트
echo "[2/4] DB 연결 테스트..."
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ DB 연결 실패"
  exit 1
fi
echo "✅ DB 연결 성공"

# 3. 필수 테이블 존재 여부
echo "[3/4] 필수 테이블 검증..."
required_tables=("academy_students" "persons" "chatops_sessions" "chatops_messages" "chatops_drafts")
for table in "${required_tables[@]}"; do
  psql $DATABASE_URL -c "SELECT 1 FROM $table LIMIT 1" > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ 테이블 누락: $table"
    exit 1
  fi
done
echo "✅ 필수 테이블 검증 완료"

# 4. Migration 실행 여부
echo "[4/4] Migration 검증..."
latest_migration=$(ls -1 infra/supabase/supabase/migrations/*.sql | tail -1)
echo "최신 Migration: $latest_migration"
echo "✅ Migration 검증 완료"

echo "===== Preflight 검증 완료 ====="
```

**배포 파이프라인 통합**:

```yaml
# .github/workflows/deploy.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Preflight 검증
      - name: Run Preflight Checks
        run: |
          chmod +x scripts/preflight-check.sh
          ./scripts/preflight-check.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      # 배포
      - name: Deploy to Supabase
        run: |
          supabase functions deploy chatops \
            --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

---

### Layer 3: Boot-time 검증 (서버 시작 시)

**목적**: Edge Function 시작 시 환경 검증

**검증 항목**:
- Supabase 클라이언트 생성 가능 여부
- OpenAI API 키 유효성
- PostgREST schema cache 확인

**구현**:

```typescript
// chatops/index.ts
serve(async (req: Request) => {
  try {
    console.log('[ChatOps] ===== 작업 시작 =====');

    // ===== Boot-time 검증 =====

    // 1. 환경 변수 로드
    const supabaseUrl = envServer.SUPABASE_URL;
    const supabaseServiceRoleKey = envServer.SERVICE_ROLE_KEY;
    const openaiApiKey = envServer.OPENAI_API_KEY;

    console.log('[ChatOps] 환경변수 로드:', {
      has_supabase_url: !!supabaseUrl,
      has_service_role_key: !!supabaseServiceRoleKey,
      has_openai_key: !!openaiApiKey,
    });

    // 2. 필수 환경 변수 검증
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'SERVER_CONFIG_ERROR',
          message: 'OpenAI API 키가 설정되지 않았습니다.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Supabase 클라이언트 생성
    const supabaseSvc = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[ChatOps] Supabase 클라이언트 생성:', {
      is_defined: !!supabaseSvc,
      has_auth: !!supabaseSvc?.auth,
    });

    // 4. (선택적) DB 연결 테스트
    // const { error: dbError } = await supabaseSvc
    //   .from('chatops_sessions')
    //   .select('id')
    //   .limit(1);
    //
    // if (dbError) {
    //   console.error('[ChatOps] DB 연결 실패:', dbError);
    //   return new Response(
    //     JSON.stringify({ error: 'DB_ERROR', message: 'DB 연결에 실패했습니다.' }),
    //     { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    //   );
    // }

    // ===== 요청 처리 =====
    // ...

  } catch (error) {
    console.error('[ChatOps] Boot-time 오류:', maskErr(error));
    return new Response(
      JSON.stringify({
        error: 'BOOT_ERROR',
        message: '서버 초기화 중 오류가 발생했습니다.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Tool 실행 전 검증

### Runtime 검증 (요청 처리 시)

**목적**: Tool 실행 전 파라미터 및 권한 검증

**검증 항목**:
1. JWT 검증
2. Tenant ID 검증
3. User ID 검증 (UUID 형식)
4. Tool 파라미터 검증
5. 비즈니스 로직 검증

**구현**:

```typescript
// chatops/index.ts
async function handleChatOpsRequest(req: Request) {
  // ===== 1. JWT 검증 =====
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'UNAUTHORIZED', message: '인증이 필요합니다.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 2. Tenant ID 추출 및 검증 =====
  const { tenant_id, user_id } = await getTenantIdFromVerifiedUser(supabaseSvc, authHeader);

  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'FORBIDDEN', message: 'Tenant 정보가 없습니다.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 3. User ID 검증 (UUID 형식) =====
  if (!user_id) {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED',
        message: '사용자 인증 정보를 확인할 수 없습니다.'
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user_id)) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_USER_ID',
        message: '잘못된 사용자 ID 형식입니다.'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 4. 요청 파싱 검증 =====
  const body: ChatOpsRequest = await req.json();
  const { session_id, message } = body;

  if (!session_id || !message) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_REQUEST',
        message: 'session_id와 message는 필수입니다.'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ===== 5. Agent 실행 (Tool 파라미터 검증은 Tool 실행 함수에서) =====
  const agentResult = await runAgent(message, conversationHistory, context, 5);

  return new Response(
    JSON.stringify({
      response: agentResult.response,
      agent_mode: true,
      tool_results: agentResult.tool_results,
      usage: agentResult.usage,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### Tool 실행 함수 내 검증

```typescript
// agent-engine-final.ts
async function executeManageStudent(args: any, context: AgentContext) {
  // ===== 1. 파라미터 검증 =====
  const { action, student_name } = args;

  if (!action) {
    return {
      success: false,
      error: 'action이 필요합니다.',
    };
  }

  // ===== 2. 액션별 필수 파라미터 검증 =====
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

  // ===== 4. 비즈니스 로직 검증 =====
  if (action === 'search' || action === 'get_profile') {
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
          message: `"${student_name}" 학생이 ${students.length}명 있습니다.`,
          candidates: students.map(s => s.persons.name),
        },
      };
    }

    return {
      success: true,
      result: { student: students[0] },
    };
  }

  // ===== 5. L2 작업 → Draft 생성 =====
  // ...
}
```

---

## 배포 전 검증

### 체크리스트

배포 전 다음 항목을 확인하세요:

- [ ] **환경 변수 설정**
  - [ ] `SUPABASE_URL`
  - [ ] `SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`

- [ ] **DB 스키마**
  - [ ] 필수 테이블 존재 (`academy_students`, `persons`, `chatops_sessions`, `chatops_messages`, `chatops_drafts`)
  - [ ] 필수 컬럼 존재 (각 테이블별)
  - [ ] FK 관계 설정

- [ ] **Migration 실행**
  - [ ] 최신 Migration 실행 여부 확인
  - [ ] PostgREST schema cache 갱신

- [ ] **코드 검증**
  - [ ] TypeScript 컴파일 오류 없음
  - [ ] Linter 오류 없음
  - [ ] Tool 파라미터 타입 정의 완료

- [ ] **테스트**
  - [ ] 단위 테스트 통과
  - [ ] 통합 테스트 통과
  - [ ] E2E 테스트 통과 (선택적)

---

### 배포 명령어

```bash
# 1. Preflight 검증
./scripts/preflight-check.sh

# 2. 배포
cd infra/supabase
supabase functions deploy chatops \
  --project-ref xawypsrotrfoyozhrsbb \
  --use-api \
  --yes

# 3. 배포 확인
curl -X POST https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/chatops \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","message":"안녕하세요"}'
```

---

## 모니터링 및 알림

### 로그 모니터링

**Supabase Dashboard**:
- Edge Functions → chatops → Logs
- 실시간 로그 확인
- 에러 로그 필터링

**로그 레벨**:
```typescript
// INFO: 정상 작동
console.log('[ChatOps] 사용자 메시지 수신:', { session_id, message_preview });

// WARN: 경고 (계속 진행 가능)
console.warn('[ChatOps] Draft 업데이트 실패 (계속 진행):', error);

// ERROR: 에러 (작업 중단)
console.error('[ChatOps] Tool 실행 오류:', maskErr(error));
```

---

### 에러 알림

**Sentry 통합** (선택적):

```typescript
// chatops/index.ts
import * as Sentry from '@sentry/deno';

Sentry.init({
  dsn: envServer.SENTRY_DSN,
  environment: 'production',
});

try {
  // ...
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      function: 'chatops',
      tenant_id: context.tenant_id,
    },
  });

  console.error('[ChatOps] 오류 발생:', maskErr(error));
  // ...
}
```

---

### 성능 모니터링

**응답 시간 추적**:

```typescript
// chatops/index.ts
const startTime = Date.now();

// ... Agent 실행 ...

const duration = Date.now() - startTime;

console.log('[ChatOps] 처리 완료:', {
  duration_ms: duration,
  tool_count: agentResult.tool_results?.length || 0,
  token_usage: agentResult.usage?.total_tokens,
});

// 느린 응답 경고
if (duration > 5000) {
  console.warn('[ChatOps] 느린 응답 감지:', { duration_ms: duration });
}
```

---

### 헬스체크 엔드포인트

```typescript
// chatops/index.ts
serve(async (req: Request) => {
  // 헬스체크
  if (req.url.endsWith('/health')) {
    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        mode: 'agent',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 일반 요청 처리
  // ...
});
```

**헬스체크 확인**:

```bash
curl https://xawypsrotrfoyozhrsbb.supabase.co/functions/v1/chatops/health
```

---

## 참고 자료

- **Agent 아키텍처**: `docu/Agent_아키텍처_전환.md`
- **파라미터 추출**: `docu/Agent_파라미터_추출.md`
- **계약 검증**: `docu/Agent_계약검증.md`
- **체크리스트**: `docu/체크리스트.md`
- **레거시 문서**: `docu/legacy/붕괴사전예방_Intent기반.md`

---

**작성자**: AI Assistant
**최종 업데이트**: 2025-01-29

