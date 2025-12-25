# 유틸리티 함수 SSOT 가이드

이 디렉토리는 **Single Source of Truth (SSOT)** 원칙에 따라 반복되는 로직을 중앙화한 유틸리티 함수들을 포함합니다.

## 📋 목차

1. [날짜 범위 계산](#날짜-범위-계산)
2. [Policy 조회](#policy-조회)
3. [에러 처리](#에러-처리)
4. [데이터 정규화](#데이터-정규화)
5. [타입 가드](#타입-가드)
6. [카드 정규화](#카드-정규화) ⭐ **NEW**
7. [Policy Registry](#policy-registry) ⭐ **NEW**
8. [React Query 키/파라미터](#react-query-키파라미터) ⭐ **NEW**

---

## 카드 정규화

**파일**: `dashboard-card-normalization.ts`

### 문제점
- `HomePage.tsx`에서 `created_at`, `priority`, `action_url`에 대한 방어 코드가 여러 곳에 분산
- UI 컴포넌트에서 타입/형식 보장이 없어 방어 코드가 반복됨
- 카드 데이터가 정규화되지 않은 상태로 전달됨

### 해결책
모든 카드 정규화를 `dashboard-card-normalization.ts`로 중앙화

### 사용 예시

```typescript
import { normalizeDashboardCard, normalizeDashboardCards } from '../utils/dashboard-card-normalization';

// 단일 카드 정규화
const normalizedCard = normalizeDashboardCard({
  id: 'test-card',
  type: 'emergency',
  title: 'Test',
  message: 'Test message',
  priority: '1', // 문자열도 숫자로 정규화
  created_at: new Date(), // Date도 ISO string으로 정규화
});

// 카드 배열 정규화
const normalizedCards = normalizeDashboardCards(rawCards);
```

### 마이그레이션 가이드

**Before (HomePage.tsx)**:
```typescript
const aTime = typeof a.created_at === 'string' ? a.created_at : '';
const priorityA = 'priority' in a ? Number(a.priority) || 0 : 0;
```

**After**:
```typescript
import { normalizeDashboardCard } from '../utils/dashboard-card-normalization';

const normalizedCard = normalizeDashboardCard(card);
// normalizedCard.created_at은 항상 string
// normalizedCard.priority는 항상 number
```

---

## Policy Registry

**파일**: `policy-registry.ts`

### 문제점
- `useTenantSettingByPath` vs `getPolicyValueFromConfig` 혼용
- Policy 소스 이원화로 인한 혼선
- "Policy Registry" 문서가 없어 어떤 정책이 어디에 있는지 불명확

### 해결책
모든 Policy를 `policy-registry.ts`에 등록하고 단일 소스로 통일

### 사용 예시

```typescript
import { usePolicy, POLICY_REGISTRY } from '../utils/policy-registry';
import { useConfig } from '@hooks/use-config';

function MyComponent() {
  const { data: config } = useConfig();

  // Policy Registry 기반 조회
  const threshold = usePolicy<number>('PAYMENT_FAILED_THRESHOLD', config);
  const lookbackDays = usePolicy<number>('PAYMENT_FAILED_LOOKBACK_DAYS', config);

  // Policy 정의 확인
  const policyDef = POLICY_REGISTRY.PAYMENT_FAILED_THRESHOLD;
  // policyDef.path, policyDef.source, policyDef.type, policyDef.defaultValue
}
```

### 마이그레이션 가이드

**Before (HomePage.tsx)**:
```typescript
const { data: aiRiskScoreThreshold } = useTenantSettingByPath(EMERGENCY_CARDS_POLICY_PATHS.AI_RISK_SCORE_THRESHOLD);
const paymentFailedThreshold = getPolicyValueFromConfig<number>(config, EMERGENCY_CARDS_POLICY_PATHS.PAYMENT_FAILED_THRESHOLD);
```

**After**:
```typescript
import { usePolicy } from '../utils/policy-registry';

const aiRiskScoreThreshold = usePolicy<number>('AI_RISK_SCORE_THRESHOLD', config);
const paymentFailedThreshold = usePolicy<number>('PAYMENT_FAILED_THRESHOLD', config);
```

---

## React Query 키/파라미터

**파일**: `packages/hooks/use-query-key-utils/src/index.ts`

### 문제점
- 훅에서 객체가 queryKey에 직접 포함됨 (`queryKey: ['ai-insights', tenantId, filter]`)
- 객체 레퍼런스 변경 시 불필요한 재패치 발생
- `nowKST` 갱신과 결합되면 재패치/떨림/버그 수정 루프 재발

### 해결책
queryKey는 원시값 배열로, 파라미터는 훅 내부에서 원시화/정규화

### 사용 예시

```typescript
import { createQueryKey } from '@hooks/use-query-key-utils';

export function useAIInsights(filter?: AIInsightFilter) {
  const context = getApiContext();
  const tenantId = context.tenantId;

  return useQuery<AIInsight[]>({
    queryKey: createQueryKey('ai-insights', tenantId, filter),
    queryFn: () => fetchAIInsights(tenantId!, filter),
    enabled: !!tenantId,
  });
}
```

### 마이그레이션 가이드

**Before (useAIInsights.ts)**:
```typescript
queryKey: ['ai-insights', tenantId, filter], // 객체 레퍼런스 직접 사용
```

**After**:
```typescript
import { createQueryKey } from '@hooks/use-query-key-utils';

queryKey: createQueryKey('ai-insights', tenantId, filter), // 원시값으로 직렬화
```

---

## 날짜 범위 계산

**파일**: `date-range-utils.ts`

### 사용 예시

```typescript
import { getBaseKST, calculateMonthlyRange, calculateWeeklyRange } from '../utils/date-range-utils';

const baseKST = getBaseKST();
const monthlyRange = calculateMonthlyRange(baseKST);
const weeklyRange = calculateWeeklyRange(baseKST);
```

---

## Policy 조회

**파일**: `policy-utils.ts`

### 사용 예시

```typescript
import { getPolicyValueFromConfig, getPolicyNumber } from '../utils/policy-utils';

const threshold = getPolicyNumber(config, 'auto_notification.overdue.threshold');
```

---

## 에러 처리

**파일**: `error-handling-utils.ts`

### 사용 예시

```typescript
import { safe, ensureArray } from '../utils/error-handling-utils';

const students = await safe(fetchPersons(tenantId, { person_type: 'student' }), []);
const payments = ensureArray(await fetchPayments(tenantId, { status: 'failed' }));
```

---

## 데이터 정규화

**파일**: `data-normalization-utils.ts`

### 사용 예시

```typescript
import { toNullable, normalizeNullableFields } from '../utils/data-normalization-utils';

const updateData = {
  name: data.name ?? student.name,
  birth_date: toNullable(data.birth_date),
  phone: toNullable(data.phone),
};
```

---

## 타입 가드

**파일**: `type-guards-utils.ts`

### 사용 예시

```typescript
import { isString, isArray, hasOwnProperty } from '../utils/type-guards-utils';

if (isString(value)) {
  value.localeCompare(other); // 타입 안전
}
```

---

## 🎯 적용 우선순위

1. **P0 (즉시)**: 카드 정규화 레이어 - UI 방어 코드 제거
2. **P0 (즉시)**: Policy Registry - Policy 소스 통일
3. **P0 (즉시)**: React Query 키/파라미터 - 재패치 방지
4. **P1 (높음)**: 날짜 범위 계산 - 날짜 계산 로직 통일
5. **P1 (높음)**: 에러 처리 - safe 래퍼 통일
6. **P2 (중간)**: 데이터 정규화 - 폼 제출 시 반복 제거
7. **P2 (중간)**: 타입 가드 - 타입 안정성 개선

---

## 📝 참고 문서

- [SSOT 원칙](../constants/README.md)
- [프론트 자동화 문서](../../../../docu/프론트 자동화.md) - Policy Key v2
- [디어쌤 아키텍처](../../../../docu/디어쌤 아키텍처.md) - 데이터 정규화 규칙
