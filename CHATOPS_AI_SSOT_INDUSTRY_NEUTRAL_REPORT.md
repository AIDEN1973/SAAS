# ChatOps 및 AI 대화창 SSOT 및 업종중립성 검증 보고서

**날짜**: 2026-01-04
**대상**: ChatOps Panel, ExecutionAuditPanel, AIPage 및 관련 컴포넌트
**목적**: SSOT(Single Source of Truth) 및 업종중립성 준수 검증

---

## 📋 요약 (Executive Summary)

ChatOps 및 AI 대화창 관련 컴포넌트를 검증한 결과, **ChatOpsPanel**에서 **9개의 업종중립성 위반**을 발견했습니다.

### 주요 발견사항

| 컴포넌트 | 하드코딩 용어 | 업종중립성 상태 | 수정 필요 |
|----------|--------------|----------------|----------|
| **ChatOpsPanel.tsx** | 9개 | ❌ 위반 | ✅ 필요 |
| ExecutionAuditPanel.tsx | 0개 | ✅ 준수 | ⏭️ 불필요 |
| AIPage.tsx | 0개 | ✅ 준수 | ⏭️ 불필요 |

### 중요 발견

ChatOpsPanel은 코드 주석에 **"업종 중립"**을 명시하고 있으나, 실제 코드에는 **업종 특화 하드코딩이 존재**합니다:

```typescript
// Line 10-11: 주석에는 업종중립이라고 명시
* [업종 중립] 모든 업종(Academy/Salon/Nail 등)에서 공통으로 사용 가능합니다
* [업종 중립] 업종별 차이는 prop을 통한 확장 포인트(`onViewTaskCard` 등)로 처리됩니다

// 하지만 실제 코드에는 하드코딩이 존재:
// Line 187: student_name: '학생 이름',
// Line 809: messageLower.includes('학생')
// Line 906: messageLower.includes('학생')
```

---

## 🔍 상세 분석

### 1. ChatOpsPanel.tsx (Line 1-1566)

**파일 경로**: [packages/ui-core/src/components/ChatOpsPanel.tsx](packages/ui-core/src/components/ChatOpsPanel.tsx)

**용도**: AI 챗봇 UI 패널 - 버블 대화 방식의 메시지 표시

#### 발견된 업종중립성 위반 (9개)

##### 위반 1: Field Label Mapping (Line 187, 189)

**위치**: `getFieldLabel()` 함수

```typescript
// ❌ 하드코딩
const labels: Record<string, string> = {
  guardian_contact: '보호자 연락처',
  total_count: '총 개수',
  student_name: '학생 이름',  // Line 187
  late_time: '지각 시간',
  student_id: '학생 ID',      // Line 189
};
```

**문제점**:
- "학생 이름", "학생 ID"가 하드코딩됨
- Academy에서는 "학생"이지만 Gym에서는 "회원", Salon에서는 "고객"으로 바뀌어야 함

**영향 범위**: L0 Intent 결과 필드 레이블 표시

---

##### 위반 2-3: 지각 학생 조회 필터 감지 (Line 809)

**위치**: `attendance.query.late` intent 처리

```typescript
// ❌ 하드코딩
const showName = messageLower.includes('이름') || messageLower.includes('학생');
```

**문제점**:
- 사용자가 "학생"이라는 단어를 포함했는지 체크
- Gym: "회원", Salon: "고객"으로 변경되어야 함

**영향 범위**: 지각 기록 조회 시 필드 필터링

---

##### 위반 4-5: 수업 명단 조회 필터 감지 (Line 906)

**위치**: `class.query.roster` intent 처리

```typescript
// ❌ 하드코딩
const showName = messageLower.includes('이름') || messageLower.includes('학생');
```

**문제점**: 위반 2-3과 동일

**영향 범위**: 수업 명단 조회 시 필드 필터링

---

##### 위반 6-9: 주석 내 하드코딩 (Line 461, 613, 752, 802, 947)

**위치**: 각 Intent별 주석

