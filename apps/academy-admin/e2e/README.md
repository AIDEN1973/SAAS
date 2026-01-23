# E2E 테스트 가이드

## 목적

**핵심 사용자 플로우만 테스트**하여 제품이 동작하는지 확인합니다.

- ✅ 로그인 → 학생 등록 → 출결 체크
- ❌ 모든 엣지 케이스
- ❌ 100% 커버리지

## 실행 방법

### 1. 환경 변수 설정

```bash
# .env.test.local 파일 생성
cp .env.test.example .env.test.local

# 테스트 계정 정보 입력
# TEST_USER_EMAIL=your-test@example.com
# TEST_USER_PASSWORD=your-password
```

### 2. 로컬에서 실행

```bash
# Dev 서버 자동 시작 + 테스트 실행
npm run test:e2e

# UI 모드로 실행 (디버깅)
npx playwright test --ui

# 특정 테스트만 실행
npx playwright test critical-path
```

### 3. CI 환경에서 실행

```bash
# CI에서는 dev 서버를 별도로 실행해야 함
npm run dev &
npm run test:e2e
```

## 테스트 작성 가이드

### DO ✅
- 핵심 플로우만 테스트 (로그인, 학생 등록, 출결)
- 사용자 관점에서 작성 ("~할 수 있다")
- 실패 시나리오도 포함 (잘못된 비밀번호 등)

### DON'T ❌
- 모든 버튼 클릭 테스트
- UI 컴포넌트 단위 테스트 (Unit 테스트에서)
- 100% 커버리지 목표

## 테스트 데이터

- 테스트 전용 계정 사용 권장
- `TEST_STUDENT` 이름에 타임스탬프 포함 → 중복 방지
- 프로덕션 환경에서는 테스트 전용 테넌트 생성

## 트러블슈팅

### 로그인 실패
```bash
# Supabase URL 확인
echo $VITE_SUPABASE_URL

# 테스트 계정이 실제로 존재하는지 확인
```

### Timeout 에러
```typescript
// playwright.config.ts에서 timeout 증가
timeout: 60000, // 60초
```

### Selector 찾을 수 없음
```typescript
// UI가 변경되었을 수 있음
// 실제 페이지 구조 확인 후 selector 수정
await page.locator('button:has-text("로그인")').click();
```

## 참고

- [Playwright 공식 문서](https://playwright.dev)
- 테스트는 `chromium` 브라우저만 사용 (빠른 실행)
- CI 환경에서는 2회 재시도 자동 설정
