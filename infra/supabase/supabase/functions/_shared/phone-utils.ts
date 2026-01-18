// LAYER: EDGE_FUNCTION_SHARED
/**
 * 전화번호 정규화 유틸리티
 *
 * [불변 규칙] 모든 전화번호는 이 함수를 통해 정규화되어야 함
 * [불변 규칙] 저장/표시 시 항상 하이픈(-) 포함 형식 사용
 * [불변 규칙] 에이전트 모드 입력도 이 함수로 정규화
 */

/**
 * 전화번호 정규화 (한국 표준 형식으로 변환) (SSOT)
 *
 * @param phone 전화번호 (다양한 형식 허용: 01029484417, 010-2948-4417 등)
 * @returns 표준 형식 전화번호 (010-2948-4417, 02-1234-5678 등) 또는 null
 *
 * @example
 * ```typescript
 * normalizePhoneNumber('01029484417') // → '010-2948-4417'
 * normalizePhoneNumber('010-2948-4417') // → '010-2948-4417'
 * normalizePhoneNumber('0212345678') // → '02-1234-5678'
 * normalizePhoneNumber('02-1234-5678') // → '02-1234-5678'
 * normalizePhoneNumber('031-123-4567') // → '031-123-4567'
 * normalizePhoneNumber('') // → null
 * normalizePhoneNumber(null) // → null
 * ```
 *
 * @remarks
 * 지원 형식:
 * - 휴대폰: 010/011/016/017/018/019 (10자리 또는 11자리)
 * - 서울: 02 (9자리 또는 10자리)
 * - 지역번호: 031/032/033/041/042/043/051/052/053/054/055/061/062/063/064 (10자리 또는 11자리)
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');

  if (!digits) return null;

  // 휴대폰 (010, 011, 016, 017, 018, 019)
  if (/^01[016789]/.test(digits)) {
    if (digits.length === 10) {
      // 구형 휴대폰 (예: 0161234567 → 016-123-4567)
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11) {
      // 신형 휴대폰 (예: 01012345678 → 010-1234-5678)
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
  }

  // 서울 지역번호 (02)
  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      // 02-123-4567
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    } else if (digits.length === 10) {
      // 02-1234-5678
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  // 기타 지역번호 (031, 032, 033, 041, 042, 043, 051, 052, 053, 054, 055, 061, 062, 063, 064)
  if (/^0(3[1-3]|4[1-3]|5[1-5]|6[1-4])/.test(digits)) {
    if (digits.length === 10) {
      // 031-123-4567
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11) {
      // 031-1234-5678
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
  }

  // 형식을 알 수 없는 경우 원본 반환 (하이픈 제거된 상태)
  return digits;
}