```typescript
// Line 461
// 하위 호환성: onViewTaskCard가 없으면 기본 동작 (학원 전용)

// Line 613
// student.query.profile: 학생 프로필 정보를 사용자 친화적인 형식으로 표시

// Line 752
// attendance.query.by_student: 출결 기록 조회

// Line 802
// attendance.query.late: 지각 학생 조회

// Line 947
// student.query.search: 학생 검색
```

**문제점**:
- 주석에 "학원 전용", "학생", "출결" 등 업종 특화 용어 사용
- 코드 가독성은 유지되나, 업종중립성 원칙에 완전히 부합하지 않음

**영향 범위**: 개발자 가독성 (런타임 영향 없음)

---

#### 업종중립성 준수율

| 카테고리 | 위반 개수 | Status |
|---------|----------|--------|
| Field Label Mapping | 2개 | ❌ 수정 필요 |
| 필드 필터 감지 로직 | 2개 | ❌ 수정 필요 |
| 주석 (코드 영향 없음) | 5개 | ⚠️ 선택적 수정 |

**총 업종중립성 준수율**: ❌ **55%** (런타임 코드 기준 4/9개 수정 필요)

---

### 2. ExecutionAuditPanel.tsx (Line 1-412)

**파일 경로**: [packages/ui-core/src/components/ExecutionAuditPanel.tsx](packages/ui-core/src/components/ExecutionAuditPanel.tsx)

**용도**: 실행 감사 및 활동 추적 패널

#### 검증 결과

✅ **하드코딩 용어 없음** - 완전한 업종중립성 준수

**특징**:
- 모든 텍스트가 시스템 레벨 용어 사용 ("실행 완료", "실패", "부분 성공" 등)
- 업종 특화 용어 전혀 사용하지 않음
- 날짜 필터, 검색, 페이지네이션 등 모두 중립적 UI

**업종중립성 준수율**: ✅ **100%**

---

### 3. AIPage.tsx

**파일 경로**: [apps/academy-admin/src/pages/AIPage.tsx](apps/academy-admin/src/pages/AIPage.tsx)

**용도**: AI 인사이트 및 브리핑 페이지

#### 검증 결과

✅ **하드코딩 용어 없음** - 완전한 업종중립성 준수

**이미 수정 완료**:
- 이전 보고서([THREE_PAGES_SSOT_COMPLIANCE_REPORT.md](THREE_PAGES_SSOT_COMPLIANCE_REPORT.md))에서 이미 100% 업종중립화 완료
- `useIndustryTerms()` 훅 사용 중
- 모든 스키마에 Fallback 패턴 적용됨

**업종중립성 준수율**: ✅ **100%**

---

## 📊 전체 통계

### 컴포넌트별 업종중립성 준수율

| 컴포넌트 | 하드코딩 개수 | 런타임 영향 | 업종중립성 | Status |
|----------|--------------|------------|-----------|--------|
| ChatOpsPanel.tsx | 9개 | 4개 | 55% | ❌ 수정 필요 |
| ExecutionAuditPanel.tsx | 0개 | 0개 | 100% | ✅ 준수 |
| AIPage.tsx | 0개 | 0개 | 100% | ✅ 준수 |

**평균 업종중립성 준수율**: 85% (3개 컴포넌트 중 2개 완전 준수)

---

## 🛠️ 수정 권장사항

### ChatOpsPanel.tsx 수정 방안

ChatOpsPanel은 `@ui-core` 패키지에 위치하여 **여러 앱에서 재사용**됩니다. 따라서 **props로 업종별 용어를 전달**하는 방식을 권장합니다.

#### 방안 1: Props로 IndustryTerms 전달 (권장)

**장점**:
- ui-core 패키지가 industry-registry에 의존하지 않음
- 앱 레벨에서 업종 선택 가능
- 테스트 용이

**구현**:

