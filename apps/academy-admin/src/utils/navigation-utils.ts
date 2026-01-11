/**
 * 네비게이션 보안 유틸리티 (SSOT)
 *
 * [불변 규칙] 모든 네비게이션 경로 검증은 이 파일의 함수를 통해서만 수행
 * [불변 규칙] 오픈 리다이렉트 방지: 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
 *
 * P0 보안: 서버/DB/정책에서 온 action_url은 반드시 이 함수로 검증해야 합니다.
 */

import type { NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../constants';

/**
 * 내부 경로 검증 함수 (P0-3: 인코딩/정규화 우회 방지)
 *
 * SSOT 원칙: 모든 경로 검증은 이 함수를 통해서만 수행
 * 하드코딩된 문자열 패턴 검사 대신 이 함수를 사용하세요.
 *
 * @param target 이동할 경로
 * @returns 내부 경로인지 여부
 *
 * @example
 * ```typescript
 * import { isSafeInternalPath } from '../utils';
 * if (isSafeInternalPath(target)) {
 *   navigate(target);
 * }
 * ```
 */
export function isSafeInternalPath(target: string): boolean {
  if (typeof target !== 'string' || target.length === 0) {
    return false;
  }

  try {
    // [P0-3 수정] URL 인코딩/디코딩 정규화 후 검사
    // decodeURIComponent로 인코딩된 문자를 디코딩하여 우회 시도 방지
    // 이중 인코딩 우회 방지: 여러 번 디코딩하여 %252f 같은 케이스도 차단
    let decoded = target;
    let prevDecoded = '';
    // 최대 10번까지 디코딩 (이중/삼중 인코딩 우회 방지)
    for (let i = 0; i < 10 && decoded !== prevDecoded; i++) {
      prevDecoded = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // 디코딩 실패 시 이전 값 사용
        decoded = prevDecoded;
        break;
      }
    }

    // [P0-3 수정] 정규화: 공백/제어문자 제거 및 경로 정규화
    // eslint-disable-next-line no-control-regex
    const normalized = decoded.trim().replace(/[\x00-\x1F\x7F]/g, ''); // 제어문자 제거

    // [P0-3 수정] 스킴 기반 공격 차단: javascript:, data:, vbscript: 등
    const lowerNormalized = normalized.toLowerCase();
    if (lowerNormalized.includes('javascript:') ||
        lowerNormalized.includes('data:') ||
        lowerNormalized.includes('vbscript:') ||
        lowerNormalized.includes('file:') ||
        lowerNormalized.includes('about:')) {
      return false;
    }

    // 기본 검증: 내부 경로만 허용
    if (!normalized.startsWith('/')) {
      return false;
    }

    // [P0-3 수정] 외부 URL 패턴 차단: scheme-relative (//evil.com) 및 절대 URL (http://, https://)
    if (normalized.startsWith('//') || normalized.includes('://')) {
      return false;
    }

    // [P0-3 수정] 추가 보안: 백슬래시, 이상 케이스 차단
    if (normalized.includes('\\') || normalized.includes('..')) {
      return false;
    }

    // [P0-3 수정] ROUTES whitelist 매칭 (가장 안전)
    // ROUTES 객체의 모든 값과 비교하여 허용된 경로만 통과
    const routeValues = Object.values(ROUTES);
    const isWhitelisted = routeValues.some((route) => {
      if (typeof route === 'string') {
        // 정확히 일치하거나 하위 경로인지 확인
        return normalized === route || normalized.startsWith(route + '/') || normalized.startsWith(route + '?');
      }
      // 함수형 ROUTES는 동적으로 생성되므로, 기본 경로 패턴만 확인
      // 예: ROUTES.STUDENT_DETAIL은 '/students/list'로 시작
      // 함수형 ROUTES는 실제 사용 시에만 생성되므로, 여기서는 기본 경로 패턴으로만 확인
      // 향후 개선: 함수형 ROUTES의 기본 경로를 추출하여 패턴 매칭
      return false;
    });

    // [P0-3 수정] 기본 경로 패턴 매칭 (함수형 ROUTES 지원)
    // ROUTES의 기본 경로 패턴만 추출하여 매칭
    const baseRoutePatterns = [
      '/',
      '/home',
      '/students',
      '/customers', // 업종별 경로 (salon, nail_salon)
      '/clients', // 업종별 경로 (real_estate)
      '/members', // 업종별 경로 (gym)
      '/attendance',
      '/appointments', // 업종별 경로 (salon, nail_salon, real_estate)
      '/billing',
      '/classes',
      '/teachers',
      '/staff', // 업종별 경로 (salon, nail_salon)
      '/agents', // 업종별 경로 (real_estate)
      '/notifications',
      '/analytics',
      '/ai',
      '/settings',
      '/agent', // 에이전트 모드 전용 라우트
      '/auth', // 인증 관련 라우트
      '/kiosk-check-in', // 키오스크 체크인
      '/super-admin', // 슈퍼 어드민
      '/manual', // 매뉴얼 페이지
    ];
    const matchesBasePattern = baseRoutePatterns.some((pattern) => {
      return normalized === pattern || normalized.startsWith(pattern + '/') || normalized.startsWith(pattern + '?');
    });

    // whitelist 또는 기본 패턴에 매칭되면 허용
    // 향후 더 엄격하게 하려면: return isWhitelisted;
    return isWhitelisted || matchesBasePattern;
  } catch (error) {
    // decodeURIComponent 실패 시 Fail Closed
    return false;
  }
}

/**
 * 안전한 네비게이션 래퍼 함수 (P0-2: 단일 게이트 SSOT)
 *
 * SSOT 원칙: 모든 네비게이션은 이 함수를 통해서만 수행
 * navigate() 직접 호출 대신 이 함수를 사용하세요.
 *
 * @param navigate React Router navigate 함수
 * @returns 안전한 네비게이션 함수
 *
 * @example
 * ```typescript
 * import { createSafeNavigate } from '../utils';
 * const safeNavigate = createSafeNavigate(navigate);
 * safeNavigate('/students/list');
 * ```
 */
export function createSafeNavigate(navigate: NavigateFunction): NavigateFunction {
  const safeNavigate: NavigateFunction = (
    (to: string | number | { pathname?: string; search?: string; hash?: string }, options?: { replace?: boolean; state?: unknown }) => {
      // NavigateFunction은 두 가지 오버로드를 가짐:
      // 1. navigate(to: To, options?: NavigateOptions)
      // 2. navigate(delta: number)
      // 숫자는 히스토리 이동이므로 검증하지 않고 그대로 전달
      if (typeof to === 'number') {
        navigate(to);
        return;
      }

      // NavigateFunction 타입 호환성을 위해 to를 string으로 변환하여 검증
      const target = typeof to === 'string' ? to : (to?.pathname || '');
      if (target && isSafeInternalPath(target)) {
        navigate(to as string, options);
      }
      // 외부 URL 또는 잘못된 형식은 무시 (Fail Closed)
    }
  ) as NavigateFunction;
  return safeNavigate;
}

