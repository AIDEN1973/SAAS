/**
 * 통합 메시지 발송 유틸리티 - 알림톡 우선, SMS 폴백
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 자동 처리
 * [불변 규칙] 개발/프로덕션 모드 모두 지원
 *
 * ## 발송 우선순위
 * 1. 카카오 알림톡 시도 (설정되어 있는 경우)
 * 2. 알림톡 실패 시 SMS 폴백 (설정되어 있는 경우)
 * 3. 둘 다 설정되지 않은 경우 에러 반환
 *
 * ## 사용 예시
 *
 * ```typescript
 * import { sendUnifiedMessage, sendUnifiedMessageBulk } from '../_shared/unified-message-sender.ts';
 *
 * // 단건 발송 (알림톡 우선, SMS 폴백)
 * const result = await sendUnifiedMessage({
 *   receiver: '01011112222',
 *   recvname: '홍길동',
 *   templateCode: 'WELCOME_MSG',  // 알림톡용
 *   alimtalkMessage: '홍길동님, 가입을 환영합니다!',  // 알림톡 메시지
 *   smsMessage: '홍길동님, 가입을 환영합니다.',  // SMS 폴백 메시지
 * });
 *
 * // 대량 발송
 * const bulkResult = await sendUnifiedMessageBulk({
 *   templateCode: 'SCHEDULE_NOTIFY',
 *   recipients: [
 *     {
 *       receiver: '01011112222',
 *       recvname: '홍길동',
 *       alimtalkMessage: '홍길동님, 수업이 있습니다.',
 *       smsMessage: '홍길동님, 수업이 있습니다.',
 *     },
 *   ],
 * });
 * ```
 */

import {
  sendAlimtalk,
  sendAlimtalkBulk,
  sendAlimtalkBulkBatched,
  isAlimtalkConfigured,
  type AlimtalkSendResult,
} from './alimtalk-sender.ts';
import {
  sendSmsToRecipients,
  sendBulkSmsWithContent,
  sendBulkSmsBatched,
  isAligoConfigured,
  getAutoMessageType,
  type SmsSendResult,
  type AligoMessageType,
} from './sms-sender.ts';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 채널 타입
 */
export type MessageChannel = 'alimtalk' | 'sms' | 'auto';

/**
 * 통합 메시지 발송 요청
 */
export interface UnifiedMessageRequest {
  /** 수신자 전화번호 */
  receiver: string;
  /** 수신자 이름 */
  recvname?: string;

  // 알림톡 관련
  /** 알림톡 템플릿 코드 */
  templateCode?: string;
  /** 알림톡 메시지 (템플릿 변수 치환 후) */
  alimtalkMessage?: string;
  /** 알림톡 버튼 정보 (JSON) */
  alimtalkButton?: string;

  // SMS 관련
  /** SMS 메시지 (폴백 또는 단독 사용) */
  smsMessage?: string;
  /** SMS 메시지 타입 */
  smsMessageType?: AligoMessageType;
  /** SMS 제목 (LMS/MMS) */
  smsTitle?: string;

  // 공통
  /** 발송 채널 (auto: 알림톡 우선, SMS 폴백) */
  channel?: MessageChannel;
  /** 예약 일시 (YYYYMMDDHHmmss 또는 YYYYMMDD + HHMM) */
  senddate?: string;
  /** 예약 시간 (HHMM, SMS용) */
  sendtime?: string;
}

/**
 * 통합 대량 발송 수신자
 */
export interface UnifiedBulkRecipient {
  /** 수신자 전화번호 */
  receiver: string;
  /** 수신자 이름 */
  recvname?: string;
  /** 알림톡 메시지 */
  alimtalkMessage?: string;
  /** 알림톡 버튼 정보 */
  alimtalkButton?: string;
  /** SMS 메시지 */
  smsMessage?: string;
}

/**
 * 통합 대량 발송 요청
 */
export interface UnifiedBulkMessageRequest {
  /** 알림톡 템플릿 코드 */
  templateCode?: string;
  /** 수신자 목록 */
  recipients: UnifiedBulkRecipient[];
  /** SMS 메시지 타입 */
  smsMessageType?: AligoMessageType;
  /** SMS 제목 (LMS/MMS) */
  smsTitle?: string;
  /** 발송 채널 */
  channel?: MessageChannel;
  /** 예약 일시 */
  senddate?: string;
  /** 예약 시간 (SMS용) */
  sendtime?: string;
}

/**
 * 통합 발송 결과
 */
export interface UnifiedSendResult {
  /** 최종 성공 여부 */
  success: boolean;
  /** 사용된 채널 */
  usedChannel: 'alimtalk' | 'sms' | 'none';
  /** 폴백 사용 여부 */
  usedFallback: boolean;

