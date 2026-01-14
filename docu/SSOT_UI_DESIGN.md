# SSOT: UI Design, Style, Layout, Component Rules

**정본 문서**: 디자인/스타일/레이아웃/공통 컴포넌트 사용 규칙의 단일 정본(SSOT)

**버전**: 1.0.0
**최종 업데이트**: 2026-01-10
**관련 문서**: `docu/디어쌤_아키텍처.md`

---

## A. Scope & Non-goals

### Scope (이 문서가 다루는 범위)

✅ **다루는 항목**:
- Design Tokens (색상, 간격, 타이포그래피, 그림자 등)
- Theme Engine (다크모드, 테넌트 테마, 업종 테마)
- UI Core Component 카탈로그 및 사용 규칙
- Layout Primitives (Grid, Stack, Container, Section 등)
- Page Templates (Dashboard, List+Detail, Settings, Wizard 등)
- Responsive 규칙 (브레이크포인트, 슬롯 우선순위)
- 상태 UI (loading/error/empty) 단일화 규칙
- SDUI 연동 규칙 (스키마에서 표현 가능한 ui.variant/ui.density/ui.intent)

### Non-goals (이 문서가 다루지 않는 범위)

❌ **다루지 않는 항목**:
- 비즈니스 로직 (자동화 정책, 임계값 등) → `docu/디어쌤 아키텍처.md` 참조
- API 호출 규칙 → `docu/rules.md` 참조
- 스키마 엔진 상세 구현 → `docu/스키마엔진.txt` 참조
- 성능 최적화 전략 → `docu/디어쌤 아키텍처.md` 7장 참조

---

## B. Layered SSOT (계층 구조)

UI 디자인 시스템은 다음 3계층으로 구성됩니다:

```
┌─────────────────────────────────────┐
│  Layout Primitives & Page Templates │  ← 레이아웃 조립 규칙
├─────────────────────────────────────┤
│  UI Core Components                 │  ← 컴포넌트 카탈로그
├─────────────────────────────────────┤
│  Design Tokens & Theme Engine       │  ← 토큰 정의 및 테마 병합
└─────────────────────────────────────┘
```

**불변 규칙**:
1. **하위 계층은 상위 계층을 참조하지 않음**: Tokens → Components → Layout 순서로만 의존
2. **페이지/피처는 SSOT를 소비만 함**: 새 규칙/새 값은 SSOT에 먼저 추가
3. **하드코딩 금지**: 모든 디자인 값은 Design Tokens로만 존재

---

## C. Design Tokens SSOT

### C-1. 토큰 종류 및 네이밍 규칙

**정본 위치**: `packages/ui-core/src/styles.css` (CSS 변수), `packages/design-system/src/tokens.ts` (TypeScript 타입)

#### 토큰 카테고리

| 카테고리 | CSS 변수 패턴 | TypeScript 타입 | 예시 |
|---------|--------------|----------------|------|
| **Spacing** | `--spacing-{size}` | `SpacingToken` | `--spacing-md`, `--spacing-lg` |
| **Color** | `--color-{name}` | `ColorToken` | `--color-primary`, `--color-text` |
| **Typography** | `--font-size-{size}`, `--font-weight-{weight}`, `--line-height-{variant}` | - | `--font-size-base`, `--font-weight-bold` |
| **Border** | `--border-radius-{size}`, `--border-width-{thickness}` | - | `--border-radius-lg`, `--border-width-thin` |
| **Shadow** | `--shadow-{size}` | - | `--shadow-md`, `--shadow-lg` |
| **Z-Index** | `--z-{layer}` | - | `--z-modal`, `--z-tooltip` |
| **Size** | `--size-{component}-{size}` | `SizeToken` | `--size-icon-base`, `--size-avatar-md` |
| **Opacity** | `--opacity-{state}` | - | `--opacity-disabled`, `--opacity-secondary` |
| **Layout** | `--width-{element}`, `--height-{element}` | - | `--width-sidebar`, `--height-header` |

#### 네이밍 규칙

**✅ 허용 패턴**:
- `--spacing-{xs|sm|md|lg|xl|2xl|3xl}`: 간격 토큰
- `--color-{primary|secondary|success|warning|error|info|text|background|surface}`: 색상 토큰
- `--font-size-{xs|sm|base|lg|xl|2xl|3xl}`: 폰트 크기 토큰
- `--border-radius-{xs|sm|md|lg|xl|2xl|full}`: 테두리 반경 토큰
- `--size-{component}-{xs|sm|md|lg|xl}`: 컴포넌트 크기 토큰