```typescript
// ChatOpsPanel Props 확장
interface ChatOpsPanelProps {
  // ... 기존 props ...

  // 업종별 용어 (선택적, 기본값은 Academy)
  industryTerms?: {
    personLabel: string;      // "학생" | "회원" | "고객"
    personIdLabel: string;    // "학생 ID" | "회원 ID" | "고객 ID"
    attendanceLabel: string;  // "출결" | "출석" | "방문"
    lateLabel: string;        // "지각" | "지각"
  };
}

// 사용 예시 (academy-admin App.tsx)
import { useIndustryTerms } from '@hooks/use-industry-terms';

function App() {
  const terms = useIndustryTerms();

  return (
    <ChatOpsPanel
      messages={messages}
      industryTerms={{
        personLabel: terms.PERSON_LABEL_PRIMARY,
        personIdLabel: `${terms.PERSON_LABEL_PRIMARY} ID`,
        attendanceLabel: terms.ATTENDANCE_LABEL,
        lateLabel: terms.LATE_LABEL,
      }}
      // ... 기타 props
    />
  );
}
```

**수정 위치**:

1. **Line 187-189**: `getFieldLabel()` 함수
```typescript
function getFieldLabel(field: string, industryTerms?: ChatOpsPanelProps['industryTerms']): string {
  const labels: Record<string, string> = {
    guardian_contact: '보호자 연락처',
    total_count: '총 개수',
    student_name: industryTerms?.personLabel ? `${industryTerms.personLabel} 이름` : '학생 이름',
    late_time: industryTerms?.lateLabel ? `${industryTerms.lateLabel} 시간` : '지각 시간',
    student_id: industryTerms?.personIdLabel || '학생 ID',
  };
  return labels[field] || field;
}
```

2. **Line 809, 906**: 필드 필터 감지 로직
```typescript
// Before
const showName = messageLower.includes('이름') || messageLower.includes('학생');

// After
const personKeywords = [
  '이름',
  industryTerms?.personLabel || '학생',
  ...(industryTerms?.personLabel === '회원' ? ['멤버'] : []),
  ...(industryTerms?.personLabel === '고객' ? ['고객님', '손님'] : []),
];
const showName = personKeywords.some(keyword => messageLower.includes(keyword));
```

---

#### 방안 2: ui-core에서 직접 useIndustryTerms 사용 (대안)

**장점**:
- Props 전달 불필요
- 자동으로 업종 감지

**단점**:
- ui-core 패키지가 industry-registry에 의존
- 패키지 간 결합도 증가

**구현**:

```typescript
// ChatOpsPanel.tsx
import { useIndustryTerms } from '@hooks/use-industry-terms';

export function ChatOpsPanel(props: ChatOpsPanelProps) {
  const terms = useIndustryTerms();

  // getFieldLabel에서 직접 사용
  const labels: Record<string, string> = {
    student_name: `${terms.PERSON_LABEL_PRIMARY} 이름`,
    student_id: `${terms.PERSON_LABEL_PRIMARY} ID`,
    // ...
  };
}
```

**권장 선택**: **방안 1 (Props 전달)** - 패키지 독립성 유지

---

### 주석 수정 (선택사항)

주석의 "학생", "출결" 등의 용어를 중립적으로 변경:

```typescript
// Before
// student.query.profile: 학생 프로필 정보를 사용자 친화적인 형식으로 표시

// After
// person.query.profile: 주요 관리 대상(학생/회원/고객) 프로필 정보를 사용자 친화적인 형식으로 표시
```

---

## 🏗️ 아키텍처 원칙 검증

### SSOT (Single Source of Truth)

| 컴포넌트 | SSOT 준수 | 상태 |
|----------|----------|------|
| ChatOpsPanel | ✅ 문서 준수 (챗봇.md, 액티비티.md) | 우수 |
| ExecutionAuditPanel | ✅ 문서 준수 (액티비티.md) | 우수 |
| AIPage | ✅ Schema Registry 연동 | 우수 |

**모든 컴포넌트가 SSOT 원칙을 준수**하고 있습니다.

### Industry Neutrality (업종중립성)

