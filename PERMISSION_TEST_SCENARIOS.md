# 직급별 권한 검증 시나리오

## 테스트 대상 경로
- `/home` - 대시보드
- `/students` 또는 `/students/list` - 학생관리
- `/attendance` - 출결관리
- `/classes` - 수업관리
- `/teachers` - 강사관리
- `/billing` 또는 `/billing/home` - 수납관리
- `/notifications` - 문자발송
- `/analytics` - 통계분석
- `/ai` - 인공지능
- `/manual` - 매뉴얼
- `/settings/automation` - 자동화 설정
- `/settings/alimtalk` - 알림톡 설정
- `/settings/permissions` - 권한 설정

## 1. 부원장 (vice_principal)

### 기본 권한 (DB 없을 때)
- ✅ 모든 페이지 접근 가능 (`['*']`)

### 예상 동작
- 모든 메뉴 표시
- 모든 페이지 접근 가능

## 2. 실장 (manager)

### 기본 권한 (DB 없을 때)
- ✅ 모든 페이지 접근 가능 (`['*']`)

### 예상 동작
- 모든 메뉴 표시
- 모든 페이지 접근 가능

## 3. 선생님 (teacher)

### 기본 권한 (DB 없을 때)
```typescript
['/home', '/students', '/attendance', '/classes', '/notifications', '/ai', '/manual']
```

### 예상 동작
#### ✅ 접근 가능
- `/home` - 대시보드
- `/students/list` - 학생관리 (startsWith '/students')
- `/attendance` - 출결관리
- `/classes` - 수업관리
- `/notifications` - 문자발송
- `/ai` - 인공지능
- `/manual` - 매뉴얼

#### ❌ 접근 불가
- `/teachers` - 강사관리
- `/billing/home` - 수납관리
- `/analytics` - 통계분석
- `/settings/automation` - 자동화 설정
- `/settings/alimtalk` - 알림톡 설정
- `/settings/permissions` - 권한 설정

### DB에 일부 권한만 있는 경우 (현재 상황)
DB에 저장된 9개:
- `/home` ✅
- `/students` ✅
- `/attendance` ✅
- `/notifications` ✅
- `/analytics` ❌
- `/teachers` ❌
- `/billing` ❌
- `/agent` ✅
- `/ai` ❌

DB에 없는 경로:
- `/classes` → DEFAULT_PERMISSIONS fallback → ✅ 접근 가능
- `/manual` → DEFAULT_PERMISSIONS fallback → ✅ 접근 가능

## 4. 조교 (assistant)

### 기본 권한 (DB 없을 때)
```typescript
['/home', '/attendance', '/manual']
```

### 예상 동작
#### ✅ 접근 가능
- `/home` - 대시보드
- `/attendance` - 출결관리
- `/manual` - 매뉴얼

#### ❌ 접근 불가
- `/students/list` - 학생관리
- `/classes` - 수업관리
- `/teachers` - 강사관리
- `/billing/home` - 수납관리
- `/notifications` - 문자발송
- `/analytics` - 통계분석
- `/ai` - 인공지능
- `/settings/**` - 모든 설정

## 5. 기타 (other)

### 기본 권한 (DB 없을 때)
```typescript
['/home', '/students', '/attendance', '/classes', '/notifications', '/manual']
```

### 예상 동작
#### ✅ 접근 가능
- `/home` - 대시보드
- `/students/list` - 학생관리
- `/attendance` - 출결관리
- `/classes` - 수업관리
- `/notifications` - 문자발송
- `/manual` - 매뉴얼

#### ❌ 접근 불가
- `/teachers` - 강사관리
- `/billing/home` - 수납관리
- `/analytics` - 통계분석
- `/ai` - 인공지능
- `/settings/**` - 모든 설정

## 검증 방법

### 1. 사이드바 메뉴 표시 검증
각 직급으로 로그인 후 브라우저 콘솔에서:
```javascript
// 필터링 결과 확인
// [getSidebarItemsForRole] Teacher 필터링 결과 로그 확인
```

### 2. 라우트 접근 검증
각 경로로 직접 이동 시도:
```
http://localhost:3004/classes
http://localhost:3004/teachers
http://localhost:3004/billing
```

### 3. 기대 결과
- 권한 있는 경로: 페이지 렌더링
- 권한 없는 경로: `/home`으로 리다이렉트

## 현재 확인된 문제점

### ✅ 해결됨
1. DB에 `/classes`가 없어도 DEFAULT_PERMISSIONS fallback으로 접근 가능
2. 사이드바와 라우트 권한 로직 일치

### 🔍 추가 검증 필요
1. 각 직급별 실제 테스트 필요
2. DB 권한이 명시적으로 `false`일 때 DEFAULT_PERMISSIONS가 아닌 DB 값 사용하는지 확인
3. 경로 매칭 로직 검증 (`startsWith` 정확도)
