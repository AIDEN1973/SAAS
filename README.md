# 디어쌤 (DearSaam) - Multi-Tenant 학원관리 SaaS 플랫폼

멀티테넌트 + Supabase + Monorepo 아키텍처 기반 학원관리 시스템

## 프로젝트 구조

```
.
├── apps/                    # 프론트엔드 애플리케이션
│   ├── academy-admin/       # 학원 관리자/선생님용
│   ├── academy-parent/      # 학부모용
│   ├── super-admin/         # SaaS 본사 플랫폼 콘솔
│   └── public-gateway/      # 공개 페이지 (결제/키오스크)
│
├── packages/                # 공유 모듈
│   ├── core/                # Core Platform Layer
│   ├── industry/            # 업종별 모듈
│   ├── services/            # Service Layer
│   ├── hooks/               # React Hooks
│   ├── lib/                 # 공통 유틸
│   └── env-registry/        # 환경변수 관리
│
└── infra/                   # 인프라 설정
    └── supabase/            # Supabase 설정
```

## 기술 스택

- **Frontend**: React, Next.js (예정)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Monorepo**: Turborepo
- **Language**: TypeScript
- **Package Manager**: npm

## 개발 환경 설정

### 필수 요구사항

- Node.js >= 18.0.0
- npm >= 9.0.0

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 환경변수

각 앱/패키지의 `.env.example` 파일을 참조하여 `.env.local` 파일을 생성하세요.

필수 환경변수:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SERVICE_ROLE_KEY` (서버 전용)

## 문서

- [요구사항 문서](./디어쌤%20요구사항.txt)
- [기술 문서](./전체%20기술문서.txt)
- [UI/UX 문서](./전체%20유아이문서.txt)
- [개발 규칙](./rules.md)