| 컴포넌트 | 주석 명시 | 실제 구현 | 일치 여부 |
|----------|----------|----------|----------|
| ChatOpsPanel | ✅ "업종 중립" 명시 | ❌ 하드코딩 존재 | ❌ **불일치** |
| ExecutionAuditPanel | - | ✅ 완전 중립 | ✅ 일치 |
| AIPage | - | ✅ 완전 중립 | ✅ 일치 |

**중요 발견**: ChatOpsPanel은 주석에서 업종중립을 명시하지만 실제로는 미준수

---

## ⚠️ 우선순위 평가

### 수정 필요성

| 항목 | 우선순위 | 이유 |
|------|----------|------|
| ChatOpsPanel 런타임 코드 (4개) | 🔴 **HIGH** | 실제 UI에 표시되는 텍스트 |
| ChatOpsPanel 주석 (5개) | 🟡 **MEDIUM** | 개발자 가독성 (런타임 영향 없음) |

### 영향 범위

ChatOpsPanel 수정 시 영향받는 기능:
1. **L0 Intent 결과 표시**: Field Label Mapping
2. **지각 기록 조회**: `attendance.query.late`
3. **수업 명단 조회**: `class.query.roster`
4. **학생 검색**: `student.query.search`

**영향받는 사용자**: 모든 ChatOps 사용자 (AI 대화 기능 사용 시)

---

## ✅ 다음 단계

### 권장 수정 순서

1. ✅ **ChatOpsPanel Props 확장** (industryTerms 추가)
2. ✅ **getFieldLabel() 함수 수정** (Line 187-189)
3. ✅ **필드 필터 감지 로직 수정** (Line 809, 906)
4. ⏭️ **주석 업데이트** (선택사항, Line 461, 613, 752, 802, 947)
5. ✅ **TypeScript 컴파일 검증**
6. ✅ **업종별 테스트** (Academy, Gym, Salon)

### 테스트 계획

수정 후 각 업종에서 테스트:

```typescript
// Academy
terms = { PERSON_LABEL_PRIMARY: '학생', ... }
→ "학생 이름", "학생 ID" 표시 확인

// Gym
terms = { PERSON_LABEL_PRIMARY: '회원', ... }
→ "회원 이름", "회원 ID" 표시 확인

// Salon
terms = { PERSON_LABEL_PRIMARY: '고객', ... }
→ "고객 이름", "고객 ID" 표시 확인
```

---

## 📝 결론

### 주요 발견사항

1. ✅ **ExecutionAuditPanel, AIPage**: 완전한 업종중립성 준수
2. ❌ **ChatOpsPanel**: 주석과 실제 구현 불일치 (주석: 업종중립 명시, 실제: 하드코딩 존재)
3. 🔴 **런타임 영향 있는 하드코딩**: 4개 (수정 필수)
4. 🟡 **주석 내 하드코딩**: 5개 (선택적 수정)

### 개선 권장사항

| 항목 | 현재 상태 | 목표 | 우선순위 |
|------|----------|------|----------|
| ChatOpsPanel 업종중립성 | 55% | 100% | 🔴 HIGH |
| Props 기반 용어 전달 | 미구현 | 구현 | 🔴 HIGH |
| 주석 업데이트 | 부분적 | 완전 | 🟡 MEDIUM |

### 기대 효과

수정 완료 시:
- ✅ ChatOps UI가 5개 업종(Academy, Gym, Salon, NailSalon, RealEstate)에서 자연스럽게 작동
- ✅ "학생 이름" → "회원 이름" / "고객 이름" 자동 변환
- ✅ 필드 필터 감지 로직이 업종별 키워드 지원
- ✅ 주석과 실제 구현의 일치성 확보

---

**작성자**: Claude Sonnet 4.5
**검증 완료**: 2026-01-04
**관련 문서**:
- [챗봇.md](docu/챗봇.md)
- [액티비티.md](docu/액티비티.md)
- [AI_자동화_기능_정리.md](docu/AI_자동화_기능_정리.md)
