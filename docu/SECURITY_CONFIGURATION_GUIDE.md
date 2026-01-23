# 🔒 보안 설정 가이드

## 개요

즉시 적용해야 할 보안 설정을 안내합니다.

---

## ✅ 완료된 항목

### 1. Function Search Path 보안 강화 ✅
- **상태**: 완료 (마이그레이션 적용됨)
- **내용**: `disable_worker_cron_job()`, `register_all_monitoring_cron_jobs()` 함수에 `SET search_path` 추가
- **효과**: SQL Injection 공격 방지

### 2. 환경 변수 보안 강화 ✅
- **상태**: 완료 (`.gitignore` 업데이트)
- **내용**: `*.env.*` 패턴을 `.gitignore`에 추가
- **효과**: 실수로 환경 변수 파일이 Git에 커밋되는 것 방지

### 3. 마이그레이션 파일 정리 ✅
- **상태**: 완료 (57개 Conflict 파일 백업)
- **내용**: `*Conflict*` 마이그레이션 파일을 `migrations-backup/`로 이동
- **효과**: 프로덕션 배포 시 중복 마이그레이션 실행 방지

---

## ⚠️ 수동 설정 필요 항목

### 4. Auth Leaked Password Protection 활성화 (필수)

Supabase는 [HaveIBeenPwned.org](https://haveibeenpwned.com/)를 통해 유출된 비밀번호를 차단할 수 있습니다.

**현재 상태**: ❌ 비활성화됨
**위험도**: Medium
**영향**: 유출된 비밀번호로 계정 생성 가능

#### 설정 방법

1. **Supabase Dashboard 접속**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Authentication → Policies로 이동**

3. **"Password Strength" 섹션에서 다음 설정 활성화**
   - ✅ **Enable password leak protection**
   - Minimum password length: `8` (기본값 유지 또는 조정)
   - Require uppercase letters: 선택 사항
   - Require lowercase letters: 선택 사항
   - Require numbers: 선택 사항
   - Require special characters: 선택 사항

4. **Save 클릭**

#### 검증

```typescript
// 테스트: 유출된 비밀번호로 회원가입 시도
const { error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123', // 유출된 비밀번호 (차단되어야 함)
});

console.log(error?.message);
// 예상 결과: "Password has been found in a data breach"
```

---

### 5. Materialized View RLS 정책 추가 (권장)

**현재 상태**: `regional_metrics_daily` materialized view가 `anon`/`authenticated` 역할에 노출됨
**위험도**: Low-Medium
**영향**: 테넌트 경계를 넘어 집계 데이터에 무단 접근 가능

#### 옵션 1: RLS 정책 추가 (권장)

```sql
-- 1. RLS 활성화
ALTER MATERIALIZED VIEW regional_metrics_daily ENABLE ROW LEVEL SECURITY;

-- 2. Tenant 격리 정책
CREATE POLICY "Users can only view their tenant's regional metrics"
  ON regional_metrics_daily
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_platform_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
```

#### 옵션 2: API 노출 제거 (간단)

```sql
-- Materialized View를 PostgREST API에서 숨김
REVOKE SELECT ON regional_metrics_daily FROM anon, authenticated;
GRANT SELECT ON regional_metrics_daily TO service_role;
```

**권장**: 옵션 1 (RLS 정책 추가) - 테넌트별 접근 제어 유지

---

## 🎯 적용 순서 (우선순위)

### Phase 1: 즉시 (오늘) ✅ 완료
1. ✅ Function Search Path 수정
2. ✅ 환경 변수 보안 강화
3. ✅ 마이그레이션 정리

### Phase 2: 이번 주 내 (수동 설정)
4. ⚠️ **Auth Leaked Password Protection 활성화** ← **지금 진행**
5. ⚠️ Materialized View RLS 정책 추가 (선택 사항)

---

## 🔍 보안 검증 체크리스트

### Database
- [x] Function Search Path 설정 완료
- [ ] Auth Leaked Password Protection 활성화
- [ ] Materialized View RLS 정책 (선택)
- [x] 모든 테이블에 RLS 활성화 확인

### Environment
- [x] `.gitignore`에 `*.env.*` 추가
- [ ] 프로덕션 환경 변수에 Service Role Key 미포함 확인
- [ ] `.env.local` 파일이 Git 추적되지 않는지 확인

### Code
- [x] API SDK를 통한 데이터 접근 강제
- [x] Rate Limiting 활성화
- [x] Input Validation (Zod)

---

## 📚 참고 자료

- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [HaveIBeenPwned Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 🚨 긴급 연락

보안 취약점 발견 시:
1. `.env` 파일이 Git에 커밋된 경우 → 즉시 Supabase Service Role Key 재발급
2. SQL Injection 의심 → Supabase 로그 확인 (`Dashboard → Logs → Database`)
3. 비정상적인 API 호출 → Rate Limiter 로그 확인

---

**마지막 업데이트**: 2026-01-24
**담당자**: Security Team
