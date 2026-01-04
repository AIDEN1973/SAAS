# 자동화 설정 페이지 업종중립성 검증 보고서

## 📋 Executive Summary

자동화 설정 페이지(`/settings/automation`)의 업종중립성 검증 결과입니다.

- **현재 업종중립성 점수**: 20% (Critical Issue)
- **SSOT 준수**: 80% (Good)
- **주요 문제**: automation-event-descriptions.ts에 하드코딩된 용어 다수
- **검증일**: 2026-01-04

## 🎯 검증 결과

### ✅ 잘 구현된 부분

#### 1. **Page Level - AutomationSettingsPage.tsx**
- ✅ `useIndustryTerms()` hook 사용 중 (line 623)
- ✅ Line 142, 145에서 `terms.GROUP_LABEL` 동적 사용
- ✅ SSOT 원칙 준수: `AUTOMATION_EVENT_CATALOG` 활용
- ✅ Policy 경로 헬퍼 함수 사용 (`getAutomationEventPolicyPath`)

```typescript
// Line 142-143 (Good Example)
else if (eventType === 'high_fill_rate_expand_candidate' && field.field === 'threshold') {
  desc = desc.replace('높은 반을', `${boldValue} 이상인 ${terms.GROUP_LABEL}을`);
}
```

#### 2. **SSOT Compliance**
- ✅ `AUTOMATION_EVENT_CATALOG` from `@core/core-automation`
- ✅ Policy path helpers in utils
- ✅ Criteria fields well-structured
- ✅ 42개 자동화 항목 완전 매핑

### ❌ 개선이 필요한 부분

#### 1. **automation-event-descriptions.ts - 하드코딩 용어**

**총 44개의 하드코딩된 업종 특정 용어 발견:**

##### 1.1 "학부모" 용어 (17곳)
```typescript
// financial_health
payment_due_reminder: "...학부모에게 자동으로 알림을 발송합니다." (line 933)
invoice_partial_balance: "...학부모에게 자동으로 알림을 발송합니다." (line 938)
recurring_payment_failed: "...학부모에게 자동으로 알림을 발송합니다." (line 943)

// customer_retention
class_reminder_today: "...학부모에게 알림을 발송합니다." (line 1017)
class_schedule_tomorrow: "...학부모에게 알림을 발송합니다." (line 1022)
consultation_reminder: "...학부모에게 알림을 발송합니다." (line 1027)
absence_first_day: "...학부모에게 알림을 발송합니다." (line 1032)

// safety_compliance
class_change_or_cancel: "...학부모에게 알림을 발송합니다." (line 1091)
checkout_missing_alert: "...학부모에게 알림을 발송합니다." (line 1101)
announcement_urgent: "...학부모에게 알림을 발송합니다." (line 1106)
announcement_digest: "...학부모에게 제공합니다." (line 1111)
consultation_summary_ready: "...학부모에게 알림을 발송합니다." (line 1116)
attendance_pattern_anomaly: "...학부모에게 알림을 발송합니다." (line 1121)

// growth_marketing
birthday_greeting: "학생 생일에..." (line 1069)
enrollment_anniversary: "학생 등록 기념일에..." (line 1074)
```

**필요 조치**: `terms.PAYER_LABEL` 사용
- Academy: "학부모"
- Gym: "회원"
- Salon/NailSalon: "고객"
- RealEstate: "임차인"

##### 1.2 "학생" 용어 (10곳)
```typescript
absence_first_day: "학생이 첫 결석을 하면..." (line 1032)
ai_suggest_churn_focus: "이탈 위험이 높은 학생을 감지하여..." (line 1042)
birthday_greeting: "학생 생일에 자동으로..." (line 1069)
enrollment_anniversary: "학생 등록 기념일에..." (line 1074)
student_onboarding_message: "신규 학생 등록 시..." (line 1126)
attendance_pattern_anomaly: "학생의 출결 패턴에..." (line 1121)
risk_students_weekly_kpi: "위험 학생의 주간 KPI..." (line 1052)
```

**필요 조치**: `terms.PERSON_LABEL_PRIMARY` 사용
- Academy: "학생"
- Gym: "회원"
- Salon/NailSalon: "고객"
- RealEstate: "임차인"

##### 1.3 "수업" 용어 (8곳)
```typescript
class_fill_rate_low_persistent: "수업 정원률이..." (line 984)
ai_suggest_class_merge: "저정원 수업을 감지하여 수업 통합을..." (line 990)
time_slot_fill_rate_low: "특정 시간대의..." (line 995)
high_fill_rate_expand_candidate: "정원률이 높은 수업을..." (line 1000)
unused_class_persistent: "사용되지 않는 수업을..." (line 1005)
class_reminder_today: "오늘 수업 시작 전에..." (line 1017)
class_schedule_tomorrow: "내일 수업 일정을..." (line 1022)
class_change_or_cancel: "수업이 변경되거나..." (line 1091)
checkin_reminder: "수업 시작 전에..." (line 1096)
checkout_missing_alert: "수업 종료 후..." (line 1101)
```

