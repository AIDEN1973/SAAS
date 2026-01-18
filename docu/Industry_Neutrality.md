# Industry Neutrality (업종 중립성) 원칙

**작성일**: 2026-01-10
**버전**: 1.1.0
**최종 업데이트**: 2026-01-17
**상태**: ✅ 정본 (SSOT)

---

## 📋 목차

1. [핵심 원칙](#핵심-원칙)
2. [Industry Adapter 패턴](#industry-adapter-패턴)
3. [실제 동작 예시](#실제-동작-예시)
4. [Tool 명칭 vs 사용자 입력](#tool-명칭-vs-사용자-입력)
5. [구현 가이드](#구현-가이드)
6. [관련 문서](#관련-문서)

---

## 핵심 원칙

### 시스템 정의

**이 시스템은 SaaS 관리 플랫폼입니다** - 단일 학원용 SaaS가 아닌, **다양한 업종의 테넌트를 관리하는 플랫폼**입니다.

### 업종 중립성이란?

- **Tool 명칭은 업종에 독립적** (예: `manage_student`)
- **사용자는 업종별 용어 사용 가능** (학생/고객/회원/원생 등)
- **실제 데이터 처리는 업종별로 동적 매핑** (Industry Adapter)

---

## Industry Adapter 패턴

### 기본 구조

```typescript
// Industry Adapter가 업종별 테이블 자동 매핑
function getTenantTableName(tenantId: string, entityType: 'student' | 'payment' | 'attendance'): string {
  const tenant = await getTenant(tenantId);
  const industryType = tenant.industry_type; // 'academy' | 'salon' | 'nail' | ...

  // 업종별 테이블 매핑
  const tableMap = {
    student: {
      academy: 'academy_students',
      salon: 'salon_customers',
      nail: 'nail_members',
      gym: 'gym_members',
      // ...
    },
    payment: {
      academy: 'academy_payments',
      salon: 'salon_payments',
      // ...
    }
  };

  return tableMap[entityType][industryType];
}
```

### 파라미터 처리 흐름

```
사용자 입력 → LLM (Tool + Parameters) → Industry Adapter → 올바른 테이블 조회
```

---

## 실제 동작 예시

### 예시 1: 학원 (Academy)

```typescript
사용자: "박소영 전화번호"

→ Tool: manage_student(action: "get_profile", student_name: "박소영")
→ Industry Adapter: getTenantTableName() → "academy_students"
→ 쿼리: SELECT * FROM academy_students WHERE tenant_id=... AND name ILIKE '%박소영%'
```

### 예시 2: 미용실 (Salon)

```typescript
사용자: "김지영 고객 정보"

→ Tool: manage_student(action: "get_profile", student_name: "김지영")
→ Industry Adapter: getTenantTableName() → "salon_customers"
→ 쿼리: SELECT * FROM salon_customers WHERE tenant_id=... AND name ILIKE '%김지영%'
```

### 예시 3: 네일샵 (Nail)

```typescript
사용자: "이민아 회원 조회"

→ Tool: manage_student(action: "get_profile", student_name: "이민아")
→ Industry Adapter: getTenantTableName() → "nail_members"
→ 쿼리: SELECT * FROM nail_members WHERE tenant_id=... AND name ILIKE '%이민아%'
```

### 예시 4: 헬스장 (Gym)

```typescript
사용자: "최준호 회원권 조회"

→ Tool: manage_student(action: "get_profile", student_name: "최준호")
→ Industry Adapter: getTenantTableName() → "gym_members"
→ 쿼리: SELECT * FROM gym_members WHERE tenant_id=... AND name ILIKE '%최준호%'
```

---

## Tool 명칭 vs 사용자 입력

### Tool 명칭 (고정)

- `manage_student` - 학생/고객/회원 관리
- `manage_payment` - 결제/청구 관리
- `manage_attendance` - 출석/방문 관리
- `manage_schedule` - 스케줄/예약 관리

### 사용자 입력 (다양)

**학생/고객/회원 관련**:
- 학원: "학생", "원생", "수강생"
- 미용실: "고객", "손님"
- 네일샵: "회원", "고객"
- 헬스장: "회원", "트레이닝 회원"

**LLM이 모든 변형을 `student_name` 파라미터로 자동 추출합니다.**

### Industry Adapter 역할

1. **테넌트 정보 조회**: `tenant.industry_type` 확인
2. **테이블 매핑**: 업종별 올바른 테이블명 반환
3. **쿼리 실행**: 매핑된 테이블에 대해 쿼리 수행

---

## 구현 가이드

### 1. Tool 정의 시

**❌ 잘못된 방식**:
```typescript
// 업종별로 Tool을 분리하면 안 됨
const tools = [
  { name: 'manage_academy_student', ... },
  { name: 'manage_salon_customer', ... },
  { name: 'manage_nail_member', ... },
];
```

**✅ 올바른 방식**:
```typescript
// Tool은 업종 중립적으로 유지
const tools = [
  {
    name: 'manage_student',
    description: 'Manage students, customers, or members',
    parameters: {
      action: { type: 'string', enum: ['get_profile', 'list', 'search'] },
      student_name: { type: 'string' },
    }
  },
];
```

### 2. Tool 실행 시

```typescript
async function executeManageStudent(params: { action: string; student_name?: string }) {
  // 1. 테넌트 정보 가져오기
  const tenant = await getTenant(userId);

  // 2. Industry Adapter로 테이블명 결정
  const tableName = getTenantTableName(tenant.id, 'student');

  // 3. 동적 쿼리 실행
  const result = await supabase
    .from(tableName)
    .select('*')
    .eq('tenant_id', tenant.id)
    .ilike('name', `%${params.student_name}%`);

  return result;
}
```

### 3. System Prompt 구성

```typescript
const systemPrompt = `
You are a helpful assistant for a multi-tenant SaaS platform.

**Industry Neutrality**:
- Use generic terms in Tool names (e.g., "manage_student", not "manage_academy_student")
- Accept user input in any industry-specific terminology (학생/고객/회원/원생)
- The system will automatically map to the correct database table based on tenant's industry_type

Tools available:
- manage_student: For managing students, customers, members, or trainees
- manage_payment: For managing payments, invoices, or billing
- manage_attendance: For managing attendance, visits, or check-ins
`;
```

---

## 금지 패턴

### ❌ 하드코딩된 업종 로직

```typescript
// 잘못된 예시
if (tenant.industry_type === 'academy') {
  return await getAcademyStudents();
} else if (tenant.industry_type === 'salon') {
  return await getSalonCustomers();
}
```

### ❌ Tool 명칭에 업종 포함

```typescript
// 잘못된 예시
const tools = [
  { name: 'get_academy_students' },
  { name: 'get_salon_customers' },
];
```

### ❌ 사용자 입력 용어 제한

```typescript
// 잘못된 예시
if (!['학생', '원생'].includes(userInput)) {
  throw new Error('학생 또는 원생만 입력 가능합니다');
}
```

---

## 허용 패턴

### ✅ Industry Adapter 활용

```typescript
// 올바른 예시
const tableName = getTenantTableName(tenantId, 'student');
return await supabase.from(tableName).select('*');
```

### ✅ 업종 중립적 Tool

```typescript
// 올바른 예시
const tools = [
  { name: 'manage_student', description: 'Manage students/customers/members' },
];
```

### ✅ LLM이 용어 해석

```typescript
// 올바른 예시
// LLM이 "고객", "회원", "학생" 모두 student_name 파라미터로 추출
// 개발자는 별도 용어 변환 로직 불필요
```

---

## 프론트엔드 업종 중립 구현

### useIndustryTerms Hook

**위치**: `packages/hooks/use-industry-terms/src/useIndustryTerms.ts`

```typescript
import { useIndustryTerms } from '@hooks/use-industry-terms';

function StudentsPage() {
  const terms = useIndustryTerms();

  return (
    <PageHeader title={`${terms.PERSON_LABEL_PRIMARY} 관리`}>
      <Button>신규 {terms.PERSON_LABEL_PRIMARY} 등록</Button>
    </PageHeader>
  );
}
```

**주요 terms 필드:**
- `PERSON_LABEL_PRIMARY`: "학생" | "회원" | "고객"
- `GROUP_LABEL`: "수업" | "그룹" | "서비스"
- `ATTENDANCE_LABEL`: "출결" | "출석" | "방문"
- `TAG_LABEL`: "태그"
- `CONSULTATION_LABEL`: "상담"

### 한국어 조사 처리 (Korean Particle Utils)

**위치**: `apps/academy-admin/src/utils/korean-particle-utils.ts`

업종 중립 용어는 동적으로 변경되므로, 한국어 조사도 동적으로 적용해야 합니다.

```typescript
import { p, templates } from '../utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';

const terms = useIndustryTerms();

// 방법 1: p 단축 함수 사용
`${terms.PERSON_LABEL_PRIMARY}${p.이가(terms.PERSON_LABEL_PRIMARY)} 등록되었습니다.`
// Academy: "학생이 등록되었습니다."
// Gym: "회원이 등록되었습니다."
// Salon: "고객이 등록되었습니다."

`${terms.CONSULTATION_LABEL}${p.을를(terms.CONSULTATION_LABEL)} 삭제하시겠습니까?`
// "상담을 삭제하시겠습니까?"

// 방법 2: templates 사용 (자주 쓰는 문장 패턴)
templates.registered(terms.PERSON_LABEL_PRIMARY);  // "학생이 등록되었습니다."
templates.confirmDelete(terms.TAG_LABEL);          // "태그를 삭제하시겠습니까?"
templates.notFound(terms.GROUP_LABEL);             // "반을 찾을 수 없습니다."
```

**p 조사 함수 목록:**
| 함수 | 설명 | 예시 |
|------|------|------|
| `p.이가(word)` | 주격 조사 | 학생이/강사가 |
| `p.을를(word)` | 목적격 조사 | 학생을/강사를 |
| `p.은는(word)` | 보조사 | 학생은/강사는 |
| `p.과와(word)` | 접속 조사 | 학생과/강사와 |
| `p.으로로(word)` | 방향/도구 조사 | 학원으로/집으로 |

**templates 문장 패턴:**
| 함수 | 결과 |
|------|------|
| `templates.registered(entity)` | "{entity}이/가 등록되었습니다." |
| `templates.deleted(entity)` | "{entity}이/가 삭제되었습니다." |
| `templates.updated(entity)` | "{entity}이/가 수정되었습니다." |
| `templates.confirmDelete(entity)` | "{entity}을/를 삭제하시겠습니까?" |
| `templates.notFound(entity)` | "{entity}을/를 찾을 수 없습니다." |
| `templates.empty(entity)` | "{entity}이/가 없습니다." |

### SubSidebar 동적 라벨

**위치**: `apps/academy-admin/src/constants/sub-sidebar-menus.ts`

SubSidebar 메뉴 라벨도 업종에 따라 동적으로 변경됩니다.

```typescript
import { menuLabels } from '../utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';

const terms = useIndustryTerms();

// 동적 메뉴 라벨 생성
const subMenuItems = [
  { id: 'list', label: menuLabels.list(terms.PERSON_LABEL_PRIMARY) },           // "학생목록"
  { id: 'tags', label: menuLabels.management(terms.TAG_LABEL) },                // "태그관리"
  { id: 'statistics', label: menuLabels.statistics(terms.PERSON_LABEL_PRIMARY) }, // "학생통계"
  { id: 'consultations', label: menuLabels.management(terms.CONSULTATION_LABEL) }, // "상담관리"
];
```

**menuLabels 함수 목록:**
| 함수 | 결과 |
|------|------|
| `menuLabels.list(entity)` | "{entity}목록" |
| `menuLabels.add(entity)` | "{entity}등록" |
| `menuLabels.statistics(entity)` | "{entity}통계" |
| `menuLabels.management(entity)` | "{entity}관리" |

---

## 관련 문서

### 핵심 문서
- [Agent_아키텍처_전환.md](./Agent_아키텍처_전환.md) - Agent 기반 아키텍처 개요
- [디어쌤_아키텍처.md](./디어쌤_아키텍처.md) - Industry Adapter 상세 구현

### 참조 문서
- [Agent_파라미터_추출.md](./Agent_파라미터_추출.md) - LLM Function Calling
- [Agent_계약검증.md](./Agent_계약검증.md) - Tool 실행 전 검증 + 배포 전 검증 + 모니터링

### 규칙 문서
- [rules.md](./rules.md) - 프로젝트 기본 규칙
- [체크리스트.md](./체크리스트.md) - P0/P1/P2 체크리스트

---

## 요약

**Industry Neutrality는 다음을 보장합니다**:

1. **Tool 명칭은 업종에 독립적** (`manage_student`, `manage_payment`)
2. **사용자는 자연스러운 업종별 용어 사용** (학생/고객/회원)
3. **LLM이 용어를 표준 파라미터로 추출** (`student_name`)
4. **Industry Adapter가 올바른 테이블로 자동 라우팅** (`academy_students`, `salon_customers`)
5. **프론트엔드는 useIndustryTerms + 한국어 조사 유틸리티로 동적 UI 생성**

이를 통해 **새로운 업종 추가 시 코드 변경 없이 설정만으로 확장 가능**합니다.

---

## 변경 이력

- **2026-01-17 (v1.1.0)**: 프론트엔드 업종 중립 구현 섹션 추가 (useIndustryTerms, 한국어 조사, SubSidebar 동적 라벨)
- **2026-01-10 (v1.0.0)**: 초기 문서 작성

---

**문서 버전**: 1.1.0
**최종 업데이트**: 2026-01-17
**작성자**: Claude Sonnet 4.5
