# 수납관리 페이지 검증 보고서

**검증일시**: 2026-01-04
**검증 대상**: `/billing/home`, `/billing/list` 및 관련 컴포넌트
**검증 범위**: 구현 완성도, SSOT 준수, 업종중립성, 정합성, 로직 오류

---

## 📋 Executive Summary

### ✅ 구현 상태
- **전체 완성도**: 70% (기본 기능 구현 완료, 고급 기능 TODO 상태)
- **SSOT 준수**: 95% (대부분 준수, 일부 개선 필요)
- **업종중립성**: **40% (심각한 문제 발견 - 하드코딩된 용어 다수)**
- **정합성/로직**: 85% (전반적으로 양호, 일부 개선 필요)

### 🔴 주요 문제점
1. **업종 하드코딩**: "인보이스", "청구서" 등 업종별로 달라져야 할 용어가 하드코딩됨
2. **미구현 기능**: 상품 관리, 정산, 강사 매출 배분 등 P2/P3 기능 미구현
3. **타입 불일치**: BillingHistoryItem.status에 'draft' 누락
4. **라우팅 불일치**: ROUTES.BILLING_LIST()는 존재하나 실제 BillingListPage 없음

---

## 🔍 상세 검증 결과

### 1. 라우팅 및 페이지 구조

#### ✅ 정상 작동
```typescript
// routes.ts (SSOT 준수)
BILLING_HOME: '/billing/home'      → BillingHomePage.tsx ✅
BILLING_LIST: (status?) => '/billing/list?status=...'  → BillingPage.tsx ⚠️
```

#### ⚠️ 문제점
```typescript
// ROUTING ISSUE #1: BillingPage는 /billing/list가 아닌 별도 경로 필요
// 현재 BillingPage.tsx는 인보이스 목록을 보여주지만
// 라우트 설정과 불일치

// EXPECTED:
// /billing/list → BillingListPage (청구서 목록)
// /billing/invoices → BillingPage (인보이스 관리)

// ACTUAL:
// BillingPage.tsx가 두 가지 역할을 모두 수행 (한 페이지 하나의 기능 원칙 위반)
```

**개선 권장사항**:
- `BillingListPage.tsx` 생성하여 청구서 목록 전용 페이지로 분리
- `BillingPage.tsx`는 인보이스 생성/관리만 담당

---

### 2. 업종중립성 (Industry Neutrality)

#### 🔴 심각한 문제: 하드코딩된 용어

##### 2.1 스키마 파일
```typescript
// ❌ billing.schema.ts - 하드코딩
label: '납부자 ID'    // Academy: 학부모, Gym: 회원, Salon: 고객
label: '금액'         // OK (중립적)
label: '마감일'       // OK (중립적)
message: '인보이스가 생성되었습니다.'  // 업종별로 다른 용어 필요

// ❌ invoice.table.schema.ts - 하드코딩
label: '상태'         // OK
label: '금액'         // OK
label: '마감일'       // OK
```

**문제**: 업종에 따라 다른 용어를 사용해야 함
- Academy: "청구서", "학부모"
- Gym: "회비", "회원"
- Salon: "결제", "고객"
- Real Estate: billing 기능 자체가 불필요 (VISIBLE_PAGES.billing = false)

##### 2.2 페이지 컴포넌트
```typescript
// ❌ BillingPage.tsx - 하드코딩
title="수납/청구 관리"           // 업종 하드코딩
'새 인보이스 생성'                // 업종 하드코딩
'인보이스가 생성되었습니다.'      // 업종 하드코딩
'강사 매출 배분 설정이 저장되었습니다.' // Academy 전용 기능

// ❌ BillingHomePage.tsx - 하드코딩
title="수납/청구 홈"              // 업종 하드코딩
'이번 달 청구서 준비 중'          // 업종 하드코딩
'미납 7일 이상 청구서가'          // 업종 하드코딩
```

