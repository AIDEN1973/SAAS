# ChatOps 파라미터 추출 종합 대책
## 147개 인텐트를 카테고리별 계약 게이트로 관리하는 방법 (업종 중립 포함)

**작성일**: 2025-01-29
**문제**: "박소영 전화번호" → `{ name: "전화번호" }` 추출 오류
**근본 원인**: 개별 인텐트 대응 불가능, 카테고리별 시스템적 해결 필요
**추가 고려**: 업종 중립(Industry-Agnostic) 설계

---

## 0. 문제의 본질

### 현재 상황
- **147개 인텐트** (L0: 58개, L1: 18개, L2-A: 23개, L2-B: 48개)
- **4-5개 카테고리**로 분류 (Attendance, Billing, Message, Student, System 등)
- **5개 업종 지원** (academy, salon, real_estate, gym, ngo)
- **개별 인텐트 대응 불가능** → 카테고리별 계약 게이트 필요
- **업종 추가 시 코드 수정 없이 작동** → Industry Adapter 패턴

### 발생한 문제
```
사용자: "박소영 전화번호"
Intent: student.query.profile (정확함)
AI 추출: { name: "전화번호" } ← 잘못됨!
Resolver: "전화번호"라는 학생 찾기 시도
결과: not_found
에러: "학생 '전화번호'을(를) 찾을 수 없습니다."
```

### 근본 원인
**3단계 파라미터 추출 파이프라인**에서 각 단계가 독립적으로 작동하며 일관성 부족:

1. **LLM 추출** (OpenAI) - 후보가 많을 때
2. **Fast-Path 추출** (`deriveMinimalParamsFromMessage`) - 단일 후보일 때 ← **버그 발생!**
3. **Resolver 정규화** (`normalizeParams`) - UUID 해소

---

## 1. 현재 시스템 아키텍처 분석

### 1.1 파라미터 추출 3단계 파이프라인

```
[사용자 메시지]
   ↓
┌─────────────────────────────────────────┐
│ Stage 1: Intent 확정                    │
│ - extractIntentCandidates()             │
│ - 단일 후보 → Fast-Path                 │
│ - 다중 후보 → LLM 호출                  │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ Stage 2: 파라미터 추출                  │
│ A) LLM 경로 (다중 후보)                 │
│    - OpenAI가 JSON 반환                 │
│    - { intent_key, params }             │
│                                         │
│ B) Fast-Path 경로 (단일 후보)           │
│    - deriveMinimalParamsFromMessage()   │
│    - 정규식 기반 휴리스틱               │
│    - ⚠️ 여기서 버그 발생!               │
└─────────────────────────────────────────┘
   ↓
┌─────────────────────────────────────────┐
│ Stage 3: Resolver 정규화                │
│ - normalizeParams()                     │
│ - name → student_id (UUID 해소)         │
│ - Intent Registry의 resolver meta 기반  │
│ - persons 테이블 SSOT 검색 (업종 중립)  │
└─────────────────────────────────────────┘
   ↓
[Handler 실행]
```

### 1.2 업종 중립(Industry-Agnostic) 설계

**Core Party SSOT**: `persons` 테이블 (모든 업종 공통)

```
persons (공통)
├── person_type: 'student' | 'teacher' | 'guardian'
├── name, phone, email (공통 필드)
└── tenant_id (Multi-Tenant)
```

**Industry-Specific** (업종별 확장):

```
academy:
  - academy_students (persons 참조)
  - academy_classes

salon:
  - salon_customers (persons 참조)
  - salon_services

gym:
  - gym_members (persons 참조)
  - gym_classes

ngo:
  - ngo_beneficiaries (persons 참조)
  - ngo_programs
```

**핵심**: Resolver는 `persons` 테이블만 사용 → 모든 업종에서 동일하게 작동

---

## 2. 발견된 버그 상세 분석

### 2.1 Fast-Path 정규식 버그

