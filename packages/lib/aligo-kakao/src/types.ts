/**
 * 알리고 카카오 알림톡/친구톡 API 타입 정의
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 *
 * 공식 문서: https://smartsms.aligo.in/admin/api/kakao.html
 * API 기본 URL: https://kakaoapi.aligo.in
 */

// ============================================================================
// 공통 타입
// ============================================================================

/**
 * 카카오 API 인증 정보
 */
export interface KakaoCredentials {
  /** 인증용 API Key */
  apikey: string;
  /** 알리고 사용자 ID */
  userid: string;
  /** 카카오 발신 프로필 키 (senderkey) */
  senderkey: string;
  /** 인증 토큰 (token) - 프로필 인증 후 발급 */
  token?: string;
}

/**
 * 메시지 타입
 */
export type KakaoMessageType = 'AT' | 'AI' | 'FT' | 'FI' | 'FW';

/**
 * 템플릿 메시지 타입
 * - BA: 기본형
 * - EX: 부가정보형
 * - AD: 채널추가형/복합형
 * - MI: 복합형
 */
export type TemplateMessageType = 'BA' | 'EX' | 'AD' | 'MI';

/**
 * 강조 표기 타입
 * - TEXT: 강조 텍스트
 * - IMAGE: 이미지
 * - ITEM_LIST: 아이템리스트
 * - NONE: 없음
 */
export type EmphasisType = 'TEXT' | 'IMAGE' | 'ITEM_LIST' | 'NONE';

/**
 * 알리고 카카오 API 기본 응답
 */
export interface KakaoBaseResponse {
  /** 결과 코드 (0: 성공, 음수: 실패) */
  code: number;
  /** 결과 메시지 */
  message: string;
}

// ============================================================================
// 채널 인증 (토큰 발급)
// ============================================================================

/**
 * 토큰 생성 요청 (/akv10/token/create/1000/y/)
 */
export interface TokenCreateRequest {
  /** 카카오 발신 프로필 키 */
  plusid: string;
  /** 전화번호 (- 없이) */
  phonenumber: string;
}

/**
 * 토큰 생성 응답
 */
export interface TokenCreateResponse extends KakaoBaseResponse {
  /** 인증 요청 처리 결과 */
  data?: {
    /** 인증 토큰 (유효시간 24시간) */
    token?: string;
  };
}

// ============================================================================
// 카테고리 조회
// ============================================================================

/**
 * 카테고리 항목
 */
export interface CategoryItem {
  /** 카테고리 코드 */
  code: string;
  /** 카테고리 이름 */
  name: string;
  /** 하위 카테고리 조회 그룹 코드 */
  groupCode?: string;
}

/**
 * 카테고리 조회 응답
 */
export interface CategoryListResponse extends KakaoBaseResponse {
  /** 카테고리 목록 */
  list?: CategoryItem[];
}

// ============================================================================
// 발신 프로필 관리
// ============================================================================

/**
 * 프로필 등록 요청 (/akv10/profile/add/)
 */
export interface ProfileAddRequest {
  /** 발신 프로필 키 (@채널ID) */
  plusid: string;
  /** 카테고리 코드 */
  categorycode: string;
  /** 전화번호 (- 없이) */
  phonenumber: string;
}

/**
 * 프로필 등록 응답
 */
export interface ProfileAddResponse extends KakaoBaseResponse {
  data?: {
    /** 발신 프로필 키 */
    senderKey?: string;
  };
}

/**
 * 발신 프로필 정보
 */
export interface ProfileInfo {
  /** 발신 프로필 키 */
  senderKey: string;
  /** 카테고리 코드 */
  categoryCode: string;
  /** 채널 이름 */
  channelName?: string;
  /** 상태 */
  status: string;
  /** 등록일 */
  regDate?: string;
}

/**
 * 프로필 조회 응답
 */
export interface ProfileListResponse extends KakaoBaseResponse {
  list?: ProfileInfo[];
}

// ============================================================================
// 템플릿 관리
// ============================================================================

/**
 * 버튼 타입
 */
export type ButtonType = 'WL' | 'AL' | 'DS' | 'BK' | 'MD' | 'BC' | 'BT' | 'AC' | 'P1' | 'P2' | 'P3';

/**
 * 템플릿 버튼
 */