**❌ 금지 패턴**:
- 하드코딩된 px/rem/em 값: `16px`, `1rem` → `var(--spacing-md)` 사용
- 하드코딩된 hex 색상: `#3b82f6` → `var(--color-primary)` 사용
- 하드코딩된 opacity: `opacity: 0.5` → `opacity: var(--opacity-disabled)` 사용
- 하드코딩된 border: `1px solid` → `var(--border-width-thin) solid` 사용

### C-2. 토큰 추가 규칙

**새 토큰 추가 시**:
1. `packages/ui-core/src/styles.css`에 CSS 변수 추가
2. `packages/design-system/src/tokens.ts`에 TypeScript 타입 추가 (해당되는 경우)
3. 이 문서의 "토큰 카테고리" 표에 추가
4. 사용 예시를 "금지 예시 vs 허용 예시" 섹션에 추가

**토큰 값 변경 시**:
1. `packages/ui-core/src/styles.css`에서만 수정
2. 컴포넌트 파일에서 직접 값 변경 금지
3. 변경 영향 범위 문서화 (예: "모든 버튼 패딩에 영향")

### C-3. 금지 규칙 (Hard Rules)

#### ❌ 금지 예시

```tsx
// ❌ 하드코딩된 px 값
<div style={{ padding: '16px' }}>

// ❌ 하드코딩된 hex 색상
<div style={{ color: '#3b82f6' }}>

// ❌ 하드코딩된 opacity
<div style={{ opacity: 0.5 }}>

// ❌ 하드코딩된 border
<div style={{ border: '1px solid #ccc' }}>

// ❌ 하드코딩된 아이콘 크기
<Icon size={16} />
```

#### ✅ 허용 예시

```tsx
// ✅ CSS 변수 사용
<div style={{ padding: 'var(--spacing-md)' }}>

// ✅ CSS 변수 사용
<div style={{ color: 'var(--color-primary)' }}>

// ✅ CSS 변수 사용
<div style={{ opacity: 'var(--opacity-disabled)' }}>

// ✅ CSS 변수 사용
<div style={{ border: 'var(--border-width-thin) solid var(--color-gray-200)' }}>

// ✅ Hook 사용 (아이콘 크기)
import { useIconSize } from '@ui-core/react';
const iconSize = useIconSize();
<Icon size={iconSize} />
```

#### 예외 (허용되는 하드코딩)

다음은 하드코딩이 허용됩니다 (레이아웃/속성 값):
- CSS 속성 값: `display: 'flex'`, `flex: 1`, `position: 'absolute'`
- 레이아웃용 특수 값: `width: 0`, `minWidth: 0`, `height: 0`
- 문자열 리터럴: `'100%'`, `'auto'`, `'none'`

---

## D. Theme/Override SSOT

### D-1. Theme Merge Priority (우선순위)

**정본 위치**: `packages/design-system/src/theme.ts`, `packages/ui-core/src/hooks/useTheme.ts`

Theme은 다음 순서로 병합됩니다 (낮은 번호가 우선):

1. **System Default Tokens** (최하위 우선순위)
   - 위치: `packages/ui-core/src/styles.css`의 `:root` 섹션
   - 용도: 모든 테넌트 공통 기본값

2. **Industry Tokens** (업종별 오버라이드)
   - 위치: `industry_themes` 테이블 (DB)
   - 용도: 업종별 색상/스타일 차이
   - 예시: 학원(academy) vs 미용실(salon) 색상 차이

3. **Tenant Theme Override** (테넌트별 오버라이드)
   - 위치: `tenant_theme_overrides` 테이블 (DB)
   - 용도: 테넌트별 브랜드 색상 커스터마이징
   - 제한: v1.0 정책상 **색상만** 변경 가능 (폰트/간격/크기는 공통)

4. **Dark Mode** (다크모드)
   - 위치: 시스템 설정 자동 감지 (`prefers-color-scheme: dark`)
   - 용도: 다크모드 색상 조정
   - 적용: `useTheme({ mode: 'auto' })` 사용 시 자동 감지

5. **High Contrast** (고대비 모드, 최상위 우선순위)
   - 위치: 시스템 설정 자동 감지 (`prefers-contrast: high`)
   - 용도: 접근성(WCAG 2.1 AAA) 대비율 확보
   - 적용: `useTheme({ highContrast: true })` 사용 시 적용

### D-2. 허용 범위 및 제한

#### ✅ 허용되는 오버라이드

- **색상 토큰**: `--color-primary`, `--color-secondary`, `--color-success` 등
- **배경색**: `--color-background`, `--color-surface` 등
- **텍스트 색상**: `--color-text`, `--color-text-secondary` 등

#### ❌ 금지되는 오버라이드

- **폰트 패밀리**: `--font-family` (모든 테넌트 공통)
- **간격 토큰**: `--spacing-*` (모든 테넌트 공통)
- **폰트 크기**: `--font-size-*` (모든 테넌트 공통)
- **테두리 반경**: `--border-radius-*` (모든 테넌트 공통)
- **그림자**: `--shadow-*` (모든 테넌트 공통)

