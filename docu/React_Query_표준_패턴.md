# React Query 표준 패턴

**버전**: 1.0.0
**최종 업데이트**: 2026-01-10
**관련 문서**: `docu/체크리스트.md` (P2-QUALITY-2)

---

## 📋 개요

React Query 사용 시 일관성을 보장하고 정책 시점 불일치를 방지하기 위한 표준 패턴입니다.

---

## 🎯 문제 정의

### 현재 문제
- **정책 시점 일관성 (P1)**: staleTime/queryKey 설정이 화면/훅마다 다름
- **React Query 패턴 불일치 (P2)**: `createQueryKey()` 미사용, `CACHE_TIMES` 상수 미사용
- **캐시 무효화 규칙 추론 어려움**: queryKey 생성 규칙이 일관되지 않음

### 목표
- 모든 쿼리에서 동일한 queryKey 생성 패턴 사용
- 정책 관련 쿼리는 동일한 staleTime 사용
- 캐시 무효화 규칙 명확화

---

## 📐 표준 패턴

### 1. Query Key 생성 패턴

**정본 위치**: `packages/hooks/use-query-key-utils/src/index.ts`

#### 기본 규칙

```typescript
import { createQueryKey } from '@hooks/use-query-key-utils';

// 패턴: [scope, entity, identifier?, params?]
const queryKey = createQueryKey('students', 'list', tenantId);
// 결과: ['students', 'list', 'tenant-123']

const queryKey = createQueryKey('students', 'detail', studentId);
// 결과: ['students', 'detail', 'student-456']

const queryKey = createQueryKey('students', 'list', tenantId, { status: 'active' });
// 결과: ['students', 'list', 'tenant-123', { status: 'active' }]
```

#### Query Key 구조

```typescript
type QueryKey = [
  scope: string,           // 엔티티 스코프 (students, classes, automation 등)
  entity: string,          // 엔티티 타입 (list, detail, stats 등)
  identifier?: string,     // 식별자 (tenantId, studentId 등)
  params?: Record<string, unknown>  // 추가 파라미터
];
```

#### 예시

```typescript
// 목록 조회
createQueryKey('students', 'list', tenantId);
createQueryKey('classes', 'list', tenantId);
createQueryKey('automation-events', 'list', tenantId);

// 상세 조회
createQueryKey('students', 'detail', studentId);
createQueryKey('classes', 'detail', classId);

// 통계 조회
createQueryKey('dashboard', 'stats', tenantId);
createQueryKey('analytics', 'region-metrics', tenantId);

// 파라미터 포함
createQueryKey('students', 'list', tenantId, { status: 'active', classId });
createQueryKey('automation-events', 'list', tenantId, { eventType: 'attendance' });
```

---

### 2. Cache Time 표준 상수

**정본 위치**: `packages/lib/react-query-config/src/cache-times.ts`

#### CACHE_TIMES 상수

```typescript
export const CACHE_TIMES = {
  // 정적 데이터 (거의 변하지 않음)
  STATIC: 1000 * 60 * 60 * 24, // 24시간

  // 준정적 데이터 (하루 단위 변경)
  SEMI_STATIC: 1000 * 60 * 60, // 1시간

  // 정책 데이터 (자주 변경되지 않음, 하지만 변경 시 즉시 반영 필요)
  POLICY: 1000 * 60 * 5, // 5분

  // 일반 데이터 (자주 변경됨)
  DEFAULT: 1000 * 60, // 1분

  // 실시간 데이터 (계속 변경됨)
  REALTIME: 1000 * 10, // 10초

  // 즉시 무효화 (항상 최신 데이터 필요)
  INSTANT: 0, // 0초
} as const;
```

#### 사용 예시

