# Phase 2: 타입 안전성 복원

> **기간**: 1~2주 | **우선순위**: P1 | **담당**: 1명
> **선행 조건**: Phase 0 완료 (Phase 1과 병렬 가능)
> **목표**: `as any` 81건 → 20건 이하, `eslint-disable` 101건 → 40건 이하

---

## 현재 상태

| 지표 | 현재 | 목표 |
|------|------|------|
| `as any` | 81건 (22개 파일) | **20건 이하** |
| `eslint-disable` | 101건 (41개 파일) | **40건 이하** |
| `@ts-ignore/@ts-expect-error` | 21건 (8개 파일) | **10건 이하** |

### 심각도별 분포

| 심각도 | `as any` 건수 | 대상 |
|--------|-------------|------|
| Critical (비즈니스 로직) | 7건 | core-auth, core-tenancy, core-search |
| High (UI Core) | 27건 | Input(10), Textarea(8), ChatOpsPanel(5), 기타(4) |
| High (Schema Engine) | 25건 | SchemaField(20), SchemaForm(3), SchemaTable(1), registry(1) |
| Medium (Edge Functions) | 16건 | ai-regional-insights(8), normalize-params(5), 기타(3) |
| Low (테스트 파일) | 6건 | useAuth.test.tsx (허용) |

---

## 2-1. Schema Engine 타입 복원 — 최대 효과 (3일)

### 문제

`packages/schema-engine/src/react/` 전체에서 `as any` **25건** 발생 (SchemaField.tsx 20건, SchemaForm.tsx 3건, SchemaTable.tsx 1건, widgets/registry.ts 1건). 동적 폼 렌더링의 타입 안전성이 완전히 포기된 상태.

### 대상 파일 및 라인

```
packages/schema-engine/src/react/SchemaField.tsx
  - Line 504, 534, 585, 615, 644, 698, 732, 772, 794, 820, 862, 989, 1327
    → rules={finalRules as any}
    패턴: Ant Design Form rules 타입 불일치
    해법: FormRule 타입 정의 후 제네릭 적용

  - Line 549, 656
    → (e.nativeEvent as any)?.isComposing
    패턴: InputEvent에 isComposing 타입 누락
    해법: InputEvent 확장 인터페이스 정의

  - Line 652
    → rows={(ui as any)?.rows}
    패턴: UI 설정 객체 타입 미정의
    해법: SchemaUIConfig 타입에 rows 필드 추가

  - Line 688, 689
    → disabled: (opt as any).disabled / divider: (opt as any).divider
    패턴: SelectOption 타입에 disabled/divider 누락
    해법: SelectOption 인터페이스 확장
```

### 구현 전략

```typescript
// 1. FormRule 타입 정의 (신규)
// packages/schema-engine/src/types/form-rules.ts

interface SchemaFormRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  validator?: (value: unknown) => Promise<void> | void;
}

// 2. UI Config 타입 확장
interface SchemaUIConfig {
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  // ...기존 필드
}

// 3. SelectOption 확장
interface SchemaSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  divider?: boolean;
}

// 4. InputEvent 확장
interface CompositionAwareEvent extends React.SyntheticEvent {
  nativeEvent: InputEvent & { isComposing?: boolean };
}
```

### 검증 기준

- [ ] `as any` 25건 → 0건 (schema-engine 전체: SchemaField 20 + SchemaForm 3 + SchemaTable 1 + registry 1)
- [ ] `npx tsc --noEmit packages/schema-engine` 에러 0건
- [ ] 기존 SchemaForm 렌더링 동작 유지

---

## 2-2. UI Core 컴포넌트 타입 복원 (3일)

### Input.tsx — 10건

```
packages/ui-core/src/components/Input.tsx
  - Line 242, 258, 275: (import.meta as any).env?.DEV
    해법: vite-env.d.ts에 ImportMeta 타입 확장 선언

  - Line 245, 261, 280: (props as any)?.name
    해법: InputProps 인터페이스에 name 필드 추가

  - Line 253: (props as any).onCompositionStart?.(e)
    해법: InputProps에 onCompositionStart 이벤트 핸들러 추가

  - Line 277: (e.nativeEvent as any)?.isComposing
    해법: CompositionAwareEvent 타입 공유 (2-1과 동일)
```

### Textarea.tsx — 8건

```
packages/ui-core/src/components/Textarea.tsx
  - Line 68, 189: (import.meta as any).env?.DEV → ImportMeta 타입 확장
  - Line 71, 194: (props as any)?.name → TextareaProps에 name 추가
  - Line 179: (props as any).onCompositionStart → 이벤트 핸들러 추가
  - Line 185, 191, 204: 나머지 props 접근 → 구체적 타입 적용
```

### ChatOpsPanel.tsx — 5건

```
packages/ui-core/src/components/ChatOpsPanel.tsx
  - Line 661: message.metadata.l0_result as any
    해법: ChatMessage 타입에 l0_result 필드 타입 정의

  - Line 1479, 1490, 1501, 1512: new Event('submit') as any
    해법: React.FormEvent 타입으로 변경 또는 form.requestSubmit() 사용
```

### 공통 타입 파일 생성