**이유**: 일관된 UX 유지 및 유지보수 비용 최소화

### D-3. 예외 처리

**Theme이 없을 때**:
- `industry_themes` 테이블에 데이터가 없으면 → System Default 사용
- `tenant_theme_overrides` 테이블에 데이터가 없으면 → Industry Theme 또는 System Default 사용
- **Fail Closed**: Theme이 없어도 UI는 정상 동작 (기본값 사용)

**Theme 적용 실패 시**:
- `useTheme()` Hook이 에러를 반환하지 않음
- 기본값(System Default)으로 자동 fallback
- 에러 로깅만 수행 (사용자에게 노출하지 않음)

---

## E. UI Core Component SSOT

### E-1. 컴포넌트 분류

**정본 위치**: `packages/ui-core/src/components/index.ts`

#### 분류 체계

| 분류 | 설명 | 예시 |
|------|------|------|
| **Primitive** | 기본 UI 요소 (버튼, 입력, 배지 등) | `Button`, `Input`, `Badge`, `Avatar` |
| **Composite** | 여러 Primitive 조합 (카드, 모달, 테이블 등) | `Card`, `Modal`, `DataTable`, `FormField` |
| **Pattern** | 특정 패턴 구현 (페이지 헤더, 액션 바 등) | `PageHeader`, `BottomActionBar`, `ContextRecommendationBanner` |
| **Layout** | 레이아웃 구조 (컨테이너, 그리드, 사이드바 등) | `Container`, `Grid`, `Sidebar`, `SubSidebar`, `AppLayout` |
| **Industry** | 업종별 라우팅 및 용어 (Phase 3) | `IndustryBasedRoute`, `useIndustryTerms`, `useIndustryConfig` |

**불변 규칙**:
- **Primitive**: 비즈니스 규칙 없음, 네트워크/DB 호출 직접 금지
- **Composite**: Primitive 조합, 비즈니스 규칙 없음
- **Pattern**: 특정 UX 패턴 구현, 비즈니스 규칙 없음
- **Layout**: 레이아웃 구조만 제공, 콘텐츠는 children으로 받음
- **Industry**: 업종별 차이를 SSOT(Industry Registry)로 추상화, 하드코딩된 용어 사용 금지

### E-2. "언제 무엇을 쓰는지" 결정표

#### 페이지 구조

| 용도 | 컴포넌트 | 위치 |
|------|---------|------|
| 전체 앱 레이아웃 | `AppLayout` | 앱 최상위 |
| 페이지 컨테이너 | `Container` | 각 페이지 최상위 |
| 페이지 헤더 | `PageHeader` | `Container` 내부 첫 번째 요소 |
| 사이드바 | `Sidebar` | `AppLayout` 내부 |
| 서브 사이드바 | `SubSidebar` | 메인 사이드바 우측, 페이지 내부 서브 네비게이션 |
| 글로벌 헤더 | `Header` | `AppLayout` 내부 |

#### 폼 입력

| 용도 | 컴포넌트 | Props |
|------|---------|-------|
| 텍스트 입력 | `Input` | `type`, `placeholder`, `error` |
| 긴 텍스트 입력 | `Textarea` | `rows`, `placeholder`, `error` |
| 선택 드롭다운 | `Select` | `options`, `placeholder`, `error` |
| 날짜 선택 | `DatePicker` | `value`, `onChange`, `error` |
| 체크박스 | `Checkbox` | `checked`, `onChange`, `label` |
| 라디오 버튼 | `Radio` | `checked`, `onChange`, `label` |
| 스위치 | `Switch` | `checked`, `onChange`, `label` |

#### 데이터 표시

| 용도 | 컴포넌트 | Props |
|------|---------|-------|
| 카드 | `Card` | `padding`, `variant`, `title` |
| 테이블 | `DataTable` | `data`, `columns`, `pagination` |
| 배지 | `Badge` | `variant`, `size` |
| 아바타 | `Avatar` | `src`, `size`, `alt` |
| 툴팁 | `Tooltip` | `content`, `placement` |

#### 액션/인터랙션

| 용도 | 컴포넌트 | Props |
|------|---------|-------|
| 버튼 | `Button` | `variant`, `size`, `onClick` |
| 모달 | `Modal` | `isOpen`, `onClose`, `title` |
| 드로어 | `Drawer` | `isOpen`, `onClose`, `placement` |
| 토스트 | `Toast` | `message`, `type`, `duration` |
| 페이지네이션 | `Pagination` | `currentPage`, `totalPages`, `onPageChange` |

#### 대시보드 카드

