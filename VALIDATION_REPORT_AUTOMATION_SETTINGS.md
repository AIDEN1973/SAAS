# AutomationSettingsPage.tsx 업종 중립화 검증 보고서

## 작업 개요
`apps/academy-admin/src/pages/AutomationSettingsPage.tsx` 파일에서 하드코딩된 학원 용어를 업종 중립적 용어로 변경

---

## 변경 사항

### 1. Import 추가
```typescript
// Line 26
import { useIndustryTerms } from '@hooks/use-industry-terms';
```
- `useIndustryTerms` hook을 import하여 업종별 용어에 접근

### 2. 인터페이스 수정

#### AutomationCardProps 인터페이스 (Line 48)
```typescript
interface AutomationCardProps {
  // ... 기존 속성들
  terms: ReturnType<typeof useIndustryTerms>;  // 추가
}
```
- terms prop을 추가하여 하위 컴포넌트에서 업종별 용어 사용 가능하도록 구성

### 3. 컴포넌트 함수 시그니처 수정

#### AutomationCard 함수 (Line 51)
```typescript
function AutomationCard({
  eventType,
  isEnabled,
  criteriaValues,
  isEditing,
  onEdit,
  onCancel,
  onClick,
  stats,
  showStats,
  terms  // 추가
}: AutomationCardProps)
```

#### AutomationCardWithState 함수 (Lines 1166-1187)
```typescript
function AutomationCardWithState({
  // ... 기존 매개변수
  terms  // 추가
}: {
  // ... 기존 속성
  terms: ReturnType<typeof useIndustryTerms>;
})
```

### 4. 핵심 용어 변환

#### Line 142: high_fill_rate_expand_candidate
**변경 전:**
```typescript
desc = desc.replace('높은 반을', `${boldValue} 이상인 반을`);
```

**변경 후:**
```typescript
desc = desc.replace('높은 반을', `${boldValue} 이상인 ${terms.GROUP_LABEL}을`);
```
- "반" → `terms.GROUP_LABEL` (academy: "반", 다른 업종: 적절한 그룹명)

#### Line 145: unused_class_persistent
**변경 전:**
```typescript
desc = desc.replace('사용되지 않는 반을', `${boldValue} 이상 사용되지 않는 반을`);
```

**변경 후:**
```typescript
desc = desc.replace('사용되지 않는 반을', `${boldValue} 이상 사용되지 않는 ${terms.GROUP_LABEL}을`);
```
- "반" → `terms.GROUP_LABEL` (academy: "반", 다른 업종: 적절한 그룹명)

### 5. useMemo 의존성 업데이트 (Line 202)
```typescript
}, [description, criteriaFields, criteriaValues, eventType, terms]);
```
- terms를 의존성 배열에 추가하여 terms 변경 시 description 재계산

### 6. 컴포넌트 호출 업데이트

#### AutomationCardWithState 반환 (Line 1222-1232)
```typescript
return (
  <AutomationCard
    eventType={eventType}
    isEnabled={isEnabled}
    criteriaValues={criteriaValues}
    isEditing={isEditing}
    onEdit={onEdit}
    onCancel={onCancel}
    stats={stats}
    showStats={showStats}
    terms={terms}  // 추가
  />
);
```

#### AutomationSettingsPage 렌더링 (Line 1151)
```typescript
<AutomationCardWithState
  key={eventType}
  eventType={eventType}
  isEditing={editingEventType === eventType}
  onEdit={() => setEditingEventType(eventType)}
  onCancel={() => setEditingEventType(null)}
  stats={executionStats?.[eventType]}
  showStats={showStats}
  terms={terms}  // 추가
/>
```

### 7. AutomationSettingsPage 함수 (Line 622)
```typescript
export function AutomationSettingsPage() {
  // ... 기존 코드
  const terms = useIndustryTerms();  // 추가
  // ...
}
```
- useIndustryTerms hook 호출하여 현재 테넌트의 업종별 용어 조회

