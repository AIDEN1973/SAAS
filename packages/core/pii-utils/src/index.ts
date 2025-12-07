/**
 * PII (Personally Identifiable Information) 마스???�틸리티
 * 
 * [불�? 규칙] PII 마스???�틸리티??packages/core/pii-utils???�의?�며,
 * 모든 ?�플리�??�션?�서 ?��??�게 ?�용?�니??
 * 
 * [불�? 규칙] 로그, audit.events.meta ?�에 직접 ?�름/?�화번호/?�메?�을 ?�기지 ?�습?�다.
 * 
 * [기술문서 참조]
 * - rules.md 6-2. PII 마스???�퍼 ?�용 (Critical)
 * - ?�체 기술문서.txt 19-6-1. PII 마스???�틸리티 (Critical)
 */

/**
 * ?�화번호 마스??
 * 
 * ?�시: 010-1234-5678 ??010-****-5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  // 010-1234-5678 ??010-****-5678
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * ?�메??마스??
 * 
 * ?�시: user@example.com ??u***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  // user@example.com ??u***@example.com
  return email.replace(/(^.).*(@.*$)/, '$1***$2');
}

/**
 * ?�름 마스??
 * 
 * ?�시: ?�길????????
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  // ?�길????????
  if (name.length <= 2) return name.charAt(0) + '*';
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
}

/**
 * 객체 ?�체 PII 마스??
 * 
 * 객체 ?�의 email, phone, name ?�드�??�동?�로 마스?�합?�다.
 */
export function maskPII(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // 문자?�인 경우 ?�메???�화번호 ?�턴 ?�인
  if (typeof data === 'string') {
    // ?�메??마스??
    if (data.includes('@')) {
      return maskEmail(data);
    }
    // ?�화번호 마스??(?�자?� ?�이???�함)
    if (/[\d-]/.test(data) && data.replace(/[\d-]/g, '').length === 0) {
      return maskPhone(data);
    }
    return data;
  }

  // 배열??경우 �??�소 마스??
  if (Array.isArray(data)) {
    return data.map(item => maskPII(item));
  }

  // 객체??경우 �??�드 마스??
  if (typeof data === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
      // PII ?�드 직접 마스??
      if (key === 'email' || key === 'user_email' || key === 'owner_email') {
        masked[key] = maskEmail(value as string);
      } else if (key === 'phone' || key === 'user_phone' || key === 'owner_phone') {
        masked[key] = maskPhone(value as string);
      } else if (key === 'name' || key === 'user_name' || key === 'owner_name') {
        masked[key] = maskName(value as string);
      } else {
        // 중첩 객체/배열 ?��? 처리
        masked[key] = maskPII(value);
      }
    }
    return masked;
  }

  return data;
}

