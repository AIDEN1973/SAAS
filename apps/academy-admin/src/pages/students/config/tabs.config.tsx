/**
 * Student Tabs Configuration
 *
 * 학생 상세 레이어 메뉴의 탭 설정 중앙화
 * [확장성] 새 탭 추가 시 이 파일만 수정하면 됨
 */

import { User, Users, MessageSquare, Tag, BookOpen, Calendar, AlertTriangle, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StudentTabId = 'info' | 'guardians' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'message';

export interface StudentTab {
  id: StudentTabId;
  label: string;
  icon: LucideIcon;
  /**
   * 탭 표시 시 카운트 표시 여부
   * true인 경우 label 뒤에 (count) 형태로 표시
   */
  showCount?: boolean;
  /**
   * 탭에 접근 가능한 최소 권한
   * undefined인 경우 모든 사용자 접근 가능
   */
  minRole?: 'admin' | 'teacher' | 'assistant';
}

/**
 * 학생 상세 레이어 메뉴 탭 설정
 */
export const STUDENT_TABS: readonly StudentTab[] = [
  {
    id: 'info',
    label: '기본정보',
    icon: User,
  },
  {
    id: 'guardians',
    label: '학부모정보',
    icon: Users,
    showCount: true,
  },
  {
    id: 'consultations',
    label: '상담일지',
    icon: MessageSquare,
    showCount: true,
  },
  {
    id: 'tags',
    label: '태그관리',
    icon: Tag,
  },
  {
    id: 'classes',
    label: '반배정',
    icon: BookOpen,
    showCount: true,
  },
  {
    id: 'attendance',
    label: '출결기록',
    icon: Calendar,
  },
  {
    id: 'risk',
    label: '이탈위험',
    icon: AlertTriangle,
  },
  {
    id: 'message',
    label: '메시지 발송',
    icon: Send,
  },
] as const;

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