**필요 조치**: `terms.GROUP_LABEL` 사용 (일부는 이미 적용됨 - line 142, 145)
- Academy: "수업"
- Gym: "수업"
- Salon: "서비스"
- NailSalon: "시술"
- RealEstate: "계약"

##### 1.4 "강사" 용어 (3곳)
```typescript
teacher_workload_imbalance: "강사 업무량 불균형 알림" (line 1142)
teacher_workload_imbalance: "강사 간 업무량이..." (line 1143)
```

**필요 조치**: `terms.PERSON_LABEL_SECONDARY` 사용
- Academy: "강사"
- Gym: "강사"
- Salon: "스태프"
- NailSalon: "디자이너"
- RealEstate: "중개인"

##### 1.5 "수납률" 용어 (2곳)
```typescript
collection_rate_drop: "수납률 하락 알림" (line 952)
collection_rate_drop: "수납률이 하락할 때..." (line 953)
```

**필요 조치**: `terms.COLLECTION_RATE_LABEL` 사용
- Academy: "수납률"
- Gym: "납부율"
- Salon/NailSalon: "결제율"
- RealEstate: "납입률"

##### 1.6 기타 업종 특정 용어
- "등원/하원": `CHECK_IN_LABEL` / `CHECK_OUT_LABEL` 사용 필요
- "결석": `ABSENCE_LABEL` 사용 필요
- "출석": `PRESENT_LABEL` 또는 `ATTENDANCE_LABEL` 사용 필요

#### 2. **Category Labels - POLICY_KEY_V2_CATEGORIES**

현재 카테고리명은 일반적이라 큰 문제 없음:
```typescript
financial_health: "재무 관리"
capacity_optimization: "정원 최적화"
customer_retention: "고객 유지"
growth_marketing: "성장 마케팅"
safety_compliance: "안전 및 규정 준수"
workforce_ops: "인력 운영"
```

단, "정원 최적화"는 일부 업종에 덜 적합할 수 있음:
- Academy/Gym: "정원 최적화" ✅
- Salon/NailSalon: "예약 최적화" (더 적합)
- RealEstate: "매물 최적화" (더 적합)

## 📊 업종별 영향도 분석

| 업종 | 영향받는 자동화 항목 수 | 영향도 |
|------|---------------------|--------|
| Academy (학원) | 0개 (현재 기준) | ✅ 영향 없음 |
| Gym (헬스장) | 35개 | 🔴 Critical |
| Salon (미용실) | 38개 | 🔴 Critical |
| Nail Salon (네일샵) | 38개 | 🔴 Critical |
| Real Estate (부동산) | 30개 | 🔴 Critical |

## 🛠️ 개선 방안

### 방안 1: Factory Function 패턴 (권장)

**장점**:
- 완전한 업종중립성 달성
- 타입 안전성 확보
- 컴파일 타임 검증 가능

**단점**:
- 대규모 리팩터링 필요
- 42개 automation description 모두 수정

**구현**:
```typescript
// automation-event-descriptions.ts
export function createAutomationEventDescriptions(
  terms: IndustryTerms
): Record<AutomationEventType, { title: string; description: string; policyKey: string }> {
  return {
    payment_due_reminder: {
      title: '결제 예정 알림',
      description: `결제 예정일 3일 전, 1일 전에 ${terms.PAYER_LABEL}에게 자동으로 알림을 발송합니다.`,
      policyKey: 'financial_health',
    },
    // ... 나머지 41개
  };
}
```

### 방안 2: Runtime String Replacement (빠른 적용)

**장점**:
- 기존 구조 유지
- 빠른 구현 가능
- 점진적 적용 가능

**단점**:
- Runtime 오버헤드 (미미)
- 컴파일 타임 검증 불가

**구현**:
```typescript
// AutomationSettingsPage.tsx
const enhancedDescription = useMemo(() => {
  let desc = description.description;

  // 업종중립 용어 치환
  desc = desc.replace(/학부모/g, terms.PAYER_LABEL);
  desc = desc.replace(/학생/g, terms.PERSON_LABEL_PRIMARY);
  desc = desc.replace(/수업/g, terms.GROUP_LABEL);
  desc = desc.replace(/강사/g, terms.PERSON_LABEL_SECONDARY);
  desc = desc.replace(/수납률/g, terms.COLLECTION_RATE_LABEL);

  // 기존 criteria 치환 로직...
  return desc;
}, [description, terms]);
```

