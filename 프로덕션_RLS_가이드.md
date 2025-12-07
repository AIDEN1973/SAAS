# 프로덕션 RLS 가이드

## 프로덕션 모드에서의 RLS 동작

### 1. JWT Claim 기반 RLS (프로덕션 표준)

프로덕션 환경에서는 **JWT에 `tenant_id` claim이 포함**되어야 하며, RLS 정책이 이를 읽어서 데이터 격리를 수행합니다.

#### 동작 흐름:

```
1. 사용자 로그인
   ↓
2. 인증 시스템이 user_tenant_roles 테이블에서 tenant_id 조회
   ↓
3. Supabase JWT 생성 시 tenant_id를 claim에 포함
   ↓
4. 모든 API 요청에 JWT 포함
   ↓
5. RLS 정책이 auth.jwt() -> 'tenant_id'로 읽어서 필터링
   ↓
6. 해당 tenant_id의 데이터만 접근 가능
```

#### RLS 정책 예시:

```sql
-- 프로덕션 표준 RLS 정책
CREATE POLICY tenant_isolation_persons ON public.persons
FOR ALL TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);
```

### 2. 개발 환경용 완화 정책 제거

프로덕션 배포 전에 **반드시** 개발 환경용 완화 정책을 제거해야 합니다.

#### 제거 방법:

**옵션 1: SQL로 직접 제거 (권장)**

```sql
-- 개발 환경용 완화 정책 제거
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.persons;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_students;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.guardians;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_consultations;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_classes;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tags;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tag_assignments;
```

**옵션 2: 마이그레이션 파일 생성**

프로덕션 배포 전에 다음 마이그레이션을 실행:

```sql
-- infra/supabase/migrations/016_remove_dev_rls_bypass.sql
-- 프로덕션 배포 전 개발 환경용 완화 정책 제거

DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.persons;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.academy_students;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.guardians;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_consultations;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.student_classes;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tags;
DROP POLICY IF EXISTS "Dev: Allow all authenticated users" ON public.tag_assignments;
```

### 3. 인증 시스템 구현

프로덕션에서는 실제 인증 시스템이 구현되어야 하며, 다음 기능이 필요합니다:

#### 필수 기능:

1. **사용자 로그인**
   - Supabase Auth를 통한 이메일/비밀번호 또는 소셜 로그인
   - 로그인 성공 시 JWT 생성

2. **JWT Claim 설정**
   - 로그인 시 `user_tenant_roles` 테이블에서 `tenant_id` 조회
   - Supabase JWT에 `tenant_id` claim 포함
   - Supabase Database Function 또는 Edge Function에서 처리

3. **미들웨어에서 Context 설정**
   - 요청마다 JWT에서 `tenant_id` 추출
   - `setApiContext()` 호출하여 Context 설정

#### 예시 코드 (Edge Function):

```typescript
// supabase/functions/auth-handler/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // JWT에서 user_id 추출
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  // JWT 디코딩하여 user_id 추출
  const { data: { user } } = await supabase.auth.getUser(token);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  // user_tenant_roles에서 tenant_id 조회
  const { data: roles } = await supabase
    .from('user_tenant_roles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!roles) {
    return new Response(JSON.stringify({ error: 'No tenant found' }), {
      status: 403,
    });
  }

  // JWT에 tenant_id claim 추가 (Supabase Database Function 사용)
  // 또는 새 JWT 생성 시 claim 포함
  // ...
});
```

#### 예시 코드 (Database Function):

```sql
-- JWT에 tenant_id claim을 추가하는 Database Function
CREATE OR REPLACE FUNCTION auth.set_tenant_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- user_tenant_roles에서 tenant_id 조회
  SELECT tenant_id INTO v_tenant_id
  FROM public.user_tenant_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- JWT claim 설정 (Supabase는 자동으로 처리하지만, 커스텀 claim 추가 시)
  -- 실제로는 Supabase Auth Hook을 사용하여 처리
END;
$$;
```

### 4. 프로덕션 배포 체크리스트

프로덕션 배포 전에 다음을 확인하세요:

- [ ] 개발 환경용 완화 정책 제거 (`015_dev_rls_bypass.sql` 정책 삭제)
- [ ] 인증 시스템 구현 완료 (JWT에 tenant_id claim 포함)
- [ ] RLS 정책이 JWT claim 기반으로 작동하는지 확인
- [ ] 테스트: 다른 tenant_id로 접근 시도 시 차단되는지 확인
- [ ] 모니터링: RLS 실패율 모니터링 설정

### 5. 보안 주의사항

⚠️ **중요**: 프로덕션 환경에서는 다음을 절대 하지 마세요:

- ❌ 개발 환경용 완화 정책 유지
- ❌ RLS 비활성화
- ❌ Service Role Key를 클라이언트에서 사용
- ❌ JWT claim 없이 데이터 접근 허용

✅ **권장 사항**:

- ✅ JWT claim 기반 RLS 사용
- ✅ 모든 테이블에 RLS 정책 적용
- ✅ Service Layer에서 추가 필터링 (2중 보안)
- ✅ 정기적인 보안 감사

### 6. 문제 해결

#### 문제: RLS 정책이 작동하지 않음

**원인**: JWT에 `tenant_id` claim이 없음

**해결**:
1. 인증 시스템에서 JWT 생성 시 `tenant_id` claim 포함 확인
2. Supabase Dashboard > Authentication > Hooks에서 JWT 생성 후처리 확인
3. Database Function 또는 Edge Function에서 claim 추가 확인

#### 문제: 모든 요청이 401 Unauthorized

**원인**: RLS 정책이 너무 엄격하거나 JWT claim 형식이 잘못됨

**해결**:
1. RLS 정책의 JWT claim 읽기 구문 확인: `(auth.jwt() ->> 'tenant_id')::uuid`
2. JWT claim 형식 확인 (문자열 vs UUID)
3. 개발 환경용 완화 정책이 제거되었는지 확인

### 7. 참고 자료

- [Supabase RLS 문서](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JWT Custom Claims](https://supabase.com/docs/guides/auth/auth-hooks)
- 기술문서: `docu/전체 기술문서.txt` - 3-2-2. RLS 규칙 템플릿
- 규칙 문서: `docu/rules.md` - 2-3. 표준 RLS 정책 패턴

