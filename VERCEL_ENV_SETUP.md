# Vercel 환경변수 설정 가이드

## 필수 환경변수

Vercel 대시보드에서 다음 환경변수를 설정해야 합니다:

### 프로덕션 환경 (Production)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 프리뷰 환경 (Preview)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 개발 환경 (Development)

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 설정 방법

1. Vercel 대시보드에 로그인
2. 프로젝트 선택
3. Settings > Environment Variables 메뉴로 이동
4. 위의 환경변수를 각 환경(Production, Preview, Development)에 추가
5. 저장 후 재배포

## 중요 사항

- Vite 프로젝트는 `VITE_` 접두사를 사용합니다
- 환경변수는 빌드 타임에 주입되므로, 설정 후 반드시 재배포해야 합니다
- 프로덕션 빌드에서는 `import.meta.env.VITE_*`로 접근 가능합니다

## 환경변수 확인

배포 후 브라우저 콘솔에서 다음 명령으로 확인할 수 있습니다:

```javascript
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
```