```
신규 파일: packages/ui-core/src/types/events.ts

export interface CompositionAwareInputEvent extends React.ChangeEvent<HTMLInputElement> {
  nativeEvent: InputEvent & { isComposing?: boolean };
}

export interface CompositionAwareTextareaEvent extends React.ChangeEvent<HTMLTextAreaElement> {
  nativeEvent: InputEvent & { isComposing?: boolean };
}
```

### 검증 기준

- [ ] `as any` 27건 → 0건 (UI Core 내: Input 10 + Textarea 8 + ChatOpsPanel 5 + VirtualList 2 + AddressSearchInput 1 + ActionButtonGroup 1)
- [ ] `npx tsc --noEmit packages/ui-core` 에러 0건
- [ ] 기존 컴포넌트 동작 유지 (스토리/데모 확인)

---

## 2-3. ImportMeta 타입 전역 해결 (0.5일)

### 문제

`(import.meta as any).env?.DEV` 패턴이 Input, Textarea 등 여러 파일에서 반복됨. Vite의 `import.meta.env` 타입이 인식되지 않아서 발생.

### 수정 대상

```
packages/ui-core/src/vite-env.d.ts (신규 또는 수정)
```

### 구현

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 영향 범위

이 한 번의 수정으로 해결되는 `as any`:
- Input.tsx: 3건
- Textarea.tsx: 2건
- 기타 Vite 환경 참조: 추정 2~3건

**총 ~7건을 1개 파일 수정으로 해결**

---

## 2-4. Edge Function 타입 복원 (2일)

### 대상 파일

```
infra/supabase/supabase/functions/ai-regional-insights-generation/index.ts
  - Line 163: config.value as any → RegionalConfig 타입 정의
  - Line 414, 416: (dongMetrics[0] as any).store_count → MetricsRow 타입
  - Line 441, 443: (sigunguMetrics[0] as any).store_count → MetricsRow 타입
  - Line 469, 471: 유사 패턴
  - Line 588: 유사 패턴
  합계: 8건

infra/supabase/supabase/functions/_shared/normalize-params.ts
  - 5건: 파라미터 정규화 시 타입 캐스팅
  해법: NormalizeResult 제네릭 타입 정의

infra/supabase/supabase/functions/chatops/handlers/utils.ts
  - 1건
infra/supabase/supabase/functions/chatops/handlers/cors.ts
  - 1건
infra/supabase/supabase/functions/sms-send-aligo/index.ts
  - 1건

합계: 16건
```

### 구현 전략

```typescript
// infra/supabase/supabase/functions/_shared/types.ts (신규)

interface RegionalConfig {
  target_regions: string[];
  analysis_depth: 'basic' | 'detailed';
  // ...
}

interface MetricsRow {
  store_count: number;
  avg_revenue: number;
  growth_rate: number;
  // ...
}
```

### 검증 기준

- [ ] Edge Function 내 `as any` 16건 → 0건 (ai-regional-insights 8 + normalize-params 5 + chatops utils/cors 2 + sms-send-aligo 1)
- [ ] 모든 Edge Function 배포 후 정상 동작

---

## 2-5. eslint-disable 정리 (2일)

### 제거 대상 (우선순위별)

#### 즉시 제거 가능 (규칙 위반이 실제로 없는 경우)

```
packages/ui-core/src/components/AILayerMenu.tsx
  - 13건: @typescript-eslint/no-unused-vars
  → 실제 미사용 변수 확인 후 변수 제거 또는 _ prefix

packages/hooks/use-student/src/student-queries.ts
  - 2건: @typescript-eslint/no-floating-promises, no-restricted-syntax
  → floating promise를 void로 처리하거나 await 추가
```

#### 타입 수정 후 제거 가능

```
packages/core/core-auth/src/signup.ts
  - 3건: no-unsafe-assignment, no-unsafe-member-access, no-explicit-any
  → Phase 0-5에서 처리됨

packages/core/core-search/src/service.ts
  - 2건: no-unsafe-assignment, no-unsafe-return
  → 검색 결과 타입 정의 후 제거

apps/academy-admin/src/pages/HomePage.tsx
  - 4건: react-hooks/exhaustive-deps
  → deps 배열 수정 또는 useCallback/useMemo 적용
```

#### 유지해도 되는 항목 (예외적 허용)

```
테스트 파일 내 eslint-disable: 허용 (mock 관련)
packages/env-registry/src/client.ts: @ts-expect-error 3건 (Vite/Next 환경 분기)
packages/ui-core/src/components/VirtualList.tsx: @ts-expect-error 2건 (라이브러리 타입 불일치)
```

---

## Phase 2 완료 기준

| 지표 | 현재 | 목표 | 허용 잔여 |
|------|------|------|-----------|
| `as any` | 81건 | **20건 이하** | 테스트 파일(6건) + 라이브러리 경계(~10건) |
| `eslint-disable` | 101건 | **40건 이하** | 의도적 예외 + 테스트 |
| `@ts-ignore` | 21건 | **10건 이하** | env-registry(3건) + VirtualList(2건) |

### 검증 명령어

```bash
# 타입 체크
npm run type-check

# any 잔여 카운트
grep -r "as any" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "*.test.*" | wc -l

# eslint-disable 잔여 카운트
grep -r "eslint-disable" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
```

---

## 다음 Phase

← [Phase 1: 테스트 커버리지 복구](./RISK_REMEDIATION_PHASE_1.md)
→ [Phase 3: Edge Function 안정성](./RISK_REMEDIATION_PHASE_3.md)
