# 보안 개선 사항

## 완료된 개선 사항

### 1. SECURITY DEFINER View 수정 (Critical)
**마이그레이션:** `20260123_fix_security_definer_views`

다음 4개 View를 `SECURITY INVOKER`로 변경:
- `daily_region_metrics`
- `daily_store_metrics`
- `schema_registry`
- `student_task_cards`

### 2. RLS 정책 누락 테이블 수정 (Critical)
**마이그레이션:** `20260123_add_rls_policies_payments_products_settlements`

다음 3개 테이블에 RLS 정책 추가:
- `payments` - SELECT/INSERT/UPDATE/DELETE 정책
- `products` - SELECT/INSERT/UPDATE/DELETE 정책
- `settlements` - SELECT/INSERT/UPDATE/DELETE 정책 (admin 전용)

### 3. Function search_path 고정 (Warning)
**마이그레이션:**
- `20260123_fix_function_search_path_part1`
- `20260123_fix_function_search_path_part2`
- `20260123_fix_function_search_path_part3`

80+ 함수에 `SET search_path = public` 적용하여 SQL 인젝션 방지

---

## 수동 설정 필요 항목

### 4. Leaked Password Protection 활성화 (Warning)

**설정 위치:** Supabase Dashboard > Authentication > Settings > Security

**설정 방법:**
1. Supabase 대시보드 접속
2. Authentication > Settings 이동
3. "Security" 섹션에서 "Leaked Password Protection" 활성화
4. Save 클릭

**효과:** HaveIBeenPwned.org 데이터베이스를 통해 유출된 비밀번호 사용 방지

**문서:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 추가 권장 사항 (낮은 우선순위)

### 5. teacher_registration_requests 테이블 RLS 검토
**상태:** 의도적 설계
현재 `INSERT` 정책이 `WITH CHECK (true)`로 설정되어 있어 모든 사용자가 등록 요청 가능.
이는 외부 강사가 스스로 등록 요청을 제출할 수 있도록 의도된 설계임.

### 6. regional_metrics_daily Materialized View API 노출
**상태:** 낮은 위험
Materialized View `regional_metrics_daily`가 API에 노출됨.
이 View는 집계된 통계 데이터만 포함하며, RLS가 적용되지 않는 Materialized View 특성상 의도된 동작임.
필요시 별도의 RPC 함수로 래핑하여 접근 제어 가능.

---

## 현재 보안 상태 요약

| 항목 | 상태 | 레벨 |
|------|------|------|
| SECURITY DEFINER Views | ✅ 해결됨 | Critical |
| RLS 정책 누락 테이블 | ✅ 해결됨 | Critical |
| Function search_path | ✅ 해결됨 | High |
| Leaked Password Protection | ⚠️ 수동 설정 필요 | Warning |
| teacher_registration_requests INSERT | ℹ️ 의도적 설계 | Info |
| regional_metrics_daily API 노출 | ℹ️ 낮은 위험 | Info |

**마지막 보안 점검:** 2026-01-23
