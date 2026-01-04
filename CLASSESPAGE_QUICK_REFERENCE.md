# ClassesPage.tsx 변경 사항 빠른 참조

## 변경된 18개 위치

### 메인 컴포넌트 (ClassesPage)

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 17 | - | `import { useIndustryTerms }...` | Import 추가 |
| 50 | - | `const terms = useIndustryTerms();` | Hook 초기화 |
| 283 | `"반 관리"` | `` `${terms.GROUP_LABEL} 관리` `` | PageHeader 제목 |
| 291-1 | `'오늘 수업만'` | `` `오늘 ${terms.GROUP_LABEL}만` `` | 필터 버튼 1 |
| 291-2 | `'전체 반 보기'` | `` `전체 ${terms.GROUP_LABEL_PLURAL} 보기` `` | 필터 버튼 2 |
| 312 | `"반 생성"` | `` `${terms.GROUP_LABEL} 생성` `` | 생성 버튼 |
| 226 | `'반 생성에 실패했습니다.'` | `` `${terms.GROUP_LABEL} 생성에 실패했습니다.` `` | 오류 메시지 |
| 272 | `'반 수정에 실패했습니다.'` | `` `${terms.GROUP_LABEL} 수정에 실패했습니다.` `` | 오류 메시지 |
| 380 | `'정말 이 반을 삭제하시겠습니까?'` | `` `정말 이 ${terms.GROUP_LABEL}을(를) 삭제하시겠습니까?` `` | 삭제 확인 |
| 380 | `'반 삭제'` | `` `${terms.GROUP_LABEL} 삭제` `` | 삭제 제목 |
| 387 | `'반 삭제에 실패했습니다.'` | `` `${terms.GROUP_LABEL} 삭제에 실패했습니다.` `` | 오류 메시지 |

### CreateClassForm 컴포넌트

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 426 | - | `const terms = useIndustryTerms();` | Hook 초기화 |
| 339 | `"반 생성"` | `` `${terms.GROUP_LABEL} 생성` `` | Drawer 제목 |
| 458 | `"반 생성"` | `` `${terms.GROUP_LABEL} 생성` `` | 헤더 제목 |

### EditClassModal 컴포넌트

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 511 | - | `const terms = useIndustryTerms();` | Hook 초기화 |
| 556 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Drawer 제목 (로딩) |
| 565 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Modal 제목 (로딩) |
| 577 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Drawer 제목 (없음) |
| 581 | `"반을 찾을 수 없습니다."` | `` `${terms.GROUP_LABEL}을(를) 찾을 수 없습니다.` `` | 에러 메시지 |
| 586 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Modal 제목 (없음) |
| 587 | `"반을 찾을 수 없습니다."` | `` `${terms.GROUP_LABEL}을(를) 찾을 수 없습니다.` `` | 에러 메시지 |
| 638 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Drawer 제목 (최종) |
| 649 | `"반 수정"` | `` `${terms.GROUP_LABEL} 수정` `` | Modal 제목 (최종) |

### ClassListView 컴포넌트

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 675 | `"등록된 반이 없습니다."` | `` `등록된 ${useIndustryTerms().GROUP_LABEL}이 없습니다.` `` | 빈 상태 메시지 |

### ClassCard 컴포넌트

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 696 | - | `const terms = useIndustryTerms();` | Hook 초기화 |

### ClassCalendarView 컴포넌트

| Line | 변경 전 | 변경 후 | 용도 |
|------|--------|--------|------|
| 741 | - | `const terms = useIndustryTerms();` | Hook 초기화 |
| 771 | `"반 편성표"` | `` `${terms.GROUP_LABEL} 편성표` `` | 캘린더 제목 |

---

## 패턴 요약

### 1. Import 추가
```typescript
import { useIndustryTerms } from '@hooks/use-industry-terms';
```

### 2. Hook 선언 (각 컴포넌트)
```typescript
const terms = useIndustryTerms();
```

### 3. 용어 치환
```typescript
// 단수
${terms.GROUP_LABEL}        // "반", "수업", "서비스"

// 복수
${terms.GROUP_LABEL_PLURAL} // "반들", "수업들", "서비스들"
```

---

## 업종별 출력값

### Academy (학원)
```
GROUP_LABEL: "반"
GROUP_LABEL_PLURAL: "반들"
```

### Gym (헬스장)
```
GROUP_LABEL: "수업"
GROUP_LABEL_PLURAL: "수업들"
```

### Salon (미용실)
```
GROUP_LABEL: "서비스"
GROUP_LABEL_PLURAL: "서비스들"
```

### Nail Salon (네일샵)
```
GROUP_LABEL: "서비스"
GROUP_LABEL_PLURAL: "서비스들"
```

### Real Estate (부동산)
```
GROUP_LABEL: "매물"
GROUP_LABEL_PLURAL: "매물들"
```

---

## 그전/그후 예시

### Academy (학원) - 변경 후
```
제목: 반 관리
버튼: "오늘 반만" / "전체 반들 보기"
생성: "반 생성"
에러: "반 생성에 실패했습니다."
캘린더: "반 편성표"
```

### Gym (헬스장) - 자동 변환
```
제목: 수업 관리
버튼: "오늘 수업만" / "전체 수업들 보기"
생성: "수업 생성"
에러: "수업 생성에 실패했습니다."
캘린더: "수업 편성표"
```

---

## 변경하지 않은 항목

- ✅ 요일 라벨 (월요일, 화요일 등) - 업종 무관
- ✅ 기술 메시지 (로딩 중...) - 업종 무관
- ✅ 내부 주석 - 문서화 목적
- ✅ 비즈니스 로직 - 모두 동일
- ✅ 스타일/레이아웃 - 모두 동일

---

## 파일 정보

| 항목 | 값 |
|------|-----|
| 파일경로 | `/apps/academy-admin/src/pages/ClassesPage.tsx` |
| 변경 수 | 18개 위치 |
| 영향 컴포넌트 | 5개 |
| Import 추가 | 1개 |
| Hook 선언 | 5개 |
| UI 텍스트 변경 | 18개 |
| 검증 상태 | ✅ 완료 |

---

**마지막 업데이트**: 2026-01-04
**상태**: Ready for Testing