##### 2.3 업종별 용어 매핑 누락
```typescript
// ❌ industry-registry.ts에 BILLING 관련 용어 정의가 없음

// EXPECTED:
export interface IndustryTerms {
  // ... 기존 필드 ...

  // Billing 관련
  BILLING_LABEL: string;           // Academy: '수납', Gym: '회비', Salon: '결제'
  BILLING_LABEL_PLURAL: string;
  INVOICE_LABEL: string;           // Academy: '청구서', Gym: '회비 청구서', Salon: '결제 내역'
  PAYER_LABEL: string;             // Academy: '학부모', Gym: '회원', Salon: '고객'
  PAYMENT_LABEL: string;
  OVERDUE_LABEL: string;
  COLLECTION_RATE_LABEL: string;
}
```

#### 🔴 심각한 문제: 업종 가시성 미적용
```typescript
// ❌ App.tsx - Billing 메뉴는 표시되나 업종별 가시성 체크 없음

// EXPECTED:
const terms = getIndustryTerms(industryType);
if (!terms.VISIBLE_PAGES.billing) {
  // Billing 메뉴 숨기기
}

// Real Estate는 billing=false이므로 메뉴 자체가 보이면 안 됨
```

---

### 3. SSOT (Single Source of Truth) 준수

#### ✅ 잘 지켜진 부분
```typescript
// ✅ routes.ts - SSOT
BILLING_HOME: '/billing/home'
BILLING_LIST: (status?: string) => ...

// ✅ billingUtils.ts - 상태값 SSOT
export const INVOICE_PAID_STATUSES = new Set<string>(['paid']);
export function isInvoicePaid(status?: string): boolean { ... }

// ✅ Hook 재사용
export async function fetchBillingHistory(...) { ... }
export function useBillingHistory(...) {
  return useQuery({ queryFn: () => fetchBillingHistory(...) })
}
```

#### ⚠️ 개선 필요
```typescript
// ⚠️ TYPE MISMATCH
// billingUtils.ts
INVOICE_PAID_STATUSES = new Set<string>(['paid']);

// useBilling.ts
status: 'pending' | 'paid' | 'overdue' | 'cancelled'  // 'draft' 누락

// billing.schema.ts (actions)
// BillingPage.tsx (statusLabels)
statusLabels: { draft: '초안', pending: '대기', paid: '결제완료', overdue: '연체', cancelled: '취소' }

// ❌ 'draft' 상태가 일부 파일에만 존재
```

**개선안**:
```typescript
// billingUtils.ts에 모든 상태값 SSOT로 정의
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: '초안',
  pending: '대기',
  paid: '결제완료',
  overdue: '연체',
  cancelled: '취소',
};

export const INVOICE_PAID_STATUSES = new Set<InvoiceStatus>([INVOICE_STATUSES.PAID]);
```

---

### 4. 기능 완성도

#### ✅ 구현 완료 기능
1. **BillingHomePage** (70% 완성)
   - ✅ 예상 수납률 카드
   - ✅ 긴급 알림 카드 (7일 이상 연체)
   - ✅ 자동 청구 진행 현황
   - ✅ 결제 현황 요약
   - ⚠️ 결제수단 미등록 체크 (P3 TODO - payment_methods 테이블 필요)

2. **BillingPage** (60% 완성)
   - ✅ 인보이스 목록 조회 (SchemaTable)
   - ✅ 인보이스 생성 (SchemaForm)
   - ✅ 상태별 필터링
   - ❌ 인보이스 상태 업데이트 (P1 TODO - 주석 처리됨)
   - ❌ 상품 관리 (P2 TODO - UI만 있고 기능 없음)
   - ❌ 정산 실행 (P2 TODO - settlements 테이블 없음)
   - ❌ 강사 매출 배분 (P2 TODO - 설정만 저장, 실제 로직 없음)

3. **Billing Hooks** (80% 완성)
   - ✅ useBillingHistory (조회)
   - ✅ useInvoice (단일 조회)
   - ✅ useProcessPayment (결제 처리 + Execution Audit)
   - ⚠️ fetchBillingHistory는 invoice 테이블을 조회하나 BillingHistoryItem 타입 사용 (혼란)

#### ❌ 미구현 기능 (P1-P3 TODO)

