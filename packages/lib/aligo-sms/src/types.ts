/**
 * 알리고(Aligo) SMS API 타입 정의
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] EUC-KR 인코딩 주의 - 특수문자/이모지 변환 가능성
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/spec.html
 */

// ============================================================================
// 공통 타입
// ============================================================================

/**
 * 알리고 API 인증 정보
 */
export interface AligoCredentials {
  /** 인증용 API Key */
  key: string;
  /** 사용자 ID */
  user_id: string;
  /** 발신자 전화번호 (최대 16bytes, 사전 등록 필요) */
  sender: string;
}

/**
 * 메시지 타입
 * - SMS: 단문 (90bytes 이하)
 * - LMS: 장문 (90bytes 초과, 첨부파일 없음)
 * - MMS: 그림문자 (이미지 첨부)
 */
export type AligoMessageType = 'SMS' | 'LMS' | 'MMS';

/**
 * 알리고 API 기본 응답
 */
export interface AligoBaseResponse {
  /** 결과 코드 (1 이상: 성공, 0 미만: 실패) */
  result_code: number;
  /** 결과 메시지 (실패 시 사유) */
  message: string;
}

// ============================================================================
// 문자 발송 (단건/동일 내용 다건)
// ============================================================================

/**
 * 문자 발송 요청 파라미터 (/send/)
 *
 * 동일한 내용의 문자를 최대 1,000명에게 동시 전송
 */
export interface AligoSendRequest {
  /** 수신자 전화번호 (컴마 분기로 최대 1,000명) */
  receiver: string;
  /** 메시지 내용 (1~2,000Byte) */
  msg: string;
  /** 메시지 타입 (미지정 시 90byte 초과시 LMS 자동 전환) */
  msg_type?: AligoMessageType;
  /** 문자 제목 (LMS, MMS만 허용, 1~44Byte) */
  title?: string;
  /** %고객명% 치환용 입력 (예: "01011111111|홍길동,01022222222|김철수") */
  destination?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약 시간 (HHMM, 현재 시간 기준 10분 이후) */
  rtime?: string;
  /** 연동 테스트 모드 (Y: 실제 발송 안함) */
  testmode_yn?: 'Y' | 'N';
}

/**
 * 문자 발송 응답
 */
export interface AligoSendResponse extends AligoBaseResponse {
  /** 메시지 고유 ID */
  msg_id?: number;
  /** 요청 성공 건수 */
  success_cnt?: number;
  /** 요청 실패 건수 */
  error_cnt?: number;
  /** 메시지 타입 (1: SMS, 2: LMS, 3: MMS) */
  msg_type?: string;
}

// ============================================================================
// 문자 발송 (대량 - 개별 내용)
// ============================================================================

/**
 * 대량 문자 발송 개별 메시지
 */
export interface AligoMassMessageItem {
  /** 수신자 전화번호 */
  receiver: string;
  /** 메시지 내용 (1~2,000Byte) */
  msg: string;
}

/**
 * 대량 문자 발송 요청 파라미터 (/send_mass/)
 *
 * 각각 다른 내용의 문자를 최대 500명에게 동시 전송
 */
export interface AligoSendMassRequest {
  /** 메시지 목록 (최대 500건) */
  messages: AligoMassMessageItem[];
  /** 메시지 타입 (필수 - SMS/LMS/MMS 혼용 불가) */
  msg_type: AligoMessageType;
  /** 문자 제목 (LMS, MMS만 허용, 공통 적용) */
  title?: string;
  /** 예약일 (YYYYMMDD) */
  rdate?: string;
  /** 예약 시간 (HHMM, 현재 시간 기준 10분 이후) */
  rtime?: string;
  /** 연동 테스트 모드 (Y: 실제 발송 안함) */
  testmode_yn?: 'Y' | 'N';
}

/**
 * 대량 문자 발송 응답
 */
export interface AligoSendMassResponse extends AligoBaseResponse {
  /** 메시지 고유 ID */
  msg_id?: number;
  /** 요청 성공 건수 */
  success_cnt?: number;
  /** 요청 실패 건수 */
  error_cnt?: number;
  /** 메시지 타입 (1: SMS, 2: LMS, 3: MMS) */
  msg_type?: string;
}

