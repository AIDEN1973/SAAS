# 디어쌤 UI/UX 아키텍처 구현 가이드

## 📦 패키지 구조

전체 유아이문서 기준으로 구현된 패키지:

### 1. `@design-system/core`
- **Tokens**: Spacing, Color, Size, Breakpoint
- **Theme Engine**: Multi-Tenant 테마 병합 시스템
  - Theme Merge Priority: system → industry → tenant → dark → high contrast

### 2. `@ui-core/react`
- **컴포넌트**: Button, Card, Input, Layout, BottomActionBar, ErrorBoundary
- **Hooks**: `useResponsiveMode()`, `useBreakpoint()`
- **반응형**: Mobile/Tablet/Desktop 자동 감지

### 3. `@schema-engine/core`
- **SDUI 렌더러**: 스키마를 UI 컴포넌트로 자동 렌더링
- **Meta-Schema Validator**: 스키마 검증
- **Versioning**: 스키마 버전 관리

### 4. `@api-sdk/core`
- **Zero-Trust**: UI는 fetch/axios 직접 호출 금지
- **자동 주입**: tenant_id, industry_type, auth token 자동 삽입
- **RLS 연동**: Supabase RLS와 통합

## 🎯 핵심 원칙

### 1. Zero-Trust UI Layer
```typescript
// ❌ 금지
fetch('/api/data')
axios.get('/api/data')
supabase.from('table').select()

// ✅ 허용
apiClient.get('table', { select: '*' })
```

### 2. Schema-Driven Everything
```typescript
// 스키마 기반 UI 생성
const formSchema: FormSchema = {
  version: "1.0.0",
  minSupportedClient: "1.0.0",
  entity: "student",
  form: {
    layout: { columns: 2, columnGap: "md" },
    fields: [
      { type: "text", name: "name", label: "이름", required: true },
      { type: "email", name: "email", label: "이메일" },
    ],
    submit: { label: "저장", variant: "solid", color: "primary" },
  },
};

<SchemaRenderer schema={formSchema} />
```

### 3. 반응형 UX
```typescript
// Mobile: Bottom Action Bar
// Tablet: 2-column + Drawer Overlay
// Desktop: Multi-panel + Persistent Sidebar

const mode = useResponsiveMode(); // 'mobile' | 'tablet' | 'desktop'
```

### 4. Performance Budget
- **Initial Load Bundle**: ≤ 500KB (초과 시 빌드 실패)
- **FCP**: ≤ 1.5s (초과 시 경고)
- **TTI**: ≤ 800ms (초과 시 빌드 실패)

## 📝 사용 예시

### Theme Engine 사용
```typescript
import { createTheme } from '@design-system/core';

const theme = createTheme({
  mode: 'light',
  industry: 'academy',
  tenantId: 'tenant-123',
});

const spacing = theme.getSpacing('md');
const color = theme.getColor('primary');
```

### UI 컴포넌트 사용
```typescript
import { Button, Card, Input, Grid, BottomActionBar } from '@ui-core/react';
import { useResponsiveMode } from '@ui-core/react';

function MyComponent() {
  const mode = useResponsiveMode();
  
  return (
    <Card padding="lg">
      <Grid columns={mode === 'mobile' ? 1 : 2} gap="md">
        <Input label="이름" name="name" />
        <Input label="이메일" name="email" type="email" />
      </Grid>
      <BottomActionBar>
        <Button variant="solid" color="primary">저장</Button>
      </BottomActionBar>
    </Card>
  );
}
```

### API SDK 사용
```typescript
import { apiClient } from '@api-sdk/core';
import { setApiContext } from '@api-sdk/core';

// Context 설정 (미들웨어에서)
setApiContext({
  tenantId: 'tenant-123',
  industryType: 'academy',
  authToken: 'jwt-token',
});

// 데이터 조회
const response = await apiClient.get('students', {
  select: 'id, name, email',
  filters: { status: 'active' },
  orderBy: { column: 'name', ascending: true },
  limit: 10,
});

if (response.error) {
  console.error(response.error.message);
} else {
  console.log(response.data);
}
```

## 🚀 다음 단계

1. **Tailwind CSS 설정**: design-system 토큰과 통합
2. **추가 컴포넌트**: Table, Drawer, Modal 등
3. **Widget Sandbox**: 커스텀 위젯 격리 시스템
4. **Admin UI Kit**: Backoffice 전용 UI Kit

