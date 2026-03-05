# Phase 1: 테스트 커버리지 복구

> **기간**: 2주 | **우선순위**: P0 | **담당**: 1~2명
> **선행 조건**: Phase 0 완료
> **목표**: 비즈니스 로직 핵심 경로에 단위 테스트 추가 + E2E skip 해제

---

## 현재 상태

| 영역 | 테스트 파일 | 활성 케이스 | skip | 비즈니스 로직 커버리지 |
|------|------------|------------|------|----------------------|
| API SDK (cache/rate-limiter/validation) | 3개 | 89건 | 0건 | 유틸리티만 커버 |
| Hooks (useStudent/useAuth/useBilling) | 3개 | 30건 | 0건 | 쿼리 훅만 커버 |
| E2E (root tests/) | 5개 | 17건 | **16건** | 대부분 비활성 |
| E2E (apps/) | 5개 | 39건 | 1건 | smoke 테스트 위주 |
| param-extraction | 1개 | 26건 | 0건 | 파라미터 추출 |
| **서비스/인더스트리/코어 레이어** | **0개** | **0건** | — | **완전 공백** |

---

## 1-1. 서비스 레이어 단위 테스트 신규 작성 (5일)

### 대상 파일 및 테스트 케이스

#### `packages/services/student-service/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/services/student-service/src/service.ts` (278줄)

```
테스트 케이스 (최소 12건):
- getStudents: 필터 없이 전체 조회
- getStudents: status 필터 적용
- getStudents: search 키워드 필터 적용
- getStudent: 존재하는 학생 조회
- getStudent: 존재하지 않는 학생 → null 반환
- createStudent: 정상 생성
- createStudent: 필수 필드 누락 시 에러
- updateStudent: 정상 수정
- deleteStudent: soft delete 동작 확인 (status → 'withdrawn')
- getGuardians: 학생별 보호자 목록 조회
- createGuardians: 보호자 생성
- bulkCreateStudents: 벌크 생성
```

#### `packages/services/attendance-service/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/services/attendance-service/src/service.ts`

```
테스트 케이스 (최소 8건):
- getAttendanceLogs: 날짜별 조회
- getAttendanceLogs: 학생별 조회
- getAttendanceLogs: 수업별 조회
- createAttendanceLog: 등원 기록 생성
- createAttendanceLog: 하원 기록 생성
- createAttendanceLog: 중복 등원 방지
- updateAttendanceLog: 상태 변경
- getAttendanceStats: 통계 집계
```

#### `packages/services/class-service/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/services/class-service/src/service.ts`

```
테스트 케이스 (최소 8건):
- getClasses: 전체 조회
- getClasses: 필터 적용
- getClass: 상세 조회 (학생 수 포함 — Phase 0-3 수정사항 검증)
- createClass: 정상 생성
- updateClass: 수정
- deleteClass: soft delete
- getClassStudents: 반별 학생 목록
- enrollStudent: 학생-반 배정
```

#### `packages/services/auth-service/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/services/auth-service/src/service.ts`

```
테스트 케이스 (최소 6건):
- login: 정상 로그인
- login: 잘못된 비밀번호
- login: 존재하지 않는 계정
- logout: 정상 로그아웃
- getCurrentUser: 인증된 사용자 조회
- getCurrentUser: 미인증 시 null
```

### 테스트 환경 설정

```
참조할 기존 패턴:
- packages/hooks/use-student/src/__tests__/useStudent.test.tsx
  → vitest + @testing-library/react + mock 패턴
- packages/api-sdk/src/__tests__/validation.test.ts
  → vitest 순수 단위 테스트 패턴

Mock 전략:
- academyService → vi.mock('@industry/academy/service')
- apiClient → vi.mock('@api-sdk/core')
- Supabase client → vi.mock('@lib/supabase-client')
```

---

## 1-2. 인더스트리 레이어 단위 테스트 (3일)

### 대상 파일

#### `packages/industry/industry-academy/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/industry/industry-academy/src/service.ts` (1,974줄)

```
테스트 케이스 (최소 15건):

[학생 도메인]
- getStudents: persons + academy_students 조인 검증
- getStudents: withTenant() 적용 확인
- createStudent: persons INSERT에 tenant_id 포함 확인
- createStudent: academy_students 확장 테이블 동시 생성
- deleteStudent: soft delete (deleted_at 설정)
- restoreDeletedStudent: 복원 동작

[수업 도메인]
- getClasses: 조회
- createClass: 생성
- enrollStudent: student_classes 레코드 생성

[출결 도메인]
- createAttendanceLog: 등원 기록
- getAttendanceLogs: 날짜 필터 (KST 변환 검증)

[보호자 도메인]
- getGuardians: 학생별 보호자 조회
- createGuardians: 벌크 생성

[태그 도메인]
- getTags: core-tags 연동 확인
- updateStudentTags: 태그 할당/해제
```

#### `packages/industry/industry-academy/src/__tests__/student-transforms.test.ts` (신규)

테스트 대상: `packages/industry/industry-academy/src/student-transforms.ts`

```
테스트 케이스 (최소 6건):
- extractAcademyData: 정상 데이터 추출
- extractAcademyData: null/undefined 입력 처리
- extractAcademyData: 빈 배열 입력 처리
- mapPersonToStudent: Person + AcademyData 병합
- mapPersonToStudent: enrichment 데이터(보호자, 대표반) 병합
- mapPersonToStudent: 누락 필드에 기본값 적용
```

---

## 1-3. E2E 테스트 skip 해제 (4일)

### 대상 파일 및 skip 사유별 대응

#### `tests/e2e/02-student-management.spec.ts` — 5건 skip