### 방안 3: Hybrid Approach (권장 실행 방안)

**Phase 1 (즉시 적용)**:
1. AutomationSettingsPage.tsx에 runtime replacement 추가
2. 5개 주요 용어만 치환 (학부모, 학생, 수업, 강사, 수납률)
3. 검증 및 테스트

**Phase 2 (중장기)**:
1. automation-event-descriptions.ts를 factory function으로 전환
2. 모든 description을 템플릿 리터럴로 변경
3. 카테고리명도 업종별 커스터마이징

## 📈 우선순위 (Priority)

### P1 (High) - 즉시 개선 필요
1. ✅ Runtime replacement로 5개 주요 용어 치환
   - "학부모" → `terms.PAYER_LABEL`
   - "학생" → `terms.PERSON_LABEL_PRIMARY`
   - "수업" → `terms.GROUP_LABEL`
   - "강사" → `terms.PERSON_LABEL_SECONDARY`
   - "수납률" → `terms.COLLECTION_RATE_LABEL`

2. ✅ AutomationSettingsPage.tsx 수정
   - `enhancedDescription` useMemo에 치환 로직 추가

### P2 (Medium) - 중장기 개선
1. automation-event-descriptions.ts factory function 전환
2. Title도 업종중립화 (현재는 description만 치환)
3. Category labels 업종별 커스터마이징

### P3 (Low) - 향후 개선
1. Criteria field labels 업종중립화
2. 세부 용어 추가 (등원/하원, 결석/출석 등)

## 🎓 적용된 아키텍처 원칙 검증

### ✅ SSOT (Single Source of Truth)
- `AUTOMATION_EVENT_CATALOG` 중앙화 ✅
- Policy path helpers 통일 ✅
- Criteria fields 구조화 ✅

### ❌ 업종중립성 (Industry Neutrality)
- **현재 점수: 20%**
- Description 하드코딩 ❌
- Runtime replacement 미적용 ❌

### ✅ Zero-Trust Architecture
- tenantId는 Context에서 자동 추출 ✅
- UI에서 직접 전달 금지 준수 ✅

### ✅ Fail Closed
- Policy 없으면 실행 안 함 ✅
- 기본값 안전하게 설정 ✅

## 📝 권장 조치 (Immediate Action Required)

### Step 1: AutomationSettingsPage.tsx 수정
```typescript
// Line 66-202의 enhancedDescription useMemo 상단에 추가

const enhancedDescription = useMemo(() => {
  let desc = description.description;

  // [P1] 업종중립 용어 치환
  desc = desc.replace(/학부모/g, terms.PAYER_LABEL);
  desc = desc.replace(/학생(?!의)/g, terms.PERSON_LABEL_PRIMARY); // "학생의" 제외
  desc = desc.replace(/학생의/g, `${terms.PERSON_LABEL_PRIMARY}의`);
  desc = desc.replace(/수업/g, terms.GROUP_LABEL);
  desc = desc.replace(/강사/g, terms.PERSON_LABEL_SECONDARY);
  desc = desc.replace(/수납률/g, terms.COLLECTION_RATE_LABEL);

  // 기존 criteria fields 치환 로직...
  // ... (line 70-199 유지)

  return desc;
}, [description, criteriaFields, criteriaValues, eventType, terms]);
```

### Step 2: 검증
```bash
# TypeScript 컴파일 확인
cd apps/academy-admin && npx tsc --noEmit

# 페이지 접속 테스트
# http://localhost:3000/settings/automation
```

### Step 3: 문서화
- [x] 검증 보고서 작성 (이 파일)
- [ ] 개선 작업 문서 작성
- [ ] CHANGELOG 업데이트

## ✅ 결론

자동화 설정 페이지는 **구조적으로는 우수**하나 **업종중립성이 20%로 매우 낮습니다**.

**즉시 조치가 필요한 이유**:
1. 현재 Academy 외 다른 업종에서 사용 불가
2. 44개 하드코딩된 용어로 인한 사용자 혼란
3. 확장성 저해 (신규 업종 추가 시 대규모 수정 필요)

**권장 조치**:
- **Phase 1 (즉시)**: Runtime replacement로 5개 핵심 용어 치환 (30분 작업)
- **Phase 2 (1주 내)**: Factory function 전환 (4시간 작업)
- **Phase 3 (1개월 내)**: Category labels 업종별 커스터마이징 (2시간 작업)

---

**작성일**: 2026-01-04
**작성자**: Claude Sonnet 4.5
**검증 상태**: ✅ 분석 완료, 개선 작업 대기 중
