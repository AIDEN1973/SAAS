# SSOT: UI Design Rules (코드에서 사용)

이 디렉토리는 디자인/스타일/레이아웃/공통 컴포넌트 사용 규칙의 단일 정본(SSOT)을 코드에서 직접 사용할 수 있도록 제공합니다.

**참조 문서**: `docu/SSOT_UI_DESIGN.md`

## 사용법

```typescript
// 전체 import
import {
  SPACING_TOKENS,
  COLOR_TOKENS,
  createCSSVar,
  detectHardcodedPx,
  PRIMITIVE_COMPONENTS,
  COMPOSITE_COMPONENTS,
  getComponentCategory,
  BREAKPOINTS,
  isDesktop,
  isMobile,
} from '@ui-core/react';
```

## 파일 구조

- `design-rules.ts`: 디자인 규칙 상수 및 검증 함수
- `component-catalog.ts`: 컴포넌트 카탈로그 상수
- `layout-templates.ts`: 레이아웃 템플릿 상수 및 헬퍼
- `index.ts`: Barrel export

## 사용 예시

### 1. CSS 변수 생성

```typescript
import { createCSSVar } from '@ui-core/react';

// ✅ 올바른 방법
const spacing = createCSSVar('spacing', 'md'); // '--spacing-md'
const color = createCSSVar('color', 'primary'); // '--color-primary'

// ❌ 하드코딩 금지
const spacing = '16px'; // 금지
```

### 2. 하드코딩 탐지 (개발 환경)

```typescript
import { detectHardcodedPx, warnHardcodedValue } from '@ui-core/react';

const style = { padding: '16px' };

if (detectHardcodedPx(style.padding)) {
  warnHardcodedValue('px', style.padding, 'var(--spacing-md)');
}
```

### 3. 컴포넌트 분류 확인

```typescript
import { getComponentCategory, isUICoreComponent } from '@ui-core/react';

const category = getComponentCategory('Button'); // 'primitive'
const exists = isUICoreComponent('Button'); // true
```

### 4. 반응형 모드 확인

```typescript
import { BREAKPOINTS, getResponsiveMode, isDesktop } from '@ui-core/react';
import { useResponsiveMode } from '@ui-core/react';

function MyComponent() {
  const mode = useResponsiveMode();
  const isDesktopMode = isDesktop(mode);

  return (
    <div style={{
      columns: isDesktopMode ? 3 : 1,
    }}>
      {/* ... */}
    </div>
  );
}
```

### 5. 페이지 구조 검증

```typescript
import { validatePageStructure } from '@ui-core/react';

function MyPage() {
  const { valid, warnings } = validatePageStructure(
    true,  // hasContainer
    true   // hasPageHeader
  );

  if (!valid) {
    console.warn('페이지 구조 검증 실패:', warnings);
  }

  return <Container>...</Container>;
}
```

## 주의사항

- **개발 환경에서만 경고**: `warnHardcodedValue` 등은 프로덕션 빌드에서는 실행되지 않습니다.
- **타입 안정성**: 모든 상수는 `as const`로 타입이 고정되어 있습니다.
- **SSR 호환**: 검증 함수는 SSR 환경에서는 실행되지 않습니다.

