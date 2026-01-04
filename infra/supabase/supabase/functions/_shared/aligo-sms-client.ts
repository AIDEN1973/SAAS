/**
 * 알리고(Aligo) SMS 클라이언트 - Edge Function 공유 모듈
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 개발/프로덕션 모드 모두 지원 (ALIGO_TEST_MODE 환경변수)
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 물음표(?) 변환 가능
 *
 * ## 사용 예시
 *
 * ```typescript
 * import { sendSms, sendMassSms, getSmsRemain } from '../_shared/aligo-sms-client.ts';
 *
 * // 단건/동일 내용 다건 발송
 * const result = await sendSms({
 *   receiver: '01011112222,01022223333',
 *   msg: '안녕하세요. 테스트 메시지입니다.',
 * });
 *
 * // 개별 내용 대량 발송
 * const massResult = await sendMassSms({
 *   msg_type: 'SMS',
 *   messages: [
 *     { receiver: '01011112222', msg: '홍길동님 안녕하세요!' },
 *     { receiver: '01022223333', msg: '김철수님 반갑습니다!' },
 *   ],
 * });
 *
 * // 잔여 건수 조회
 * const remain = await getSmsRemain();
 * console.log(`SMS: ${remain.SMS_CNT}건`);
 * ```
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/spec.html
 */

import { getAligoCredentials, getAligoTestMode } from './env-registry.ts';

// ============================================================================
// 상수
// ============================================================================

/** 알리고 API 기본 URL */
const ALIGO_API_BASE_URL = 'https://apis.aligo.in';

/** SMS 바이트 한도 (EUC-KR 기준) */
const SMS_BYTE_LIMIT = 90;

/** 단건 발송 최대 수신자 수 */
const SINGLE_SEND_MAX_RECEIVERS = 1000;

/** 대량 발송 최대 건수 */
const MASS_SEND_MAX_COUNT = 500;

// ============================================================================
// 타입 정의
// ============================================================================

/** 메시지 타입 */
export type AligoMessageType = 'SMS' | 'LMS' | 'MMS';

/** 알리고 API 기본 응답 */
export interface AligoBaseResponse {
  result_code: number;
  message: string;
}

/** 문자 발송 요청 */
export interface AligoSendRequest {
  /** 수신자 전화번호 (컴마 구분, 최대 1000명) */
  receiver: string;
  /** 메시지 내용 (1~2,000Byte) */
  msg: string;
  /** 메시지 타입 (미지정 시 자동 결정) */
  msg_type?: AligoMessageType;
  /** 문자 제목 (LMS, MMS만 허용) */
  title?: string;
  /** %고객명% 치환용 (예: "01011111111|홍길동,01022222222|김철수") */
  destination?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약시간 (HHMM, 현재 시간 기준 10분 이후) */
  rtime?: string;
  /** 테스트 모드 오버라이드 */
  testmode_yn?: 'Y' | 'N';
}

