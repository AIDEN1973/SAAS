/**
 * 알리고 카카오 알림톡/친구톡 클라이언트 라이브러리
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 *
 * @example
 * ```typescript
 * import { createKakaoClient } from '@samdle/aligo-kakao';
 *
 * const client = createKakaoClient({
 *   apikey: 'your-api-key',
 *   userid: 'your-user-id',
 *   senderkey: 'your-sender-key',
 *   token: 'your-token', // 프로필 인증 후 발급
 * });
 *
 * // 알림톡 발송
 * const result = await client.sendAlimtalk({
 *   senderkey: 'your-sender-key',
 *   tpl_code: 'TEMPLATE_CODE',
 *   msg_1: '안녕하세요, #{고객명}님. 예약이 확정되었습니다.',
 *   receiver_1: '01012345678',
 *   recvname_1: '홍길동',
 * });
 *
 * // SMS 폴백 포함 발송
 * const resultWithFallback = await client.sendAlimtalk({
 *   senderkey: 'your-sender-key',
 *   tpl_code: 'TEMPLATE_CODE',
 *   msg_1: '안녕하세요, #{고객명}님.',
 *   receiver_1: '01012345678',
 *   failover: 'Y',
 *   fmessage_1: '안녕하세요. 알림톡 수신이 불가하여 문자로 발송됩니다.',
 * });
 * ```
 */

// 클라이언트
export { AligoKakaoClient, createKakaoClient, normalizePhoneNumber } from './client.ts';

// 타입
export type {
  // 인증
  KakaoCredentials,
  KakaoClientOptions,

  // 공통
  KakaoMessageType,
  TemplateMessageType,
  EmphasisType,
  ButtonType,
  KakaoBaseResponse,

  // 토큰
  TokenCreateRequest,
  TokenCreateResponse,

  // 카테고리
  CategoryItem,
  CategoryListResponse,

  // 프로필
  ProfileAddRequest,
  ProfileAddResponse,
  ProfileInfo,
  ProfileListResponse,

  // 템플릿
  TemplateButton,
  TemplateInfo,
  TemplateListRequest,
  TemplateListResponse,
  TemplateAddRequest,
  TemplateAddResponse,
  TemplateModifyRequest,
  TemplateDeleteRequest,
  TemplateRequestRequest,

  // 알림톡
  AlimtalkRecipient,
  AlimtalkSendRequest,
  AlimtalkSendResponse,
  AlimtalkBulkSendRequest,

  // 친구톡
  FriendtalkSendRequest,
  FriendtalkSendResponse,

  // 내역 조회
  HistoryListRequest,
  HistoryItem,
  HistoryListResponse,
  HistoryDetailRequest,
  HistoryDetailItem,
  HistoryDetailResponse,

  // 잔여 포인트
  RemainResponse,

  // 예약 취소
  CancelRequest,
  CancelResponse,

  // 발송 결과
  SendResult,
  UnifiedSendResult,
} from './types.ts';

// 에러
export { KakaoApiError } from './types.ts';
