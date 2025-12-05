# 디어쌤 프로젝트 환경설정 가이드

## 환경설정 완료 내역

✅ Monorepo 구조 설정 완료
✅ 기본 폴더 구조 생성 완료
✅ React 앱 4개 기본 설정 완료 (academy-admin, academy-parent, super-admin, public-gateway)
✅ 환경변수 관리 시스템 (env-registry) 설정 완료
✅ Supabase 클라이언트 설정 완료
✅ TypeScript 설정 완료

## 다음 단계

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

각 앱의 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 환경변수를 설정하세요:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key

# 클라이언트 (NEXT_PUBLIC_*)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Node 환경
NODE_ENV=development

# 공통
APP_NAME=디어쌤
APP_VERSION=1.0.0
```

### 3. 개발 서버 실행

```bash
# 모든 앱 동시 실행
npm run dev

# 또는 개별 앱 실행
cd apps/academy-admin
npm run dev
```

개발 서버 포트:
- academy-admin: http://localhost:3000
- academy-parent: http://localhost:3001
- super-admin: http://localhost:3002
- public-gateway: http://localhost:3003

## 프로젝트 구조

```
.
├── apps/                    # 프론트엔드 애플리케이션
│   ├── academy-admin/       # 학원 관리자/선생님용
│   ├── academy-parent/      # 학부모용
│   ├── super-admin/         # SaaS 본사 플랫폼 콘솔
│   └── public-gateway/      # 공개 페이지
│
├── packages/                # 공유 모듈
│   ├── env-registry/        # 환경변수 관리
│   └── lib/                 # 공통 유틸
│       └── supabase-client/ # Supabase 클라이언트
│
└── infra/                   # 인프라 설정
    └── supabase/            # Supabase 설정
```

## 주요 패키지

### @env-registry/core

중앙 환경변수 관리 시스템

- 서버/Edge: `import { envServer } from '@env-registry/core/server'`
- 클라이언트: `import { envClient } from '@env-registry/core/client'`
- 공통: `import { envCommon } from '@env-registry/core/common'`

### @lib/supabase-client

Supabase 클라이언트 유틸리티

- 클라이언트: `import { createClient } from '@lib/supabase-client'`
- 서버/Edge: `import { createServerClient } from '@lib/supabase-client/server'`
- 멀티테넌트: `import { withTenant } from '@lib/supabase-client/db'`

## 참고 문서

- [요구사항 문서](./디어쌤%20요구사항.txt)
- [기술 문서](./전체%20기술문서.txt)
- [UI/UX 문서](./전체%20유아이문서.txt)
- [개발 규칙](./rules.md)

