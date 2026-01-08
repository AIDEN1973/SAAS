# 호버 배경색 표준 (Hover Background Color Standard)

## 개요

모든 UI 요소의 롤오버(호버) 배경색은 `var(--color-primary-40)`을 사용합니다.

## 목적

1. **일관성**: 모든 인터랙티브 요소의 호버 효과가 통일됩니다
2. **업종별 자동 적용**: 업종별 브랜드 색상이 자동으로 반영됩니다
   - ACADEMY: 퍼플 톤 (`#a78bfa` 기반)
   - GYM: 오렌지 톤 (`#fb923c` 기반)
   - SALON: 핑크 톤 (`#f9a8d4` 기반)
   - REAL_ESTATE: 청록 톤 (`#5eead4` 기반)
   - NGO: 그린 톤 (`#86efac` 기반)
3. **유지보수 용이**: CSS 변수 하나로 전체 호버 색상을 중앙 관리합니다

## CSS 변수 정의

### Primary-40 색상 생성 방식

`--color-primary-40`은 `applyTheme.ts`에서 자동 생성됩니다:

```typescript
// packages/ui-core/src/utils/applyTheme.ts
root.style.setProperty('--color-primary-40', hexToRgba(colorTokens.primary.light, 0.08));
```

- **베이스**: `primary.light` 색상
- **투명도**: 8% (0.08 alpha)
- **계산**: 동적으로 RGBA 값으로 변환

### 전체 Primary 색상 스케일

| 변수 | 투명도 | 용도 |
|------|--------|------|
| `--color-primary-30` | 5% | 가장 밝은 호버 배경 (선택적 사용) |
| `--color-primary-40` | **8%** | **표준 호버 배경 (필수)** |
| `--color-primary-50` | 10% | 일반 배경색 |
| `--color-primary-100` | 20% | 선택된 항목 배경색 |

## 적용 대상

다음 모든 UI 요소에 `--color-primary-40`을 적용합니다:

### 1. 글로벌 헤더
- ✅ AI 토글 버튼 ([AIToggle.tsx:87](../../packages/ui-core/src/components/AIToggle.tsx#L87))
- ✅ AI 에이전트 버튼 ([App.tsx:44](../../apps/academy-admin/src/App.tsx#L44))
- ✅ 사용자 프로필 레이어 메뉴 - 설정 버튼 ([Header.tsx:403](../../packages/ui-core/src/components/Header.tsx#L403))
- ✅ 사용자 프로필 레이어 메뉴 - 로그아웃 버튼 ([Header.tsx:448](../../packages/ui-core/src/components/Header.tsx#L448))
- ✅ 사용자 프로필 레이어 메뉴 - 닫기(X) 버튼 ([Header.tsx:290](../../packages/ui-core/src/components/Header.tsx#L290))

### 2. 사이드바
- ✅ 일반 메뉴 아이템 ([Sidebar.tsx:182](../../packages/ui-core/src/components/Sidebar.tsx#L182))
- ✅ Advanced 메뉴 더보기(...) 버튼 ([Sidebar.tsx:134](../../packages/ui-core/src/components/Sidebar.tsx#L134))
- ✅ Advanced 레이어 메뉴 아이템 ([Sidebar.tsx:416](../../packages/ui-core/src/components/Sidebar.tsx#L416))

### 3. 향후 추가 예정
- 버튼 컴포넌트의 ghost/text 변형
- 드롭다운 메뉴 아이템
- 테이블 행 호버
- 카드 호버
- 리스트 아이템 호버
- 탭 호버
- 아이콘 버튼 호버

## 사용 방법

### React 인라인 스타일 (권장)

```tsx
// State 기반 호버
const [isHovered, setIsHovered] = useState(false);

<button
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  style={{
    backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent',
    transition: 'var(--transition-all)',
  }}
>
  버튼
</button>
```

### Event Handler 기반 호버

```tsx
<button
  style={{
    backgroundColor: 'transparent',
    transition: 'var(--transition-all)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = 'var(--color-primary-40)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  }}
>
  버튼
</button>
```

### CSS (필요시)

```css
.interactive-element {
  background-color: transparent;
  transition: var(--transition-all);
}

.interactive-element:hover {
  background-color: var(--color-primary-40);
}
```

## 금지 사항

❌ **사용하지 말아야 할 색상**:
- `var(--color-gray-100)` - 회색 톤 (업종별 색상 미반영)
- `var(--color-gray-50)` - 회색 톤
- 하드코딩된 HEX 값 (`#f5f9ff`, `#e8f2ff` 등)
- `rgba()` 직접 정의

✅ **올바른 사용**:
```tsx
backgroundColor: isHovered ? 'var(--color-primary-40)' : 'transparent'
```

❌ **잘못된 사용**:
```tsx
backgroundColor: isHovered ? 'var(--color-gray-100)' : 'transparent'  // ❌
backgroundColor: isHovered ? '#e8f2ff' : 'transparent'  // ❌
backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.08)' : 'transparent'  // ❌
```

## 업종별 테마 설정

업종별 Primary 색상은 `industry_themes` 테이블에서 관리됩니다:

```sql
-- infra/supabase/supabase/migrations/061_create_industry_themes_table.sql
INSERT INTO public.industry_themes (industry_type, theme_tokens)
VALUES (
  'academy',
  '{
    "colors": {
      "primary": {
        "light": "#a78bfa",      -- 이 색상 기반으로 primary-40 자동 생성
        "DEFAULT": "#8b5cf6",
        "dark": "#7c3aed"
      }
    }
  }'::jsonb
);
```

## 테마 적용 플로우

1. **테넌트 로그인** → `tenants.industry_type` 조회
2. **테마 로드** → `useTheme()` 훅이 `industry_themes` 테이블에서 업종 테마 조회
3. **CSS 주입** → `applyThemeToCSS()` 함수가 `--color-primary-40` 동적 생성
4. **자동 반영** → 모든 컴포넌트의 호버 효과가 업종별 색상으로 표시

## 관련 파일

### 핵심 파일
- [`packages/ui-core/src/utils/applyTheme.ts`](../../packages/ui-core/src/utils/applyTheme.ts) - CSS 변수 동적 생성
- [`packages/ui-core/src/hooks/useTheme.ts`](../../packages/ui-core/src/hooks/useTheme.ts) - 테마 로드 및 적용
- [`packages/design-system/src/theme.ts`](../../packages/design-system/src/theme.ts) - ThemeEngine 구현

### 마이그레이션
- [`infra/supabase/supabase/migrations/061_create_industry_themes_table.sql`](../../infra/supabase/supabase/migrations/061_create_industry_themes_table.sql) - 업종별 테마 테이블

### 적용 예시
- [`packages/ui-core/src/components/Sidebar.tsx`](../../packages/ui-core/src/components/Sidebar.tsx)
- [`packages/ui-core/src/components/Header.tsx`](../../packages/ui-core/src/components/Header.tsx)
- [`packages/ui-core/src/components/AIToggle.tsx`](../../packages/ui-core/src/components/AIToggle.tsx)
- [`apps/academy-admin/src/App.tsx`](../../apps/academy-admin/src/App.tsx)

## 버전 이력

- **2025-01-08**: 초안 작성, `--color-primary-40` 표준 확립
- **향후 계획**: 모든 UI 컴포넌트에 일괄 적용