/** 문자 발송 응답 */
export interface AligoSendResponse extends AligoBaseResponse {
  msg_id?: number;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

/** 대량 발송 메시지 항목 */
export interface AligoMassMessageItem {
  receiver: string;
  msg: string;
}

/** 대량 문자 발송 요청 */
export interface AligoSendMassRequest {
  /** 메시지 목록 (최대 500건) */
  messages: AligoMassMessageItem[];
  /** 메시지 타입 (필수) */
  msg_type: AligoMessageType;
  /** 문자 제목 (LMS, MMS만 허용, 공통 적용) */
  title?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약시간 (HHMM) */
  rtime?: string;
  /** 테스트 모드 오버라이드 */
  testmode_yn?: 'Y' | 'N';
}

/** 대량 문자 발송 응답 */
export interface AligoSendMassResponse extends AligoBaseResponse {
  msg_id?: number;
  success_cnt?: number;
  error_cnt?: number;
  msg_type?: string;
}

/** 전송 내역 조회 요청 */
export interface AligoListRequest {
  page?: number;
  page_size?: number;
  start_date?: string;
  limit_day?: number;
}

/** 전송 내역 항목 */
export interface AligoListItem {
  mid: string;
  type: string;
  sender: string;
  sms_count: string;
  reserve_state: string;
  msg: string;
  fail_count: string;
  reg_date: string;
  reserve: string;
}

/** 전송 내역 조회 응답 */
export interface AligoListResponse extends AligoBaseResponse {
  list?: AligoListItem[];
  next_yn?: string;
}

/** 전송 결과 상세 조회 요청 */
export interface AligoSmsListRequest {
  mid: number;
  page?: number;
  page_size?: number;
}

/** 전송 결과 상세 항목 */
export interface AligoSmsListItem {
  mdid: string;
  type: string;
  sender: string;
  receiver: string;
  sms_state: string;
  reg_date: string;
  send_date: string;
  reserve_date: string;
}

/** 전송 결과 상세 조회 응답 */
export interface AligoSmsListResponse extends AligoBaseResponse {
  list?: AligoSmsListItem[];
  next_yn?: string;
}

/** 잔여 건수 조회 응답 */
export interface AligoRemainResponse extends AligoBaseResponse {
  SMS_CNT?: number;
  LMS_CNT?: number;
  MMS_CNT?: number;
}

/** 예약 취소 요청 */
export interface AligoCancelRequest {
  mid: number;
}

/** 예약 취소 응답 */
export interface AligoCancelResponse extends AligoBaseResponse {
  cancel_date?: string;
}

/** 발송 결과 (통합) */
export interface SmsSendResult {
  success: boolean;
  msgId?: number;
  successCount: number;
  errorCount: number;
  messageType?: AligoMessageType;
  errorMessage?: string;
  errorCode?: number;
  testMode: boolean;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * EUC-KR 바이트 수 계산
 *
 * 한글: 2바이트, 영문/숫자/특수문자: 1바이트
 */
export function calculateEucKrBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0xac00 && code <= 0xd7a3) || // 완성형 한글
      (code >= 0x3131 && code <= 0x318e) || // 한글 자모
      (code >= 0x1100 && code <= 0x11ff) // 한글 자모 확장
    ) {
      bytes += 2;
    } else if (code <= 0x7f) {
      // ASCII
      bytes += 1;
    } else {
      // 기타 유니코드
      bytes += 2;
    }
  }
  return bytes;
}

/**
 * 메시지 타입 자동 결정
 */
export function getAutoMessageType(msg: string): AligoMessageType {
  const bytes = calculateEucKrBytes(msg);
  return bytes > SMS_BYTE_LIMIT ? 'LMS' : 'SMS';
}

/**
 * 전화번호 정규화 (하이픈 제거)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 메시지 타입 파싱 (응답값 → enum)
 */
function parseMessageType(msgType?: string): AligoMessageType | undefined {
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

// ============================================================================
// API 호출 헬퍼
// ============================================================================

/**
 * 알리고 API 호출 (내부 헬퍼)
 */
async function callAligoApi<T extends AligoBaseResponse>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  testMode: boolean
): Promise<T> {
  const credentials = getAligoCredentials();
  const url = `${ALIGO_API_BASE_URL}${endpoint}`;

  const formData = new URLSearchParams();
  formData.append('key', credentials.key);
  formData.append('user_id', credentials.user_id);
  formData.append('sender', credentials.sender);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  }

  if (testMode) {
    formData.append('testmode_yn', 'Y');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as T;

  if (data.result_code < 0) {
    throw new Error(data.message || `알리고 API 오류: ${data.result_code}`);
  }

  return data;
}

// ============================================================================
// 공개 API
// ============================================================================

