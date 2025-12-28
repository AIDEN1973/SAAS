/**
 * PII (Personally Identifiable Information) 마스킹 유틸리티
 *
 * [불변 규칙] Edge Functions 전용 PII 마스킹 유틸리티
 * [불변 규칙] packages/core/pii-utils와 동일한 로직을 사용합니다.
 * [불변 규칙] 로그, audit.events.meta 등에 직접 이름/전화번호/이메일을 기록하지 않습니다.
 *
 * [기술문서 참조]
 * - rules.md 6-2. PII 마스킹 헬퍼 사용 (Critical)
 * - 전체 기술문서.txt 19-6-1. PII 마스킹 유틸리티 (Critical)
 */

/**
 * 전화번호 마스킹
 *
 * 예시: 010-1234-5678 → 010-****-5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // 010-1234-5678 → 010-****-5678
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 이메일 마스킹
 *
 * 예시: user@example.com → u***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  // user@example.com → u***@example.com
  return email.replace(/(^.).*(@.*$)/, '$1***$2');
}

/**
 * 이름 마스킹
 *
 * 예시: 홍길동 → 홍*동
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  // 홍길동 → 홍*동
  if (name.length <= 2) return name.charAt(0) + '*';
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
}

/**
 * 객체 전체 PII 마스킹
 *
 * 객체 내의 email, phone, name 필드들을 자동으로 마스킹합니다.
 */
export function maskPII(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // 문자열인 경우 이메일/전화번호 패턴 확인
  if (typeof data === 'string') {
    // 이메일 마스킹
    if (data.includes('@')) {
      return maskEmail(data);
    }
    // 전화번호 마스킹(숫자와 -만 포함)
    if (/[\d-]/.test(data) && data.replace(/[\d-]/g, '').length === 0) {
      return maskPhone(data);
    }
    return data;
  }

  // 배열인 경우 각 요소 마스킹
  if (Array.isArray(data)) {
    return data.map(item => maskPII(item));
  }

  // 객체인 경우 각 필드 마스킹
  if (typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // PII 필드 직접 마스킹
      if (key === 'email' || key === 'user_email' || key === 'owner_email') {
        masked[key] = maskEmail(value as string);
      } else if (key === 'phone' || key === 'user_phone' || key === 'owner_phone') {
        masked[key] = maskPhone(value as string);
      } else if (key === 'name' || key === 'user_name' || key === 'owner_name') {
        masked[key] = maskName(value as string);
      } else {
        // 중첩 객체/배열 재귀 처리
        masked[key] = maskPII(value);
      }
    }
    return masked;
  }

  return data;
}

