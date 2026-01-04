/**
 * SMS 발송 훅 - 알리고(Aligo) API 연동
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원
 */

export { useSms, default } from './useSms';
export {
  calculateSmsBytes,
  getRecommendedSmsType,
  normalizePhoneNumber,
  formatPhoneNumber,
} from './useSms';

export type {
  SmsMessageType,
  SmsSendRequest,
  SmsMassMessageItem,
  SmsSendMassRequest,
  SmsListRequest,
  SmsListItem,
  SmsDetailItem,
  SmsRemainInfo,
  SmsSendResult,
  SmsApiResponse,
} from './types';