// ============================================================================
// 전송 내역 조회
// ============================================================================

/**
 * 전송 내역 조회 요청 파라미터 (/list/)
 */
export interface AligoListRequest {
  /** 페이지 번호 (기본 1) */
  page?: number;
  /** 페이지당 출력 개수 (기본 30, 최대 500) */
  page_size?: number;
  /** 조회 시작 일자 (YYYYMMDD, 기본 최근일자) */
  start_date?: string;
  /** 조회 마감 일자 (시작일 기준 며칠 전까지) */
  limit_day?: number;
}

/**
 * 전송 내역 항목
 */
export interface AligoListItem {
  /** 메시지 ID */
  mid: string;
  /** 문자 구분 (유형) */
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
 * 전송 내역 조회 응답
 */
export interface AligoListResponse extends AligoBaseResponse {
  /** 목록 배열 */
  list?: AligoListItem[];
  /** 다음 조회 목록 유무 */
  next_yn?: string;
}

// ============================================================================
// 전송 결과 상세 조회
// ============================================================================

/**
 * 전송 결과 상세 조회 요청 파라미터 (/sms_list/)
 */
export interface AligoSmsListRequest {
  /** 메시지 고유 ID */
  mid: number;
  /** 페이지 번호 (기본 1) */
  page?: number;
  /** 페이지당 출력 개수 (기본 30, 최대 500) */
  page_size?: number;
}

/**
 * 전송 결과 상세 항목
 */
export interface AligoSmsListItem {
  /** 메시지 상세 ID */
  mdid: string;
  /** 문자 구분 (유형) */
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
 * 전송 결과 상세 조회 응답
 */
export interface AligoSmsListResponse extends AligoBaseResponse {
  /** 목록 배열 */
  list?: AligoSmsListItem[];
  /** 다음 조회 목록 유무 */
  next_yn?: string;
}

// ============================================================================
// 발송 가능 건수 조회
// ============================================================================

/**
 * 발송 가능 건수 조회 응답 (/remain/)
 */
export interface AligoRemainResponse extends AligoBaseResponse {
  /** 단문 전송 시 발송 가능 건수 */
  SMS_CNT?: number;
  /** 장문 전송 시 발송 가능 건수 */
  LMS_CNT?: number;
  /** 그림(사진) 전송 시 발송 가능 건수 */
  MMS_CNT?: number;
}

// ============================================================================
// 예약 문자 취소
// ============================================================================

/**
 * 예약 문자 취소 요청 파라미터 (/cancel/)
 */
export interface AligoCancelRequest {
  /** 메시지 ID */
  mid: number;
}

/**
 * 예약 문자 취소 응답
 */
export interface AligoCancelResponse extends AligoBaseResponse {
  /** 취소 일자 */
  cancel_date?: string;
}

// ============================================================================
// 클라이언트 옵션
// ============================================================================

/**
 * 알리고 클라이언트 옵션
 */
export interface AligoClientOptions {
  /** 인증 정보 */
  credentials: AligoCredentials;
  /** 테스트 모드 (기본값: false) */
  testMode?: boolean;
  /** API 타임아웃 (ms, 기본값: 30000) */
  timeout?: number;
}

// ============================================================================
// 에러 타입
// ============================================================================

/**
 * 알리고 API 에러
 */
export class AligoApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly response?: AligoBaseResponse
  ) {
    super(message);
    this.name = 'AligoApiError';
  }
}

// ============================================================================
// 유틸리티 타입
// ============================================================================

/**
 * 메시지 바이트 계산 결과
 */
export interface MessageByteInfo {
  /** 바이트 수 */
  bytes: number;
  /** 권장 메시지 타입 */
  recommendedType: AligoMessageType;
  /** SMS 한도 초과 여부 */
  exceedsSmsLimit: boolean;
}

/**
 * 발송 결과 (통합)
 */
export interface SendResult {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 ID */
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
}
