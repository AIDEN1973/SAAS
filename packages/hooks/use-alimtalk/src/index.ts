/**
 * 알림톡 발송 React Hook
 *
 * [불변 규칙] 업종 중립 - 모든 테넌트에서 즉시 활용 가능
 * [불변 규칙] 알림톡 기본, SMS 폴백 지원
 */

export { useAlimtalk } from './useAlimtalk';
export { useAlimtalkSettings } from './useAlimtalkSettings';

export type {
  // 훅 반환 타입
  UseAlimtalkReturn,
  UseAlimtalkState,
  UseAlimtalkActions,

  // 데이터 타입
  UsedChannel,
  AlimtalkTemplate,
  AlimtalkButton,
  AlimtalkRecipient,
  SendAlimtalkRequest,
  SendResult,
  SendHistory,
  RemainPoints,
} from './types';

export type {
  // 설정 훅 타입
  UseAlimtalkSettingsReturn,
  AlimtalkStatus,
  AlimtalkProfile,
  AlimtalkCategory,
  AlimtalkTemplateInfo,
  AlimtalkHistoryItem,
  AlimtalkHistoryDetailItem,
  AlimtalkRemainPoints,
  AddTemplateRequest,
  ModifyTemplateRequest,
  OperationResult,
  AddTemplateResult,
  ButtonType,
  TemplateMessageType,
  EmphasisType,
  TemplateButton,
} from './useAlimtalkSettings';
