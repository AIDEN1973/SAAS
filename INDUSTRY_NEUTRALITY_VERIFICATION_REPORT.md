# 업종중립성 검증 보고서
**Date:** 2026-01-04
**Project:** SAMDLE Academy Admin
**Objective:** SSOT, 업종중립, 테넌트 추가(업종 추가) 기준 엄격 준수 검증

---

## 📊 Executive Summary

| 메트릭 | 현황 | 목표 |
|--------|------|------|
| **Industry Registry** | ✅ 완료 | **5개 업종 지원** (academy, gym, salon, nail_salon, real_estate) |
| **useIndustryTerms Hook** | ✅ 완료 | Context 기반 자동 업종 감지 |
| **useIndustryConfig Hook** | ✅ 완료 | 페이지 가시성 체크 및 라우트 조회 |
| **IndustryBasedRoute** | ✅ 완료 | 업종별 라우팅 보호 (7개 라우트 적용) |
| **App.tsx 사이드바 필터링** | ✅ 완료 | 업종별 메뉴 자동 숨김/표시 |
| **업종중립 달성률** | **27%** | 100% (11개 중 3개 페이지 완료) |
| **하드코딩 위반 건수** | **69+ 건** | 0건 목표 (StudentsPage + 기타 8개 페이지) |

### 주요 성과
1. ✅ **Industry Registry 시스템 구축 완료 (Phase 1 + Phase 2)**
   - 파일: `packages/industry/industry-registry.ts`
   - **5개 업종 지원**: Academy, Gym, Salon, Nail Salon, Real Estate
   - `PERSON_LABEL_PRIMARY`, `ROUTES`, `STATS_*_TITLE` 등 50+ 용어 정의
   - **VISIBLE_PAGES 추가**: 업종별 페이지 가시성 설정

2. ✅ **useIndustryTerms Hook 구현 완료 (Phase 1)**
   - 파일: `packages/hooks/use-industry-terms/src/index.ts`
   - Zero-Trust 정책 준수 (Context에서 tenantId 추출)
   - Shared Catalog 등록 완료

3. ✅ **useIndustryConfig Hook 구현 완료 (Phase 3)**
   - 파일: `packages/hooks/use-industry-config/src/index.ts`
   - 페이지 가시성 체크 (`isPageVisible`, `isAnyPageVisible` 등)
   - 라우트 경로 조회 (`getRoutePath`)
   - Shared Catalog 등록 완료

4. ✅ **IndustryBasedRoute 컴포넌트 구현 완료 (Phase 3)**
   - 파일: `apps/academy-admin/src/components/IndustryBasedRoute.tsx`
   - 3가지 변형: 단일, OR, AND
   - 7개 라우트에 적용 (classes, teachers, attendance, billing, analytics, ai, settings)

5. ✅ **App.tsx 사이드바 메뉴 업종별 필터링 완료 (Phase 3)**
   - 파일: `apps/academy-admin/src/App.tsx`
   - 업종별 메뉴 자동 숨김/표시
   - 용어 자동 전환 (예: "학생" → "회원" → "고객")
   - 예: Salon은 "출결 관리" 숨김, "예약 관리" 표시

6. ✅ **HomePage 100% 업종중립화 달성 (Phase 1)**
   - Emergency Cards, AI Briefing Cards 메시지 모두 업종중립
   - useIndustryTerms Hook 적용 완료

7. ✅ **useStudentStatsCards Hook 100% 업종중립화 달성 (Phase 1)**
   - 모든 통계 카드 제목 업종중립화
   - 라우팅 경로 업종중립화

8. ✅ **AttendancePage 100% 업종중립화 달성 (Phase 1)**
   - 31개 하드코딩 위반 모두 수정 완료
   - Industry Registry 확장 (7개 신규 용어 추가)
   - 출석부 인쇄 기능 업종중립화

### 주요 이슈 (Phase 1 완료 필요)
1. ❌ **11개 주요 페이지 중 8개가 업종 특화 하드코딩 상태**
2. ❌ **69개 이상의 하드코딩 위반 건수** (StudentsPage 50건 + 기타 페이지 예상 19건)
3. ✅ **routes.ts 문제 해결** (IndustryBasedRoute로 동적 처리)

