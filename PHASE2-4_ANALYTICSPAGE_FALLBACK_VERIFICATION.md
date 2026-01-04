# Phase 2-4: AnalyticsPage Fallback 수정 완료 보고서

## 요약
AnalyticsPage.tsx의 하드코딩된 fallback 값들이 성공적으로 제거되었습니다. 모든 fallback은 이제 업종 중립적이거나 적절히 처리됩니다.

---

## 수정된 항목

### 1. Line 79: industryType Fallback
**상태**: ✅ 완료

**이전 코드**:
```typescript
const industryType = context?.industryType || 'academy'; // 하드코딩된 'academy' fallback
```

**현재 코드**:
```typescript
const industryType = context?.industryType || config?.industry_type || DEFAULT_INDUSTRY_TYPE;
```

**개선 사항**:
- Context에서 첫 번째로 industryType 조회
- 없으면 config에서 industry_type 조회
- 마지막으로 업종 레지스트리의 DEFAULT_INDUSTRY_TYPE 사용 (현재 'academy')
- DEFAULT_INDUSTRY_TYPE은 `/packages/industry/industry-registry.ts`에서 중앙 관리됨

**근거**:
- 불변 규칙: "Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)"
- 주석 추가: `// [불변 규칙] Zero-Trust: industryType은 Context에서 가져와야 함 (하드코딩 금지)`
- DEFAULT_INDUSTRY_TYPE은 레지스트리에서 import되어 단일 관리점(SSOT) 제공

---

### 2. Line 1062: academyName Fallback
**상태**: ✅ 완료

**수정된 코드**:
```typescript
const academyName = typeof config?.academy_name === 'string'
  ? config.academy_name
  : (config?.organization_name || '');
```

**개선 사항**:
- 하드코딩된 '디어쌤' 브랜드명 제거
- academy_name 필드 우선 사용 (레거시 호환성)
- 없으면 organization_name 사용 (업종 중립적)
- 둘 다 없으면 빈 문자열 (업종 중립적)

**근거**:
- 업종별로 조직 이름 필드 다름:
  - academy: academy_name (학원명)
  - gym: organization_name (헬스장명)
  - salon: organization_name (미용실명)
  - 기타: organization_name (통일된 필드)
- 타입 안전성: typeof 체크로 string 보장
- 공백 폴백: 일관된 빈 문자열 사용

---

## 검증 결과

### 남은 하드코딩 값 확인
```bash
grep -n "|| 'academy\||| '디어\|fallback.*academy\|fallback.*디어" apps/academy-admin/src/pages/AnalyticsPage.tsx
```
**결과**: No matches found ✅

### 임포트 확인
```typescript
// Line 36
import { DEFAULT_INDUSTRY_TYPE } from '@industry/registry';

// Line 80
const terms = useIndustryTerms();
```
✅ 올바른 import 구조 확인

---

## 영향받은 컴포넌트

### 직접 영향
1. **AnalyticsPage.tsx (Line 79, 1062)**
   - industryType 초기화
   - 월간 리포트 PDF 생성 시 조직명 설정

### 간접 영향
1. **MonthlyReportData 인터페이스**
   - academyName 필드에 organization_name 받기 가능

2. **PDF 생성 함수 (`downloadMonthlyReportPDF`)**
   - 빈 조직명도 정상 처리 (display: academyName || 'Report')

---

## 업종별 호환성 검증

| 업종 | industry_type | academy_name | organization_name | 최종값 |
|------|---------------|--------------|-------------------|--------|
| 학원 | academy | ✅ 사용 | - | ✅ academy_name |
| 헬스장 | gym | - | ✅ 사용 | ✅ organization_name |
| 미용실 | salon | - | ✅ 사용 | ✅ organization_name |
| 네일샵 | nail_salon | - | ✅ 사용 | ✅ organization_name |
| 부동산 | real_estate | - | ✅ 사용 | ✅ organization_name |

---

## 기술 문서 준수

✅ **SSOT 규칙 준수**
- DEFAULT_INDUSTRY_TYPE은 레지스트리에서만 정의
- 하드코딩된 'academy' 문자열 제거

✅ **Zero-Trust 규칙 준수**
- industryType을 Context → Config → Registry 순으로 조회
- 직접 문자열 하드코딩 제거

✅ **업종 중립성**
- 모든 조직명은 config에서 제공
- 브랜드명('디어쌤') 제거
- 조건부 처리로 null/undefined 안전성 확보

✅ **코드 주석**
- 불변 규칙 명시: `[불변 규칙] Zero-Trust`
- 폴백 이유 설명

---

## 변경 내역 요약

| 파일 | 줄 | 변경 전 | 변경 후 | 상태 |
|------|-----|--------|--------|------|
| AnalyticsPage.tsx | 79 | `context?.industryType \|\| 'academy'` | `context?.industryType \|\| config?.industry_type \|\| DEFAULT_INDUSTRY_TYPE` | ✅ |
| AnalyticsPage.tsx | 1062 | `academyName \|\| '디어쌤'` | `config?.academy_name ? config.academy_name : (config?.organization_name \|\| '')` | ✅ |

---

## 검증 체크리스트

- [x] 하드코딩된 'academy' 제거
- [x] 하드코딩된 '디어쌤' 제거
- [x] DEFAULT_INDUSTRY_TYPE import 확인
- [x] useIndustryTerms() 훅 활용
- [x] 업종별 호환성 검증
- [x] 타입 안전성 확인
- [x] null/undefined 처리
- [x] SSOT 규칙 준수
- [x] Zero-Trust 규칙 준수
- [x] 코드 주석 추가

---

## 결론

**Phase 2-4 완료**: AnalyticsPage의 모든 하드코딩된 fallback 값이 제거되었으며, 업종 중립적이고 안전한 패턴으로 수정되었습니다.

**다음 Phase**: Phase 2-5 및 이후 페이지 검증