| 용도 | 컴포넌트 | 위치 |
|------|---------|------|
| 알림/통계 카드 레이아웃 | `NotificationCardLayout` | `packages/ui-core/src/components/NotificationCardLayout.tsx` |
| 리스트형 카드 레이아웃 | `ListCardLayout` | `packages/ui-core/src/components/ListCardLayout.tsx` |
| 카드 그리드 레이아웃 | `CardGridLayout` | `apps/academy-admin/src/components/CardGridLayout.tsx` |

**⚠️ 주의**: `CardGridLayout`은 현재 Academy 전용이지만, 향후 `packages/ui-core`로 이동 예정

#### 업종별 라우팅 및 용어 (Phase 3)

| 용도 | 컴포넌트/Hook | 위치 |
|------|--------------|------|
| 업종별 용어 가져오기 | `useIndustryTerms` | `packages/hooks/use-industry-terms` |
| 용어 + 페이지 가시성 체크 | `useIndustryConfig` | `packages/hooks/use-industry-config` |
| 업종별 라우팅 보호 | `IndustryBasedRoute` | `apps/academy-admin/src/components/IndustryBasedRoute.tsx` |
| 업종별 용어 레지스트리 (SSOT) | `getIndustryTerms` | `packages/industry/industry-registry.ts` |

**사용 예시**:
```typescript
import { useIndustryTerms } from '@hooks/use-industry-terms';

function MyPage() {
  const terms = useIndustryTerms();

  return (
    <PageHeader title={`${terms.PERSON_LABEL_PRIMARY} 관리`}>
      <Button>신규 {terms.PERSON_LABEL_PRIMARY} 등록</Button>
    </PageHeader>
  );
}
```

**⚠️ 중요**: 모든 업종 특화 용어(학생, 반, 강사 등)는 하드코딩 금지. Industry Registry를 통해서만 참조.

**상세 문서**: `docu/디어쌤_아키텍처.md` 13장 참조

### E-3. 상태 UI (loading/error/empty) 단일화 규칙

**현재 상태**: 여러 페이지에서 중복 구현됨 (통일 필요)

#### 표준 패턴 (권장)

**로딩 상태**:
```tsx
// ✅ 권장: Spinner 컴포넌트 사용
import { Spinner } from '@ui-core/react';

{isLoading && (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 'var(--spacing-xl)',
  }}>
    <Spinner size="md" />
  </div>
)}
```

**에러 상태**:
```tsx
// ✅ 권장: Card + 에러 메시지
import { Card } from '@ui-core/react';

{error && (
  <Card padding="md" variant="outlined">
    <div style={{ color: 'var(--color-error)' }}>
      오류: {error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.'}
    </div>
  </Card>
)}
```

**빈 상태**:
```tsx
// ✅ 권장: Card + 안내 메시지 + 액션 버튼
import { Card, Button } from '@ui-core/react';

{!isLoading && !error && items.length === 0 && (
  <Card padding="lg" variant="default">
    <div style={{
      textAlign: 'center',
      color: 'var(--color-text-secondary)',
      padding: 'var(--spacing-xl)'
    }}>
      <p style={{ marginBottom: 'var(--spacing-md)' }}>
        데이터가 없습니다.
      </p>
      <Button variant="outline" onClick={handleCreate}>
        첫 항목 생성하기
      </Button>
    </div>
  </Card>
)}
```

#### AI 분석 로딩 상태 (진행률 표시)

**정본 위치**: `apps/academy-admin/src/pages/students/components/AIAnalysisLoadingUI.tsx`

AI 분석 및 생성 작업의 로딩 상태는 전용 컴포넌트를 사용합니다:

```tsx
// ✅ 권장: AIAnalysisLoadingUI 컴포넌트 사용
import { AIAnalysisLoadingUI } from '../components/AIAnalysisLoadingUI';

// 1. 분석 단계 정의
const ANALYSIS_STEPS = [
  { step: 1, label: '데이터 수집 중', duration: 800 },
  { step: 2, label: 'AI 분석 중', duration: 3000 },
  { step: 3, label: '결과 저장 중', duration: 500 },
] as const;

// 2. 상태 및 단계 추적
const [currentStep, setCurrentStep] = useState<number>(0);

// 3. 진행 단계 시뮬레이션
useEffect(() => {
  if (!isAnalyzing) {
    setCurrentStep(0);
    return;
  }

  setCurrentStep(1);
  const timers: NodeJS.Timeout[] = [];
  let accumulatedTime = 0;

  ANALYSIS_STEPS.forEach((step, index) => {
    if (index === 0) return;
    accumulatedTime += ANALYSIS_STEPS[index - 1].duration;
    const timer = setTimeout(() => {
      setCurrentStep(step.step);
    }, accumulatedTime);
    timers.push(timer);
  });

  return () => {
    timers.forEach(timer => clearTimeout(timer));
  };
}, [isAnalyzing]);

// 4. UI 렌더링
{isAnalyzing ? (
  <AIAnalysisLoadingUI
    steps={ANALYSIS_STEPS}
    currentStep={currentStep}
    message="분석이 완료될 때까지 잠시만 기다려주세요."
  />
) : (
  // 일반 콘텐츠
)}
```