---

## 📋 페이지별 검증 결과

### 1. HomePage (홈 대시보드)
**파일:** `apps/academy-admin/src/pages/HomePage.tsx`
**상태:** ✅ **100% 업종중립 달성**

#### 수정 내역
- ✅ useIndustryTerms Hook 추가
- ✅ Emergency Cards 메시지 업종중립화
  ```typescript
  // 변경 전
  message: `${count}명의 학생이 이탈 위험 단계입니다.`

  // 변경 후
  message: `${count}명의 ${terms.PERSON_LABEL_PRIMARY}이(가) ${terms.EMERGENCY_RISK_LABEL}입니다.`
  ```
- ✅ AI Briefing Cards 메시지 업종중립화
- ✅ 라우팅 경로 업종중립화 (`terms.ROUTES.PRIMARY_RISK`)

#### 검증 결과
- useIndustryTerms 사용: ✅ Yes (라인 134)
- 하드코딩 위반: 0건
- 업종중립성: **100%**

---

### 2. StudentsPage (학생관리)
**파일:** `apps/academy-admin/src/pages/StudentsPage.tsx`
**상태:** ⚠️ **Hook 추가만 완료, 메시지 미수정**

#### 위반 사항 (50+ 건)

**A. 페이지 제목 및 레이블 (14건)**
```typescript
// 라인 520
title="학생관리"  // ❌ 하드코딩
→ title={`${terms.PERSON_LABEL_PRIMARY} 관리`}

// 라인 530
createTooltip="학생등록"  // ❌ 하드코딩
→ createTooltip={`${terms.PERSON_LABEL_PRIMARY} 등록`}

// 라인 357
toast('학생이 삭제(퇴원 처리)되었습니다.', 'success');  // ❌ 하드코딩
→ toast(`${terms.PERSON_LABEL_PRIMARY}이 삭제되었습니다.`, 'success');
```

**B. 빈 상태 메시지 (3건)**
```typescript
// 라인 733
등록된 학생이 없습니다.  // ❌ 하드코딩
→ `등록된 ${terms.PERSON_LABEL_PRIMARY}이 없습니다.`

// 라인 739
첫 학생 등록하기  // ❌ 하드코딩
→ `첫 ${terms.PERSON_LABEL_PRIMARY} 등록하기`
```

#### 수정 현황
- ✅ useIndustryTerms Hook import 추가 (라인 30)
- ❌ 메시지 미수정 (50+ 건 잔존)
- 업종중립성: **5%**

---

### 3. StudentsHomePage (학생관리 홈)
**파일:** `apps/academy-admin/src/pages/StudentsHomePage.tsx`
**상태:** ❌ **미수정**

#### 위반 사항 (5건)
```typescript
// 라인 108
title="학생 관리"  // ❌ 하드코딩

// 라인 114
전체 학생 보기  // ❌ 하드코딩
```

#### 수정 필요
- ❌ useIndustryTerms Hook 미사용
- 업종중립성: **0%**

---

### 4. AttendancePage (출결관리)
**파일:** `apps/academy-admin/src/pages/AttendancePage.tsx`
**상태:** ✅ **100% 업종중립 달성**

#### 수정 내역 (31건 모두 수정)

**A. Industry Registry 확장**
```typescript
// 7개 신규 용어 추가
EXCUSED_LABEL: string;      // '사유'
CHECK_IN_LABEL: string;     // '등원' (academy) | '입장' (fitness/music)
CHECK_OUT_LABEL: string;    // '하원' (academy) | '퇴장' (fitness/music)
TOTAL_LABEL: string;        // '총원'
```

