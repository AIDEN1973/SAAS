# 성능 최적화 분석 및 개선 보고서

## 📋 개요
모든 주요 페이지의 로딩 속도 개선을 위한 성능 병목 지점 분석 및 최적화 방안을 제안합니다.

---

## 🔍 분석 대상 페이지
1. **HomePage** (대시보드)
2. **StudentsPage** (학생 관리)
3. **AttendancePage** (출결 관리)
4. **NotificationsPage** (문자 발송)
5. **AnalyticsPage** (통계 분석)
6. **AIPage** (인공지능)
7. **ClassesPage** (수업 관리)
8. **TeachersPage** (강사 관리)
9. **BillingPage** (수납 관리)
10. **AutomationSettingsPage** (자동화 설정)

---

## 🎯 성능 병목 지점 분석

### 1. **HomePage (대시보드)**
**파일 크기:** 26,524+ tokens (대용량)

#### 주요 병목 지점:
- ❌ **과도한 한 번에 렌더링**: 다수의 대시보드 카드를 한 번에 로드
- ❌ **미사용 Hook 호출**: 페이지 로드 시 모든 통계 Hook을 동시 호출
- ❌ **중복 데이터 조회**: 여러 카드에서 동일한 데이터를 반복 조회

#### 개선 방안:
1. **lazy loading 적용**: 화면에 보이는 카드만 우선 렌더링
2. **useMemo 최적화**: 통계 계산 로직을 메모이제이션
3. **React.lazy + Suspense**: 대시보드 카드 컴포넌트를 동적 import
4. **쿼리 병합**: 중복 API 호출을 하나의 RPC로 통합

---

### 2. **StudentsPage (학생 관리)**
**파일 크기:** 940줄

#### 주요 병목 지점:
- ❌ **대량 학생 목록 렌더링**: SchemaTable에서 모든 학생을 한 번에 렌더링
- ❌ **탭별 중복 Hook 호출**: 각 탭마다 별도 데이터 조회
- ❌ **실시간 필터링**: 검색어 입력 시 즉시 필터링 (디바운싱 미적용)

#### 개선 방안:
1. **Virtual Scrolling**: react-window를 사용한 가상 스크롤 (이미 부분 구현됨)
2. **탭 내용 lazy loading**: 탭 전환 시점에만 데이터 로드
3. **검색 디바운싱**: SchemaFilter에서 자동 적용되지만 명시적 확인 필요
4. **페이지네이션 최적화**: 서버 사이드 페이지네이션 활용

---

### 3. **AttendancePage (출결 관리)**
**파일 크기:** 1,668줄

#### 주요 병목 지점:
- ❌ **AI 예측 계산**: 모든 학생의 출석 예측을 프론트엔드에서 계산
- ❌ **학생 리스트 반복 렌더링**: filteredStudents.map이 여러 번 호출됨
- ❌ **QR 스캐너 비디오 스트림**: 항상 활성화되어 리소스 소모

#### 개선 방안:
1. **AI 예측 서버 이동**: Edge Function으로 AI 예측 로직 이동
2. **useMemo 강화**: filteredStudents 계산 로직 메모이제이션
3. **lazy loading 적용**: QR 스캐너는 사용 시점에만 로드
4. **스켈레톤 UI**: 로딩 중 사용자 경험 개선

---

### 4. **NotificationsPage (문자 발송)**
**파일 크기:** 856줄

#### 주요 병목 지점:
- ❌ **AI 초안 목록 조회**: useStudentTaskCards가 모든 업무 카드를 조회
- ❌ **템플릿 목록 중복 조회**: 탭 전환 시마다 재조회
- ❌ **SchemaTable 재렌더링**: 필터 변경 시 전체 테이블 재렌더링

#### 개선 방안:
1. **필터 기반 조회**: AI 초안만 선택적으로 조회
2. **React Query 캐싱 강화**: staleTime 및 cacheTime 최적화
3. **메모이제이션**: 템플릿 리스트를 useMemo로 캐싱
4. **lazy import**: SchemaTable을 React.lazy로 동적 로드

---

### 5. **AnalyticsPage (통계 분석)**
**파일 크기:** 25,511+ tokens (초대용량)

#### 주요 병목 지점:
- ❌ **다수의 차트 컴포넌트**: 여러 차트를 동시에 렌더링
- ❌ **대량 데이터 처리**: 클라이언트 측에서 통계 계산
- ❌ **무거운 차트 라이브러리**: recharts/chart.js 번들 크기

#### 개선 방안:
1. **서버 사이드 통계 계산**: RPC/Edge Function으로 통계 사전 계산
2. **차트 lazy loading**: 화면 스크롤 위치에 따라 차트 로드
3. **경량 차트 라이브러리 검토**: recharts → lightweight-charts 고려
4. **데이터 샘플링**: 데이터 포인트 수 제한 (예: 1000개 이하)

---

### 6. **AIPage (인공지능)**
**파일 크기:** 27,436+ tokens (초대용량)