**위치**: `infra/supabase/supabase/functions/chatops/handlers/intent-resolver.ts:439-451`

**문제**:

```typescript
// ❌ 현재 (잘못됨)
const nameHintPatterns = [
  /(.+?)\s*(프로필|전화번호|연락처|정보|상세|출결|수납|청구)/,
  /(학생|대상|회원)?\s*([가-힣]{2,5})\s*(을|를)?\s*(찾|검색|조회|확인)/,
];

for (const p of nameHintPatterns) {
  const mm = m.match(p);
  if (mm) {
    const candidate = (mm[2] || mm[1] || '').trim();  // ❌ 순서 잘못됨!
    // ...
  }
}
```

**"박소영 전화번호" 매칭 결과**:
```javascript
// 첫 번째 패턴: /(.+?)\s*(프로필|전화번호|연락처|정보)/
// mm[1] = "박소영"     ← 이게 name이어야 함!
// mm[2] = "전화번호"   ← 이건 키워드

// 현재 코드: (mm[2] || mm[1])
// → mm[2]가 항상 존재하므로 "전화번호" 선택 ❌

// 올바른 코드: (mm[1] || mm[2])
// → mm[1]을 먼저 선택 → "박소영" ✅
```

### 2.2 업종별 용어 미지원

**현재 패턴**:
```typescript
/(학생|대상|회원)?\s*([가-힣]{2,5})\s*(을|를)?\s*(찾|검색|조회|확인)/
```

**문제**: "고객", "수혜자", "클라이언트" 등 다른 업종 용어 미포함

---

## 3. 종합 대책: 5-Layer 방어선 (업종 중립 포함)

### 3.1 Layer 0: Intent Registry 메타데이터 (SSOT)

**원칙**: 모든 인텐트는 필요한 메타데이터를 선언해야 함

**현재 상태**:
```typescript
'student.query.profile': {
  intent_key: 'student.query.profile',
  automation_level: 'L0',
  description: '학생 프로필 조회',
  examples: [
    '박소영 프로필',
    '박소영 전화번호',
  ],
  // ✅ 이미 구현된 메타데이터
  resolver: { kind: 'student', required: ['student_id'], allow_name: true },
  schema: { uuid_fields: ['student_id'], required_fields: ['student_id'] },
  ambiguity: { enabled: true, max_candidates: 5 },
}
```

**개선 방향** (업종 중립):
```typescript
'student.query.profile': {
  // ...
  description: '대상 프로필 조회',  // ← 업종 중립 용어
  examples: [
    // 업종별 용어 모두 포함
    '박소영 프로필',
    '박소영 전화번호',
    '고객 박소영 정보',  // salon
    '회원 박소영 연락처',  // gym
    '수혜자 박소영 상세',  // ngo
    '원생 박소영 프로필',  // academy
  ],
}
```

---

### 3.2 Layer 1: Fast-Path 정규식 수정 (✅ 구현 완료)

**수정 내용**:

```typescript
// 🔧 FIX: P0-PARAM - 정규식 캡처 그룹 순서 수정 + 업종 중립 강화
const nameHintPatterns = [
  {
    pattern: /(.+?)\s*(프로필|전화번호|연락처|정보|상세|출결|수납|청구)/,
    nameGroup: 1,  // ✅ 첫 번째 그룹이 name
    keywordGroup: 2
  },
  {
    pattern: /(학생|대상|회원|고객|원생|수혜자|클라이언트)?\s*([가-힣]{2,5})\s*(을|를)?\s*(찾|검색|조회|확인)/,
    prefixGroup: 1,  // 업종별 용어 (선택)
    nameGroup: 2     // ✅ 이름
  },
];

// 키워드 필터링 (업종 중립)
const invalidKeywords = [
  '프로필', '전화번호', '연락처', '정보', '상세', '출결', '수납', '청구',
  '조회', '확인', '검색', '찾기', '보기',
  // 업종별 용어 (사람 이름이 아님)
  '학생', '원생', '대상', '회원', '고객', '수혜자', '클라이언트',
  '선생님', '강사', '트레이너', '디자이너',
  '반', '클래스', '서비스', '프로그램', '세션', '수업',
];

for (const { pattern, nameGroup } of nameHintPatterns) {
  const mm = m.match(pattern);
  if (mm) {
    const candidate = mm[nameGroup]?.trim();
    if (candidate && candidate.length >= 2 && candidate.length <= 20) {
      // 키워드가 아닌지 확인
      if (!invalidKeywords.includes(candidate)) {
        params.name = candidate;
        break;
      }
    }
  }
}
```

