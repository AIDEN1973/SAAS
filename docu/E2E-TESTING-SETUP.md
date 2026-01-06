# E2E 테스트 환경 구축 가이드

## 📋 개요

E2E (End-to-End) 테스트는 실제 사용자처럼 애플리케이션과 상호작용하여 전체 워크플로우를 검증합니다.

## 🛠 사전 요구사항

### 1. Supabase 로컬 인스턴스

E2E 테스트는 로컬 Supabase 인스턴스가 필요합니다.

```bash
# Supabase CLI 설치
npm install -g supabase

# Supabase 로컬 시작
cd infra/supabase
supabase start
```

로컬 Supabase가 시작되면 다음 정보를 확인할 수 있습니다:
- API URL: `http://localhost:54321`
- Anon Key: (콘솔에 표시됨)

### 2. 환경 변수 설정

`.env.test` 파일이 이미 생성되어 있습니다. 필요시 수정하세요:

```bash
# .env.test
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
PLAYWRIGHT_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!
```

## 🚀 E2E 테스트 실행 단계

### 1단계: Supabase 로컬 시작

```bash
cd infra/supabase
supabase start
```

### 2단계: 테스트 데이터 시드

```bash
npm run seed:test
```

이 명령은 다음 데이터를 생성합니다:
- ✅ 테스트 사용자 3명 (관리자, 일반 사용자, 기본 사용자)
- ✅ 테스트 테넌트 1개
- ✅ 샘플 학생 5명
- ✅ 샘플 출석 데이터
- ✅ 샘플 청구서 데이터

### 3단계: E2E 테스트 실행

```bash
# 모든 브라우저에서 실행
npm run test:e2e

# Chromium만 실행
npm run test:e2e:chromium

# UI 모드로 실행 (권장)
npm run test:e2e:ui

# 디버그 모드로 실행
npm run test:e2e:debug
```

### 4단계: 테스트 리포트 확인

```bash
npm run test:e2e:report
```

## 📊 테스트 커버리지

현재 E2E 테스트는 다음을 커버합니다:

### 1. 로그인 플로우 (6 tests)
- ✅ 이메일/비밀번호 로그인
- ✅ 잘못된 비밀번호 처리
- ✅ 존재하지 않는 이메일 처리
- ✅ 테넌트 선택
- ✅ 로그아웃
- ✅ 필수 필드 검증

### 2. 학생 관리 (6 tests)
- ✅ 학생 목록 조회
- ✅ 학생 등록
- ✅ 학생 정보 수정
- ✅ 학생 검색
- ✅ 학생 필터링
- ✅ 학생 상세 정보

### 3. 출석 관리 (4 tests)
- ✅ 출석 체크 페이지
- ✅ 출석 체크
- ✅ 출석 기록 조회
- ✅ 출석 통계

### 4. 결제 관리 (6 tests)
- ✅ 청구서 목록
- ✅ 청구서 상세
- ✅ 상태별 필터링
- ✅ 청구서 통계
- ✅ 기간별 조회
- ✅ 엑셀 내보내기

### 5. RBAC (5 tests)
- ✅ 관리자 권한
- ✅ 일반 사용자 권한
- ✅ 권한 없는 페이지 리다이렉션
- ✅ 로그아웃 후 보호
- ✅ 테넌트 격리

**총 테스트**: 27개 시나리오 × 3개 브라우저 = **81개 테스트**

## 🐛 문제 해결

### 문제 1: Supabase 연결 실패

**증상**: `Error: fetch failed` 또는 `ECONNREFUSED`

**해결**:
```bash
# Supabase가 실행 중인지 확인
supabase status

# 실행 중이 아니면 시작
supabase start
```

### 문제 2: 테스트 사용자 로그인 실패

**증상**: `Invalid login credentials`

**해결**:
```bash
# 시드 데이터 재생성
npm run seed:test
```

### 문제 3: 개발 서버 시작 실패

**증상**: `webServer.command failed`

**해결**:
```bash
# 개발 서버 수동 시작
npm run dev:admin

# 다른 터미널에서 테스트 실행 (서버 재시작 방지)
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm run test:e2e
```

### 문제 4: 포트 충돌

**증상**: `Port 3000 is already in use`

**해결**:
```bash
# .env.test에서 포트 변경
PLAYWRIGHT_BASE_URL=http://localhost:3001

# 또는 기존 프로세스 종료
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

## 📝 테스트 작성 가이드

### 기본 템플릿

```typescript
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('내 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('시나리오 설명', async ({ page }) => {
    // 페이지 이동
    await page.goto('/my-feature');

    // 요소 찾기
    const button = page.locator('button:has-text("클릭")');

    // 클릭
    await button.click();

    // 검증
    await expect(page).toHaveURL('/expected-url');
    await expect(page.locator('.success')).toBeVisible();
  });
});
```

### 모범 사례

1. **테스트 독립성**: 각 테스트는 독립적으로 실행 가능해야 함
2. **명확한 시나리오**: 테스트 이름은 "무엇을 테스트하는지" 명확히 표현
3. **명시적 대기**: `waitFor`를 사용하여 비동기 동작 처리
4. **선택자 우선순위**: `data-testid > role > text > css`
5. **에러 핸들링**: 예상되는 에러도 테스트

## 🎯 다음 단계

### 추가할 테스트

1. **반응형 테스트**: 모바일 뷰포트
2. **접근성 테스트**: ARIA, 키보드 네비게이션
3. **성능 테스트**: Lighthouse 통합
4. **다국어 테스트**: i18n 검증

### CI/CD 통합

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run seed:test
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Supabase 로컬 개발](https://supabase.com/docs/guides/cli)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)

## ✅ 체크리스트

E2E 테스트 실행 전 확인사항:

- [ ] Supabase 로컬 인스턴스 실행 중
- [ ] `.env.test` 파일 설정 완료
- [ ] 테스트 데이터 시드 완료 (`npm run seed:test`)
- [ ] 개발 서버 준비 (자동 시작 또는 수동 시작)
- [ ] 포트 충돌 없음 (3000, 54321)

---

**마지막 업데이트**: 2026-01-05
**작성자**: Claude Code AI Assistant