**레이아웃 구조**:
- 상단: 애니메이션 점 3개 (`.chatops-loading-dot` 클래스 사용)
- 중간: 단계별 인디케이터 (숫자 원형) + 현재 단계 문구
- 하단: 설명 메시지

**Props**:
- `steps`: `readonly AIAnalysisStep[]` - 분석 단계 배열
- `currentStep`: `number` - 현재 진행 중인 단계 번호
- `message`: `string` (선택) - 하단 설명 메시지 (기본값: "분석이 완료될 때까지 잠시만 기다려주세요.")

**사용 위치**:
- `RiskAnalysisTab.tsx`: 이탈위험 분석 (3단계)
- `ConsultationsTab.tsx`: 상담 AI 요약 생성 (3단계)
- `AIPage.tsx`: 성과 분석 인사이트 생성 (3단계), 상담일지 자동 요약 (3단계)

**스타일 규칙**:
- 모든 값은 CSS 변수 사용 (하드코딩 금지)
- 단계 인디케이터 크기: `var(--size-avatar-sm)` (32px)
- 전환 효과: `var(--transition-all)`
- 간격: `var(--spacing-*)` 토큰만 사용
- 색상: `var(--color-*)` 토큰만 사용

#### 공통 컴포넌트 현황

**구현 완료**:
- ✅ `EmptyState`: 빈 상태 표시 (안내 메시지 + 아이콘)
- ✅ `AIAnalysisLoadingUI`: AI 분석/생성 작업 로딩 상태 (진행률 표시)

**TODO**: `packages/ui-core/src/components/`에 다음 컴포넌트 추가:
- `LoadingState`: 일반 로딩 상태 표시 (Spinner + 메시지)
- `ErrorState`: 에러 상태 표시 (에러 메시지 + 재시도 버튼)

**현재**: 각 페이지에서 위 패턴을 따르되, 향후 공통 컴포넌트로 교체 예정

---

## F. Layout SSOT

### F-1. Layout Primitives 규칙

**정본 위치**: `packages/ui-core/src/components/Layout.tsx`

#### Container

**용도**: 페이지 최대 너비 제한 및 패딩 제공

```tsx
import { Container } from '@ui-core/react';

<Container maxWidth="xl" padding="lg">
  {/* 페이지 콘텐츠 */}
</Container>
```

**Props**:
- `maxWidth`: `'sm' | 'md' | 'lg' | 'xl' | '2xl'` (기본값: `'xl'`)
- `padding`: `'none' | 'sm' | 'md' | 'lg' | 'xl'` (기본값: `'lg'`)

#### Grid

**용도**: 그리드 레이아웃 (반응형 컬럼)

```tsx
import { Grid } from '@ui-core/react';

<Grid columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} gap="md">
  {/* 그리드 아이템 */}
</Grid>
```

**Props**:
- `columns`: `{ xs?: number, sm?: number, md?: number, lg?: number, xl?: number }`
- `gap`: `SpacingToken` (기본값: `'md'`)

#### SidebarLayout

**용도**: 사이드바 + 메인 콘텐츠 레이아웃

```tsx
import { SidebarLayout } from '@ui-core/react';

<SidebarLayout
  sidebar={<Sidebar />}
  sidebarWidth="13rem"
>
  {/* 메인 콘텐츠 */}
</SidebarLayout>
```

#### SubSidebar

**용도**: 페이지 내부 서브 네비게이션 사이드바 (메인 사이드바 우측)

**정본 위치**: `packages/ui-core/src/components/SubSidebar.tsx`

```tsx
import { SubSidebar } from '@ui-core/react';

<div style={{ display: 'flex', height: 'var(--height-viewport)', width: 'var(--width-full)' }}>
  {!isMobileMode && (
    <SubSidebar
      title="학생관리"
      items={subMenuItems}
      selectedId={selectedSubMenu}
      onSelect={handleSubMenuChange}
    />
  )}
  <div style={{ flex: 1, overflow: 'auto', height: 'var(--height-full)' }}>
    {/* 메인 콘텐츠 */}
  </div>
</div>
```

**Props**:
- `title`: 사이드바 제목 (PageHeader 타이틀과 동일한 스타일 적용)
- `items`: 메뉴 아이템 목록 (`{ id, label, icon?, disabled?, badge? }`)
- `selectedId`: 현재 선택된 아이템 ID
- `onSelect`: 아이템 선택 핸들러
- `width`: 너비 (기본값: `var(--width-agent-history-sidebar)`)
- `collapsedWidth`: 축소 시 너비 (기본값: `var(--touch-target-min)`)
- `collapsed`: 축소 상태 (controlled)
- `onCollapsedChange`: 축소 상태 변경 핸들러