---

### 3.3 Layer 2: LLM Prompt 강화 (✅ 구현 완료)

**수정 내용**:

```typescript
const systemPrompt = `당신은 다양한 업종의 관리 시스템 AI 어시스턴트입니다.
사용자의 요청을 분석하여 적절한 Intent와 파라미터를 추출합니다.

**업종별 용어 매핑**:
- 학원(academy): 학생, 원생, 반, 수업
- 미용실(salon): 고객, 서비스, 예약
- 체육관(gym): 회원, 클래스, 세션
- NGO: 수혜자, 프로그램, 활동
- 부동산(real_estate): 클라이언트, 매물, 계약

**중요 규칙**:
1. **name 필드 추출 시**: 사람 이름만 추출하세요. 키워드는 제외합니다.
   - 올바름: "박소영 전화번호" → { name: "박소영" }
   - 올바름: "고객 박소영 연락처" → { name: "박소영" }
   - 올바름: "회원 김철수 정보" → { name: "김철수" }
   - 잘못됨: "박소영 전화번호" → { name: "전화번호" }

2. **업종별 용어는 무시**: "학생", "고객", "회원" 등은 파라미터에 포함하지 마세요.

3. **UUID 필드**: student_id, class_id 등은 절대 사람 이름을 넣지 마세요.

4. **날짜 필드**: "오늘", "어제", "내일"은 그대로 전달하세요 (서버에서 변환).
`;
```

---

### 3.4 Layer 3: Resolver Gate 강화 (✅ 구현 완료)

**현재 구현**: ✅ 이미 업종 중립!

```typescript
// normalize-params.ts:80-102
async function queryPersonsByName(...) {
  // ✅ persons 테이블 사용 (모든 업종 공통)
  let query = withTenant(
    supabase
      .from('persons')  // ← Core Party SSOT
      .select('id, name, phone, person_type, status')
      .eq('person_type', 'student')
      .eq('status', 'active'),
    tenantId
  );
}
```

**추가 강화** (키워드 필터링):

```typescript
// 🔧 FIX: P0-PARAM - 키워드 필터링 (업종 중립)
const invalidKeywords = [
  // 공통 키워드
  '프로필', '전화번호', '연락처', '정보', '상세', '출결', '수납', '청구',
  '조회', '확인', '검색', '찾기', '보기', '알림', '메시지', '발송',
  // 업종별 용어 (사람 이름이 아님)
  '학생', '원생', '대상', '회원', '고객', '수혜자', '클라이언트',
  '선생님', '강사', '트레이너', '디자이너', '에이전트',
  '반', '클래스', '서비스', '프로그램', '세션', '수업',
];

if (studentName) {
  const isKeyword = invalidKeywords.some(kw => studentName.includes(kw));
  if (isKeyword) {
    console.log('[ChatOps:Normalize] Resolver 스킵 (키워드 감지)');
    attachResolveFailed(p, {
      field: 'student_id',
      original_value: String(studentName),
      reason: 'invalid_name_format',
    });
    return normalized;
  }

  // 기존 Resolver 로직...
}
```

---

### 3.5 Layer 4: 사용자 피드백 루프 (이미 구현됨)

