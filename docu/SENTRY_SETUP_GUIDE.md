# Sentry 설정 가이드

**목적**: Sentry를 사용하여 프론트엔드 에러를 자동으로 수집하고 Performance Monitoring 페이지에 표시

---

## 📋 현재 상태

### ✅ 이미 완료된 것
- Sentry Auth Token 발급됨 (organization: `rutz`)
- Academy Admin Sentry 초기화 코드 구현됨
- Super Admin Sentry 초기화 코드 구현됨
- logger-utils.ts Sentry 통합 완료
- sync-sentry-errors Edge Function 배포 완료
- frontend_error_logs 테이블 생성됨

### ⚠️ 필요한 작업
1. Sentry 프로젝트 2개 생성 (Academy Admin, Super Admin)
2. Auth Token 권한 업그레이드 (`project:read`, `project:write` 추가)
3. DSN 복사 및 환경 변수 설정
4. Edge Function 환경 변수 설정

---

## 🔧 Step-by-Step 설정

### Step 1: Sentry 프로젝트 생성

#### 1-1. Sentry 웹사이트 접속
```
https://sentry.io
로그인 → Organization: rutz 선택
```

#### 1-2. 첫 번째 프로젝트 생성 (Academy Admin)

1. **Projects** 메뉴 클릭
2. **Create Project** 버튼 클릭
3. 다음과 같이 설정:

```
Platform: React
Project Name: samdle-academy-admin
Team: (기본값 또는 선택)
Alert frequency: On every new issue (권장)
```

4. **Create Project** 클릭

#### 1-3. 두 번째 프로젝트 생성 (Super Admin)

위와 동일하게 반복하되:
```
Project Name: samdle-super-admin
```

---

### Step 2: DSN (Data Source Name) 복사

#### 2-1. Academy Admin DSN

1. **Projects** → **samdle-academy-admin** 클릭
2. **Settings** → **Client Keys (DSN)** 클릭
3. DSN 값 복사 (예: `https://abc123@o123456.ingest.sentry.io/456789`)

#### 2-2. Super Admin DSN

위와 동일하게 **samdle-super-admin** 프로젝트에서 DSN 복사

---

### Step 3: Auth Token 재생성 (권한 추가)

**현재 Token 권한**: `org:ci` (부족)
**필요한 권한**: `project:read`, `project:write`, `org:read`

#### 3-1. 새 Token 생성

1. **Settings** → **Developer Settings** → **Auth Tokens**
2. **Create New Token** 클릭
3. Token 설정:

```
Name: monitoring-sentry-token
Scopes:
  ✅ project:read
  ✅ project:write
  ✅ org:read
```

4. **Create Token** 클릭
5. **생성된 Token 즉시 복사** (다시 볼 수 없음!)

#### 3-2. 프로젝트 Slug 확인

프로젝트 URL을 보면:
```
https://sentry.io/organizations/rutz/projects/samdle-academy-admin/
                                      ↑                ↑
                                   SENTRY_ORG    SENTRY_PROJECT
```

- **SENTRY_ORG**: `rutz`
- **SENTRY_PROJECT**: `samdle-academy-admin` (또는 `samdle-super-admin`)

---

### Step 4: 환경 변수 설정

#### 4-1. 프론트엔드 환경 변수

##### Academy Admin: `apps/academy-admin/.env.production`

새 파일 생성 또는 기존 파일 수정:

```env
# Sentry 설정
VITE_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/456789  # ← Step 2-1에서 복사한 DSN
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

##### Super Admin: `apps/super-admin/.env.production`

```env
# Sentry 설정
VITE_SENTRY_DSN=https://def456@o123456.ingest.sentry.io/789012  # ← Step 2-2에서 복사한 DSN
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

#### 4-2. Edge Function 환경 변수 (Supabase)

**방법 1: CLI 사용 (권장)**

```bash
cd infra/supabase

supabase secrets set --project-ref xawypsrotrfoyozhrsbb \
  SENTRY_AUTH_TOKEN="sntrys_새로_생성한_토큰" \
  SENTRY_ORG="rutz" \
  SENTRY_PROJECT="samdle-academy-admin"
```

**방법 2: 스크립트 사용**

1. `sentry-setup.sh` 파일 열기
2. 다음 값 수정:
   ```bash
   SENTRY_AUTH_TOKEN="sntrys_새로_생성한_토큰"  # Step 3-1에서 복사
   SENTRY_ORG="rutz"
   SENTRY_PROJECT="samdle-academy-admin"  # 또는 samdle-super-admin
   ```
3. 스크립트 실행:
   ```bash
   bash sentry-setup.sh
   ```

**확인**:
```bash
supabase secrets list --project-ref xawypsrotrfoyozhrsbb | grep SENTRY

# 출력 예시:
# SENTRY_AUTH_TOKEN  | xxxxxxxxxxxxx
# SENTRY_ORG         | xxxxxxxxxxxxx
# SENTRY_PROJECT     | xxxxxxxxxxxxx
```

---

### Step 5: 테스트

#### 5-1. 프론트엔드 에러 발생시키기