**B. 알림 메시지 (5건)**
```typescript
// 라인 485
showAlert(`${terms.PERSON_LABEL_PRIMARY}을(를) 선택해주세요.`, '입력 오류', 'warning');

// 라인 610
showAlert(`등록되지 않은 ${terms.PERSON_LABEL_PRIMARY}입니다.`, '알림', 'warning');

// 라인 625
showAlert(`${student.name}님의 ${terms.CHECK_IN_LABEL}이(가) 기록되었습니다.`, '출결 기록 완료', 'success');

// 라인 650, 655
showAlert(`${terms.PERSON_LABEL_PRIMARY} 정보를 불러오는 중입니다.`, '알림', 'info');
showAlert(`${terms.PERSON_LABEL_PRIMARY} 정보가 없습니다.`, '알림', 'info');
```

**C. 출석부 인쇄 상태 매핑 (8건)**
```typescript
// 라인 705-706
const typeStr = log.attendance_type === 'check_in' ? terms.CHECK_IN_LABEL
  : log.attendance_type === 'check_out' ? terms.CHECK_OUT_LABEL
  : log.attendance_type === 'late' ? terms.LATE_LABEL
  : terms.ABSENCE_LABEL;

const statusStr = log.status === 'present' ? terms.PRESENT_LABEL
  : log.status === 'late' ? terms.LATE_LABEL
  : log.status === 'absent' ? terms.ABSENCE_LABEL
  : terms.EXCUSED_LABEL;
```

**D. Select Options (8건)**
```typescript
// 라인 1157-1160, 1345-1348
<option value="present">{terms.PRESENT_LABEL}</option>
<option value="late">{terms.LATE_LABEL}</option>
<option value="absent">{terms.ABSENCE_LABEL}</option>
<option value="excused">{terms.EXCUSED_LABEL}</option>
```

**E. 버튼 라벨 및 통계 카드 (16건)**
```typescript
// 체크박스 라벨 (4건)
<span>{terms.CHECK_IN_LABEL}</span>
<span>{terms.CHECK_OUT_LABEL}</span>

// 일괄 버튼 (4건)
일괄 {terms.CHECK_IN_LABEL}
일괄 {terms.CHECK_OUT_LABEL}

// 통계 카드 제목 (4건)
title={terms.TOTAL_LABEL}
title={terms.PRESENT_LABEL}
title={terms.LATE_LABEL}
title={terms.ABSENCE_LABEL}

// 배지 라벨 (6건) - Tablet & Mobile 섹션
<Badge>{terms.LATE_LABEL}</Badge>
<Badge>{terms.ABSENCE_LABEL}</Badge>
<Badge>{terms.EXCUSED_LABEL}</Badge>
```

#### 검증 결과
- ✅ useIndustryTerms Hook 적용 완료
- ✅ 하드코딩 위반: **0건** (Grep 검증 완료)
- ✅ 업종중립성: **100%**

**상세 보고서:** [ATTENDANCE_PAGE_VERIFICATION_COMPLETE.md](ATTENDANCE_PAGE_VERIFICATION_COMPLETE.md)

---

### 5. routes.ts (라우팅 상수)
**파일:** `apps/academy-admin/src/constants/routes.ts`
**상태:** ❌ **미수정**

#### 위반 사항 (6건)
```typescript
// 라인 12-22
export const ROUTES = {
  HOME: '/',

  // ❌ 하드코딩된 /students 경로
  STUDENTS_LIST: '/students/list',
  STUDENTS_RISK: '/students/list?filter=risk',
  STUDENTS_ABSENT: '/students/list?filter=absent',
  STUDENTS_CONSULTATION: '/students/list?filter=consultation',
  STUDENT_DETAIL: (studentId: string) => `/students/list?studentId=${studentId}`,

  // ... 기타 경로
};
```

#### 권장 수정안
```typescript
import { getIndustryTerms } from '@industry/registry';

export function getRoutes(industryType: string = 'academy') {
  const terms = getIndustryTerms(industryType);

  return {
    HOME: '/',
    PRIMARY_LIST: terms.ROUTES.PRIMARY_LIST,
    PRIMARY_RISK: terms.ROUTES.PRIMARY_RISK,
    // ... Industry Registry 활용

    // 하위 호환성을 위해 기존 이름 유지
    STUDENTS_LIST: terms.ROUTES.PRIMARY_LIST,
    // ...
  };
}

export const ROUTES = getRoutes('academy');
```

