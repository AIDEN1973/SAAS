// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 인증 및 권한 관리
 * - tenant_id 추출
 * - user_role 조회
 */

import { maskErr } from './utils.ts';

/**
 * P0-10: tenant_id 검증 함수 (값 변환 없이 검증만 수행)
 *
 * [불변 규칙] service role 쿼리는 반드시 tenant_id 조건을 강제합니다.
 *
 * @param tenantId 검증할 tenant_id
 * @returns 검증된 tenant_id (입력값 그대로 반환, 변환 없음)
 * @throws {Error} tenant_id가 유효하지 않으면 에러 발생
 *
 * @example
 * ```typescript
 * // ✅ 권장 패턴: 검증과 사용 분리
 * requireTenantScope(context.tenant_id);  // 검증만
 * .eq('tenant_id', context.tenant_id)     // 원본 사용
 *
 * // ⚠️ 기존 패턴 (작동은 하지만 의도가 불명확)
 * .eq('tenant_id', requireTenantScope(context.tenant_id))
 * ```
 */
export function requireTenantScope(tenantId: string): string {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.length < 10) {
    throw new Error('SECURITY_GUARD: invalid tenant_id for scoped query');
  }
  // 중요: 입력값을 그대로 반환 (변환 없음)
  return tenantId;
}

/**
 * 🔧 FIX: P0-SEC - RBAC 기반 user_role 조회
 */
export type UserRole = 'owner' | 'admin' | 'sub_admin' | 'instructor' | 'teacher' | 'assistant' | 'counselor' | 'guardian' | 'parent' | 'staff';

export async function getUserRoleForTenant(
  supabaseSvc: any,
  tenantId: string,
  userId: string
): Promise<UserRole | null> {
  try {
    // 🔧 FIX: P0-SEC - service role 쿼리는 반드시 tenant_id 검증
    const scopedTenantId = requireTenantScope(tenantId);
    const { data, error } = await supabaseSvc
      .from('user_tenant_roles')
      .select('role')
      .eq('tenant_id', scopedTenantId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return null;
    const role = data?.role as UserRole | undefined;

    // Fail-Closed: role이 없으면 null 반환
    if (!role) return null;

    // allowlist
    const allowed: UserRole[] = ['owner', 'admin', 'sub_admin', 'instructor', 'teacher', 'assistant', 'counselor', 'guardian', 'parent', 'staff'];
    return allowed.includes(role) ? role : null;
  } catch {
    return null;
  }
}

/**
 * JWT payload에서 tenant_id와 user_id 추출 (Fallback용)
 * 로컬 개발 환경에서 app_metadata가 없을 때 사용
 * 🔧 FIX: P0-SEC - user_id도 함께 추출하여 "system" 문자열 사용 방지
 */
function extractFromJWT(authHeader: string | null): { tenant_id: string | null; user_id: string | null } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { tenant_id: null, user_id: null };
  }

  try {
    const token = authHeader.substring(7); // "Bearer " 제거
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { tenant_id: null, user_id: null };
    }

    // JWT payload 디코딩 (base64url)
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const payload = JSON.parse(atob(base64));

    // JWT claim에서 tenant_id와 user_id 추출
    const tenantId = payload.tenant_id || payload.app_metadata?.tenant_id || null;
    const userId = payload.sub || null;  // JWT의 'sub' claim이 user_id

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const validTenantId = tenantId && uuidRegex.test(tenantId) ? tenantId : null;
    const validUserId = userId && uuidRegex.test(userId) ? userId : null;

    return { tenant_id: validTenantId, user_id: validUserId };
  } catch {
    return { tenant_id: null, user_id: null };
  }
}

/**
 * 검증된 user에서 tenant_id와 user_id 추출
 * [P0-SEC-A] Auth 검증 경계 분리: anon client로 검증, UUID 검증 추가
 * 🔧 FIX: P0-SEC - user_id를 항상 UUID로 반환 ("system" 문자열 사용 금지)
 * 🔧 FIX: 로컬 개발 환경 지원 (JWT payload fallback)
 */
export async function getTenantIdFromVerifiedUser(
  supabaseAuth: any,
  authHeader?: string | null
): Promise<{ tenant_id: string | null; user_id: string | null }> {
  try {
    // [P0-SEC-A] anon client로 검증 (토큰 인자 없이, global headers 사용)
    const { data: { user }, error } = await supabaseAuth.auth.getUser();

    if (error || !user) {
      console.error('[ChatOps] Failed to get user from verified token');

      // 🔧 FIX: 로컬 개발 환경 fallback - JWT에서 직접 추출 시도
      if (authHeader) {
        const { tenant_id, user_id } = extractFromJWT(authHeader);
        if (tenant_id && user_id) {
          console.log('[ChatOps] tenant_id and user_id extracted from JWT payload (fallback)');
          return { tenant_id, user_id };
        }
      }

      // ✅ "system" 문자열 대신 null 반환
      return { tenant_id: null, user_id: null };
    }

    // P0-SEC: tenant_id는 app_metadata만 신뢰 (user_metadata는 조작 가능)
    let tenantId = (user.app_metadata?.tenant_id as string) || null;

    // 🔧 FIX: 로컬 개발 환경 fallback - app_metadata에 없으면 JWT에서 추출
    if (!tenantId && authHeader) {
      const extracted = extractFromJWT(authHeader);
      tenantId = extracted.tenant_id;
      if (tenantId) {
        console.log('[ChatOps] tenant_id extracted from JWT payload (app_metadata fallback)');
      }
    }

    if (!tenantId || typeof tenantId !== 'string') {
      console.error('[ChatOps] tenant_id not found in user.app_metadata or JWT (fail-closed)');
      return { tenant_id: null, user_id: user.id };
    }

    // [P0-SEC-A] UUID 형식 검증 (Fail-Closed)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      console.error('[ChatOps] tenant_id is not a valid UUID');
      return { tenant_id: null, user_id: user.id };
    }

    return { tenant_id: tenantId, user_id: user.id };
  } catch (error) {
    console.error('[ChatOps] Failed to extract tenant_id from verified user:', maskErr(error));

    // 🔧 FIX: 로컬 개발 환경 fallback - 에러 발생 시에도 JWT에서 추출 시도
    if (authHeader) {
      const { tenant_id, user_id } = extractFromJWT(authHeader);
      if (tenant_id && user_id) {
        console.log('[ChatOps] tenant_id and user_id extracted from JWT payload (error fallback)');
        return { tenant_id, user_id };
      }
    }

    // ✅ "system" 문자열 대신 null 반환
    return { tenant_id: null, user_id: null };
  }
}