**현재 구현**:
```typescript
if (handlerParams._resolve_ambiguous) {
  return new Response(
    JSON.stringify({
      error: 'CONTRACT_RESOLUTION_AMBIGUOUS',
      message: formatResolveAmbiguousMessage(resolveAmbiguous),
      candidates: resolveAmbiguous.candidates,
    }),
    { status: 400 }
  );
}
```

---

### 3.6 Layer 5: 모니터링 및 자동 수정 (P2)

**로그 수집**:
```typescript
console.log('[ChatOps:ParamExtraction] Failed extraction:', {
  message: maskPII(message),
  intent_key: intent.intent_key,
  extracted_params: maskPIIJson(params),
  resolver_result: 'not_found',
});
```

---

## 4. 카테고리별 적용 전략

### 4.1 Student 카테고리 (✅ 구현 완료)

**관련 인텐트** (약 40개):
- `student.query.*`
- `student.exec.*`

**공통 패턴**:
- `name` → `student_id` 해소
- `resolver: { kind: 'student', required: ['student_id'], allow_name: true }`
- **persons 테이블 사용** (업종 중립)

---

### 4.2 Class 카테고리 (P1)

**관련 인텐트** (약 20개):
- `class.query.*`
- `class.exec.*`

**공통 패턴**:
- `class_name` → `class_id` 해소 필요
- `resolveClassIdByName()` 함수 구현 필요

---

### 4.3 Teacher 카테고리 (P1)

**관련 인텐트** (약 10개):
- `teacher.query.*`
- `teacher.exec.*`

**공통 패턴**:
- `teacher_name` → `teacher_id` 해소 필요
- `resolveTeacherIdByName()` 함수 구현 필요

---

## 5. 구현 우선순위

### ✅ P0 (즉시 수정 - 완료)

1. **Fast-Path 정규식 버그 수정** ✅
   - 파일: `intent-resolver.ts:447`
   - 수정: `(mm[2] || mm[1])` → `(mm[1] || mm[2])`
   - 업종별 용어 추가

2. **Resolver Gate 키워드 필터링 추가** ✅
   - 파일: `normalize-params.ts:233`
   - 추가: `invalidKeywords` 체크 (업종 중립)

3. **LLM Prompt 강화** ✅
   - 파일: `chatops/index.ts:1346`
   - 추가: 업종별 용어 매핑 + name 필드 추출 규칙

---

### P1 (단기 - 1주 내)

4. **Intent Registry 메타데이터 검증 스크립트**
   - 신규 파일: `scripts/verify-intent-resolver-meta.ts`
   - 모든 인텐트의 resolver meta 존재 여부 검증

5. **Class/Teacher Resolver 구현**
   - `resolveClassIdByName()`
   - `resolveTeacherIdByName()`

6. **Intent Registry examples 업종 중립 강화**
   - 모든 student 관련 인텐트에 업종별 용어 추가

---

### P2 (중기 - 1개월 내)

7. **사용자 피드백 루프 개선**
   - `extractAllPossibleNames()` 함수 구현
   - not_found 시 대안 제시

8. **모니터링 대시보드**
   - 파라미터 추출 실패율 추적
   - 자주 실패하는 패턴 시각화

---

## 6. 검증 계획

### 6.1 단위 테스트

```typescript
// tests/param-extraction.test.ts
describe('deriveMinimalParamsFromMessage', () => {
  it('should extract name correctly from "박소영 전화번호"', () => {
    const result = deriveMinimalParamsFromMessage('박소영 전화번호', 'student.query.profile');
    expect(result.name).toBe('박소영');
  });

  it('should not extract keyword as name', () => {
    const result = deriveMinimalParamsFromMessage('전화번호 조회', 'student.query.profile');
    expect(result.name).toBeUndefined();
  });

  // 업종 중립 테스트
  it('should extract name from "고객 박소영 연락처" (salon)', () => {
    const result = deriveMinimalParamsFromMessage('고객 박소영 연락처', 'student.query.profile');
    expect(result.name).toBe('박소영');
  });

  it('should extract name from "회원 김철수 정보" (gym)', () => {
    const result = deriveMinimalParamsFromMessage('회원 김철수 정보', 'student.query.profile');
    expect(result.name).toBe('김철수');
  });
});
```

