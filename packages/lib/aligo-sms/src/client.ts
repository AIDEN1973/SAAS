/**
 * 알리고(Aligo) SMS API 클라이언트
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (testmode_yn 파라미터)
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 물음표(?) 변환 가능
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/spec.html
 */

import type {
  AligoCredentials,
  AligoClientOptions,
  AligoMessageType,
  AligoSendRequest,
  AligoSendResponse,
  AligoSendMassRequest,
  AligoSendMassResponse,
  AligoMassMessageItem,
  AligoListRequest,
  AligoListResponse,
  AligoSmsListRequest,
  AligoSmsListResponse,
  AligoCancelRequest,
  AligoCancelResponse,
  AligoRemainResponse,
  AligoBaseResponse,
  SendResult,
  MessageByteInfo,
} from './types.ts';
import { AligoApiError } from './types.ts';

/** 알리고 API 기본 URL */
const ALIGO_API_BASE_URL = 'https://apis.aligo.in';

/** SMS 바이트 한도 (EUC-KR 기준) */
const SMS_BYTE_LIMIT = 90;

/** 단건 발송 최대 수신자 수 */
const SINGLE_SEND_MAX_RECEIVERS = 1000;

/** 대량 발송 최대 건수 */
const MASS_SEND_MAX_COUNT = 500;

/**
 * 문자열의 EUC-KR 바이트 수 계산
 *
 * 한글: 2바이트, 영문/숫자/특수문자: 1바이트
 * 개행문자(\n): 2바이트 (시스템별로 다를 수 있음)
 */
export function calculateEucKrBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // 한글 범위 (완성형 + 조합형)
    if (
      (code >= 0xac00 && code <= 0xd7a3) || // 완성형 한글
      (code >= 0x3131 && code <= 0x318e) || // 한글 자모
      (code >= 0x1100 && code <= 0x11ff) // 한글 자모 (확장)
    ) {
      bytes += 2;
    } else if (code <= 0x7f) {
      // ASCII
      bytes += 1;
    } else {
      // 기타 유니코드 (2바이트로 계산)
      bytes += 2;
    }
  }
  return bytes;
}

/**
 * 메시지 바이트 정보 및 권장 타입 계산
 */
export function getMessageByteInfo(msg: string): MessageByteInfo {
  const bytes = calculateEucKrBytes(msg);
  const exceedsSmsLimit = bytes > SMS_BYTE_LIMIT;
  const recommendedType: AligoMessageType = exceedsSmsLimit ? 'LMS' : 'SMS';

  return {
    bytes,
    recommendedType,
    exceedsSmsLimit,
  };
}

/**
 * 전화번호 정규화 (하이픈 제거)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 예약 시간 검증 (현재 시간 기준 10분 이후)
 */
export function validateScheduleTime(rdate: string, rtime: string): boolean {
  const now = new Date();
  const year = parseInt(rdate.substring(0, 4), 10);
  const month = parseInt(rdate.substring(4, 6), 10) - 1;
  const day = parseInt(rdate.substring(6, 8), 10);
  const hour = parseInt(rtime.substring(0, 2), 10);
  const minute = parseInt(rtime.substring(2, 4), 10);

  const scheduleDate = new Date(year, month, day, hour, minute);
  const minScheduleDate = new Date(now.getTime() + 10 * 60 * 1000); // 10분 후

  return scheduleDate >= minScheduleDate;
}

/**
 * 알리고 SMS 클라이언트
 */
export class AligoSmsClient {
  private readonly credentials: AligoCredentials;
  private readonly testMode: boolean;
  private readonly timeout: number;