```
skip 사유: "TODO: /students 페이지 구현 후 활성화"

해제 조건:
- /students 라우트가 정상 동작하는지 확인 (App.tsx 라우팅 검증)
- 테스트 데이터 시딩 스크립트 작성 (테스트용 학생 생성/삭제)
- 테스트 간 격리: 각 테스트 전 고유 학생 생성, 후 삭제

수정할 테스트:
Line 40: '학생 목록을 조회할 수 있어야 함'
Line 61: '새로운 학생을 등록할 수 있어야 함'
Line 103: '학생 정보를 수정할 수 있어야 함'
Line 135: '학생을 검색할 수 있어야 함'
Line 190: '학생 상세 정보를 조회할 수 있어야 함'
```

#### `tests/e2e/03-attendance.spec.ts` — 3건 skip

```
skip 사유: "TODO: /attendance 페이지 구현 후 활성화"

해제 조건:
- /attendance 라우트 동작 확인
- 테스트용 수업 + 학생 + 출결 시딩

수정할 테스트:
Line 29: '출석 체크 페이지에 접근할 수 있어야 함'
Line 60: '출석 기록을 조회할 수 있어야 함'
Line 77: '출석 통계를 확인할 수 있어야 함'
```

#### `tests/e2e/04-billing.spec.ts` — 1건 skip

```
수정할 테스트:
Line 29: '청구서 목록을 조회할 수 있어야 함'
```

#### `tests/e2e/05-rbac.spec.ts` — 5건 skip

```
skip 사유: "TODO: RBAC 페이지 구현 후 활성화"

해제 조건:
- RLS 정책 기반 권한 검증이 동작하는지 확인
- 테스트용 다중 역할 사용자 시딩 (admin, manager, viewer)

수정할 테스트:
Line 15: '관리자는 모든 페이지에 접근할 수 있어야 함'
Line 58: '일반 사용자는 제한된 페이지만 접근할 수 있어야 함'
Line 89: '권한 없는 페이지 접근 시 리다이렉션되어야 함'
Line 130: '로그아웃 후 보호된 페이지 접근 시 로그인 페이지로 리다이렉션'
Line 158: '다른 테넌트의 데이터에 접근할 수 없어야 함'
```

#### `apps/academy-admin/e2e/critical-path.spec.ts` — 1건 skip

```
수정할 테스트:
Line 155: '전체 사용자 여정 (회원가입부터 출결까지)'
→ DB 초기화 스크립트 필요. 테스트 전 전용 테넌트 생성, 후 삭제.
```

#### `tests/e2e/01-login.spec.ts` — 1건 skip

```
수정할 테스트:
Line 112: '로그아웃할 수 있어야 함'
```

### E2E 인프라 작업

```
신규 파일:
- tests/e2e/helpers/seed.ts — 테스트 데이터 시딩 유틸
- tests/e2e/helpers/cleanup.ts — 테스트 후 정리 유틸
- tests/e2e/helpers/auth.ts — 로그인 헬퍼 (중복 제거)

환경 설정:
- .env.test — 테스트 전용 환경변수
- playwright.config.ts — baseURL, 타임아웃 검증
```

---

## 1-4. 코어 레이어 핵심 테스트 (3일)

### 대상 파일

#### `packages/core/core-billing/src/__tests__/service.test.ts` (신규)

테스트 대상: `packages/core/core-billing/src/service.ts` (212줄)
> **참고**: billing-service는 `packages/services/`가 아닌 `packages/core/core-billing/`에 위치

```
테스트 케이스 (최소 8건):
- createInvoice: 정상 생성 (금액 > 0)
- createInvoice: 금액 0 거부
- createInvoice: 음수 금액 거부
- getInvoices: 테넌트별 조회
- updateInvoiceStatus: 상태 변경 (pending → paid)
- calculateTotal: 합계 계산
- getOverdueInvoices: 연체 인보이스 조회
- cancelInvoice: 취소 처리
```

#### `packages/core/core-auth/src/__tests__/service.test.ts` (신규)

```
테스트 케이스 (최소 5건):
- signUp: 회원가입 + 테넌트 생성
- signIn: 로그인 + 세션 생성
- signOut: 로그아웃
- getSession: 유효 세션 반환
- getSession: 만료 세션 → null
```

#### `packages/core/core-auth/src/__tests__/signup.test.ts` (신규)

```
테스트 케이스 (최소 5건):
- signupB2B: 정상 회원가입
- signupB2B: 중복 이메일 거부
- signupB2B: 테넌트 자동 생성 확인
- signupB2B: 기본 역할 할당 확인
- signupB2B: onboarding 자동 실행 확인
```

---

## Phase 1 완료 기준

### 정량 목표

| 지표 | 현재 | 목표 | 비고 |
|------|------|------|------|
| 테스트 파일 수 | 17개 | **30개+** | +13개 신규 |
| 활성 테스트 케이스 | 201개 | **370개+** | +169건 신규 |
| E2E skip | 16건 | **0건** | 전부 해제 |
| 서비스 레이어 커버리지 | 0% | **80%+** | 핵심 경로 |
| 인더스트리 레이어 커버리지 | 0% | **60%+** | 주요 메서드 |
| 코어(billing/auth) 커버리지 | 0% | **70%+** | 금융/인증 |

### 검증 명령어

```bash
# 단위 테스트 전체 실행
npm run test:unit

# E2E 테스트 전체 실행 (skip 없이)
npm run test:e2e

# 특정 패키지 테스트
npx vitest packages/services/student-service
npx vitest packages/industry/industry-academy
npx vitest packages/core/core-billing
```

---

## 다음 Phase

← [Phase 0: 긴급 보안/데이터 무결성](./RISK_REMEDIATION_PHASE_0.md)
→ [Phase 2: 타입 안전성 복원](./RISK_REMEDIATION_PHASE_2.md)
