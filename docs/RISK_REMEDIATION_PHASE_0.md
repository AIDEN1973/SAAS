# Phase 0: 긴급 보안 및 데이터 무결성 수정

> **기간**: 3~5일 | **우선순위**: P0 (즉시) | **담당**: 1명
> **선행 조건**: 없음
> **목표**: 프로덕션에서 돈·데이터·보안에 직접 영향을 주는 버그를 즉시 수정

---

## 0-1. Payment Webhook 서명 검증 추가 (1일)

### 문제

`infra/supabase/supabase/functions/payment-webhook-handler/index.ts`에서 웹훅 요청의 서명을 검증하지 않음. 공격자가 가짜 결제 완료 웹훅을 보내면 무료로 서비스 이용 가능.

### 수정 대상

```
infra/supabase/supabase/functions/payment-webhook-handler/index.ts
  - Line 44~50: 서명 검증 로직 추가
  - Line 118~124: 멱등성 키(idempotency key) 저장 로직 추가
```

### 구현 사항

1. 웹훅 헤더에서 PG사 서명 추출 (Toss/Stripe의 `x-webhook-signature`)
2. HMAC-SHA256으로 요청 body + secret 검증
3. `webhook_events` 테이블 생성 → 수신된 이벤트 ID 저장 (중복 처리 방지)
4. 검증 실패 시 403 반환 + Sentry 알림

### 검증 기준

- [ ] 유효하지 않은 서명으로 요청 시 403 반환
- [ ] 동일 이벤트 ID 재전송 시 200 반환 (중복 처리 안 함)
- [ ] 유효한 서명으로 요청 시 정상 처리

---

## 0-2. auto-billing-generation `amount: 0` 버그 수정 (1일)

### 문제

`infra/supabase/supabase/functions/auto-billing-generation/index.ts` Line 212에서 모든 인보이스 금액이 `amount: 0`으로 생성됨.

```typescript
// 현재 코드 (Line 212)
amount: 0, // ⚠️ TODO: billing_plans 실제 금액 조회 필요
```

### 수정 대상

```
infra/supabase/supabase/functions/auto-billing-generation/index.ts
  - Line 212: billing_plans 테이블에서 실제 금액 조회
  - Line 220~227: 인보이스 생성 실패 시 재시도 로직 추가
```

### 구현 사항

1. `billing_plans` 테이블에서 학생별 수강료 조회
2. 금액이 0이거나 null이면 인보이스 생성 건너뜀 + 경고 로그
3. 생성된 인보이스 금액 검증 (음수 방지)

### 검증 기준

- [ ] billing_plans에 등록된 금액이 인보이스에 반영됨
- [ ] billing_plans가 없는 학생은 인보이스 생성 안 됨
- [ ] 음수 금액 인보이스 생성 불가

---

## 0-3. class-service 학생 수 하드코딩 수정 (0.5일)

### 문제

`packages/services/class-service/src/service.ts` Line 89~90에서 반별 학생 수가 항상 0으로 반환됨.

```typescript
// 현재 코드 (Line 89-90)
totalStudents: 0,    // TODO: 실제 학생 수 계산
activeStudents: 0,   // TODO: 실제 활성 학생 수 계산
```

### 수정 대상

```
packages/services/class-service/src/service.ts
  - Line 89~90: student_classes 테이블 기반 집계 쿼리로 교체
```

### 구현 사항

1. `student_classes` 테이블에서 class_id 기준 카운트 쿼리
2. `active_only` 필터로 활성/전체 분리

### 검증 기준

- [ ] 반 상세 조회 시 실제 등록 학생 수 반환
- [ ] 수강 등록/해제 시 카운트 갱신 확인

---

## 0-4. industry-academy `class_name: undefined` 수정 (0.5일)

### 문제

`packages/industry/industry-academy/src/service.ts` Line 249에서 학생의 소속반 이름이 항상 `undefined`.

```typescript
// 현재 코드 (Line 249)
class_name: undefined, // TODO: class_name 처리
```

### 수정 대상

```
packages/industry/industry-academy/src/service.ts
  - Line 249: student_classes + classes 조인으로 대표반 이름 조회
```

### 구현 사항

1. `student_classes` → `classes` 조인하여 대표반(첫 번째 활성 수업) 이름 조회
2. 여러 반에 등록된 경우 대표반 1개만 표시 (정렬 기준: enrolled_at ASC)

### 검증 기준

- [ ] 학생 목록에서 소속반 이름이 표시됨
- [ ] 반 미등록 학생은 빈 문자열 반환

---

## 0-5. core-auth signup eslint-disable 제거 (0.5일)

### 문제

`packages/core/core-auth/src/signup.ts` Line 1~3에서 파일 전체의 타입 안전성 규칙을 비활성화함.

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
```

인증 관련 코드에서 타입 검사를 전면 비활성화하는 것은 보안 리스크.

### 수정 대상

```
packages/core/core-auth/src/signup.ts
  - Line 1~3: eslint-disable 제거
  - 파일 전체: any 타입을 구체적 타입으로 교체
```

### 구현 사항

1. Supabase Auth 응답 타입 (`AuthResponse`, `User` 등) 적용
2. `as any` → proper type assertion 또는 type guard
3. eslint-disable 3건 제거

### 검증 기준

- [ ] `npx eslint packages/core/core-auth/src/signup.ts` 에러 0건
- [ ] 기존 useAuth 테스트 통과

---

## Phase 0 완료 체크리스트

- [ ] 0-1: 웹훅 서명 검증 구현 + 테스트
- [ ] 0-2: 빌링 금액 실제 조회 구현
- [ ] 0-3: 반별 학생 수 실제 집계 구현
- [ ] 0-4: 학생 소속반 이름 조회 구현
- [ ] 0-5: core-auth 타입 안전성 복원
- [ ] 전체: `npm run lint` 에러 증가 없음
- [ ] 전체: `npm run type-check` 통과

---

## 다음 Phase

→ [Phase 1: 테스트 커버리지 복구](./RISK_REMEDIATION_PHASE_1.md)
