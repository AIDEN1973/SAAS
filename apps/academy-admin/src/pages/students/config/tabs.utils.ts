/**
 * Student Tabs Utilities
 *
 * 탭 관련 유틸리티 함수들
 */

import { STUDENT_TABS } from './tabs.config';
import type { StudentTabId, StudentTab } from './tabs.config';

/**
 * 탭 ID 유효성 검증
 */
export function isValidTabId(value: string | null): value is StudentTabId {
  if (!value) return false;
  return STUDENT_TABS.some(tab => tab.id === value);
}

/**
 * 탭 ID로 탭 설정 조회
 */
export function getTabById(tabId: StudentTabId): StudentTab | undefined {
  return STUDENT_TABS.find(tab => tab.id === tabId);
}

/**
 * URL 경로로부터 초기 탭 결정
 */
export function getInitialTabFromPath(pathname: string, queryTab: string | null): StudentTabId {
  // URL 경로 기반 매핑
  if (pathname.includes('/attendance')) return 'attendance';
  if (pathname.includes('/risk')) return 'risk';
  if (pathname.includes('/welcome') || pathname.includes('/message')) return 'message';
  if (pathname.includes('/guardians')) return 'guardians';
  if (pathname.includes('/consultations')) return 'consultations';
  if (pathname.includes('/tags')) return 'tags';
  if (pathname.includes('/classes')) return 'classes';

  // 쿼리 파라미터 기반
  if (queryTab && isValidTabId(queryTab)) {
    return queryTab as StudentTabId;
  }

  // 기본값
  return 'info';
}