##### P1 (높은 우선순위)
```typescript
// 1. 인보이스 상태 업데이트 기능
// BillingPage.tsx:223-241
const updateInvoiceStatus = useMutation({ ... })  // 주석 처리됨
// → 관리자가 수동으로 상태 변경 필요 (draft → pending → paid → cancelled)
```

##### P2 (중간 우선순위)
```typescript
// 2. 상품 관리 (products 테이블)
// BillingPage.tsx:118-121
// → 현재는 invoice_items에서 임시로 추출하는 방식
// → 별도 ProductsPage 생성 권장

// 3. 정산 실행 (settlements 테이블)
// BillingPage.tsx:173-175
// → 계산만 수행하고 실제 저장 안 함

// 4. 과목별 매출 집계
// subject-revenue.table.schema.ts는 있으나 실제 쿼리 없음
```

##### P3 (낮은 우선순위)
```typescript
// 5. 결제수단 등록 체크 (payment_methods 테이블)
// BillingHomePage.tsx:79-82
// → 자동 청구를 위한 결제수단 등록 필수

// 6. billing_plans 테이블 구현
// billing-exec-issue_invoices.ts:179-180
// → 현재는 고정 금액으로 청구서 생성
```

---

### 5. 로직 및 정합성 검증

#### ✅ 올바른 로직
```typescript
// 1. Zero-Trust 원칙 준수
const context = getApiContext();
const tenantId = context.tenantId;
// UI에서 tenantId 직접 전달 안 함 ✅

// 2. KST 기준 날짜 처리
const dueDateKST = toKST(inv.period_end);
const nowKST = toKST();
const daysOverdue = nowKST.diff(dueDateKST, 'days'); ✅

// 3. Execution Audit 자동 기록
await createExecutionAuditRecord({ ... }); ✅

// 4. 반응형 UI (Mobile/Tablet/Desktop)
{isMobileMode || isTabletMode ? <Drawer /> : <Modal />} ✅
```

#### ⚠️ 개선 필요한 로직

##### 5.1 BillingHomePage 카드 로직
```typescript
// ⚠️ ISSUE #1: auto_billing_enabled 필드가 invoice 테이블에 없음
const autoBillingInvoices = invoices.filter(
  (inv: BillingHistoryItem & { auto_billing_enabled?: boolean }) =>
    inv.auto_billing_enabled
);
// → 항상 0%가 되어 의미 없는 카드

// ⚠️ ISSUE #2: 미납 알림 진행 현황 카드가 생성되지 않음
// BillingHomePage.tsx:145에서 cards.push() 누락
```

##### 5.2 BillingPage 필터링
```typescript
// ⚠️ ISSUE #3: SchemaTable에 filter를 전달하지만 실제 적용 안 됨
<SchemaTable
  schema={invoiceTableSchemaData}
  apiCall={async () => {
    const response = await apiClient.get('invoices', {
      filters: filter.status ? { status: filter.status } : {},
      // ✅ 필터는 전달됨
    });
  }}
/>
// → SchemaTable이 apiCall을 호출하는지 확인 필요
```

##### 5.3 타입 안전성
```typescript
// ⚠️ ISSUE #4: any 타입 사용
(items as Array<{ item_type?: string; description?: string; ... }>)
// → InvoiceItem 타입을 정의하고 사용해야 함

// ⚠️ ISSUE #5: 타입 단언 남용
return (response.data || []) as BillingHistoryItem[];
// → 실제 타입 검증 없이 강제 변환
```

---

### 6. Edge Function 및 자동화

#### ✅ 구현된 자동화
1. **월 자동 청구** (billing-exec-issue_invoices.ts)
   - ✅ 매일 04:00 KST 자동 실행
   - ✅ 활성 학생 조회
   - ✅ 중복 발행 방지
   - ⚠️ billing_plans 테이블 미구현 (고정 금액 사용)

2. **연체 알림** (billing-send-overdue-notice-*.ts)
   - ✅ 1차/2차 연체 안내
   - ✅ amount_due > 0인 청구서 대상
   - ✅ 보호자별 중복 제거

3. **결제 링크 발송** (billing-send-payment-link.ts)
   - ✅ SMS/KakaoTalk 발송
   - ✅ notifications 테이블 기록