```typescript
import { CACHE_TIMES } from '@lib/react-query-config';

// 정책 데이터
const { data: automationConfig } = useQuery({
  queryKey: createQueryKey('automation', 'config', tenantId),
  queryFn: () => fetchAutomationConfig(tenantId),
  staleTime: CACHE_TIMES.POLICY, // 5분
});

// 학생 목록 (일반 데이터)
const { data: students } = useQuery({
  queryKey: createQueryKey('students', 'list', tenantId),
  queryFn: () => fetchStudents(tenantId),
  staleTime: CACHE_TIMES.DEFAULT, // 1분
});

// 대시보드 통계 (실시간)
const { data: stats } = useQuery({
  queryKey: createQueryKey('dashboard', 'stats', tenantId),
  queryFn: () => fetchDashboardStats(tenantId),
  staleTime: CACHE_TIMES.REALTIME, // 10초
});

// 설정 데이터 (정적)
const { data: settings } = useQuery({
  queryKey: createQueryKey('settings', 'general', tenantId),
  queryFn: () => fetchSettings(tenantId),
  staleTime: CACHE_TIMES.STATIC, // 24시간
});
```

---

### 3. 정책 관련 쿼리 표준 패턴

**중요**: 정책 관련 쿼리는 반드시 `CACHE_TIMES.POLICY`를 사용하여 정책 시점 일관성을 보장합니다.

#### 정책 쿼리 패턴

```typescript
import { createQueryKey } from '@hooks/use-query-key-utils';
import { CACHE_TIMES } from '@lib/react-query-config';

// 자동화 정책
export function useAutomationPolicy(tenantId: string) {
  return useQuery({
    queryKey: createQueryKey('automation', 'policy', tenantId),
    queryFn: () => fetchAutomationPolicy(tenantId),
    staleTime: CACHE_TIMES.POLICY, // 필수
    gcTime: CACHE_TIMES.POLICY * 2, // staleTime의 2배
  });
}

// 알림 정책
export function useNotificationPolicy(tenantId: string) {
  return useQuery({
    queryKey: createQueryKey('notification', 'policy', tenantId),
    queryFn: () => fetchNotificationPolicy(tenantId),
    staleTime: CACHE_TIMES.POLICY, // 필수
    gcTime: CACHE_TIMES.POLICY * 2,
  });
}

// 테넌트 설정 (정책 포함)
export function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: createQueryKey('tenant', 'settings', tenantId),
    queryFn: () => fetchTenantSettings(tenantId),
    staleTime: CACHE_TIMES.POLICY, // 필수
    gcTime: CACHE_TIMES.POLICY * 2,
  });
}
```

---

### 4. Mutation 표준 패턴

#### 기본 Mutation 패턴

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQueryKey } from '@hooks/use-query-key-utils';

export function useCreateStudent(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStudentInput) => createStudent(tenantId, data),
    onSuccess: () => {
      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: createQueryKey('students', 'list', tenantId),
      });

      // 통계 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: createQueryKey('dashboard', 'stats', tenantId),
      });
    },
  });
}

export function useUpdateStudent(studentId: string, tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStudentInput) => updateStudent(studentId, data),
    onSuccess: () => {
      // 상세 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: createQueryKey('students', 'detail', studentId),
      });

      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: createQueryKey('students', 'list', tenantId),
      });
    },
  });
}
```

#### 낙관적 업데이트 패턴

```typescript
export function useUpdateStudentOptimistic(studentId: string, tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStudentInput) => updateStudent(studentId, data),
    onMutate: async (data) => {
      // 진행 중인 refetch 취소
      await queryClient.cancelQueries({
        queryKey: createQueryKey('students', 'detail', studentId),
      });

      // 이전 값 백업
      const previousStudent = queryClient.getQueryData(
        createQueryKey('students', 'detail', studentId)
      );

      // 낙관적 업데이트
      queryClient.setQueryData(
        createQueryKey('students', 'detail', studentId),
        (old: any) => ({ ...old, ...data })
      );

      return { previousStudent };
    },
    onError: (err, data, context) => {
      // 에러 시 이전 값으로 롤백
      if (context?.previousStudent) {
        queryClient.setQueryData(
          createQueryKey('students', 'detail', studentId),
          context.previousStudent
        );
      }
    },
    onSettled: () => {
      // 완료 시 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: createQueryKey('students', 'detail', studentId),
      });
    },
  });
}
```

---

### 5. 캐시 무효화 규칙

#### 범위별 무효화

```typescript
// 특정 tenantId의 모든 students 쿼리 무효화
queryClient.invalidateQueries({
  queryKey: createQueryKey('students', 'list', tenantId),
});

