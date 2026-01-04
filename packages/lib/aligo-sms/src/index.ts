/**
 * 알리고(Aligo) SMS API 라이브러리
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (testMode 옵션)
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 물음표(?) 변환 가능
 *
 * ## 사용 예시
 *
 * ```typescript
 * import { createAligoClient, getMessageByteInfo } from '@samdle/aligo-sms';
 *
 * // 클라이언트 생성
 * const client = createAligoClient({
 *   key: 'your-api-key',
 *   user_id: 'your-user-id',
 *   sender: '01012345678',
 * }, false); // testMode: false (프로덕션)
 *
 * // 단건 발송
 * const result = await client.send({
 *   receiver: '01011112222',
 *   msg: '안녕하세요. 테스트 메시지입니다.',
 * });
 *
 * // 동일 내용 다건 발송 (최대 1,000명)
 * const bulkResult = await client.send({
 *   receiver: '01011112222,01022223333,01033334444',
 *   msg: '안녕하세요. 공지사항입니다.',
 * });
 *
 * // 개별 내용 대량 발송 (최대 500명)
 * const massResult = await client.sendMass({
 *   msg_type: 'SMS',
 *   messages: [
 *     { receiver: '01011112222', msg: '홍길동님, 안녕하세요!' },
 *     { receiver: '01022223333', msg: '김철수님, 반갑습니다!' },
 *   ],
 * });
 *
 * // 예약 발송
 * const scheduledResult = await client.send({
 *   receiver: '01011112222',
 *   msg: '예약 메시지입니다.',
 *   rdate: '20260103',
 *   rtime: '1030',
 * });
 *
 * // 잔여 발송 가능 건수 조회
 * const remain = await client.getRemain();
 * console.log(`SMS: ${remain.SMS_CNT}건, LMS: ${remain.LMS_CNT}건`);
 *
 * // 전송 내역 조회
 * const list = await client.getList({ page: 1, page_size: 50 });
 *
 * // 전송 결과 상세 조회
 * const detail = await client.getSmsList({ mid: 123456789 });
 *
 * // 예약 문자 취소
 * const cancelResult = await client.cancel({ mid: 123456789 });
 * ```
 *
 * ## 주의사항
 *
 * - 발신번호는 사이트 내에서 사전 등록된 번호만 사용 가능
 * - EUC-KR 미지원 특수문자/이모지는 물음표(?)로 변환됨
 * - 예약 발송은 현재 시간 기준 10분 이후부터 가능
 * - 예약 취소는 발송 5분 전까지만 가능
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/spec.html
 */

// 클라이언트
export { AligoSmsClient, createAligoClient } from './client.ts';

// 유틸리티 함수
export {
  calculateEucKrBytes,
  getMessageByteInfo,
  normalizePhoneNumber,
  validateScheduleTime,
} from './client.ts';

// 타입
export type {
  AligoCredentials,
  AligoClientOptions,
  AligoMessageType,
  AligoBaseResponse,
  AligoSendRequest,
  AligoSendResponse,
  AligoMassMessageItem,
  AligoSendMassRequest,
  AligoSendMassResponse,
  AligoListRequest,
  AligoListResponse,
  AligoListItem,
  AligoSmsListRequest,
  AligoSmsListResponse,
  AligoSmsListItem,
  AligoRemainResponse,
  AligoCancelRequest,
  AligoCancelResponse,
  MessageByteInfo,
  SendResult,
} from './types.ts';

// 에러 클래스
export { AligoApiError } from './types.ts';
