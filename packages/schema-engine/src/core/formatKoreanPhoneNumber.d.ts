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
export declare function formatKoreanPhoneNumber(input: string): string;
//# sourceMappingURL=formatKoreanPhoneNumber.d.ts.map