**스타일 규칙**:
- 헤더 타이틀: `PageHeader`와 동일한 폰트 스타일 (`--font-size-3xl`, `--font-weight-extrabold`, `--line-height-tight`)
- 상단 여백: `Container`의 `paddingTop`과 동일 (`--spacing-xl`)
- 선택/호버 배경색: `var(--color-primary-40)`
- 선택된 메뉴 텍스트: `var(--color-primary)`
- 모든 값은 CSS 변수 사용 (하드코딩 금지)

**사용 위치**:
- `AIPage` - 인공지능 페이지
- `AnalyticsPage` - 분석 페이지
- `AttendancePage` - 출결 페이지
- `AutomationSettingsPage` - 자동화 설정 페이지
- `BillingPage` - 수납 페이지
- `ClassesPage` - 반 관리 페이지
- `ManualPage` - 매뉴얼 페이지
- `NotificationsPage` - 알림 페이지
- `StudentsHomePage` - 학생 홈 페이지
- `StudentsPage` - 학생 관리 페이지
- `TeachersPage` - 강사 관리 페이지

**패턴**: 서브 메뉴가 있는 모든 주요 페이지에서 일관되게 사용

**메뉴 정의 SSOT**: `apps/academy-admin/src/constants/sub-sidebar-menus.ts`
- 각 페이지별 서브 메뉴 아이템 정의
- 타입 안전성을 위한 TypeScript 타입 정의
- 아이콘 크기는 상수로 관리 (`ICON_SIZE`)
- 예시: `AI_SUB_MENU_ITEMS`, `STUDENTS_SUB_MENU_ITEMS`, `ATTENDANCE_SUB_MENU_ITEMS` 등

**URL 상태 관리**:
- `getSubMenuFromUrl()`: URL 파라미터에서 선택된 서브 메뉴 ID 추출
- `setSubMenuToUrl()`: 선택된 서브 메뉴 ID를 URL 파라미터로 설정
- 페이지 새로고침 시에도 선택된 탭 유지

### F-2. Page Templates 규칙

#### Dashboard Template

**구조**:
```
<Container maxWidth="xl" padding="lg">
  <PageHeader title="대시보드" />
  <CardGridLayout
    cards={cards}
    desktopColumns={3}
    tabletColumns={2}
    mobileColumns={1}
  />
</Container>
```

**사용 위치**: `HomePage`, `StudentsHomePage`, `AnalyticsPage` 등

#### List+Detail Template

**구조**:
```
<Container maxWidth="xl" padding="lg">
  <PageHeader title="목록" actions={<Button>생성</Button>} />
  <DataTable data={items} columns={columns} />
</Container>
```

**사용 위치**: `StudentsPage`, `ClassesPage`, `TeachersPage` 등

#### Settings Template

**구조**:
```
<Container maxWidth="md" padding="lg">
  <PageHeader title="설정" />
  <Card padding="lg" title="섹션 제목">
    {/* 설정 폼 */}
  </Card>
</Container>
```

### F-3. Responsive 규칙

**정본 위치**: `packages/ui-core/src/hooks/useResponsiveMode.ts`, `docu/디어쌤 아키텍처.md` 6-0 섹션

#### 브레이크포인트 (고정 값)

| 브레이크포인트 | 최소 너비 | 용도 |
|--------------|----------|------|
| `xs` (기본) | 0px | 모바일 (기본) |
| `sm` | 640px | 큰 모바일 / 작은 태블릿 |
| `md` | 768px | 태블릿 |
| `lg` | 1024px | 작은 데스크톱 |
| `xl` | 1280px | 큰 데스크톱 |

**⚠️ 중요**: 이 수치는 Tailwind CSS와 동일하지만, 스키마엔진에서는 Tailwind 클래스 문자열을 직접 사용하지 않습니다. 숫자 규격만 참조합니다.

#### 슬롯 우선순위 (반응형)

**모바일 우선 (Mobile First)**:
- 기본 스타일은 모바일(`xs`) 기준
- `sm`, `md`, `lg`, `xl`에서 점진적 향상(Progressive Enhancement)

**예시**:
```tsx
const mode = useResponsiveMode();
const isDesktop = mode === 'lg' || mode === 'xl';
const isTablet = mode === 'md';
const isMobile = mode === 'xs' || mode === 'sm';

<div style={{
  columns: isDesktop ? 3 : isTablet ? 2 : 1,
  gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)',
}}>
```

---

## G. SDUI 연동 규칙

**정본 위치**: `docu/스키마엔진.txt`