// 특정 studentId의 모든 쿼리 무효화
queryClient.invalidateQueries({
  queryKey: createQueryKey('students', 'detail', studentId),
});

// 특정 scope의 모든 쿼리 무효화
queryClient.invalidateQueries({
  queryKey: ['students'],
});

// 모든 쿼리 무효화 (거의 사용하지 않음)
queryClient.invalidateQueries();
```

#### 연관 데이터 무효화

```typescript
// 학생 생성 시 연관 데이터 무효화
export function useCreateStudent(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStudentInput) => createStudent(tenantId, data),
    onSuccess: () => {
      // 1. 학생 목록
      queryClient.invalidateQueries({
        queryKey: createQueryKey('students', 'list', tenantId),
      });

      // 2. 대시보드 통계
      queryClient.invalidateQueries({
        queryKey: createQueryKey('dashboard', 'stats', tenantId),
      });

      // 3. 반별 학생 수 (클래스가 지정된 경우)
      if (data.classId) {
        queryClient.invalidateQueries({
          queryKey: createQueryKey('classes', 'detail', data.classId),
        });
      }
    },
  });
}
```

---

## 🚫 금지 패턴

### ❌ 하드코딩된 queryKey

```typescript
// ❌ 금지
useQuery({
  queryKey: ['students', tenantId],
  // ...
});

// ✅ 허용
useQuery({
  queryKey: createQueryKey('students', 'list', tenantId),
  // ...
});
```

### ❌ 매직 넘버 staleTime

```typescript
// ❌ 금지
useQuery({
  queryKey: createQueryKey('students', 'list', tenantId),
  staleTime: 60000, // 1분
  // ...
});

// ✅ 허용
useQuery({
  queryKey: createQueryKey('students', 'list', tenantId),
  staleTime: CACHE_TIMES.DEFAULT,
  // ...
});
```

### ❌ 정책 쿼리에서 다른 staleTime 사용

```typescript
// ❌ 금지
export function useAutomationPolicy(tenantId: string) {
  return useQuery({
    queryKey: createQueryKey('automation', 'policy', tenantId),
    staleTime: CACHE_TIMES.DEFAULT, // 정책은 CACHE_TIMES.POLICY 필수
    // ...
  });
}

// ✅ 허용
export function useAutomationPolicy(tenantId: string) {
  return useQuery({
    queryKey: createQueryKey('automation', 'policy', tenantId),
    staleTime: CACHE_TIMES.POLICY, // 필수
    // ...
  });
}
```

---

## 📦 createQueryKey 유틸리티 구현

**위치**: `packages/hooks/use-query-key-utils/src/index.ts`

```typescript
/**
 * React Query queryKey 생성 유틸리티
 *
 * @param scope - 엔티티 스코프 (students, classes, automation 등)
 * @param entity - 엔티티 타입 (list, detail, stats 등)
 * @param identifier - 식별자 (tenantId, studentId 등)
 * @param params - 추가 파라미터
 * @returns queryKey 배열
 */
export function createQueryKey(
  scope: string,
  entity: string,
  identifier?: string,
  params?: Record<string, unknown>
): unknown[] {
  const key: unknown[] = [scope, entity];

  if (identifier !== undefined) {
    key.push(identifier);
  }

  if (params !== undefined) {
    key.push(params);
  }

  return key;
}

/**
 * queryKey에서 scope 추출
 */
export function getScopeFromQueryKey(queryKey: unknown[]): string | undefined {
  return typeof queryKey[0] === 'string' ? queryKey[0] : undefined;
}

/**
 * queryKey에서 entity 추출
 */
