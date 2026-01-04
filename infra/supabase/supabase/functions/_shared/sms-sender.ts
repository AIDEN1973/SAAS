/**
 * SMS 발송 유틸리티 - Edge Function 공유 모듈
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] Provider 추상화 - 현재는 알리고(Aligo)만 지원, 향후 확장 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (ALIGO_TEST_MODE 환경변수)
 *
 * ## 사용 예시
 *
 * ```typescript
 * import { sendSmsToRecipients, sendBulkSmsWithContent } from '../_shared/sms-sender.ts';
 *
 * // 단일/복수 수신자에게 동일 내용 발송
 * const result = await sendSmsToRecipients({
 *   phones: ['01011112222', '01022223333'],
 *   message: '안녕하세요. 공지사항입니다.',
 * });
 *
 * // 개별 내용 대량 발송
 * const massResult = await sendBulkSmsWithContent({
 *   recipients: [
 *     { phone: '01011112222', name: '홍길동', message: '홍길동님 안녕하세요!' },
 *     { phone: '01022223333', name: '김철수', message: '김철수님 반갑습니다!' },
 *   ],
 * });
 * ```
 */

import { sendSms, sendMassSms, getAutoMessageType, type AligoMessageType } from './aligo-sms-client.ts';
import { getAligoTestMode, envServer } from './env-registry.ts';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * SMS 수신자 정보
 */
export interface SmsRecipient {
  /** 전화번호 */
  phone: string;
  /** 이름 (%고객명% 치환용) */
  name?: string;
  /** 개별 메시지 (대량 발송 시) */
  message?: string;
}

/**
 * 단일/복수 수신자 동일 내용 발송 요청
 */
export interface SendSmsRequest {
  /** 수신자 전화번호 목록 */
  phones: string[];
  /** 메시지 내용 */
  message: string;
  /** 메시지 타입 (미지정 시 자동 결정) */
  messageType?: AligoMessageType;
  /** 문자 제목 (LMS/MMS 전용) */
  title?: string;
  /** 예약일 (YYYYMMDD) */
  reserveDate?: string;
  /** 예약시간 (HHMM) */
  reserveTime?: string;
  /** %고객명% 치환 데이터 */
  names?: Record<string, string>; // phone → name 매핑
}

/**
 * 개별 내용 대량 발송 요청
 */
export interface SendBulkSmsRequest {
  /** 수신자 목록 (개별 메시지 포함) */
  recipients: SmsRecipient[];
  /** 메시지 타입 (필수) */
  messageType: AligoMessageType;
  /** 문자 제목 (LMS/MMS 전용, 공통 적용) */
  title?: string;
  /** 예약일 (YYYYMMDD) */
  reserveDate?: string;
  /** 예약시간 (HHMM) */
  reserveTime?: string;
}

/**
 * SMS 발송 결과
 */
export interface SmsSendResult {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 ID (알리고) */
  msgId?: number;
  /** 성공 건수 */
  successCount: number;
  /** 실패 건수 */
  errorCount: number;
  /** 메시지 타입 */
  messageType?: AligoMessageType;
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
  /** 에러 코드 (실패 시) */
  errorCode?: number;
  /** 테스트 모드 여부 */
  testMode: boolean;
  /** 부분 성공 여부 */
  partial: boolean;
}

// ============================================================================
// SMS 발송 함수
// ============================================================================

/**
 * 알리고 SMS 설정 여부 확인
 */
export function isAligoConfigured(): boolean {
  return !!(
    envServer.ALIGO_API_KEY &&
    envServer.ALIGO_USER_ID &&
    envServer.ALIGO_SENDER
  );
}