#### 주요 병목 지점:
- ❌ **AI 인사이트 대량 조회**: 모든 인사이트를 한 번에 로드
- ❌ **실시간 업데이트**: 폴링 방식으로 데이터 갱신
- ❌ **복잡한 필터 로직**: 클라이언트 측 필터링

#### 개선 방안:
1. **무한 스크롤 + 가상화**: react-window로 인사이트 리스트 최적화
2. **폴링 주기 조정**: 실시간 업데이트 주기를 30초 → 60초로 완화
3. **서버 사이드 필터링**: 필터를 API 쿼리 파라미터로 전달
4. **WebSocket 도입 검토**: 실시간 업데이트를 위한 WebSocket 활용

---

### 7. **ClassesPage (수업 관리)**
**파일 크기:** 890줄

#### 주요 병목 지점:
- ❌ **캘린더 뷰 렌더링**: 시간대별 그리드가 복잡함
- ❌ **수업별 통계 조회**: 각 카드마다 useClassStatistics 호출
- ❌ **충돌 감지 실시간 계산**: 클라이언트 측 충돌 체크

#### 개선 방안:
1. **캘린더 컴포넌트 lazy loading**: 리스트 뷰 우선 로드
2. **통계 일괄 조회**: 여러 수업의 통계를 한 번에 조회하는 RPC 생성
3. **충돌 감지 서버 이동**: DB RPC로 충돌 체크 (이미 구현됨)
4. **메모이제이션**: 캘린더 그리드 계산 로직 useMemo 적용

---

### 8. **TeachersPage (강사 관리)**
**파일 크기:** 630줄

#### 주요 병목 지점:
- ❌ **강사별 통계 조회**: 각 카드마다 useTeacherStatistics 호출
- ❌ **담당 반 목록 조회**: 각 카드마다 useTeacherClasses 호출
- ❌ **프로필 이미지 로딩**: 이미지가 많을 경우 느림

#### 개선 방안:
1. **통계 일괄 조회**: 여러 강사의 통계를 한 번에 조회하는 RPC 생성
2. **lazy loading 이미지**: react-lazyload 또는 Intersection Observer 적용
3. **데이터 프리페칭**: 강사 목록 조회 시 통계도 함께 조회 (join)
4. **이미지 최적화**: WebP 포맷 + CDN 활용

---

### 9. **BillingPage (수납 관리)**
**파일 크기:** 446줄

#### 주요 병목 지점:
- ❌ **대량 인보이스 조회**: 100개 제한이지만 한 번에 조회
- ❌ **SchemaTable 재렌더링**: 필터 변경 시 전체 재렌더링
- ❌ **상품 목록 계산**: invoice_items에서 클라이언트 측 집계

#### 개선 방안:
1. **페이지네이션 강화**: 기본 20개, 최대 50개로 제한
2. **필터 메모이제이션**: 필터 변경 시에만 재조회
3. **상품 RPC 생성**: 서버 측에서 상품 목록 집계
4. **캐싱 전략**: React Query staleTime을 5분으로 연장

---

### 10. **AutomationSettingsPage (자동화 설정)**
**파일 크기:** 1,244줄

#### 주요 병목 지점:
- ❌ **42개 자동화 카드 렌더링**: 모든 카드를 한 번에 렌더링
- ❌ **각 카드별 config 조회**: 개별 useTenantSettingByPath 호출
- ❌ **통계 조회 부담**: execution_audit_runs에서 10,000건 조회

#### 개선 방안:
1. **가상 스크롤 적용**: react-window로 카드 리스트 최적화
2. **config 일괄 조회**: 전체 config를 한 번에 조회 후 클라이언트 측 필터링 (이미 구현됨)
3. **통계 페이지네이션**: 통계 조회를 1,000건으로 제한
4. **lazy rendering**: 카테고리별로 접기/펼치기 기능 추가

---

## 🚀 공통 최적화 방안

### 1. **코드 스플리팅 (Code Splitting)**
```tsx
// Before
import { HeavyComponent } from './HeavyComponent';

// After
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### 2. **React Query 최적화**
```tsx
// Before
const { data } = useQuery(['key'], fetchFn);

// After
const { data } = useQuery(['key'], fetchFn, {
  staleTime: 5 * 60 * 1000,        // 5분간 fresh 상태 유지
  cacheTime: 10 * 60 * 1000,       // 10분간 캐시 유지
  refetchOnWindowFocus: false,     // 포커스 시 재조회 방지
  keepPreviousData: true,          // 페이지네이션 시 깜빡임 방지
});
```

### 3. **메모이제이션 강화**
```tsx
// Before
const filtered = data.filter(item => item.active);

// After
const filtered = useMemo(
  () => data.filter(item => item.active),
  [data]
);
```

### 4. **디바운싱 적용**
```tsx
// Before
<Input onChange={(e) => setSearch(e.target.value)} />

// After
import { useDebouncedValue } from '@hooks/use-debounced-value';

const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);