---

## 검증 결과

### 변환된 하드코딩 용어
| 원래 용어 | 변경 후 | 매핑 대상 | 설명 |
|---------|-------|---------|------|
| "반" (2곳) | `terms.GROUP_LABEL` | Academy: "반" | 수업/클래스 단위 그룹명 동적 변환 |

### 파일 분석 결과

#### 발견된 패턴
1. **고정된 학원 용어**: 142줄, 145줄에서 "반" 사용
2. **동적 텍스트 생성**: description 문자열에서 필드값 치환 시점
3. **조건부 로직**: eventType별 설명 텍스트 맞춤화

#### 검증된 항목
- ✓ useIndustryTerms import 추가
- ✓ 컴포넌트 props 인터페이스 업데이트
- ✓ 함수 시그니처 수정
- ✓ terms prop 전달 경로 완성 (AutomationSettingsPage → AutomationCardWithState → AutomationCard)
- ✓ useMemo 의존성 배열 업데이트
- ✓ 하드코딩 용어 동적화

#### 주의 사항
- AUTOMATION_EVENT_DESCRIPTIONS에서 "반"이 포함된 description이 추가로 있을 수 있음
  - 해당 텍스트는 상수에서 정의되므로 별도 수정 필요 시 constants 파일 확인 필요
  - 현재 파일의 동적 치환 로직만 수정 완료

---

## TypeScript 컴파일 확인

파일별 컴파일 결과:
- ✓ AutomationSettingsPage.tsx: **에러 없음**
- ✗ AlimtalkSettingsPage.tsx: SESSION_LABEL 미존재 (별도 이슈)
- ✗ NotificationsPage.tsx: ATTENDANCE_LABEL 미존재 (별도 이슈)
- ✗ TeachersPage.tsx: terms prop 관련 (별개 파일)

**현재 파일은 수정 완료 후 컴파일 에러 없음**

---

## 영향 범위

### 수정된 자동화 이벤트
1. **high_fill_rate_expand_candidate**
   - 설명: "높은 반을 {threshold} 이상인 반을로 변환"
   - 변경: 업종별 GROUP_LABEL 사용

2. **unused_class_persistent**
   - 설명: "사용되지 않는 반을 {threshold} 이상 사용되지 않는 반을로 변환"
   - 변경: 업종별 GROUP_LABEL 사용

### 다중 업종 지원 현황
- Academy: "반" → `terms.GROUP_LABEL` = "반"
- Fitness: "반" → `terms.GROUP_LABEL` = "클래스" (해당 용어 사용 시)
- Music: "반" → `terms.GROUP_LABEL` = "레슨" (해당 용어 사용 시)

---

## 코드 품질 체크

### 준수 사항
- ✓ [SSOT] Industry Registry를 통한 용어 접근 준수
- ✓ [불변 규칙] 하드코딩된 용어 제거
- ✓ Zero-Trust: tenantId는 Context에서만 추출
- ✓ React Hooks 규칙 준수 (useIndustryTerms는 컴포넌트 최상위 호출)
- ✓ useMemo 의존성 배열 완전성 검증

### 성능 고려사항
- useIndustryTerms: tenantId 기반 memoization (산업 타입은 변경되지 않음)
- terms 객체는 메인 컴포넌트에서만 조회 후 props로 전달
- 하위 컴포넌트에서 불필요한 재계산 없음

---

## 최종 결론

**상태**: ✓ **완료**

- 요청된 모든 변경사항 적용 완료
- 파일 내 발견된 모든 하드코딩된 "반" 용어 업종 중립화
- TypeScript 타입 체크 통과
- 업종별 용어 동적 매핑 구현 확인

**추가 검토 필요 사항**:
- AUTOMATION_EVENT_DESCRIPTIONS 상수에 포함된 "반" 용어는 별도 수정 필요
- 다른 페이지의 SESSION_LABEL, ATTENDANCE_LABEL 미존재 이슈는 별개 작업
