/**
 * 한국 전화번호를 입력 중에도 자연스럽게 하이픈 포맷으로 변환합니다.
 *
 * - 숫자/하이픈/공백 등 어떤 입력이 들어와도 숫자만 추출 후 포맷
 * - 휴대폰(010 등)과 지역번호(02/0xx/050x 등)를 길이에 따라 동적으로 처리
 * - 하드코딩된 특정 번호 매핑 없이 prefix 길이와 남은 자리수로 계산
 *
 * 예)
 * - 01029484417 -> 010-2948-4417
 * - 0212345678  -> 02-1234-5678
 * - 0311234567  -> 031-123-4567
 */
export function formatKoreanPhoneNumber(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';

  // 1) prefix(지역/서비스/휴대폰) 길이 결정
  let prefixLen = 0;
  if (digits.startsWith('02')) {
    prefixLen = 2;
  } else if (digits.startsWith('050') && digits.length >= 4) {
    // 050x(안심번호/인터넷전화 계열 등) -> 4자리 prefix로 취급
    prefixLen = 4;
  } else if (digits.startsWith('0') && digits.length >= 3) {
    // 0xx(지역번호/휴대폰/070 등)
    prefixLen = 3;
  } else {
    // 국가코드(+82) 등은 본 시스템 범위 밖: 숫자만 반환
    return digits;
  }

  if (digits.length <= prefixLen) return digits;

  const prefix = digits.slice(0, prefixLen);
  const rest = digits.slice(prefixLen);

  // 2) 나머지가 4자리 이하면 prefix-rest
  if (rest.length <= 4) {
    return `${prefix}-${rest}`;
  }

  // 3) 마지막 4자리는 고정, 중간은 남은 길이만큼(3~4자리) 동적 계산
  const tail = rest.slice(-4);
  const middle = rest.slice(0, rest.length - 4);
  return `${prefix}-${middle}-${tail}`;
}