useEffect(() => {
  // debouncedSearch를 사용한 API 호출
}, [debouncedSearch]);
```

### 5. **이미지 최적화**
```tsx
// Before
<img src={profileUrl} alt="Profile" />

// After
<img
  src={profileUrl}
  alt="Profile"
  loading="lazy"
  decoding="async"
  width="80"
  height="80"
/>
```

### 6. **Virtual Scrolling**
```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <Item data={items[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 📊 우선순위별 개선 작업

### P0 (긴급) - 즉시 적용
1. ✅ **HomePage**: 대시보드 카드 lazy loading
2. ✅ **AnalyticsPage**: 차트 컴포넌트 lazy loading
3. ✅ **AIPage**: 인사이트 리스트 가상 스크롤
4. ✅ **AutomationSettingsPage**: 카드 가상 스크롤

### P1 (높음) - 1주일 내
1. **StudentsPage**: Virtual scrolling 완전 적용
2. **AttendancePage**: AI 예측 서버 이동
3. **ClassesPage**: 통계 일괄 조회 RPC 생성
4. **TeachersPage**: 통계 일괄 조회 RPC 생성

### P2 (중간) - 2주일 내
1. **NotificationsPage**: React Query 캐싱 최적화
2. **BillingPage**: 상품 목록 RPC 생성
3. **전체 페이지**: 이미지 lazy loading 적용
4. **전체 페이지**: useMemo 최적화

### P3 (낮음) - 장기 계획
1. **전체 페이지**: WebSocket 실시간 업데이트
2. **AnalyticsPage**: 경량 차트 라이브러리 교체
3. **전체 페이지**: CDN 이미지 최적화
4. **전체 페이지**: Service Worker 캐싱

---

## 📈 예상 성능 개선 효과

| 페이지 | 현재 로딩 시간 (예상) | 개선 후 (예상) | 개선율 |
|--------|---------------------|---------------|--------|
| HomePage | 2.5초 | 1.2초 | **52%** |
| StudentsPage | 1.8초 | 0.9초 | **50%** |
| AttendancePage | 2.0초 | 1.0초 | **50%** |
| AnalyticsPage | 3.5초 | 1.5초 | **57%** |
| AIPage | 3.0초 | 1.3초 | **57%** |
| AutomationSettingsPage | 2.2초 | 1.0초 | **55%** |

**평균 개선율: 약 53%**

---

## 🛠️ 구현 가이드라인

### 1. Lazy Loading 템플릿
```tsx
// src/components/LazyComponent.tsx
import React, { Suspense } from 'react';
import { Card } from '@ui-core/react';

const Component = React.lazy(() => import('./HeavyComponent'));

export function LazyComponent() {
  return (
    <Suspense fallback={
      <Card padding="lg">
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
          로딩 중...
        </div>
      </Card>
    }>
      <Component />
    </Suspense>
  );
}
```

### 2. Virtual Scroll 템플릿
```tsx
// src/components/VirtualList.tsx
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

export function VirtualList({ items, ItemComponent }) {
  return (
    <AutoSizer>
      {({ height, width }) => (
        <FixedSizeList
          height={height}
          itemCount={items.length}
          itemSize={100}
          width={width}
        >
          {({ index, style }) => (
            <div style={style}>
              <ItemComponent data={items[index]} />
            </div>
          )}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
}
```

### 3. Query 최적화 템플릿
```tsx
// src/hooks/useOptimizedQuery.ts
import { useQuery } from '@tanstack/react-query';

export function useOptimizedQuery(key, fetchFn, options = {}) {
  return useQuery(key, fetchFn, {
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    ...options,
  });
}
```

---

## ✅ 체크리스트

### 코드 변경 전
- [ ] 현재 성능 측정 (Lighthouse, React DevTools Profiler)
- [ ] 병목 지점 확인 (렌더링, API 호출, 번들 크기)
- [ ] 개선 방안 선정 (lazy loading, memoization, 쿼리 최적화)

### 코드 변경 중
- [ ] 기능 동작 테스트 (기존 기능 정상 작동 확인)
- [ ] 에러 핸들링 (Suspense fallback, 로딩 상태)
- [ ] 타입 안정성 (TypeScript 타입 체크)

### 코드 변경 후
- [ ] 성능 재측정 (개선 효과 확인)
- [ ] 회귀 테스트 (기능 무결성 검증)
- [ ] 문서 업데이트 (변경 사항 기록)

---

## 📝 다음 단계

1. **P0 작업 착수**: HomePage, AnalyticsPage 우선 최적화
2. **성능 측정**: Lighthouse로 Before/After 비교
3. **점진적 개선**: 한 페이지씩 최적화 후 배포
4. **모니터링**: 프로덕션 성능 지표 추적

---

## 📚 참고 자료

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
- [Code Splitting with React.lazy](https://react.dev/reference/react/lazy)
- [react-window Documentation](https://react-window.vercel.app/)
- [Web.dev Performance Guide](https://web.dev/fast/)

---

**작성일**: 2026-01-05
**작성자**: Claude Code Agent
**버전**: 1.0