export function getEntityFromQueryKey(queryKey: unknown[]): string | undefined {
  return typeof queryKey[1] === 'string' ? queryKey[1] : undefined;
}

/**
 * queryKey에서 identifier 추출
 */
export function getIdentifierFromQueryKey(queryKey: unknown[]): string | undefined {
  return typeof queryKey[2] === 'string' ? queryKey[2] : undefined;
}
```

---

## 📦 CACHE_TIMES 구현

**위치**: `packages/lib/react-query-config/src/cache-times.ts`

```typescript
/**
 * React Query 캐시 시간 상수
 *
 * staleTime: 데이터가 "신선한" 상태로 유지되는 시간
 * gcTime (구 cacheTime): 데이터가 메모리에서 제거되기까지의 시간
 */
export const CACHE_TIMES = {
  // 정적 데이터 (거의 변하지 않음)
  STATIC: 1000 * 60 * 60 * 24, // 24시간

  // 준정적 데이터 (하루 단위 변경)
  SEMI_STATIC: 1000 * 60 * 60, // 1시간

  // 정책 데이터 (자주 변경되지 않음, 하지만 변경 시 즉시 반영 필요)
  POLICY: 1000 * 60 * 5, // 5분

  // 일반 데이터 (자주 변경됨)
  DEFAULT: 1000 * 60, // 1분

  // 실시간 데이터 (계속 변경됨)
  REALTIME: 1000 * 10, // 10초

  // 즉시 무효화 (항상 최신 데이터 필요)
  INSTANT: 0, // 0초
} as const;

/**
 * 각 캐시 타입에 대한 gcTime (메모리 보관 시간)
 * 일반적으로 staleTime의 2배로 설정
 */
export const GC_TIMES = {
  STATIC: CACHE_TIMES.STATIC * 2,
  SEMI_STATIC: CACHE_TIMES.SEMI_STATIC * 2,
  POLICY: CACHE_TIMES.POLICY * 2,
  DEFAULT: CACHE_TIMES.DEFAULT * 2,
  REALTIME: CACHE_TIMES.REALTIME * 2,
  INSTANT: CACHE_TIMES.INSTANT,
} as const;
```

---

## 🔍 체크리스트

### 새 쿼리 추가 시

- [ ] `createQueryKey()` 사용하여 queryKey 생성
- [ ] `CACHE_TIMES` 상수 사용하여 staleTime 설정
- [ ] 정책 관련 쿼리는 `CACHE_TIMES.POLICY` 사용
- [ ] gcTime은 staleTime의 2배로 설정
- [ ] mutation 시 연관 데이터 캐시 무효화

### 기존 쿼리 마이그레이션 시

- [ ] 하드코딩된 queryKey → `createQueryKey()` 변환
- [ ] 매직 넘버 staleTime → `CACHE_TIMES` 상수 사용
- [ ] 정책 쿼리 staleTime 통일 (`CACHE_TIMES.POLICY`)

---

## 📊 마이그레이션 가이드

### Phase 1: 유틸리티 구현 (완료)
- [x] `createQueryKey()` 함수 구현
- [x] `CACHE_TIMES` 상수 정의

### Phase 2: 정책 쿼리 우선 마이그레이션
- [ ] `useAutomationPolicy` → `CACHE_TIMES.POLICY`
- [ ] `useNotificationPolicy` → `CACHE_TIMES.POLICY`
- [ ] `useTenantSettings` → `CACHE_TIMES.POLICY`

### Phase 3: 일반 쿼리 점진적 마이그레이션
- [ ] `useStudents` → `createQueryKey()` + `CACHE_TIMES.DEFAULT`
- [ ] `useClasses` → `createQueryKey()` + `CACHE_TIMES.DEFAULT`
- [ ] `useDashboardStats` → `createQueryKey()` + `CACHE_TIMES.REALTIME`

---

## 📝 변경 이력

- **2026-01-10 (v1.0.0)**: 초기 문서 작성

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2026-01-10
**유지보수 책임**: 프론트엔드 팀