**Academy Admin에서**:
```typescript
// 개발자 도구 콘솔에서 실행
throw new Error('Sentry Test Error from Academy Admin');
```

**Super Admin에서**:
```typescript
// 개발자 도구 콘솔에서 실행
throw new Error('Sentry Test Error from Super Admin');
```

#### 5-2. Sentry에서 확인

1. https://sentry.io 접속
2. **Issues** 메뉴 클릭
3. 방금 발생시킨 에러가 표시되는지 확인

#### 5-3. Performance Monitoring 페이지에서 확인

1. Super Admin 앱 실행
2. **Performance Monitoring** 페이지 접속
3. **Overview** 탭에서 **Frontend Errors Card** 확인
4. 5분 후 (Cron Job 실행 후) 에러가 표시되는지 확인

---

## 🔍 문제 해결

### 문제 1: DSN을 찾을 수 없음

**해결**:
1. Sentry → Projects → (프로젝트 선택)
2. Settings → Client Keys (DSN)
3. DSN 섹션에서 복사

### 문제 2: Auth Token 권한 부족

**에러**:
```
{"detail":"You do not have permission to perform this action."}
```

**해결**:
- Step 3에서 새 Token을 생성하고 `project:read`, `project:write` 권한 추가

### 문제 3: Edge Function에서 Sentry 에러를 가져오지 못함

**확인 사항**:
1. 환경 변수 확인:
   ```bash
   supabase secrets list --project-ref xawypsrotrfoyozhrsbb | grep SENTRY
   ```
2. Edge Function 로그 확인:
   ```sql
   SELECT * FROM get_logs('edge-function')
   WHERE function_name = 'sync-sentry-errors'
   ORDER BY timestamp DESC LIMIT 10;
   ```
3. Cron Job 실행 이력 확인:
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = 25
   ORDER BY start_time DESC LIMIT 5;
   ```

### 문제 4: Frontend Errors Card에 데이터가 표시되지 않음

**가능한 원인**:
1. **Sentry에 에러가 없음** → Step 5-1에서 테스트 에러 발생시키기
2. **Cron Job이 아직 실행되지 않음** → 최대 5분 대기
3. **Edge Function 환경 변수 미설정** → Step 4-2 확인
4. **Auth Token 권한 부족** → Step 3 확인

---

## 📊 예상 결과

### Sentry Issues 페이지
```
Unresolved Issues (3)

❌ Error: Sentry Test Error from Academy Admin
   Last seen: Just now
   Count: 1

❌ TypeError: Cannot read property 'user' of null
   Last seen: 2 minutes ago
   Count: 5

❌ NetworkError: Failed to fetch
   Last seen: 10 minutes ago
   Count: 12
```

### Performance Monitoring 페이지 (Frontend Errors Card)
```
Frontend Errors

Status: ⚠️ Warning (3 errors)

Recent Errors:
1. Cannot read property 'user' of null
   Component: UserProfile | Count: 5 | Level: error
   Last seen: 2 minutes ago

2. Failed to fetch
   Component: API | Count: 12 | Level: error
   Last seen: 10 minutes ago

3. Sentry Test Error from Academy Admin
   Component: Unknown | Count: 1 | Level: error
   Last seen: Just now
```

---

## ✅ 완료 체크리스트

### Sentry 웹사이트
- [ ] Organization `rutz` 접속 확인
- [ ] `samdle-academy-admin` 프로젝트 생성
- [ ] `samdle-super-admin` 프로젝트 생성
- [ ] Academy Admin DSN 복사
- [ ] Super Admin DSN 복사
- [ ] Auth Token 재생성 (`project:read`, `project:write` 권한)

### 환경 변수 설정
- [ ] `apps/academy-admin/.env.production` 생성 및 DSN 설정
- [ ] `apps/super-admin/.env.production` 생성 및 DSN 설정
- [ ] Edge Function 환경 변수 설정 (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)

### 테스트
- [ ] Academy Admin에서 테스트 에러 발생
- [ ] Super Admin에서 테스트 에러 발생
- [ ] Sentry Issues 페이지에서 에러 확인
- [ ] Performance Monitoring 페이지에서 에러 표시 확인 (5분 후)

---

## 🎯 최종 확인

모든 설정이 완료되면:

1. **Sentry에 에러가 자동으로 수집됨**
   - 프로덕션 환경에서 발생하는 모든 에러가 Sentry로 전송
   - logger-utils.ts의 `logError()`, `logWarn()` 함수 사용 시 자동 전송

2. **Performance Monitoring 페이지에서 확인 가능**
   - 5분마다 Sentry API에서 최신 에러 가져옴
   - Frontend Errors Card에 표시
   - 에러 개수, 컴포넌트, 레벨 등 자세한 정보 제공

3. **실시간 알림 받기 (선택)**
   - Sentry → Settings → Alerts
   - 에러 발생 시 이메일/Slack 알림 설정

---

## 📚 참고 문서

- [Sentry React 가이드](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Auth Tokens](https://docs.sentry.io/api/auth/)
- [Sentry Issues API](https://docs.sentry.io/api/events/list-a-projects-issues/)

---

**설정 중 문제가 발생하면 이 문서의 "문제 해결" 섹션을 참고하세요!**
