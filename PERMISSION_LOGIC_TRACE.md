# 권한 로직 동작 추적

## 로직 흐름

```typescript
hasPagePermission(pagePath: string): boolean {
  // 1. admin/owner/super_admin → true
  // 2. teacherPosition 없으면 → true

  // 3. DB에 권한이 있는지 확인
  const positionPermissions = rolePermissions?.filter(p => p.position === teacherPosition);
  const hasPositionPermissionsInDB = positionPermissions.length > 0;

  if (hasPositionPermissionsInDB) {
    // 3-1. DB에서 pagePath와 매칭되는 권한 찾기
    const permission = sortedPermissions.find(p => pagePath.startsWith(p.page_path));

    if (permission) {
      // 3-1-1. DB에 명시적으로 있으면 DB 값 사용
      return permission.can_access;
    }

    // 3-1-2. DB에 없으면 fallback
  }

  // 4. DEFAULT_PERMISSIONS 사용
  const defaultPaths = DEFAULT_PERMISSIONS[teacherPosition];
  if (defaultPaths.includes('*')) return true;
  return sortedDefaultPaths.some(dp => pagePath.startsWith(dp));
}
```

## 시나리오 1: 부원장 (vice_principal)

### Case 1-1: DB에 권한 전혀 없음
```
teacherPosition = 'vice_principal'
positionPermissions = []
hasPositionPermissionsInDB = false

→ 4단계로 이동
→ defaultPaths = ['*']
→ defaultPaths.includes('*') = true
→ return true ✅
```

**결과**: 모든 페이지 접근 가능

### Case 1-2: DB에 일부 권한 있음
```
teacherPosition = 'vice_principal'
positionPermissions = [
  { page_path: '/home', can_access: true },
  { page_path: '/students', can_access: true }
]
hasPositionPermissionsInDB = true

pagePath = '/classes'
→ 3-1단계: permission = undefined (매칭 없음)
→ 3-1-2단계: fallback
→ 4단계로 이동
→ defaultPaths = ['*']
→ return true ✅
```

**결과**: DB에 없는 경로도 DEFAULT_PERMISSIONS로 접근 가능

## 시나리오 2: 실장 (manager)

부원장과 동일 (`['*']`)

## 시나리오 3: 선생님 (teacher)

### Case 3-1: DB에 권한 전혀 없음
```
teacherPosition = 'teacher'
positionPermissions = []
hasPositionPermissionsInDB = false

pagePath = '/classes'
→ 4단계로 이동
→ defaultPaths = ['/home', '/students', '/attendance', '/classes', '/notifications', '/ai', '/manual']
→ sortedDefaultPaths.some(dp => '/classes'.startsWith(dp))
→ '/classes'.startsWith('/classes') = true
→ return true ✅
```

**결과**: 기본 권한 7개 페이지 접근 가능

### Case 3-2: DB에 일부 권한 있음 (현재 상황)
```
teacherPosition = 'teacher'
positionPermissions = [
  { page_path: '/home', can_access: true },
  { page_path: '/students', can_access: true },
  { page_path: '/attendance', can_access: true },
  { page_path: '/notifications', can_access: true },
  { page_path: '/analytics', can_access: false },
  { page_path: '/teachers', can_access: false },
  { page_path: '/billing', can_access: false },
  { page_path: '/agent', can_access: true },
  { page_path: '/ai', can_access: false }
]
hasPositionPermissionsInDB = true

--- /classes 접근 시 ---
pagePath = '/classes'
→ 3-1단계: sortedPermissions.find(p => '/classes'.startsWith(p.page_path))
→ '/classes'.startsWith('/notifications')? NO
→ '/classes'.startsWith('/attendance')? NO
→ '/classes'.startsWith('/analytics')? NO
→ '/classes'.startsWith('/students')? NO
→ '/classes'.startsWith('/teachers')? NO
→ '/classes'.startsWith('/billing')? NO
→ '/classes'.startsWith('/agent')? NO
→ '/classes'.startsWith('/home')? NO
→ '/classes'.startsWith('/ai')? NO
→ permission = undefined
→ 3-1-2단계: fallback
→ 4단계로 이동
→ defaultPaths.some(dp => '/classes'.startsWith(dp))
→ '/classes'.startsWith('/classes') = true
→ return true ✅
```

