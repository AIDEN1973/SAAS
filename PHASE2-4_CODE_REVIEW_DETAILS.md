# Phase 2-4: AnalyticsPage Fallback 수정 - 상세 코드 리뷰

## 변경 내역 분석

### 변경 1: Line 77-79 - industryType 초기화

#### 파일 위치
`apps/academy-admin/src/pages/AnalyticsPage.tsx` Line 73-82

#### 변경 전 코드 (커밋 37aa714)
```typescript
export function AnalyticsPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  // [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
  const industryType = context?.industryType || 'academy'; // Context에서 가져오되, 없으면 fallback ← PROBLEMATIC
```

#### 변경 후 코드 (현재)
```typescript
export function AnalyticsPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: config } = useConfig();
  // [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
  const industryType = context?.industryType || config?.industry_type || DEFAULT_INDUSTRY_TYPE; ✅
  const terms = useIndustryTerms();
```

#### 분석

**문제점**:
- 문자열 'academy'가 하드코딩됨
- 스타일 가이드 위반: 모든 업종 타입 하드코딩 금지
- 관리 불가능: 업종 추가 시 이 부분 수정 필요

**해결책**:
1. `context?.industryType`: API Context에서 tenantId와 함께 전달되는 업종 정보 우선
2. `config?.industry_type`: useConfig 훅에서 조회한 설정 정보에서 이차 조회
3. `DEFAULT_INDUSTRY_TYPE`: 레지스트리에서 import된 기본 업종 사용

**장점**:
- 모든 fallback이 레지스트리나 API 기반
- 문자열 하드코딩 제거
- 업종 추가 시 레지스트리만 수정하면 자동 적용

#### DEFAULT_INDUSTRY_TYPE 정의
```typescript
// packages/industry/industry-registry.ts Line 1039
export const DEFAULT_INDUSTRY_TYPE = 'academy';

// apps/academy-admin/src/pages/AnalyticsPage.tsx Line 36
import { DEFAULT_INDUSTRY_TYPE } from '@industry/registry';
```

**근거**: 레지스트리에서 중앙 관리되므로, 기본 업종 변경 시 모든 컴포넌트에서 자동으로 반영됨

---

### 변경 2: Line 1060-1062 - academyName 초기화

#### 파일 위치
`apps/academy-admin/src/pages/AnalyticsPage.tsx` Line 1060-1065

#### 변경 전 코드
```typescript
onSuccess: (data) => {
  // PDF 생성 및 다운로드 (통계문서 FR-09: 월간 리포트 PDF)
  const academyName = config?.academy_name || '디어쌤'; // ← 하드코딩된 브랜드명
  const pdfData: MonthlyReportData = {
    academyName,
    reportMonth: data.month,
```

#### 변경 후 코드
```typescript
onSuccess: (data) => {
  // PDF 생성 및 다운로드 (통계문서 FR-09: 월간 리포트 PDF)
  const academyName = typeof config?.academy_name === 'string'
    ? config.academy_name
    : (config?.organization_name || '');
  const pdfData: MonthlyReportData = {
    academyName,
    reportMonth: data.month,
```

#### 분석

**문제점**:
- '디어쌤'은 특정 학원(의 AI 이름)의 고유명사
- 다른 업종이나 다른 조직에서 실행 시 부적절함
- 거의 모든 사용자에게 부자연스러운 폴백

**해결책 - 3단계 폴백**:

1단계: `config?.academy_name` (레거시, 학원 전용)
```typescript
typeof config?.academy_name === 'string' ? config.academy_name : ...
```
- 학원의 academy_name 필드 우선 사용
- typeof 체크로 string 타입 보증
- 기존 학원 데이터와의 호환성 유지

2단계: `config?.organization_name` (통일된 필드)
```typescript
: (config?.organization_name || '')
```
- 대부분의 업종에서 사용하는 필드
- 헬스장, 미용실, 부동산 등에서 조직명 제공
- 업종 중립적

3단계: 빈 문자열 (안전한 폴백)
```typescript
: (config?.organization_name || '')
```
- 조직명이 없을 경우 빈 문자열
- PDF 생성 시 "Report" 등으로 표시됨
- null/undefined 방지

#### 업종별 필드 매핑
```typescript
// Database schema 분석
config: {
  academy_name?: string;      // academy 전용
  organization_name?: string;  // gym, salon, nail_salon, real_estate 공용
  // ...
}
```

---

## 추가 개선 사항

### 관련 import 추가 (Line 34-36)
```typescript
// BEFORE
import { useConfig } from '@hooks/use-config';
import { LocationWarningBanner } from '../components/LocationWarningBanner';

// AFTER
import { useConfig } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { DEFAULT_INDUSTRY_TYPE } from '@industry/registry';
```

**이유**:
- `useIndustryTerms()`: 업종별 용어 자동 로드 (Line 80)
- `DEFAULT_INDUSTRY_TYPE`: 중앙 관리되는 기본 업종 상수

