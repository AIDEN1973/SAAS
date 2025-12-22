# Shared Catalog 템플릿 가이드

이 디렉토리에는 Shared Catalog 등록 및 관리에 필요한 템플릿이 포함되어 있습니다.

## 파일 목록

### 1. `catalog-entry-template.ts`
Shared Catalog에 새 Hook/Feature/Adapter를 등록할 때 사용하는 템플릿입니다.

**사용 방법:**
1. 템플릿을 복사하여 `packages/shared-catalog.ts`의 `sharedCatalog` 객체에 추가
2. ⚠️ 표시된 필드를 실제 값으로 수정
3. Hook의 JSDoc 주석에서 `useWhen`, `doNot` 정보 추출 시도
4. `scripts/check-shared-catalog.ts`로 검증

### 2. `eslint-rule-template.cjs`
ESLint `no-restricted-syntax` 규칙을 추가할 때 사용하는 템플릿입니다.

**사용 방법:**
1. 템플릿을 복사하여 `apps/*/.eslintrc.cjs`의 `rules` 섹션에 추가
2. `selector`의 테이블명을 실제 값으로 변경
3. `message`의 Hook 정보를 실제 Hook에 맞게 변경
4. 여러 패턴을 차단해야 하는 경우, 배열에 여러 객체 추가

### 3. `replacement-guide.md`
직접 구현 패턴을 공통 Hook으로 치환하는 가이드입니다.

**주요 내용:**
- 패턴 탐지 방법
- 적절한 Hook 선택 방법
- 코드 치환 예시
- 주의사항 및 체크리스트

## 빠른 시작

### 새 Hook 등록하기

1. **템플릿 복사:**
   ```bash
   # catalog-entry-template.ts에서 Hook 템플릿 복사
   ```

2. **packages/shared-catalog.ts에 추가:**
   ```typescript
   hooks: {
     'use-your-hook': {
       path: '@hooks/use-your-hook',
       import: 'import { useYourHook } from "@hooks/use-your-hook"',
       useWhen: '이 Hook을 언제 사용해야 하는가?',
       // ...
     },
   }
   ```

3. **ESLint 규칙 추가 (필요 시):**
   ```bash
   # eslint-rule-template.cjs 참고하여 apps/*/.eslintrc.cjs에 추가
   ```

4. **검증:**
   ```bash
   npm run check:shared-catalog
   ```

## 관련 문서

- `메모` (111-163줄): 지시문
- `packages/shared-catalog.ts`: 등록된 공통화 요소 목록
- `scripts/check-shared-catalog.ts`: 검증 스크립트