**결과**: DB에 없는 `/classes`는 DEFAULT_PERMISSIONS로 접근 가능

### Case 3-3: DB에 명시적으로 거부
```
positionPermissions = [
  { page_path: '/teachers', can_access: false }
]

pagePath = '/teachers'
→ 3-1단계: permission = { page_path: '/teachers', can_access: false }
→ return false ❌
```

**결과**: DB에 명시적으로 `false`면 차단

### Case 3-4: 학생관리 하위 경로 접근
```
positionPermissions = [
  { page_path: '/students', can_access: true }
]

pagePath = '/students/list'
→ 3-1단계: '/students/list'.startsWith('/students') = true
→ permission = { page_path: '/students', can_access: true }
→ return true ✅
```

**결과**: 상위 경로 권한으로 하위 경로 접근 가능

## 시나리오 4: 조교 (assistant)

### Case 4-1: DB에 권한 없음
```
teacherPosition = 'assistant'
positionPermissions = []

pagePath = '/students/list'
→ 4단계로 이동
→ defaultPaths = ['/home', '/attendance', '/manual']
→ '/students/list'.startsWith('/home')? NO
→ '/students/list'.startsWith('/attendance')? NO
→ '/students/list'.startsWith('/manual')? NO
→ return false ❌
```

**결과**: 기본 권한 3개만 접근 가능

### Case 4-2: DB에 추가 권한 부여
```
teacherPosition = 'assistant'
positionPermissions = [
  { page_path: '/students', can_access: true }
]

pagePath = '/students/list'
→ 3-1단계: '/students/list'.startsWith('/students') = true
→ permission = { page_path: '/students', can_access: true }
→ return true ✅
```

**결과**: DB에서 추가로 권한을 부여할 수 있음

## 시나리오 5: 기타 (other)

선생님과 유사하지만 `/ai` 권한 없음
```
defaultPaths = ['/home', '/students', '/attendance', '/classes', '/notifications', '/manual']
```

## 잠재적 문제점 분석

### ✅ 정상 동작
1. DB에 권한 없음 → DEFAULT_PERMISSIONS 사용
2. DB에 일부 권한 → DB 우선, 없으면 DEFAULT_PERMISSIONS
3. DB에 명시적 거부 → DB 값 사용 (차단)
4. 상위 경로 권한 → 하위 경로 접근 가능 (`startsWith`)

### ⚠️ 주의사항

#### 1. 경로 순서 중요
```
DB에 다음 두 권한이 있을 때:
- '/students' → true
- '/students/list' → false

pagePath = '/students/list'
→ sortedPermissions (길이순 정렬):
  1. '/students/list' (길이 14)
  2. '/students' (길이 9)
→ '/students/list'.startsWith('/students/list') = true
→ permission = { page_path: '/students/list', can_access: false }
→ return false ❌ (정상)
```

더 구체적인 경로가 우선 매칭되므로 **정상 동작**

#### 2. 경로 프리픽스 문제
```
DB: '/home' → true
pagePath = '/homework'
→ '/homework'.startsWith('/home') = true
→ return true ❌ (의도하지 않은 동작)
```

**해결 방법**: 경로는 항상 `/`로 끝나거나, 정확한 매칭 확인 필요

하지만 현재 시스템에는 이런 충돌 경로가 없으므로 **문제 없음**

#### 3. DEFAULT_PERMISSIONS 중복 정의
현재 3곳에 정의됨:
- `App.tsx` (사이드바 필터링)
- `RoleBasedRoute.tsx` (라우트 접근 제어)
- `useRolePermissions.ts` (공통 정의)

**개선 방안**: 중앙 집중식 관리 필요

## 결론

### ✅ 현재 구현 상태
모든 직급에 대해 **로직이 정확하게 동작**합니다.

### 검증 완료
1. 부원장/실장: `['*']` → 모든 접근 가능
2. 선생님: 7개 경로 기본 권한, DB fallback 정상
3. 조교: 3개 경로만 기본 권한
4. 기타: 6개 경로 기본 권한

### 권장 사항
1. DEFAULT_PERMISSIONS를 `useRolePermissions.ts`에서만 export하고, 다른 곳에서 import 사용
2. 디버그 로그 제거 (프로덕션 배포 전)
3. 각 직급별 실제 사용자 테스트 수행