---

### 6-11. 나머지 페이지 (검증 대기)
- AnalyticsPage (통계분석)
- AIPage (인공지능)
- ClassesPage (수업관리)
- TeachersPage (강사관리)
- BillingPage (수납관리)
- AutomationSettingsPage (자동화 설정)
- AlimtalkSettingsPage (알림톡 설정)

**예상 위반 건수:** 각 페이지당 20-50건 (총 140-350건 추정)

---

## 🔧 수정 방안 및 우선순위

### P0: 즉시 수정 필수 (완료)
- ✅ Industry Registry 시스템 구축
- ✅ useIndustryTerms Hook 구현
- ✅ HomePage 업종중립화
- ✅ useStudentStatsCards Hook 업종중립화

### P1: 고우선순위 (진행중)
1. ⏳ **StudentsPage 메시지 수정** (50+ 건)
   - 페이지 제목, 버튼 라벨, 알림 메시지
2. ⏳ **AttendancePage 전체 수정** (31건)
   - 출석부 상태 매핑, Select Options
3. ⏳ **routes.ts 동적 함수화**
   - Industry Registry 연동

### P2: 중우선순위 (대기)
4. StudentsHomePage 수정 (5건)
5. ClassesPage 검증 및 수정
6. TeachersPage 검증 및 수정

### P3: 저우선순위 (대기)
7. BillingPage 검증 및 수정
8. AnalyticsPage 검증 및 수정
9. AIPage 검증 및 수정
10. AutomationSettingsPage 검증 및 수정
11. AlimtalkSettingsPage 검증 및 수정

---

## 📈 업종 전환 테스트 시나리오

### 테스트 케이스 1: Academy → Fitness
1. tenants 테이블에서 industry_type을 'fitness'로 변경
2. 예상 결과:
   - "학생" → "회원"
   - "반" → "수업"
   - "강사" → "트레이너"
   - "/students" → "/members"

### 테스트 케이스 2: Academy → Music
1. tenants 테이블에서 industry_type을 'music'로 변경
2. 예상 결과:
   - "학생" → "수강생"
   - "반" → "레슨"
   - "강사" → "강사" (동일)
   - "/students" → "/students" (동일)

---

## 🎯 최종 권장사항

### 옵션 A: 단계적 수정 (권장)
1. ✅ 완료: Industry Registry + useIndustryTerms Hook
2. ✅ 완료: HomePage 업종중립화
3. ⏭️ **다음 단계**: 3개 핵심 페이지 수정
   - StudentsPage (학생관리)
   - AttendancePage (출결관리)
   - ClassesPage (수업관리)
4. 점진적으로 나머지 페이지 개선

### 옵션 B: 일괄 자동화
- 정규표현식 기반 일괄 치환 스크립트 작성
- ⚠️ 위험: 컨텍스트 무시로 인한 오작동 가능

### 옵션 C: 현재 상태 유지
- Infrastructure는 완비되었으므로 향후 점진적 적용

---

---

## 🚀 Phase 3: Industry-Based Routing 완료 (2026-01-04)

### 구현 내용

**1. IndustryBasedRoute 컴포넌트** (✅ 완료)
- 파일: [apps/academy-admin/src/components/IndustryBasedRoute.tsx](apps/academy-admin/src/components/IndustryBasedRoute.tsx)
- 기능: 업종별 페이지 가시성 설정에 따라 라우트 접근 제어
- 3가지 변형:
  - `IndustryBasedRoute`: 단일 페이지 체크
  - `IndustryBasedRouteOr`: 여러 페이지 중 하나라도 visible이면 허용
  - `IndustryBasedRouteAnd`: 모든 페이지가 visible일 때만 허용

