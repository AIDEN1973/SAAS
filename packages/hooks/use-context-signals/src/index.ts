/**
 * useContextSignals Hook
 *
 * 프론트 자동화 문서 1.2.1 섹션 참조
 * 정본 권장 이름: useContextSignals
 *
 * 역할:
 * - 상황 신호 수집 (Context Signal Collection)
 * - UI 조정 (Priority 가중치, 배너 표시)
 * - 자동 화면 전환 금지 (navigate() 자동 호출 금지)
 * - 실행 금지 (프론트엔드는 실행하지 않음)
 *
 * 레거시 호환: useAdaptiveNavigation과 동일한 기능 제공
 */

export { useAdaptiveNavigation as useContextSignals } from '@hooks/use-adaptive-navigation';

