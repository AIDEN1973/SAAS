# Edge Functions 파일 동기화 가이드

## 문제점

Supabase CLI는 `supabase/functions` 디렉토리를 사용하여 Edge Functions를 배포합니다.
하지만 실제 소스 파일은 `functions/` 디렉토리에 있습니다.

이로 인해 두 디렉토리 간 동기화 문제가 발생할 수 있습니다.

## 디렉토리 구조

```
infra/supabase/
├── functions/              # 소스 파일 (작업 디렉토리)
│   ├── _shared/           # 공유 모듈
│   └── chatops/           # 각 Edge Function
└── supabase/
    └── functions/         # 배포용 디렉토리 (Supabase CLI가 사용)
        ├── _shared/       # 공유 모듈 (동기화 필요)
        └── chatops/       # 각 Edge Function (동기화 필요)
```

## 해결 방법

### 자동 동기화

`deploy.sh` 스크립트는 배포 전 자동으로 파일을 동기화합니다.

### 수동 동기화

```bash
cd infra/supabase
bash functions/sync-for-deploy.sh
```

## 주의사항

1. **항상 `functions/` 디렉토리에서 작업하세요** - 이것이 소스 디렉토리입니다.
2. **배포 전에 동기화를 확인하세요** - `sync-for-deploy.sh`를 실행하거나 `deploy.sh`를 사용하세요.
3. **`supabase/functions/`는 배포용이므로 직접 수정하지 마세요** - `functions/`에서 수정하고 동기화하세요.