### G-1. 스키마에서 표현 가능한 UI 속성

스키마에서 다음 UI 속성을 표현할 수 있습니다:

| 속성 | 스키마 경로 | 설명 | 예시 |
|------|-----------|------|------|
| `ui.variant` | `field.ui.variant` | 컴포넌트 변형 | `'solid' | 'outline' | 'ghost'` |
| `ui.density` | `field.ui.density` | 컴포넌트 밀도 | `'compact' | 'normal' | 'comfortable'` |
| `ui.intent` | `field.ui.intent` | 의도/상태 | `'primary' | 'success' | 'warning' | 'error'` |
| `ui.size` | `field.ui.size` | 컴포넌트 크기 | `'xs' | 'sm' | 'md' | 'lg' | 'xl'` |
| `ui.layout.columns` | `form.layout.columns` | 폼 컬럼 수 | `1 | 2 | 3 | 4` |
| `ui.layout.columnGap` | `form.layout.columnGap` | 컬럼 간격 | `SpacingToken` |

### G-2. 스키마에서 Tailwind 클래스 사용 금지

**❌ 금지**:
```json
{
  "field": {
    "ui": {
      "className": "flex items-center gap-2"  // ❌ Tailwind 클래스 직접 사용 금지
    }
  }
}
```

**✅ 허용**:
```json
{
  "field": {
    "ui": {
      "variant": "solid",
      "size": "md",
      "intent": "primary"
    }
  },
  "form": {
    "layout": {
      "columns": 2,
      "columnGap": "md"
    }
  }
}
```

**이유**: 스키마는 논리적 구조만, 스타일은 core-ui가 담당

---

## H. Enforcement (강제 장치)

### H-1. PR 체크리스트 (SSOT 미준수 시 반려)

**필수 체크 항목**:

- [ ] **하드코딩 금지**: px/rem/em/hex/opacity 값이 하드코딩되지 않았는가?
- [ ] **CSS 변수 사용**: 모든 디자인 값이 `var(--*)` 형식인가?
- [ ] **UI Core Component 사용**: 새 컴포넌트를 만들기 전에 UI Core에 있는지 확인했는가?
- [ ] **PageHeader 사용**: 모든 페이지가 `PageHeader`를 사용하는가?
- [ ] **Container 사용**: 모든 페이지가 `Container`로 감싸져 있는가?
- [ ] **상태 UI 패턴**: loading/error/empty 상태가 표준 패턴을 따르는가?
- [ ] **반응형 처리**: 모바일/태블릿/데스크톱에서 정상 동작하는가?

### H-2. ESLint/코드 규칙 후보 (하드코딩 탐지 방향)

**TODO**: 다음 ESLint 규칙 추가 검토:

```javascript
// 예시: 하드코딩된 px 값 탐지
{
  rules: {
    'no-hardcoded-px': 'error',  // 16px, 24px 등 탐지
    'no-hardcoded-hex': 'error',  // #3b82f6 등 탐지
    'no-hardcoded-opacity': 'error',  // opacity: 0.5 등 탐지
  }
}
```

**현재 상태**: 규칙 아이디어만 제안, 실제 도입은 TODO

### H-3. 예외 승인 프로세스

**예외가 필요한 경우**:
1. **예외 사유 문서화**: PR 설명에 예외 사유 명시
2. **예외 기간 명시**: 임시 예외인지, 영구 예외인지 명시
3. **대안 검토**: 예외 없이 해결 가능한 방법 검토

**예외 승인 기준**:
- 기술적 제약으로 인한 불가피한 경우
- 레거시 코드 마이그레이션 중인 경우 (기간 제한)
- 성능 최적화를 위한 특수 케이스 (문서화 필수)

---

## I. 재발 원인 Top 3 + 차단 방법

### 1. 하드코딩 재발 (가장 빈번)

**재발 원인**:
- 개발자가 CSS 변수 존재를 모름
- 빠른 개발을 위해 임시로 하드코딩 후 수정 안 함
- 컴포넌트 파일에서 직접 값 변경

**차단 방법**:
- ✅ 이 SSOT 문서에 모든 토큰 카탈로그 제공
- ✅ "금지 예시 vs 허용 예시" 코드 블록 제공
- ✅ ESLint 규칙 추가 (향후)
- ✅ PR 체크리스트에 하드코딩 금지 항목 추가

### 2. 컴포넌트 중복 구현

**재발 원인**:
- UI Core Component 카탈로그를 모름
- 비슷한 컴포넌트를 새로 만듦
- 상태 UI(loading/error/empty)를 매번 새로 구현

**차단 방법**:
- ✅ 이 SSOT 문서에 컴포넌트 분류 및 결정표 제공
- ✅ "언제 무엇을 쓰는지" 결정표 제공
- ✅ 상태 UI 표준 패턴 문서화
- ✅ 공통 컴포넌트(`LoadingState`, `ErrorState`, `EmptyState`) 추가 예정