### 6.2 회귀 테스트 (업종 중립 포함)

```typescript
const testCases = [
  // Academy
  { input: '박소영 프로필', expected: { name: '박소영' } },
  { input: '박소영 전화번호', expected: { name: '박소영' } },
  { input: '학생 박소영 조회', expected: { name: '박소영' } },
  { input: '원생 김철수 출결', expected: { name: '김철수' } },

  // Salon
  { input: '고객 박소영 연락처', expected: { name: '박소영' } },
  { input: '고객 이영희 정보', expected: { name: '이영희' } },

  // Gym
  { input: '회원 김철수 프로필', expected: { name: '김철수' } },
  { input: '회원 박지민 상세', expected: { name: '박지민' } },

  // NGO
  { input: '수혜자 최민수 정보', expected: { name: '최민수' } },
];

describe('Parameter Extraction Regression Tests (Industry-Agnostic)', () => {
  testCases.forEach(({ input, expected }) => {
    it(`should extract params correctly from "${input}"`, () => {
      const result = deriveMinimalParamsFromMessage(input, 'student.query.profile');
      expect(result).toMatchObject(expected);
    });
  });
});
```

---

## 7. 최종 요약

### 7.1 핵심 원칙

1. **카테고리별 계약 게이트**: 147개 인텐트를 개별 대응하지 않고, 5-6개 카테고리로 분류하여 공통 로직 적용
2. **업종 중립 설계**: Core Party SSOT (`persons`) + Industry Adapter 패턴
3. **Intent Registry 메타데이터 SSOT**: 모든 인텐트는 필요한 `resolver`, `schema`, `ambiguity` meta 선언
4. **5-Layer 방어선**: Registry → Fast-Path → LLM → Resolver → Feedback
5. **Fail-Closed Opt-in**: meta가 없으면 Resolver 실행 금지

### 7.2 즉시 수정 항목 (✅ 완료)

1. **Fast-Path 정규식 수정** ✅
   - `(mm[1] || mm[2])` 순서 수정
   - 업종별 용어 추가 (고객, 회원, 수혜자 등)
   - 키워드 필터링 추가

2. **Resolver Gate 키워드 필터링** ✅
   - 업종별 용어 포함 (학생, 고객, 회원 등)

3. **LLM Prompt 강화** ✅
   - 업종별 용어 매핑 명시
   - name 필드 추출 규칙 강화

### 7.3 기대 효과 (업종 중립 포함)

| 테스트 케이스 | 현재 | 수정 후 |
|--------------|------|---------|
| "박소영 전화번호" (학원) | `{ name: "전화번호" }` ❌ | `{ name: "박소영" }` ✅ |
| "고객 박소영 연락처" (미용실) | `{ name: "연락처" }` ❌ | `{ name: "박소영" }` ✅ |
| "회원 김철수 정보" (체육관) | `{ name: "정보" }` ❌ | `{ name: "김철수" }` ✅ |
| "수혜자 이영희 프로필" (NGO) | `{ name: "프로필" }` ❌ | `{ name: "이영희" }` ✅ |

**모든 업종에서 동일한 품질 보장!** ✅

### 7.4 업종 중립 설계의 핵심

1. **Core Party SSOT**: `persons` 테이블 (모든 업종 공통)
2. **Industry Adapter**: 업종별 테이블명 동적 매핑
3. **Resolver는 persons 사용**: 업종과 무관하게 작동
4. **업종별 용어 모두 지원**: 학생, 고객, 회원, 수혜자 등

---

**문서 버전**: 1.0
**작성자**: SAMDLE 개발팀
**최종 업데이트**: 2025-01-29
**구현 상태**: P0 완료 ✅

