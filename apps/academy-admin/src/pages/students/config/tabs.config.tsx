/**
 * Student Tabs Configuration
 *
 * PERSON 상세 레이어 메뉴의 탭 설정 중앙화
 * [확장성] 새 탭 추가 시 이 파일만 수정하면 됨
 * [업종중립] 라벨은 IndustryTerms를 통해 동적으로 생성
 */

import { User, MessageSquare, Tag, BookOpen, Calendar, AlertTriangle, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IndustryTerms } from '@industry/registry';

export type StudentTabId = 'info' | 'consultations' | 'tags' | 'classes' | 'attendance' | 'risk' | 'message';

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
 * 탭 설정의 정적 부분 (아이콘, 옵션 등)
 */
const TAB_CONFIG: Record<StudentTabId, Omit<StudentTab, 'id' | 'label'>> = {
  info: {
    icon: User,
  },
  consultations: {
    icon: MessageSquare,
    showCount: true,
  },
  tags: {
    icon: Tag,
  },
  classes: {
    icon: BookOpen,
    showCount: true,
  },
  attendance: {
    icon: Calendar,
  },
  risk: {
    icon: AlertTriangle,
  },
  message: {
    icon: Send,
  },
};

/**
 * 탭 순서: 기본정보 → 수업배정 → 상담내역 → 태그 → 출결 → 이탈위험 → 문자발송
 */
const TAB_ORDER: StudentTabId[] = ['info', 'classes', 'consultations', 'tags', 'attendance', 'risk', 'message'];

/**
 * PERSON 상세 레이어 메뉴 탭 설정 생성 함수
 * @param terms - 업종별 용어 객체
 * @returns 탭 설정 배열
 */
export function getStudentTabs(terms: IndustryTerms): readonly StudentTab[] {
  const labelMap: Record<StudentTabId, string> = {
    info: '기본정보',
    classes: terms.GROUP_LABEL + '배정',
    consultations: terms.CONSULTATION_LABEL + '내역',
    tags: terms.TAG_LABEL,
    attendance: terms.ATTENDANCE_LABEL,
    risk: '이탈위험',
    message: '문자발송',
  };

  return TAB_ORDER.map((id) => ({
    id,
    label: labelMap[id],
    ...TAB_CONFIG[id],
  }));
}

/**
 * @deprecated STUDENT_TABS는 업종 중립화를 위해 getStudentTabs(terms)로 대체됨
 * 기존 코드 호환성을 위해 유지하지만, 새 코드에서는 getStudentTabs 사용 권장
 */
export const STUDENT_TABS: readonly StudentTab[] = [
  {
    id: 'info',
    label: '기본정보',
    icon: User,
  },
  {
    id: 'classes',
    label: '수업배정',
    icon: BookOpen,
    showCount: true,
  },
  {
    id: 'consultations',
    label: '상담내역',
    icon: MessageSquare,
    showCount: true,
  },
  {
    id: 'tags',
    label: '태그',
    icon: Tag,
  },
  {
    id: 'attendance',
    label: '출결',
    icon: Calendar,
  },
  {
    id: 'risk',
    label: '이탈위험',
    icon: AlertTriangle,
  },
  {
    id: 'message',
    label: '문자발송',
    icon: Send,
  },
];