**2. useIndustryConfig Hook** (✅ 완료)
- 파일: [packages/hooks/use-industry-config/src/index.ts](packages/hooks/use-industry-config/src/index.ts)
- 기능: `useIndustryTerms` Hook의 래퍼로 편리한 메서드 제공
- API:
  - `isPageVisible(page)`: 페이지 가시성 체크
  - `getRoutePath(route)`: 라우트 경로 조회
  - `isAnyPageVisible(pages)`: 여러 페이지 중 하나라도 visible인지 체크
  - `areAllPagesVisible(pages)`: 모든 페이지가 visible인지 체크

**3. App.tsx 사이드바 메뉴 업종별 필터링** (✅ 완료)
- 파일: [apps/academy-admin/src/App.tsx](apps/academy-admin/src/App.tsx:L417-L675)
- 기능:
  - 업종별 메뉴 항목 자동 숨김/표시
  - 용어 자동 전환 (예: "학생 관리" → "회원 관리" → "고객 관리")
  - 예시:
    - Academy: "출결 관리" ✅, "예약 관리" ❌
    - Salon: "출결 관리" ❌, "예약 관리" ✅

**4. App.tsx 라우팅 보호** (✅ 완료)
- 파일: [apps/academy-admin/src/App.tsx](apps/academy-admin/src/App.tsx:L782-L800)
- 적용된 7개 라우트:
  1. `/classes` - 수업관리
  2. `/teachers` - 강사관리
  3. `/attendance` - 출결관리
  4. `/billing/*` - 수납관리
  5. `/analytics` - 통계분석
  6. `/ai` - 인공지능
  7. `/settings/automation`, `/settings/alimtalk` - 자동화/알림톡 설정

### 업종별 페이지 가시성 매트릭스

| 페이지 | academy | gym | salon | nail_salon | real_estate |
|--------|---------|-----|-------|------------|-------------|
| **attendance** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **appointments** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **billing** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **properties** | ❌ | ❌ | ❌ | ❌ | ✅ |

### 테스트 시나리오 예시

**Salon 테넌트 (미용실):**
- 사이드바: "고객 관리", "예약 관리", "서비스 관리", "스타일리스트 관리" 표시
- 사이드바: "출결 관리" 숨김 (attendance=false)
- URL 접근: `/attendance` → 자동 리다이렉트 `/home`
- URL 접근: `/appointments` → 허용 (AppointmentsPage 표시)

**상세 보고서:** [PHASE3_INDUSTRY_BASED_ROUTING_COMPLETE.md](PHASE3_INDUSTRY_BASED_ROUTING_COMPLETE.md)

---

## 📝 결론

**Phase 3 완료로 업종중립성 인프라가 100% 완성되었습니다.**

- ✅ **Infrastructure 완성도: 100%**
  - Industry Registry (**5개 업종** 지원: academy, gym, salon, nail_salon, real_estate)
  - useIndustryTerms Hook (Phase 1)
  - useIndustryConfig Hook (Phase 3)
  - IndustryBasedRoute 컴포넌트 (Phase 3)
  - App.tsx 사이드바 필터링 (Phase 3)
  - App.tsx 라우팅 보호 (Phase 3)
  - Shared Catalog 등록 완료

- ⚠️ **Application 적용률: 27%**
  - HomePage: 100% 완료
  - useStudentStatsCards: 100% 완료
  - AttendancePage: 100% 완료
  - StudentsPage: 5% (Hook만 추가)
  - 나머지 8개 페이지: 0%

**다음 우선순위:**

**옵션 A: Phase 4 - 신규 페이지 구현 (권장)**
1. Appointments Page 구현 (salon, nail_salon, real_estate 필수)
2. Properties Page 구현 (real_estate 전용)

**옵션 B: Phase 1 완료 - 기존 페이지 수정**
1. StudentsPage 메시지 수정 (50+ 건)
2. 나머지 8개 페이지 검증 및 수정

**예상 작업 시간:**
- Appointments Page: 4-6시간
- Properties Page: 3-4시간
- StudentsPage 완료: 2-3시간
- 전체 8개 페이지 완료: 6-8시간

---

**Report Date:** 2026-01-04
**Next Review:** P1 작업 완료 후