export interface TemplateButton {
  /** 버튼 타입 */
  type: ButtonType;
  /** 버튼 이름 (최대 28자) */
  name: string;
  /** 링크 (모바일) */
  url_mobile?: string;
  /** 링크 (PC) */
  url_pc?: string;
  /** 스키마 링크 (Android) */
  scheme_android?: string;
  /** 스키마 링크 (iOS) */
  scheme_ios?: string;
  /** 플러그인 ID */
  plugin_id?: string;
  /** 릴레이 ID */
  relay_id?: string;
  /** 원터치 결제 ID */
  oneclick_id?: string;
  /** 배송 추적 상태 (WEB/CHAT) */
  ds_chat?: string;
}

/**
 * 템플릿 정보
 */
export interface TemplateInfo {
  /** 템플릿 코드 */
  templtCode: string;
  /** 템플릿 이름 */
  templtName: string;
  /** 템플릿 내용 */
  templtContent: string;
  /** 템플릿 상태 (R: 대기, A: 승인, S: 중단) */
  status: string;
  /** 검수 상태 */
  inspStatus?: string;
  /** 템플릿 메시지 타입 */
  templateMessageType?: TemplateMessageType;
  /** 강조 표기 타입 */
  templateEmphasisType?: EmphasisType;
  /** 강조 제목 (강조 표기 시) */
  emphasisTitle?: string;
  /** 강조 부제목 (강조 표기 시) */
  emphasisSubTitle?: string;
  /** 부가정보 (EX 타입) */
  extra?: string;
  /** 광고 문구 (AD 타입) */
  ad?: string;
  /** 버튼 목록 */
  buttons?: TemplateButton[];
  /** 등록일 */
  cdate?: string;
  /** 카테고리 코드 */
  categoryCode?: string;
  /** 보안 템플릿 여부 (Y/N) */
  securityFlag?: string;
}

/**
 * 템플릿 목록 조회 요청
 */
export interface TemplateListRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 인증 토큰 */
  token: string;
  /** 템플릿 코드 (특정 템플릿 조회 시) */
  tpl_code?: string;
}

/**
 * 템플릿 목록 조회 응답
 */
export interface TemplateListResponse extends KakaoBaseResponse {
  list?: TemplateInfo[];
}

/**
 * 템플릿 등록 요청
 */
export interface TemplateAddRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 인증 토큰 */
  token: string;
  /** 템플릿 이름 (최대 150자) */
  tpl_name: string;
  /** 템플릿 내용 (최대 1000자) */
  tpl_content: string;
  /** 템플릿 메시지 타입 */
  tpl_message_type?: TemplateMessageType;
  /** 강조 표기 타입 */
  tpl_emphasis_type?: EmphasisType;
  /** 강조 제목 */
  emphasis_title?: string;
  /** 강조 부제목 */
  emphasis_subtitle?: string;
  /** 부가정보 */
  tpl_extra?: string;
  /** 광고 문구 */
  tpl_ad?: string;
  /** 버튼 목록 (JSON) */
  tpl_button?: TemplateButton[];
  /** 카테고리 코드 */
  category_code?: string;
  /** 보안 템플릿 여부 */
  security_flag?: 'Y' | 'N';
}

/**
 * 템플릿 등록 응답
 */
export interface TemplateAddResponse extends KakaoBaseResponse {
  data?: {
    /** 생성된 템플릿 코드 */
    templtCode?: string;
  };
}

/**
 * 템플릿 수정 요청
 */
export interface TemplateModifyRequest extends TemplateAddRequest {
  /** 수정할 템플릿 코드 */
  tpl_code: string;
}

/**
 * 템플릿 삭제 요청
 */
export interface TemplateDeleteRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 인증 토큰 */
  token: string;
  /** 삭제할 템플릿 코드 */
  tpl_code: string;
}

/**
 * 템플릿 검수 요청
 */
export interface TemplateRequestRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 인증 토큰 */
  token: string;
  /** 검수 요청할 템플릿 코드 */
  tpl_code: string;
}

// ============================================================================
// 알림톡 발송
// ============================================================================

/**
 * 알림톡 발송 수신자
 */
export interface AlimtalkRecipient {
  /** 수신자 전화번호 */
  receiver_1: string;
  /** 수신자 이름 (optional) */
  recvname_1?: string;
  /** 템플릿 치환 변수 (#{변수명}) */
  [key: string]: string | undefined;
}

