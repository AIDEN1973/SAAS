# ARIA 접근성 가이드

## 개요

P2-1 개선 완료: 모든 페이지에 ARIA 속성 추가 가이드라인

이 문서는 SAMDLE 프로젝트의 모든 페이지와 컴포넌트에서 WCAG 2.1 AAA 수준의 접근성을 보장하기 위한 ARIA 속성 사용 가이드라인입니다.

## 기본 원칙

### 1. 터치 타깃 크기 (이미 준수 중 ✓)

- 모든 인터랙티브 요소: 최소 44x44px (WCAG 2.1 AAA)
- CSS 변수: `var(--touch-target-min)` 사용
- **현재 상태**: Sidebar.tsx를 비롯한 모든 주요 컴포넌트에서 이미 준수 중

```tsx
<button
  style={{
    minWidth: 'var(--touch-target-min)',
    minHeight: 'var(--touch-target-min)',
  }}
>
```

### 2. 의미 있는 HTML 태그 (이미 준수 중 ✓)

- `<button>`, `<nav>`, `<main>`, `<aside>`, `<header>` 등 의미 있는 태그 사용
- **현재 상태**: 모든 페이지에서 이미 준수 중

### 3. ARIA 속성 추가 (개선 완료 부분)

#### Sidebar.tsx (완료 ✓)

```tsx
// 일반 메뉴 아이템
<button
  aria-label={item.label}
  aria-current={isActive ? 'page' : undefined}
>
  {item.icon}
  <span>{item.label}</span>
</button>

// Advanced 메뉴 버튼
<button
  aria-label="더보기 메뉴"
  aria-expanded={advancedMenuOpen}
  aria-haspopup="true"
>
  <DotsThree />
</button>

// Advanced 메뉴 아이템
<button
  aria-label={item.label}
  role="menuitem"
>
  {item.icon}
  <span>{item.label}</span>
</button>
```

## 필수 ARIA 속성 체크리스트

### 버튼 (Buttons)

#### 텍스트가 있는 버튼
```tsx
// ✓ GOOD: children이 있으면 aria-label 불필요
<Button>저장</Button>
```

#### 아이콘만 있는 버튼
```tsx
// ✗ BAD
<Button>
  <X />
</Button>

// ✓ GOOD
<Button aria-label="닫기">
  <X />
</Button>
```

#### 토글 버튼
```tsx
// ✓ GOOD
<Button
  aria-label="사이드바 열기"
  aria-expanded={isOpen}
  aria-controls="sidebar"
>
  <Menu />
</Button>
```

### 네비게이션 (Navigation)

#### 현재 페이지 표시
```tsx
// ✓ GOOD
<button
  aria-current={isActive ? 'page' : undefined}
>
  대시보드
</button>
```

#### 메뉴 그룹
```tsx
// ✓ GOOD
<nav aria-label="주 메뉴">
  <ul role="menubar">
    <li role="none">
      <button role="menuitem">홈</button>
    </li>
  </ul>
</nav>
```

### 폼 (Forms)

#### 폼 필드 라벨
```tsx
// ✓ GOOD: SchemaForm이 자동으로 처리
<SchemaForm schema={schema} />

// 커스텀 폼
<label htmlFor="email">이메일</label>
<input id="email" type="email" aria-required="true" />
```

#### 에러 메시지
```tsx
// ✓ GOOD
<input
  aria-invalid={hasError}
  aria-describedby="email-error"
/>
{hasError && (
  <span id="email-error" role="alert">
    이메일 형식이 올바르지 않습니다.
  </span>
)}
```

### 다이얼로그/모달 (Dialogs/Modals)

#### Modal 컴포넌트
```tsx
// ✓ GOOD: Modal 컴포넌트가 자동으로 처리
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="메시지 발송"
>
  {/* role="dialog", aria-modal="true" 자동 적용 */}
</Modal>
```

### 알림 (Alerts)

#### 동적 콘텐츠 알림
```tsx
// ✓ GOOD
<div role="alert" aria-live="polite">
  저장되었습니다.
</div>

// 긴급 알림
<div role="alert" aria-live="assertive">
  오류가 발생했습니다.
</div>
```

### 테이블 (Tables)

#### 데이터 테이블
```tsx
// ✓ GOOD: SchemaTable이 자동으로 처리
<SchemaTable schema={tableSchema} />

// 커스텀 테이블
<table role="table" aria-label="학생 목록">
  <thead>
    <tr>
      <th scope="col">이름</th>
      <th scope="col">학년</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>홍길동</td>
      <td>3학년</td>
    </tr>
  </tbody>
</table>
```

## 페이지별 적용 가이드

### HomePage.tsx

**현재 상태**: 기본 접근성 준수 (터치 타깃, 의미 있는 태그)

**추가 권장사항**:
```tsx
// 카드 버튼에 aria-label 추가
<Card
  onClick={() => navigate('/students')}
  role="button"
  aria-label="학생 관리로 이동"
  tabIndex={0}
>
```

### NotificationsPage.tsx

**현재 상태**: 기본 접근성 준수

