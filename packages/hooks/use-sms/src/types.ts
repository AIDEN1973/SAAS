/**
 * SMS 발송 타입 정의
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 */

/**
 * 메시지 타입
 */
export type SmsMessageType = 'SMS' | 'LMS' | 'MMS';

/**
 * SMS 발송 요청 (단건/동일 내용 다건)
 */
export interface SmsSendRequest {
  /** 수신자 전화번호 (컴마 구분 시 최대 1,000명) */
  receiver: string;
  /** 메시지 내용 (1~2,000Byte) */
  msg: string;
  /** 메시지 타입 (미지정 시 자동 결정) */
  msg_type?: SmsMessageType;
  /** 문자 제목 (LMS, MMS만 허용) */
  title?: string;
  /** %고객명% 치환용 (예: "01011111111|홍길동,01022222222|김철수") */
  destination?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약시간 (HHMM) */
  rtime?: string;
}

/**
 * 대량 발송 메시지 항목
 */
export interface SmsMassMessageItem {
  /** 수신자 전화번호 */
  receiver: string;
  /** 메시지 내용 */
  msg: string;
}

/**
 * SMS 대량 발송 요청 (개별 내용)
 */
export interface SmsSendMassRequest {
  /** 메시지 목록 (최대 500건) */
  messages: SmsMassMessageItem[];
  /** 메시지 타입 (필수) */
  msg_type: SmsMessageType;
  /** 문자 제목 (LMS, MMS만 허용) */
  title?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약시간 (HHMM) */
  rtime?: string;
}

/**
 * 전송 내역 조회 요청
 */
export interface SmsListRequest {
  /** 페이지 번호 */
  page?: number;
  /** 페이지당 출력 개수 */
  page_size?: number;
  /** 조회 시작 일자 (YYYYMMDD) */
  start_date?: string;
  /** 조회 마감 일자 (시작일 기준 며칠 전) */
  limit_day?: number;
}

/**
 * 전송 내역 항목
 */
export interface SmsListItem {
  /** 메시지 ID */
  mid: string;
  /** 문자 구분 */
  type: string;
  /** 발신 번호 */
  sender: string;
  /** 전송 요청 수 */
  sms_count: string;
  /** 요청 상태 */
  reserve_state: string;
  /** 메시지 내용 */
  msg: string;
  /** 처리 실패 건수 */
  fail_count: string;
  /** 등록일 */
  reg_date: string;
  /** 예약 일자 */
  reserve: string;
}

/**
 * 전송 결과 상세 항목
 */
export interface SmsDetailItem {
  /** 메시지 상세 ID */
  mdid: string;
  /** 문자 구분 */
  type: string;
  /** 발신 번호 */
  sender: string;
  /** 수신 번호 */
  receiver: string;
  /** 전송 상태 */
  sms_state: string;
  /** 등록일 */
  reg_date: string;
  /** 전송일 */
  send_date: string;
  /** 예약일 */
  reserve_date: string;
}

/**
 * 잔여 건수 정보
 */
export interface SmsRemainInfo {
  /** SMS 발송 가능 건수 */
  SMS_CNT?: number;
  /** LMS 발송 가능 건수 */
  LMS_CNT?: number;
  /** MMS 발송 가능 건수 */
  MMS_CNT?: number;
}

/**
 * SMS 발송 결과
 */
export interface SmsSendResult {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 ID */
  msgId?: number;
  /** 성공 건수 */
  successCount: number;
  /** 실패 건수 */
  errorCount: number;
  /** 메시지 타입 */
  messageType?: SmsMessageType;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 테스트 모드 여부 */
  testMode: boolean;
}

/**
 * SMS API 응답 (공통)
 */
export interface SmsApiResponse<T = unknown> {
  success: boolean;
  test_mode: boolean;
  data?: T;
  error?: string;
}