/**
 * 알림톡 발송 요청 (/akv10/alimtalk/send/)
 */
export interface AlimtalkSendRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 템플릿 코드 */
  tpl_code: string;
  /** 발신자 (SMS 대체발송용) */
  sender?: string;
  /** 메시지 (템플릿과 동일해야 함, 변수 치환 후) */
  msg_1: string;
  /** 수신자 전화번호 */
  receiver_1: string;
  /** 수신자 이름 */
  recvname_1?: string;
  /** SMS 대체발송 타입 (SMS/LMS/MMS) - 없으면 대체발송 안함 */
  failover?: 'Y' | 'N';
  /** 대체발송 메시지 타입 */
  fsubject_1?: string;
  /** 대체발송 메시지 내용 */
  fmessage_1?: string;
  /** 버튼 정보 (JSON) */
  button_1?: string;
  /** 예약 일시 (YYYYMMDDHHmmss) */
  senddate?: string;
  /** 테스트 모드 */
  testMode?: 'Y' | 'N';
}

/**
 * 알림톡 대량 발송 요청
 */
export interface AlimtalkBulkSendRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 템플릿 코드 */
  tpl_code: string;
  /** 발신자 (SMS 대체발송용) */
  sender?: string;
  /** 수신자 목록 (최대 500명) */
  recipients: Array<{
    receiver: string;
    recvname?: string;
    msg: string;
    button?: string;
    failover?: 'Y' | 'N';
    fsubject?: string;
    fmessage?: string;
  }>;
  /** 예약 일시 */
  senddate?: string;
  /** 테스트 모드 */
  testMode?: 'Y' | 'N';
}

/**
 * 알림톡 발송 응답
 */
export interface AlimtalkSendResponse extends KakaoBaseResponse {
  info?: {
    /** 발송 타입 */
    type: string;
    /** 메시지 ID */
    mid: string;
    /** 요청 건수 */
    cnt: number;
    /** 현재 잔액 */
    current?: string;
    /** 전송 가격 */
    unit?: number;
    /** 전체 가격 */
    total?: number;
    /** 스케줄 코드 */
    scnt?: number;
  };
}

// ============================================================================
// 친구톡 발송
// ============================================================================

/**
 * 친구톡 발송 요청 (/akv10/friend/send/)
 */
export interface FriendtalkSendRequest {
  /** 발신 프로필 키 */
  senderkey: string;
  /** 광고 여부 (Y: 광고, N: 일반) */
  adFlag?: 'Y' | 'N';
  /** 발신자 (SMS 대체발송용) */
  sender?: string;
  /** 메시지 내용 */
  msg_1: string;
  /** 수신자 전화번호 */
  receiver_1: string;
  /** 수신자 이름 */
  recvname_1?: string;
  /** 이미지 URL */
  image_1?: string;
  /** 와이드 이미지 사용 여부 */
  image_type?: 'W' | 'S';
  /** 버튼 정보 (JSON) */
  button_1?: string;
  /** SMS 대체발송 여부 */
  failover?: 'Y' | 'N';
  /** 대체발송 메시지 타입 */
  fsubject_1?: string;
  /** 대체발송 메시지 내용 */
  fmessage_1?: string;
  /** 예약 일시 */
  senddate?: string;
  /** 테스트 모드 */
  testMode?: 'Y' | 'N';
}

/**
 * 친구톡 발송 응답
 */
export interface FriendtalkSendResponse extends KakaoBaseResponse {
  info?: {
    type: string;
    mid: string;
    cnt: number;
    current?: string;
    unit?: number;
    total?: number;
  };
}

// ============================================================================
// 발송 내역 조회
// ============================================================================

/**
 * 발송 내역 조회 요청 (/akv10/history/list/)
 */
export interface HistoryListRequest {
  /** 페이지 번호 */
  page?: number;
  /** 페이지당 출력 개수 (최대 500) */
  limit?: number;
  /** 조회 시작일 (YYYYMMDD) */
  startdate?: string;
  /** 조회 종료일 (YYYYMMDD) */
  enddate?: string;
}

/**
 * 발송 내역 항목
 */
