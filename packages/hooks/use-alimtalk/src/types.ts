/**
 * 알림톡 관련 타입 정의
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
 */

/**
 * 발송 결과 채널 타입 (발송 후 결과에 사용)
 * - 사용자 입력에서는 채널 선택 불가
 * - 발송 결과에서 어떤 채널이 사용되었는지 표시
 */
export type UsedChannel = 'alimtalk' | 'sms' | 'none';

/**
 * 템플릿 정보
 */
export interface AlimtalkTemplate {
  /** 템플릿 코드 */
  code: string;
  /** 템플릿 이름 */
  name: string;
  /** 템플릿 내용 */
  content: string;
  /** 템플릿 상태 (R: 대기, A: 승인, S: 중단) */
  status: string;
  /** 템플릿 메시지 타입 (BA/EX/AD/MI) */
  messageType?: string;
  /** 강조 표기 타입 */
  emphasisType?: string;
  /** 버튼 목록 */
  buttons?: AlimtalkButton[];
}

/**
 * 템플릿 버튼
 */
export interface AlimtalkButton {
  /** 버튼 타입 */
  type: string;
  /** 버튼 이름 */
  name: string;
  /** 링크 URL (모바일) */
  urlMobile?: string;
  /** 링크 URL (PC) */
  urlPc?: string;
}

/**
 * 알림톡 수신자
 */
export interface AlimtalkRecipient {
  /** 수신자 전화번호 */
  phone: string;
  /** 수신자 이름 */
  name?: string;
  /** 템플릿 변수 (#{변수명} 치환용) */
  variables?: Record<string, string>;
}

/**
 * 알림톡 발송 요청
 */
export interface SendAlimtalkRequest {
  /** 템플릿 코드 */
  templateCode: string;
  /** 수신자 목록 */
  recipients: AlimtalkRecipient[];
  /** SMS 폴백 사용 여부 */
  useFallback?: boolean;
  /** SMS 폴백 메시지 (미지정 시 알림톡 메시지 사용) */
  fallbackMessage?: string;
  /** 예약 발송 시간 (ISO 8601) */
  scheduledAt?: string;
}

/**
 * 발송 결과
 * [불변 규칙] 채널 선택 제거됨 - 알림톡 기본, SMS는 폴백으로만 작동
 */
export interface SendResult {
  /** 성공 여부 */
  success: boolean;
  /** 사용된 채널 (발송 후 결과) */
  usedChannel: UsedChannel;
  /** 폴백 사용 여부 */
  usedFallback: boolean;
  /** 성공 건수 */
  successCount: number;
  /** 실패 건수 */
  errorCount: number;
  /** 메시지 ID */
  messageId?: string;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 테스트 모드 여부 */
  testMode: boolean;
}

/**
 * 발송 내역 항목
 */
export interface SendHistory {
  /** 메시지 ID */
  mid: string;
  /** 발송 타입 */
  type: string;
  /** 발신 프로필 */
  sender: string;
  /** 발송 건수 */
  count: number;
  /** 상태 */
  status: string;
  /** 예약일 */
  reserveDate?: string;
  /** 등록일 */
  createdAt: string;
}

/**
 * 잔여 포인트
 */
export interface RemainPoints {
  /** 알림톡 잔여 건수 */
  alimtalk: number;
  /** 친구톡 텍스트 잔여 건수 */
  friendtalkText: number;
  /** 친구톡 이미지 잔여 건수 */
  friendtalkImage: number;
  /** 친구톡 와이드 잔여 건수 */
  friendtalkWide: number;
}

/**
 * 훅 상태
 */
export interface UseAlimtalkState {
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 템플릿 목록 */
  templates: AlimtalkTemplate[];
  /** 잔여 포인트 */
  remainPoints: RemainPoints | null;
}

/**
 * 훅 액션
 */
export interface UseAlimtalkActions {
  /** 알림톡 발송 */
  sendAlimtalk: (request: SendAlimtalkRequest) => Promise<SendResult>;
  /** 템플릿 목록 조회 */
  fetchTemplates: () => Promise<void>;
  /** 발송 내역 조회 */
  fetchHistory: (options?: { page?: number; limit?: number }) => Promise<SendHistory[]>;
  /** 잔여 포인트 조회 */
  fetchRemainPoints: () => Promise<void>;
  /** 예약 발송 취소 */
  cancelScheduled: (mid: string) => Promise<boolean>;
}

/**
 * useAlimtalk 훅 반환 타입
 */
export type UseAlimtalkReturn = UseAlimtalkState & UseAlimtalkActions;