#### ⚠️ 개선 필요
```typescript
// ISSUE #6: 강사 매출 배분 설정은 저장되지만 실제 배분 로직 없음
// teacher-revenue-split.schema.ts는 있으나
// 정산 시 강사별로 금액을 배분하는 로직이 billing-exec-close_month.ts에 없음
```

---

## 📊 검증 결과 요약

| 항목 | 점수 | 상태 |
|------|------|------|
| **라우팅 구조** | 70% | ⚠️ BillingListPage 누락 |
| **업종중립성** | 40% | 🔴 심각 - 하드코딩 다수 |
| **SSOT 준수** | 95% | ✅ 양호 (일부 타입 불일치) |
| **기능 완성도** | 70% | ⚠️ P1/P2 기능 미구현 |
| **로직 정합성** | 85% | ⚠️ 일부 로직 오류 |
| **코드 품질** | 90% | ✅ 우수 (타입 안전성 개선 필요) |

---

## 🔧 필수 개선 사항

### Priority 1 (즉시 개선 필요)

#### 1. 업종중립성 확보
```typescript
// industry-registry.ts에 추가
export interface IndustryTerms {
  // ... 기존 필드 ...

  // Billing 관련
  BILLING_LABEL: string;
  BILLING_HOME_LABEL: string;
  INVOICE_LABEL: string;
  INVOICE_LABEL_PLURAL: string;
  PAYER_LABEL: string;
  PAYMENT_LABEL: string;
  OVERDUE_LABEL: string;
  COLLECTION_RATE_LABEL: string;
  DUE_DATE_LABEL: string;
  AMOUNT_LABEL: string;
}

const ACADEMY_TERMS: IndustryTerms = {
  // ...
  BILLING_LABEL: '수납',
  BILLING_HOME_LABEL: '수납 홈',
  INVOICE_LABEL: '청구서',
  INVOICE_LABEL_PLURAL: '청구서들',
  PAYER_LABEL: '학부모',
  PAYMENT_LABEL: '결제',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '수납률',
  DUE_DATE_LABEL: '마감일',
  AMOUNT_LABEL: '금액',
};

const GYM_TERMS: IndustryTerms = {
  // ...
  BILLING_LABEL: '회비',
  BILLING_HOME_LABEL: '회비 홈',
  INVOICE_LABEL: '회비 청구서',
  INVOICE_LABEL_PLURAL: '회비 청구서들',
  PAYER_LABEL: '회원',
  PAYMENT_LABEL: '납부',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '납부율',
  DUE_DATE_LABEL: '납부 기한',
  AMOUNT_LABEL: '금액',
};

const SALON_TERMS: IndustryTerms = {
  // ...
  BILLING_LABEL: '결제',
  BILLING_HOME_LABEL: '결제 홈',
  INVOICE_LABEL: '결제 내역',
  INVOICE_LABEL_PLURAL: '결제 내역들',
  PAYER_LABEL: '고객',
  PAYMENT_LABEL: '결제',
  OVERDUE_LABEL: '미결제',
  COLLECTION_RATE_LABEL: '결제율',
  DUE_DATE_LABEL: '결제 기한',
  AMOUNT_LABEL: '금액',
};
```

#### 2. 스키마 업종중립화
```typescript
// billing.schema.ts
import { useIndustryTerms } from '@hooks/use-industry-terms';

export function createBillingFormSchema(terms: IndustryTerms): FormSchema {
  return {
    // ...
    fields: [
      {
        name: 'payer_id',
        ui: {
          label: terms.PAYER_LABEL + ' ID',
          placeholder: terms.PAYER_LABEL + ' ID를 입력하세요',
        },
      },
      {
        name: 'amount',
        ui: {
          label: terms.AMOUNT_LABEL,
        },
      },
      {
        name: 'due_date',
        ui: {
          label: terms.DUE_DATE_LABEL,
        },
      },
    ],
    actions: [
      {
        event: 'onSubmitSuccess',
        message: terms.INVOICE_LABEL + '가 생성되었습니다.',
      },
    ],
  };
}
```