/**
 * 단일/복수 수신자에게 동일 내용 SMS 발송
 *
 * - 최대 1,000명까지 동시 발송 가능
 * - %고객명% 치환 지원
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendSmsToRecipients(request: SendSmsRequest): Promise<SmsSendResult> {
  if (!isAligoConfigured()) {
    return {
      success: false,
      successCount: 0,
      errorCount: request.phones.length,
      errorMessage: '알리고 SMS 설정이 완료되지 않았습니다. (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)',
      errorCode: -900,
      testMode: true,
      partial: false,
    };
  }

  if (request.phones.length === 0) {
    return {
      success: false,
      successCount: 0,
      errorCount: 0,
      errorMessage: '수신자가 없습니다.',
      errorCode: -901,
      testMode: getAligoTestMode(),
      partial: false,
    };
  }

  // destination 생성 (%고객명% 치환용)
  let destination: string | undefined;
  if (request.names && Object.keys(request.names).length > 0) {
    destination = request.phones
      .map((phone) => {
        const name = request.names?.[phone];
        return name ? `${phone}|${name}` : null;
      })
      .filter(Boolean)
      .join(',');
  }

  const result = await sendSms({
    receiver: request.phones.join(','),
    msg: request.message,
    msg_type: request.messageType,
    title: request.title,
    destination,
    rdate: request.reserveDate,
    rtime: request.reserveTime,
  });

  return {
    success: result.success,
    msgId: result.msgId,
    successCount: result.successCount,
    errorCount: result.errorCount,
    messageType: result.messageType,
    errorMessage: result.errorMessage,
    errorCode: result.errorCode,
    testMode: result.testMode,
    partial: result.success && result.errorCount > 0,
  };
}

/**
 * 개별 내용 대량 SMS 발송
 *
 * - 최대 500명까지 동시 발송 가능
 * - 각 수신자에게 개별 메시지 전송
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendBulkSmsWithContent(request: SendBulkSmsRequest): Promise<SmsSendResult> {
  if (!isAligoConfigured()) {
    return {
      success: false,
      successCount: 0,
      errorCount: request.recipients.length,
      errorMessage: '알리고 SMS 설정이 완료되지 않았습니다. (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)',
      errorCode: -900,
      testMode: true,
      partial: false,
    };
  }

  if (request.recipients.length === 0) {
    return {
      success: false,
      successCount: 0,
      errorCount: 0,
      errorMessage: '수신자가 없습니다.',
      errorCode: -901,
      testMode: getAligoTestMode(),
      partial: false,
    };
  }

  // 메시지가 없는 수신자 필터링
  const validRecipients = request.recipients.filter((r) => r.phone && r.message);

  if (validRecipients.length === 0) {
    return {
      success: false,
      successCount: 0,
      errorCount: request.recipients.length,
      errorMessage: '유효한 수신자가 없습니다. (전화번호와 메시지가 모두 필요)',
      errorCode: -902,
      testMode: getAligoTestMode(),
      partial: false,
    };
  }

  const result = await sendMassSms({
    messages: validRecipients.map((r) => ({
      receiver: r.phone,
      msg: r.message!,
    })),
    msg_type: request.messageType,
    title: request.title,
    rdate: request.reserveDate,
    rtime: request.reserveTime,
  });

  return {
    success: result.success,
    msgId: result.msgId,
    successCount: result.successCount,
    errorCount: result.errorCount,
    messageType: result.messageType,
    errorMessage: result.errorMessage,
    errorCode: result.errorCode,
    testMode: result.testMode,
    partial: result.success && result.errorCount > 0,
  };
}

/**
 * 500건 이상의 대량 발송을 위한 배치 처리
 *
 * - 500건 단위로 분할하여 순차 발송
 * - 전체 결과 집계
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendBulkSmsBatched(request: SendBulkSmsRequest): Promise<SmsSendResult> {
  const BATCH_SIZE = 500;
  const recipients = request.recipients;

  if (recipients.length <= BATCH_SIZE) {
    return sendBulkSmsWithContent(request);
  }

  let totalSuccess = 0;
  let totalError = 0;
  let lastMsgId: number | undefined;
  let lastError: string | undefined;
  const testMode = getAligoTestMode();

  // 배치 단위로 분할
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const result = await sendBulkSmsWithContent({
      ...request,
      recipients: batch,
    });

    totalSuccess += result.successCount;
    totalError += result.errorCount;

    if (result.msgId) {
      lastMsgId = result.msgId;
    }

    if (result.errorMessage) {
      lastError = result.errorMessage;
    }

    // 배치 간 짧은 딜레이 (rate limiting 방지)
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    success: totalError === 0,
    msgId: lastMsgId,
    successCount: totalSuccess,
    errorCount: totalError,
    messageType: request.messageType,
    errorMessage: lastError,
    testMode,
    partial: totalSuccess > 0 && totalError > 0,
  };
}

// Re-export 유틸리티 함수
export { getAutoMessageType } from './aligo-sms-client.ts';
export type { AligoMessageType } from './aligo-sms-client.ts';