### 3. 레이아웃 패턴 불일치

**재발 원인**:
- 페이지마다 다른 레이아웃 구조 사용
- 반응형 처리 방식이 페이지마다 다름
- Container/Padding 사용이 일관되지 않음

**차단 방법**:
- ✅ 이 SSOT 문서에 Page Templates 규칙 제공
- ✅ 반응형 브레이크포인트 표준화
- ✅ `CardGridLayout` 등 공통 레이아웃 컴포넌트 제공
- ✅ PR 체크리스트에 레이아웃 일관성 항목 추가

---

## J. 코드에서 SSOT 사용하기

**정본 위치**: `packages/ui-core/src/ssot/`

SSOT 규칙을 코드에서 직접 사용할 수 있습니다:

```typescript
// 1. 디자인 규칙 상수 및 검증 함수
import {
  SPACING_TOKENS,
  COLOR_TOKENS,
  createCSSVar,
  detectHardcodedPx,
  warnHardcodedValue,
} from '@ui-core/react';

// CSS 변수 생성
const padding = createCSSVar('spacing', SPACING_TOKENS.MD); // '--spacing-md'

// 하드코딩 탐지 (개발 환경)
if (detectHardcodedPx('16px')) {
  warnHardcodedValue('px', '16px', 'var(--spacing-md)');
}

// 2. 컴포넌트 카탈로그
import {
  PRIMITIVE_COMPONENTS,
  COMPOSITE_COMPONENTS,
  getComponentCategory,
  isUICoreComponent,
  getComponentRecommendation,
} from '@ui-core/react';

// 컴포넌트 분류 확인
const category = getComponentCategory('Button'); // 'primitive'
const exists = isUICoreComponent('Button'); // true

// 사용 권장 사항 조회
const recommended = getComponentRecommendation('텍스트 입력'); // 'Input'

// 3. 레이아웃 템플릿
import {
  BREAKPOINTS,
  getResponsiveMode,
  isDesktop,
  isMobile,
  validatePageStructure,
} from '@ui-core/react';
import { useResponsiveMode } from '@ui-core/react';

function MyPage() {
  const mode = useResponsiveMode();
  const isDesktopMode = isDesktop(mode);

  // 페이지 구조 검증
  const { valid, warnings } = validatePageStructure(true, true);

  return <Container>...</Container>;
}
```

**상세 사용 가이드**: `packages/ui-core/src/ssot/README.md` 참조

---

## K. 참조 문서

- **컴포넌트 상세 가이드**: `docu/컴포넌트 디자인.md`
- **아키텍처 문서**: `docu/디어쌤 아키텍처.md` (4장: Multi-Tenant Theme Engine, 6장: Responsive UX)
- **스키마 엔진**: `docu/스키마엔진.txt`
- **개발 규칙**: `docu/rules.md`
- **SSOT 코드 사용 가이드**: `packages/ui-core/src/ssot/README.md`

---

**문서 버전**: 1.3.0
**최종 업데이트**: 2026-01-14
**유지보수 책임**: 프론트엔드 팀

---

## 변경 이력

- **2026-01-14 (v1.3.0)**: AI 분석 로딩 상태 컴포넌트 및 SubSidebar 사용 위치 업데이트
  - AIAnalysisLoadingUI 공통 컴포넌트 추가
  - AI 분석/생성 작업 진행률 표시 패턴 문서화
  - 3단계 진행률 표시 구현 가이드 추가
  - 사용 위치 및 스타일 규칙 명시
  - EmptyState 컴포넌트 구현 완료 상태로 업데이트
  - SubSidebar 사용 페이지 목록 업데이트 (11개 페이지)
  - SubSidebar 메뉴 정의 SSOT 및 URL 상태 관리 가이드 추가
- **2026-01-13 (v1.2.0)**: SubSidebar 컴포넌트 문서화
  - Layout 컴포넌트 분류에 SubSidebar 추가
  - 페이지 구조 결정표에 서브 사이드바 추가
  - SubSidebar 상세 사용 가이드 및 Props 문서화
  - 스타일 규칙 (PageHeader와 동일한 폰트, CSS 변수 사용) 명시
- **2026-01-04 (v1.1.0)**: Phase 3: Industry-Based Routing 반영
  - Industry 컴포넌트 분류 추가
  - useIndustryTerms, useIndustryConfig Hook 문서화
  - IndustryBasedRoute 컴포넌트 추가
  - 하드코딩된 업종 특화 용어 사용 금지 규칙 추가
  - `docu/디어쌤_아키텍처.md` 13장 참조 추가
- **2024-12-19 (v1.0.0)**: 초기 버전 작성

            