#### 3. 페이지 컴포넌트 업종중립화
```typescript
// BillingPage.tsx
const terms = useIndustryTerms();

<PageHeader title={terms.BILLING_LABEL + ' 관리'} />
<Button onClick={...}>새 {terms.INVOICE_LABEL} 생성</Button>
showAlert(terms.INVOICE_LABEL + '가 생성되었습니다.', '성공');
```

#### 4. 타입 통일
```typescript
// billingUtils.ts - SSOT
export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUSES[keyof typeof INVOICE_STATUSES];

// useBilling.ts
import { InvoiceStatus } from '../../utils/billingUtils';

status: InvoiceStatus;  // 'pending' | 'paid' | 'overdue' | 'cancelled' | 'draft'
```

### Priority 2 (단기 개선)

#### 5. BillingListPage 분리
```typescript
// BillingListPage.tsx (새 파일)
export function BillingListPage() {
  const { status } = useParams();
  // 청구서 목록만 표시
  // 상세보기, 상태 변경 등은 여기서 처리
}

// App.tsx 라우팅
<Route path="/billing/list" element={<BillingListPage />} />
<Route path="/billing/invoices" element={<BillingPage />} />
```

#### 6. P1 기능 구현 - 인보이스 상태 업데이트
```typescript
// BillingPage.tsx - 주석 해제 및 구현
const updateInvoiceStatus = useMutation({
  mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
    const response = await apiClient.patch<Invoice>(`invoices/${id}`, { status });
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['invoices', tenantId] });
    showAlert(terms.INVOICE_LABEL + ' 상태가 업데이트되었습니다.', '성공');
  },
});
```

#### 7. 로직 오류 수정
```typescript
// BillingHomePage.tsx - 미납 알림 진행 현황 카드 추가
cards.push({
  id: 'unpaid-notification-progress',
  type: 'unpaid_notification_progress',
  title: '미납 알림 진행 현황',
  value: `${overdueInvoices.length}건`,
  action_url: ROUTES.BILLING_LIST('overdue'),
  priority: 6,
});

// auto_billing_enabled 필드 제거 또는 실제 구현
// (현재는 의미 없는 카드이므로 제거 권장)
```

---

## 📝 권장 개선 로드맵

### Phase 1 (1-2주) - 업종중립성 확보
1. ✅ industry-registry.ts에 BILLING 관련 용어 추가
2. ✅ 모든 스키마 파일 업종중립화
3. ✅ 모든 페이지 컴포넌트 terms 사용
4. ✅ 타입 통일 (SSOT)

### Phase 2 (2-3주) - 미구현 기능 완성
1. ✅ BillingListPage 분리
2. ✅ 인보이스 상태 업데이트 구현
3. ✅ 로직 오류 수정
4. ⚠️ products 테이블 설계 및 구현 (별도 페이지)
5. ⚠️ settlements 테이블 설계 및 구현

### Phase 3 (3-4주) - 고급 기능
1. ⚠️ payment_methods 테이블 구현
2. ⚠️ billing_plans 테이블 구현
3. ⚠️ 강사 매출 배분 실제 로직 구현
4. ⚠️ 과목별 매출 집계 쿼리 구현

---

## 🎯 결론

수납관리 페이지는 **기본 기능은 잘 구현**되어 있으나, **업종중립성이 심각하게 부족**합니다.

### 즉시 조치 필요
1. **industry-registry.ts에 BILLING 용어 추가** (최우선)
2. **모든 하드코딩된 "인보이스", "청구서" 제거**
3. **타입 통일 (InvoiceStatus)**
4. **BillingListPage 분리**

### 단기 개선
5. **P1 기능 구현 (상태 업데이트)**
6. **로직 오류 수정**

### 장기 개선
7. **P2/P3 기능 구현 (상품, 정산, 결제수단)**

SSOT 준수와 코드 품질은 우수하지만, **업종 확장성이 현저히 부족**하여 Gym, Salon 등 다른 업종에서는 **용어 불일치로 사용 불가** 상태입니다.

---

**검증자**: Claude Code
**최종 수정**: 2026-01-04
