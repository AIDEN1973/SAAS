// LAYER: EDGE_FUNCTION_HANDLER
/**
 * 알리고 SMS 발송 Handler
 *
 * Intent: sms.exec.send_aligo
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (ALIGO_TEST_MODE 환경변수)
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 물음표(?) 변환 가능
 *
 * ## 지원 기능
 * - 단건/동일 내용 다건 발송 (최대 1,000명)
 * - 개별 내용 대량 발송 (최대 500명)
 * - 예약 발송 (10분 이후)
 * - %고객명% 치환
 *
 * ## Plan.params 형식
 * ```json
 * {
 *   "send_mode": "single" | "mass",
 *   "receiver": "01011112222,01022223333", // single 모드
 *   "msg": "안녕하세요. 테스트 메시지입니다.",
 *   "msg_type": "SMS" | "LMS" | "MMS", // 선택
 *   "title": "제목", // LMS/MMS 전용
 *   "destination": "01011112222|홍길동,01022223333|김철수", // %고객명% 치환
 *   "rdate": "20260103", // 예약일
 *   "rtime": "1030", // 예약시간
 *   "messages": [ // mass 모드 전용
 *     { "receiver": "01011112222", "msg": "홍길동님 안녕하세요!" },
 *     { "receiver": "01022223333", "msg": "김철수님 반갑습니다!" }
 *   ]
 * }
 * ```
 */

import type {
  IntentHandler,
  SuggestedActionChatOpsPlanV1,
  HandlerContext,
  HandlerResult,
  ContractErrorCategory,
} from './types.ts';
import { maskPII } from '../../_shared/pii-utils.ts';
import { sendSms, sendMassSms, type AligoMessageType } from '../../_shared/aligo-sms-client.ts';
import { getAligoTestMode } from '../../_shared/env-registry.ts';

interface SmsSendParams {
  send_mode: 'single' | 'mass';
  receiver?: string;
  msg?: string;
  msg_type?: AligoMessageType;
  title?: string;
  destination?: string;
  rdate?: string;
  rtime?: string;
  messages?: Array<{
    receiver: string;
    msg: string;
  }>;
  testmode_yn?: 'Y' | 'N';
}

export const smsSendAligoHandler: IntentHandler = {
  intent_key: 'sms.exec.send_aligo',

  async execute(
    plan: SuggestedActionChatOpsPlanV1,
    context: HandlerContext
  ): Promise<HandlerResult> {
    try {
      const params = plan.params as SmsSendParams;

      // 필수 파라미터 검증
      if (!params.send_mode) {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
          message: 'send_mode가 필요합니다. (single 또는 mass)',
        };
      }

      const testMode = getAligoTestMode();

      // 발송 모드에 따라 처리
      if (params.send_mode === 'single') {
        // 단건/동일 내용 다건 발송
        if (!params.receiver || !params.msg) {
          return {
            status: 'failed',
            error_code: 'INVALID_PARAMS',
            contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
            message: 'single 모드에서는 receiver와 msg가 필요합니다.',
          };
        }

        const result = await sendSms({
          receiver: params.receiver,
          msg: params.msg,
          msg_type: params.msg_type,
          title: params.title,
          destination: params.destination,
          rdate: params.rdate,
          rtime: params.rtime,
          testmode_yn: params.testmode_yn,
        });

        if (!result.success) {
          return {
            status: 'failed',
            error_code: 'SMS_SEND_FAILED',
            contract_category: ContractErrorCategory.EXTERNAL_PROVIDER_FAILURE,
            message: result.errorMessage || 'SMS 발송에 실패했습니다.',
            result: {
              error_code: result.errorCode,
              test_mode: result.testMode,
            },
          };
        }

        return {
          status: 'success',
          result: {
            total_count: result.successCount + result.errorCount,
            success_count: result.successCount,
            error_count: result.errorCount,
            msg_id: result.msgId,
            msg_type: result.messageType,
            test_mode: result.testMode,
          },
          affected_count: result.successCount,
          message: `SMS ${result.successCount}건 발송 ${result.testMode ? '(테스트 모드)' : '완료'}`,
        };
      } else if (params.send_mode === 'mass') {
        // 개별 내용 대량 발송
        if (!params.messages || params.messages.length === 0) {
          return {
            status: 'failed',
            error_code: 'INVALID_PARAMS',
            contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
            message: 'mass 모드에서는 messages 배열이 필요합니다.',
          };
        }

        if (!params.msg_type) {
          return {
            status: 'failed',
            error_code: 'INVALID_PARAMS',
            contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
            message: 'mass 모드에서는 msg_type이 필수입니다. (SMS, LMS, MMS 중 선택)',
          };
        }

        const result = await sendMassSms({
          messages: params.messages,
          msg_type: params.msg_type,
          title: params.title,
          rdate: params.rdate,
          rtime: params.rtime,
          testmode_yn: params.testmode_yn,
        });

        if (!result.success) {
          return {
            status: 'failed',
            error_code: 'SMS_MASS_SEND_FAILED',
            contract_category: ContractErrorCategory.EXTERNAL_PROVIDER_FAILURE,
            message: result.errorMessage || '대량 SMS 발송에 실패했습니다.',
            result: {
              error_code: result.errorCode,
              test_mode: result.testMode,
            },
          };
        }

        // 부분 성공 처리
        if (result.errorCount > 0 && result.successCount > 0) {
          return {
            status: 'partial',
            result: {
              total_count: result.successCount + result.errorCount,
              success_count: result.successCount,
              error_count: result.errorCount,
              msg_id: result.msgId,
              msg_type: result.messageType,
              test_mode: result.testMode,
            },
            affected_count: result.successCount,
            message: `SMS ${result.successCount}건 성공, ${result.errorCount}건 실패 ${result.testMode ? '(테스트 모드)' : ''}`,
          };
        }

        return {
          status: 'success',
          result: {
            total_count: result.successCount + result.errorCount,
            success_count: result.successCount,
            error_count: result.errorCount,
            msg_id: result.msgId,
            msg_type: result.messageType,
            test_mode: result.testMode,
          },
          affected_count: result.successCount,
          message: `대량 SMS ${result.successCount}건 발송 ${result.testMode ? '(테스트 모드)' : '완료'}`,
        };
      } else {
        return {
          status: 'failed',
          error_code: 'INVALID_PARAMS',
          contract_category: ContractErrorCategory.CONTRACT_INPUT_TYPE,
          message: `지원하지 않는 send_mode입니다: ${params.send_mode}`,
        };
      }
    } catch (error) {
      const maskedError = maskPII(error);
      console.error('[smsSendAligoHandler] Execution failed:', maskedError);
      return {
        status: 'failed',
        error_code: 'EXECUTION_FAILED',
        contract_category: ContractErrorCategory.EXTERNAL_PROVIDER_FAILURE,
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      };
    }
  },
};