### 코드 주석 추가
```typescript
// Line 78
// [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)
const industryType = context?.industryType || config?.industry_type || DEFAULT_INDUSTRY_TYPE;
```

**목적**:
- 불변 규칙 명시 (유지보수자를 위함)
- Zero-Trust 보안 원칙 강조
- 향후 수정자가 이 줄에 하드코딩을 추가하지 않도록 경고

---

## 테스트 관점

### Unit Test 검증 항목

#### 1. industryType Fallback 체인
```typescript
describe('AnalyticsPage - industryType initialization', () => {
  test('prioritizes context.industryType', () => {
    // context.industryType = 'gym'
    // config.industry_type = 'academy'
    // Expected: industryType = 'gym'
  });

  test('falls back to config.industry_type if context missing', () => {
    // context.industryType = undefined
    // config.industry_type = 'salon'
    // Expected: industryType = 'salon'
  });

  test('uses DEFAULT_INDUSTRY_TYPE if both missing', () => {
    // context.industryType = undefined
    // config.industry_type = undefined
    // Expected: industryType = DEFAULT_INDUSTRY_TYPE ('academy')
  });
});
```

#### 2. academyName Fallback 체인
```typescript
describe('AnalyticsPage - academyName initialization', () => {
  test('uses academy_name if present and string', () => {
    // config.academy_name = '더학원'
    // Expected: academyName = '더학원'
  });

  test('falls back to organization_name if academy_name not string', () => {
    // config.academy_name = undefined
    // config.organization_name = '골드짐'
    // Expected: academyName = '골드짐'
  });

  test('uses empty string if both missing', () => {
    // config.academy_name = undefined
    // config.organization_name = undefined
    // Expected: academyName = ''
  });

  test('handles non-string academy_name gracefully', () => {
    // config.academy_name = null
    // config.organization_name = undefined
    // Expected: academyName = ''
  });
});
```

---

## 데이터 흐름 다이어그램

### industryType 초기화 흐름
```
┌─────────────────────────┐
│  getApiContext()        │
│  .industryType          │
└────────────┬────────────┘
             │
        있음? ├─YES─→ ✅ industryType = context.industryType
             │
        NO  ↓
┌─────────────────────────┐
│  useConfig()            │
│  .industry_type         │
└────────────┬────────────┘
             │
        있음? ├─YES─→ ✅ industryType = config.industry_type
             │
        NO  ↓
┌─────────────────────────┐
│  DEFAULT_INDUSTRY_TYPE  │
│  (from registry)        │
└────────────┬────────────┘
             │
             └─────────→ ✅ industryType = 'academy'
```

### academyName 초기화 흐름
```
┌────────────────────────────┐
│  config.academy_name       │
│  typeof === 'string'?      │
└────────────┬───────────────┘
             │
        YES  ├─→ ✅ academyName = academy_name
             │
        NO  ↓
┌────────────────────────────┐
│  config.organization_name  │
│  truthiness check          │
└────────────┬───────────────┘
             │
        YES  ├─→ ✅ academyName = organization_name
             │
        NO  ↓
┌────────────────────────────┐
│  Empty string              │
└────────────┬───────────────┘
             │
             └─────────→ ✅ academyName = ''
```

---

## 보안 고려사항

### Zero-Trust 원칙 적용
```typescript
// ❌ 나쁜 예: 하드코딩된 기본값
const industryType = context?.industryType || 'academy';

// ✅ 좋은 예: 계층적 검증 + 레지스트리 기반
const industryType = context?.industryType || config?.industry_type || DEFAULT_INDUSTRY_TYPE;
```

**이유**:
- 데이터 소스를 명시적으로 관리
- 각 소스의 우선순위 명확
- 향후 감사/모니터링 가능

### 타입 안전성
```typescript
// 안전한 타입 가드
const academyName = typeof config?.academy_name === 'string'
  ? config.academy_name
  : (config?.organization_name || '');
```

**이유**:
- `config.academy_name`이 null, undefined, number 등일 수 있음
- typeof 체크로 string만 사용
- 런타임 에러 방지

---

## 결론

### Phase 2-4 달성 목표
- [x] 하드코딩된 'academy' 제거
- [x] 하드코딩된 '디어쌤' 제거
- [x] 레지스트리 기반 fallback 구현
- [x] 업종 중립성 확보
- [x] Zero-Trust 원칙 준수
- [x] 타입 안전성 강화

### 코드 품질 향상
| 항목 | 개선 전 | 개선 후 |
|------|--------|--------|
| 하드코딩 상수 | 2개 | 0개 |
| Fallback 체인 | 1단계 | 3단계 (industry) / 3단계 (name) |
| 업종 호환성 | 학원만 | 5개 업종 모두 |
| 타입 안전성 | 기본 | typeof 가드 추가 |
| 유지보수성 | 낮음 | 높음 (레지스트리 중앙 관리) |

### 다음 단계
1. 다른 페이지의 유사 하드코딩 검토
2. 전체 프로젝트에서 'academy' 문자열 하드코딩 제거
3. PDF 생성 등 다운스트림 영향 테스트