export interface HistoryItem {
  /** 메시지 ID */
  mid: string;
  /** 발송 타입 (AT/FT 등) */
  type: string;
  /** 발신 프로필 */
  sender: string;
  /** 요청 건수 */
  cnt: string;
  /** 상태 */
  state: string;
  /** 예약일 */
  reserve: string;
  /** 등록일 */
  regdate: string;
}

/**
 * 발송 내역 조회 응답
 */
export interface HistoryListResponse extends KakaoBaseResponse {
  list?: HistoryItem[];
  currentPage?: number;
  totalPage?: number;
}

/**
 * 발송 상세 조회 요청 (/akv10/history/detail/)
 */
export interface HistoryDetailRequest {
  /** 메시지 ID */
  mid: number;
  /** 페이지 번호 */
  page?: number;
  /** 페이지당 출력 개수 */
  limit?: number;
}

/**
 * 발송 상세 항목
 */
export interface HistoryDetailItem {
  /** 수신자 번호 */
  receiver: string;
  /** 발송 상태 */
  status: string;
  /** 상태 코드 */
  code: string;
  /** 발송일 */
  senddate: string;
  /** 결과 수신일 */
  reportdate?: string;
}

/**
 * 발송 상세 조회 응답
 */
export interface HistoryDetailResponse extends KakaoBaseResponse {
  list?: HistoryDetailItem[];
  currentPage?: number;
  totalPage?: number;
}

// ============================================================================
// 잔여 포인트 조회
// ============================================================================

/**
 * 잔여 포인트 조회 응답 (/akv10/remain/)
 */
export interface RemainResponse extends KakaoBaseResponse {
  /** 잔여 포인트 (알림톡) */
  AT_CNT?: number;
  /** 잔여 포인트 (친구톡 텍스트) */
  FT_CNT?: number;
  /** 잔여 포인트 (친구톡 이미지) */
  FI_CNT?: number;
  /** 잔여 포인트 (친구톡 와이드) */
  FW_CNT?: number;
}

// ============================================================================
// 예약 취소
// ============================================================================

/**
 * 예약 취소 요청 (/akv10/cancel/)
 */
export interface CancelRequest {
  /** 메시지 ID */
  mid: number;
}

/**
 * 예약 취소 응답
 */
export interface CancelResponse extends KakaoBaseResponse {
  data?: {
    /** 취소 건수 */
    cnt?: number;
  };
}

// ============================================================================
// 클라이언트 옵션
// ============================================================================

/**
 * 카카오 클라이언트 옵션
 */
export interface KakaoClientOptions {
  /** 인증 정보 */
  credentials: KakaoCredentials;
  /** 테스트 모드 (기본값: true, 안전 기본값) */
  testMode?: boolean;
  /** API 타임아웃 (ms, 기본값: 30000) */
  timeout?: number;
}

// ============================================================================
// 에러 타입
// ============================================================================

/**
 * 카카오 API 에러
 */
export class KakaoApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly response?: KakaoBaseResponse
  ) {
    super(message);
    this.name = 'KakaoApiError';
  }
}

// ============================================================================
// 발송 결과 (통합)
// ============================================================================

/**
 * 발송 결과
 */
export interface SendResult {
  /** 성공 여부 */
  success: boolean;
  /** 메시지 ID */
  mid?: string;
  /** 발송 건수 */
  count: number;
  /** 발송 타입 */
  type?: KakaoMessageType;
  /** 폴백 사용 여부 */
  usedFallback?: boolean;
  /** 에러 메시지 (실패 시) */
  errorMessage?: string;
  /** 에러 코드 (실패 시) */
  errorCode?: number;
}

/**
 * 통합 메시지 발송 결과 (알림톡 + SMS 폴백)
 */
export interface UnifiedSendResult {
  /** 최종 성공 여부 */
  success: boolean;
  /** 알림톡 발송 결과 */
  alimtalk?: SendResult;
  /** SMS 폴백 발송 결과 (알림톡 실패 시) */
  smsFallback?: {
    success: boolean;
    msgId?: number;
    successCount: number;
    errorCount: number;
    errorMessage?: string;
  };
  /** 사용된 채널 */
  channel: 'alimtalk' | 'sms' | 'none';
  /** 총 성공 건수 */
  totalSuccessCount: number;
  /** 총 실패 건수 */
  totalErrorCount: number;
}