/**
 * SMS 단건/동일 내용 다건 발송
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendSms(request: AligoSendRequest): Promise<SmsSendResult> {
  const testMode = request.testmode_yn === 'Y' ? true : getAligoTestMode();

  try {
    const receivers = request.receiver
      .split(',')
      .map((r) => normalizePhoneNumber(r.trim()));

    if (receivers.length > SINGLE_SEND_MAX_RECEIVERS) {
      return {
        success: false,
        successCount: 0,
        errorCount: receivers.length,
        errorMessage: `수신자 수가 최대 ${SINGLE_SEND_MAX_RECEIVERS}명을 초과합니다.`,
        errorCode: -901,
        testMode,
      };
    }

    const msgType = request.msg_type || getAutoMessageType(request.msg);

    const params: Record<string, string | number | undefined> = {
      receiver: receivers.join(','),
      msg: request.msg,
      msg_type: msgType,
      title: request.title,
      destination: request.destination,
      rdate: request.rdate,
      rtime: request.rtime,
    };

    const response = await callAligoApi<AligoSendResponse>('/send/', params, testMode);

    return {
      success: true,
      msgId: response.msg_id,
      successCount: response.success_cnt ?? 0,
      errorCount: response.error_cnt ?? 0,
      messageType: parseMessageType(response.msg_type),
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      successCount: 0,
      errorCount: 1,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -998,
      testMode,
    };
  }
}

/**
 * SMS 대량 발송 (개별 내용)
 *
 * @param request 발송 요청
 * @returns 발송 결과
 */
export async function sendMassSms(request: AligoSendMassRequest): Promise<SmsSendResult> {
  const testMode = request.testmode_yn === 'Y' ? true : getAligoTestMode();

  try {
    if (request.messages.length > MASS_SEND_MAX_COUNT) {
      return {
        success: false,
        successCount: 0,
        errorCount: request.messages.length,
        errorMessage: `발송 건수가 최대 ${MASS_SEND_MAX_COUNT}건을 초과합니다.`,
        errorCode: -902,
        testMode,
      };
    }

    if (request.messages.length === 0) {
      return {
        success: false,
        successCount: 0,
        errorCount: 0,
        errorMessage: '발송할 메시지가 없습니다.',
        errorCode: -903,
        testMode,
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

    const response = await callAligoApi<AligoSendMassResponse>('/send_mass/', params, testMode);

    return {
      success: true,
      msgId: response.msg_id,
      successCount: response.success_cnt ?? 0,
      errorCount: response.error_cnt ?? 0,
      messageType: parseMessageType(response.msg_type),
      testMode,
    };
  } catch (error) {
    return {
      success: false,
      successCount: 0,
      errorCount: request.messages.length,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorCode: -998,
      testMode,
    };
  }
}

/**
 * 전송 내역 조회
 *
 * @param request 조회 요청
 * @returns 전송 내역
 */
export async function getSmsHistory(request?: AligoListRequest): Promise<AligoListResponse> {
  const testMode = getAligoTestMode();
  const params: Record<string, string | number | undefined> = {
    page: request?.page ?? 1,
    page_size: request?.page_size ?? 30,
    start_date: request?.start_date,
    limit_day: request?.limit_day,
  };

  return callAligoApi<AligoListResponse>('/list/', params, testMode);
}

/**
 * 전송 결과 상세 조회
 *
 * @param request 조회 요청
 * @returns 전송 결과 상세
 */
export async function getSmsDetail(request: AligoSmsListRequest): Promise<AligoSmsListResponse> {
  const testMode = getAligoTestMode();
  const params: Record<string, string | number | undefined> = {
    mid: request.mid,
    page: request.page ?? 1,
    page_size: request.page_size ?? 30,
  };

  return callAligoApi<AligoSmsListResponse>('/sms_list/', params, testMode);
}

/**
 * 발송 가능 건수 조회
 *
 * @returns 잔여 건수
 */
export async function getSmsRemain(): Promise<AligoRemainResponse> {
  const testMode = getAligoTestMode();
  return callAligoApi<AligoRemainResponse>('/remain/', {}, testMode);
}

/**
 * 예약 문자 취소
 *
 * @param request 취소 요청
 * @returns 취소 결과
 */
export async function cancelScheduledSms(request: AligoCancelRequest): Promise<AligoCancelResponse> {
  const testMode = getAligoTestMode();
  const params: Record<string, string | number | undefined> = {
    mid: request.mid,
  };

  return callAligoApi<AligoCancelResponse>('/cancel/', params, testMode);
}