**개선 완료** (P2-2):
- NotificationFormModal 컴포넌트 추출로 중복 제거
- Modal/Drawer 자동 ARIA 속성 적용

**추가 권장사항**:
```tsx
// AI 초안 제안 배너
<div
  role="banner"
  aria-label="AI 초안 제안"
  tabIndex={0}
>
  <Sparkles aria-hidden="true" />
  <span>AI가 초안을 작성했습니다</span>
  <Button aria-label="AI 초안 적용">적용</Button>
</div>
```

### AnalyticsPage.tsx

**현재 상태**: 기본 접근성 준수

**개선 완료** (P1-2):
- Policy 하드코딩 제거 (useAnalyticsConfig 훅)

**추가 권장사항**:
```tsx
// 차트 영역
<div
  role="img"
  aria-label="월별 출석률 차트"
  aria-describedby="chart-description"
>
  <HeatmapCard ... />
</div>
<p id="chart-description" style={{ position: 'absolute', left: '-10000px' }}>
  2024년 1월부터 12월까지의 월별 출석률을 히트맵으로 표시합니다.
</p>
```

### AIPage.tsx

**현재 상태**: 기본 접근성 준수

**추가 권장사항**:
```tsx
// AI 인사이트 카드
<Card
  role="article"
  aria-labelledby="insight-title"
>
  <h3 id="insight-title">학생 위험도 분석</h3>
  <p>...</p>
</Card>
```

### ClassesPage.tsx, TeachersPage.tsx, BillingPage.tsx

**현재 상태**: 기본 접근성 준수

**추가 권장사항**:
- SubSidebar 메뉴에 `aria-label` 추가
- 테이블 필터 버튼에 `aria-label` 추가
- 상태 Badge에 `aria-label` 추가 (색상만으로 정보 전달 금지)

```tsx
// Badge 예시
<Badge variant="success" aria-label="활성 상태">
  활성
</Badge>

// SubSidebar 메뉴
<SubSidebar
  items={subMenuItems}
  aria-label="수업 관리 서브 메뉴"
/>
```

### AutomationSettingsPage.tsx

**현재 상태**: 기본 접근성 준수

**추가 권장사항**:
```tsx
// Switch 토글
<Switch
  checked={enabled}
  onChange={setEnabled}
  aria-label="자동 알림 활성화"
  aria-describedby="switch-description"
/>
<p id="switch-description">
  자동 알림을 활성화하면 이벤트 발생 시 자동으로 알림이 발송됩니다.
</p>
```

### AlimtalkSettingsPage.tsx

**현재 상태**: 기본 접근성 준수

**추가 권장사항**:
```tsx
// 탭 네비게이션
<button
  role="tab"
  aria-selected={selectedTab === 'status'}
  aria-controls="status-panel"
  id="status-tab"
>
  발송 상태
</button>
<div
  role="tabpanel"
  aria-labelledby="status-tab"
  id="status-panel"
>
  {/* 탭 콘텐츠 */}
</div>
```

## 자동화 도구

### ESLint 플러그인 추천

```json
// .eslintrc.json
{
  "extends": [
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": [
    "jsx-a11y"
  ],
  "rules": {
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error"
  }
}
```

### axe-core 통합

```tsx
// dev 환경에서만 실행
if (process.env.NODE_ENV === 'development') {
  import('react-axe').then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

## 테스트 체크리스트

### 수동 테스트

- [ ] 키보드만으로 모든 기능 사용 가능 (Tab, Enter, Space, Arrow keys)
- [ ] 스크린 리더(NVDA, JAWS, VoiceOver)로 모든 콘텐츠 읽기 가능
- [ ] 포커스 표시 명확 (outline, border, background 변화)
- [ ] 색상만으로 정보 전달하지 않음 (아이콘, 텍스트 병행)

### 자동화 테스트

```tsx
// Vitest + Testing Library
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should not have accessibility violations', async () => {
  const { container } = render(<HomePage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 참고 자료

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [React Accessibility](https://react.dev/learn/accessibility)

## 완료 상태

### P1 이슈 (완료 ✓)
- [x] Sidebar.tsx의 any 타입 제거
- [x] AnalyticsPage Policy 하드코딩 제거 (useAnalyticsConfig 훅)

### P2 이슈 (완료 ✓)
- [x] Sidebar.tsx ARIA 속성 추가
- [x] NotificationsPage 중복 폼 추출 (NotificationFormModal)
- [x] ARIA 접근성 가이드 문서 작성 (이 문서)

### 향후 작업 (권장)
- [ ] 모든 페이지의 아이콘 전용 버튼에 aria-label 추가
- [ ] 차트/그래프에 aria-label, aria-describedby 추가
- [ ] ESLint jsx-a11y 플러그인 활성화
- [ ] axe-core 통합 및 CI/CD 파이프라인에 접근성 테스트 추가
- [ ] 스크린 리더 테스트 자동화

---

**문서 버전**: 1.0
**최종 수정일**: 2026-01-15
**작성자**: Claude Sonnet 4.5