  constructor(options: AligoClientOptions) {
    this.credentials = options.credentials;
    this.testMode = options.testMode ?? false;
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * API 요청 전송 (공통)
   */
  private async request<T extends AligoBaseResponse>(
    endpoint: string,
    params: Record<string, string | number | undefined>
  ): Promise<T> {
    const url = `${ALIGO_API_BASE_URL}${endpoint}`;

    // FormData 생성 (application/x-www-form-urlencoded)
    const formData = new URLSearchParams();
    formData.append('key', this.credentials.key);
    formData.append('user_id', this.credentials.user_id);
    formData.append('sender', this.credentials.sender);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    // 테스트 모드 설정
    if (this.testMode) {
      formData.append('testmode_yn', 'Y');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AligoApiError(
          `HTTP 오류: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      const data = (await response.json()) as T;

      // API 응답 코드 확인 (0 미만은 실패)
      if (data.result_code < 0) {
        throw new AligoApiError(data.message || '알 수 없는 오류', data.result_code, data);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AligoApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AligoApiError('요청 타임아웃', -999);
      }

      throw new AligoApiError(
        error instanceof Error ? error.message : '알 수 없는 오류',
        -998
      );
    }
  }

  /**
   * 문자 발송 (단건 또는 동일 내용 다건)
   *
   * 동일한 내용의 문자를 최대 1,000명에게 동시 전송
   *
   * @param request 발송 요청
   * @returns 발송 결과
   */
  async send(request: AligoSendRequest): Promise<SendResult> {
    const receivers = request.receiver.split(',').map((r) => normalizePhoneNumber(r.trim()));

    if (receivers.length > SINGLE_SEND_MAX_RECEIVERS) {
      return {
        success: false,
        successCount: 0,
        errorCount: receivers.length,
        errorMessage: `수신자 수가 최대 ${SINGLE_SEND_MAX_RECEIVERS}명을 초과합니다.`,
        errorCode: -901,
      };
    }

    // 메시지 타입 자동 결정 (미지정 시)
    let msgType = request.msg_type;
    if (!msgType) {
      const byteInfo = getMessageByteInfo(request.msg);
      msgType = byteInfo.recommendedType;
    }

    const params: Record<string, string | number | undefined> = {
      receiver: receivers.join(','),
      msg: request.msg,
      msg_type: msgType,
      title: request.title,
      destination: request.destination,
      rdate: request.rdate,
      rtime: request.rtime,
    };

    // 테스트 모드 오버라이드 (요청에서 명시적 지정 시)
    if (request.testmode_yn === 'Y') {
      params.testmode_yn = 'Y';
    }

    try {
      const response = await this.request<AligoSendResponse>('/send/', params);

      return {
        success: true,
        msgId: response.msg_id,
        successCount: response.success_cnt ?? 0,
        errorCount: response.error_cnt ?? 0,
        messageType: this.parseMessageType(response.msg_type),
      };
    } catch (error) {
      if (error instanceof AligoApiError) {
        return {
          success: false,
          successCount: 0,
          errorCount: receivers.length,
          errorMessage: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * 대량 문자 발송 (개별 내용)
   *
   * 각각 다른 내용의 문자를 최대 500명에게 동시 전송
   *
   * @param request 발송 요청
   * @returns 발송 결과
   */
  async sendMass(request: AligoSendMassRequest): Promise<SendResult> {
    if (request.messages.length > MASS_SEND_MAX_COUNT) {
      return {
        success: false,
        successCount: 0,
        errorCount: request.messages.length,
        errorMessage: `발송 건수가 최대 ${MASS_SEND_MAX_COUNT}건을 초과합니다.`,
        errorCode: -902,
      };
    }

    if (request.messages.length === 0) {
      return {
        success: false,
        successCount: 0,
        errorCount: 0,
        errorMessage: '발송할 메시지가 없습니다.',
        errorCode: -903,
      };
    }

    const params: Record<string, string | number | undefined> = {
      msg_type: request.msg_type,
      cnt: request.messages.length,
      title: request.title,
      rdate: request.rdate,
      rtime: request.rtime,
    };

    // 개별 메시지 추가 (rec_1, msg_1, rec_2, msg_2, ...)
    request.messages.forEach((item, index) => {
      const num = index + 1;
      params[`rec_${num}`] = normalizePhoneNumber(item.receiver);
      params[`msg_${num}`] = item.msg;
    });

    // 테스트 모드 오버라이드
    if (request.testmode_yn === 'Y') {
      params.testmode_yn = 'Y';
    }

    try {
      const response = await this.request<AligoSendMassResponse>('/send_mass/', params);

      return {
        success: true,
        msgId: response.msg_id,
        successCount: response.success_cnt ?? 0,
        errorCount: response.error_cnt ?? 0,
        messageType: this.parseMessageType(response.msg_type),
      };
    } catch (error) {
      if (error instanceof AligoApiError) {
        return {
          success: false,
          successCount: 0,
          errorCount: request.messages.length,
          errorMessage: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * 전송 내역 조회
   *
   * @param request 조회 요청
   * @returns 전송 내역 목록
   */
  async getList(request?: AligoListRequest): Promise<AligoListResponse> {
    const params: Record<string, string | number | undefined> = {
      page: request?.page ?? 1,
      page_size: request?.page_size ?? 30,
      start_date: request?.start_date,
      limit_day: request?.limit_day,
    };

    return this.request<AligoListResponse>('/list/', params);
  }

  /**
   * 전송 결과 상세 조회
   *
   * @param request 조회 요청
   * @returns 전송 결과 상세 목록
   */
  async getSmsList(request: AligoSmsListRequest): Promise<AligoSmsListResponse> {
    const params: Record<string, string | number | undefined> = {
      mid: request.mid,
      page: request.page ?? 1,
      page_size: request.page_size ?? 30,
    };

    return this.request<AligoSmsListResponse>('/sms_list/', params);
  }

  /**
   * 발송 가능 건수 조회
   *
   * @returns 잔여 포인트 기준 발송 가능 건수
   */
  async getRemain(): Promise<AligoRemainResponse> {
    return this.request<AligoRemainResponse>('/remain/', {});
  }

  /**
   * 예약 문자 취소
   *
   * @param request 취소 요청
   * @returns 취소 결과
   */
  async cancel(request: AligoCancelRequest): Promise<AligoCancelResponse> {
    const params: Record<string, string | number | undefined> = {
      mid: request.mid,
    };

    return this.request<AligoCancelResponse>('/cancel/', params);
  }

  /**
   * 메시지 타입 파싱 (응답값 → enum)
   */
  private parseMessageType(msgType?: string): AligoMessageType | undefined {
    switch (msgType) {
      case '1':
      case 'SMS':
        return 'SMS';
      case '2':
      case 'LMS':
        return 'LMS';
      case '3':
      case 'MMS':
        return 'MMS';
      default:
        return undefined;
    }
  }
}

/**
 * 알리고 클라이언트 생성 헬퍼 함수
 *
 * @param credentials 인증 정보
 * @param testMode 테스트 모드 (기본값: false)
 * @returns AligoSmsClient 인스턴스
 */
export function createAligoClient(
  credentials: AligoCredentials,
  testMode = false
): AligoSmsClient {
  return new AligoSmsClient({
    credentials,
    testMode,
  });
}
