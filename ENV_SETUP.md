# 환경변수 설정 가이드

## 📋 개요

디어쌤 프로젝트는 **중앙 환경변수 관리 시스템**(`@env-registry/core`)을 사용합니다.
**모든 환경변수는 루트 디렉토리의 `.env.local` 파일 하나에서 중앙 관리**됩니다.

## 🔧 설정 방법

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 로그인
2. 새 프로젝트 생성
3. 프로젝트 설정에서 다음 정보 확인:
   - Project URL (SUPABASE_URL)
   - API Keys → anon/public key (SUPABASE_ANON_KEY)
   - API Keys → service_role key (SERVICE_ROLE_KEY) ⚠️ **보안 주의**

### 2. 중앙 환경변수 파일 생성

**루트 디렉토리**에 `.env.local` 파일을 하나만 생성하세요:

```
.env.local  (프로젝트 루트)
```

⚠️ **중요**: 각 앱별로 `.env.local` 파일을 만들지 마세요. 모든 환경변수는 루트의 `.env.local`에서 중앙 관리됩니다.

### 3. 필수 환경변수

```env
# Supabase 설정 (필수)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SERVICE_ROLE_KEY=your-service-role-key-here

# 클라이언트 환경변수 (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Node 환경
NODE_ENV=development

# 공통 설정
APP_NAME=디어쌤
APP_VERSION=1.0.0
```

## 🔒 보안 주의사항

### ⚠️ 절대 커밋하지 마세요!

- `.env.local` 파일은 `.gitignore`에 포함되어 있습니다
- **절대로** `.env.local` 파일을 Git에 커밋하지 마세요
- Service Role Key는 서버/Edge Function에서만 사용합니다
- 클라이언트 코드에서는 `envServer`를 import하면 안 됩니다

### 환경변수 사용 규칙

**✅ 서버/Edge 코드:**
```typescript
import { envServer } from '@env-registry/core/server';
const supabase = createServerClient(); // Service Role Key 사용
```

**✅ 클라이언트 코드:**
```typescript
import { envClient } from '@env-registry/core/client';
const supabase = createClient(); // Anon Key 사용
```

**❌ 금지:**
```typescript
// 클라이언트에서 envServer import 금지!
import { envServer } from '@env-registry/core/server'; // ❌
```

## 📝 환경변수 검증

환경변수가 올바르게 설정되었는지 확인:

```bash
# TypeScript 타입 체크
npm run type-check

# 개발 서버 실행 (환경변수 오류 시 즉시 확인 가능)
npm run dev
```

## 🚀 다음 단계

환경변수 설정이 완료되면:

1. Supabase 프로젝트에서 데이터베이스 스키마 생성
2. RLS (Row Level Security) 정책 설정
3. 개발 서버 실행: `npm run dev`

## 📚 참고

- [Supabase 문서](https://supabase.com/docs)
- [환경변수 관리 시스템 문서](./packages/env-registry/README.md)
- [개발 규칙](./rules.md)