  // 알림톡 결과
  /** 알림톡 발송 시도 여부 */
  alimtalkAttempted: boolean;
  /** 알림톡 발송 결과 */
  alimtalkResult?: AlimtalkSendResult;

  // SMS 결과
  /** SMS 발송 시도 여부 */
  smsAttempted: boolean;
  /** SMS 발송 결과 */
  smsResult?: SmsSendResult;

  // 통계
  /** 총 성공 건수 */
  successCount: number;
  /** 총 실패 건수 */
  errorCount: number;
  /** 에러 메시지 (최종 실패 시) */
  errorMessage?: string;
  /** 테스트 모드 여부 */
  testMode: boolean;
}

// ============================================================================
// 통합 메시지 발송 함수
// ============================================================================

/**
 * 메시지 채널 사용 가능 여부 확인
 */
export function getAvailableChannels(): {
  alimtalk: boolean;
  sms: boolean;
  any: boolean;
} {
  const alimtalk = isAlimtalkConfigured();
  const sms = isAligoConfigured();
  return {
    alimtalk,
    sms,
    any: alimtalk || sms,
  };
}

/**
 * 단건 통합 메시지 발송
 *
 * - channel이 'auto'(기본값)인 경우: 알림톡 우선, 실패 시 SMS 폴백
 * - channel이 'alimtalk'인 경우: 알림톡만 시도
 * - channel이 'sms'인 경우: SMS만 시도
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendUnifiedMessage(request: UnifiedMessageRequest): Promise<UnifiedSendResult> {
  const channel = request.channel ?? 'auto';
  const channels = getAvailableChannels();

  // 초기화
  let result: UnifiedSendResult = {
    success: false,
    usedChannel: 'none',
    usedFallback: false,
    alimtalkAttempted: false,
    smsAttempted: false,
    successCount: 0,
    errorCount: 1,
    testMode: false,
  };

  // 채널 사용 불가 확인
  if (!channels.any) {
    return {
      ...result,
      errorMessage: '알림톡과 SMS 모두 설정되지 않았습니다. 환경변수를 확인하세요.',
    };
  }

  // 알림톡 발송 시도 (auto 또는 alimtalk)
  if (
    (channel === 'auto' || channel === 'alimtalk') &&
    channels.alimtalk &&
    request.templateCode &&
    request.alimtalkMessage
  ) {
    result.alimtalkAttempted = true;

    const alimtalkResult = await sendAlimtalk({
      templateCode: request.templateCode,
      receiver: request.receiver,
      recvname: request.recvname,
      message: request.alimtalkMessage,
      button: request.alimtalkButton,
      senddate: request.senddate,
    });

    result.alimtalkResult = alimtalkResult;
    result.testMode = alimtalkResult.testMode;

    if (alimtalkResult.success) {
      return {
        ...result,
        success: true,
        usedChannel: 'alimtalk',
        successCount: alimtalkResult.count,
        errorCount: 0,
      };
    }

    // 알림톡 전용 채널인 경우 여기서 반환
    if (channel === 'alimtalk') {
      return {
        ...result,
        errorMessage: alimtalkResult.errorMessage,
      };
    }
  }

  // SMS 폴백 (auto) 또는 SMS 직접 발송 (sms)
  if (
    (channel === 'auto' || channel === 'sms') &&
    channels.sms &&
    request.smsMessage
  ) {
    result.smsAttempted = true;
    result.usedFallback = result.alimtalkAttempted;

    const smsResult = await sendSmsToRecipients({
      phones: [request.receiver],
      message: request.smsMessage,
      messageType: request.smsMessageType,
      title: request.smsTitle,
      reserveDate: request.senddate?.substring(0, 8),
      reserveTime: request.sendtime ?? request.senddate?.substring(8, 12),
      names: request.recvname ? { [request.receiver]: request.recvname } : undefined,
    });

    result.smsResult = smsResult;
    result.testMode = smsResult.testMode;

    if (smsResult.success) {
      return {
        ...result,
        success: true,
        usedChannel: 'sms',
        successCount: smsResult.successCount,
        errorCount: smsResult.errorCount,
      };
    }

    return {
      ...result,
      errorMessage: smsResult.errorMessage,
    };
  }

  // 발송할 수 있는 채널이 없음
  return {
    ...result,
    errorMessage: '발송 가능한 채널이 없습니다. 템플릿 코드, 메시지, 환경변수를 확인하세요.',
  };
}

/**
 * 대량 통합 메시지 발송
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendUnifiedMessageBulk(request: UnifiedBulkMessageRequest): Promise<UnifiedSendResult> {
  const channel = request.channel ?? 'auto';
  const channels = getAvailableChannels();

  // 초기화
  let result: UnifiedSendResult = {
    success: false,
    usedChannel: 'none',
    usedFallback: false,
    alimtalkAttempted: false,
    smsAttempted: false,
    successCount: 0,
    errorCount: request.recipients.length,
    testMode: false,
  };

  if (request.recipients.length === 0) {
    return {
      ...result,
      errorCount: 0,
      errorMessage: '수신자가 없습니다.',
    };
  }

  if (!channels.any) {
    return {
      ...result,
      errorMessage: '알림톡과 SMS 모두 설정되지 않았습니다.',
    };
  }

  // 알림톡 발송 시도
  // 알림톡 발송 조건: 템플릿 코드 필수 + 알림톡 메시지가 있는 수신자 존재 + 알림톡 설정 완료
  const hasAlimtalkData = !!request.templateCode && request.recipients.some((r) => r.alimtalkMessage);

  if ((channel === 'auto' || channel === 'alimtalk') && channels.alimtalk && hasAlimtalkData) {
    result.alimtalkAttempted = true;

    const alimtalkRecipients = request.recipients
      .filter((r) => r.alimtalkMessage)
      .map((r) => ({
        receiver: r.receiver,
        recvname: r.recvname,
        message: r.alimtalkMessage!,
        button: r.alimtalkButton,
      }));

    const alimtalkResult = await sendAlimtalkBulkBatched({
      templateCode: request.templateCode!,
      recipients: alimtalkRecipients,
      senddate: request.senddate,
    });

    result.alimtalkResult = alimtalkResult;
    result.testMode = alimtalkResult.testMode;

    if (alimtalkResult.success) {
      // 알림톡 메시지가 있는 수신자 수와 실제 발송 성공 건수 비교
      const alimtalkRecipientCount = alimtalkRecipients.length;
      const actualErrorCount = alimtalkRecipientCount - alimtalkResult.count;
      return {
        ...result,
        success: true,
        usedChannel: 'alimtalk',
        successCount: alimtalkResult.count,
        errorCount: actualErrorCount > 0 ? actualErrorCount : 0,
      };
    }

    if (channel === 'alimtalk') {
      return {
        ...result,
        errorMessage: alimtalkResult.errorMessage,
      };
    }
  }

  // SMS 폴백 또는 직접 발송
  const hasSmsData = request.recipients.some((r) => r.smsMessage);

  if ((channel === 'auto' || channel === 'sms') && channels.sms && hasSmsData) {
    result.smsAttempted = true;
    result.usedFallback = result.alimtalkAttempted;

    const smsRecipients = request.recipients
      .filter((r) => r.smsMessage)
      .map((r) => ({
        phone: r.receiver,
        name: r.recvname,
        message: r.smsMessage,
      }));

    // 메시지 타입 결정
    const msgType = request.smsMessageType ?? getAutoMessageType(smsRecipients[0]?.message ?? '');

    const smsResult = await sendBulkSmsBatched({
      recipients: smsRecipients,
      messageType: msgType,
      title: request.smsTitle,
      reserveDate: request.senddate?.substring(0, 8),
      reserveTime: request.sendtime ?? request.senddate?.substring(8, 12),
    });

    result.smsResult = smsResult;
    result.testMode = smsResult.testMode;

    if (smsResult.success || smsResult.successCount > 0) {
      return {
        ...result,
        success: smsResult.success,
        usedChannel: 'sms',
        successCount: smsResult.successCount,
        errorCount: smsResult.errorCount,
        errorMessage: smsResult.partial ? '일부 발송 실패' : undefined,
      };
    }

    return {
      ...result,
      errorMessage: smsResult.errorMessage,
    };
  }

  return {
    ...result,
    errorMessage: '발송 가능한 채널이 없습니다.',
  };
}

/**
 * 동일 내용 대량 발송 (모든 수신자에게 같은 메시지)
 *
 * @param receivers 수신자 전화번호 목록
 * @param templateCode 알림톡 템플릿 코드
 * @param alimtalkMessage 알림톡 메시지
 * @param smsMessage SMS 폴백 메시지
 * @param options 추가 옵션
 * @returns 발송 결과
 */
export async function sendUnifiedMessageToAll(
  receivers: string[],
  templateCode: string | undefined,
  alimtalkMessage: string | undefined,
  smsMessage: string | undefined,
  options?: {
    channel?: MessageChannel;
    smsTitle?: string;
    senddate?: string;
  }
): Promise<UnifiedSendResult> {
  return sendUnifiedMessageBulk({
    templateCode,
    recipients: receivers.map((receiver) => ({
      receiver,
      alimtalkMessage,
      smsMessage,
    })),
    smsTitle: options?.smsTitle,
    channel: options?.channel,
    senddate: options?.senddate,
  });
}

// Re-export
export {
  isAlimtalkConfigured,
  isAligoConfigured,
  getAutoMessageType,
  type AligoMessageType,
};
