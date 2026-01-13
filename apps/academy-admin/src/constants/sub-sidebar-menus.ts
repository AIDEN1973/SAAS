/**
 * 서브 사이드바 메뉴 설정
 *
 * [불변 규칙] 각 페이지의 서브 사이드바 메뉴 항목을 SSOT로 관리
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용
 *
 * @example
 * ```tsx
 * import { ATTENDANCE_SUB_MENU_ITEMS } from '../constants';
 * <SubSidebar items={ATTENDANCE_SUB_MENU_ITEMS} ... />
 * ```
 */

import { createElement } from 'react';
import type { SubSidebarMenuItem } from '@ui-core/react';
import {
  LayoutDashboard,
  Users,
  CircleCheckBig,
  Mail,
  BarChart3,
  Brain,
  GraduationCap,
  UserPen,
  CreditCard,
  Settings,
  MessageCircle,
  Search,
  Clock,
  Bot,
  UserPlus,
  List,
  Tags,
  TrendingUp,
  Send,
  FileText,
  History,
  Calendar,
  PieChart,
  Zap,
  Bell,
  Link,
  Wallet,
  Receipt,
  CircleDollarSign,
  Cog,
  Play,
} from 'lucide-react';

/** 아이콘 크기 (CSS 변수 참조) */
const ICON_SIZE = 16;

/** 출결관리 페이지 서브 메뉴 ID */
export type AttendanceSubMenuId =
  | 'today'
  | 'history'
  | 'statistics'
  | 'settings';

/** 출결관리 페이지 서브 메뉴 설정 (아이콘은 페이지에서 동적으로 주입) */
export const ATTENDANCE_SUB_MENU_ITEMS: SubSidebarMenuItem<AttendanceSubMenuId>[] = [
  {
    id: 'today',
    label: '오늘 출결',
    ariaLabel: '오늘 출결 관리 화면으로 이동',
  },
  {
    id: 'history',
    label: '출결 기록',
    ariaLabel: '출결 기록 조회 화면으로 이동',
  },
  {
    id: 'statistics',
    label: '출결 통계',
    ariaLabel: '출결 통계 화면으로 이동',
  },
  {
    id: 'settings',
    label: '출결 설정',
    ariaLabel: '출결 설정 화면으로 이동',
  },
];

/** 서브 사이드바 기본 너비 (CSS 변수) */
export const SUB_SIDEBAR_WIDTH = 'var(--width-agent-history-sidebar)';

// ============================================================================
// 매뉴얼 페이지 서브 메뉴 설정
// ============================================================================

/** 매뉴얼 페이지 서브 메뉴 ID */
export type ManualSubMenuId =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'notifications'
  | 'analytics'
  | 'ai'
  | 'classes'
  | 'teachers'
  | 'billing'
  | 'automation'
  | 'alimtalk'
  | 'search'
  | 'timeline'
  | 'agent';

/** 매뉴얼 페이지 서브 메뉴 설정 */
export const MANUAL_SUB_MENU_ITEMS: SubSidebarMenuItem<ManualSubMenuId>[] = [
  { id: 'dashboard', label: '대시보드', icon: createElement(LayoutDashboard, { size: ICON_SIZE }), ariaLabel: '대시보드 매뉴얼로 이동' },
  { id: 'students', label: '학생관리', icon: createElement(Users, { size: ICON_SIZE }), ariaLabel: '학생관리 매뉴얼로 이동' },
  { id: 'attendance', label: '출결관리', icon: createElement(CircleCheckBig, { size: ICON_SIZE }), ariaLabel: '출결관리 매뉴얼로 이동' },
  { id: 'notifications', label: '문자발송', icon: createElement(Mail, { size: ICON_SIZE }), ariaLabel: '문자발송 매뉴얼로 이동' },
  { id: 'analytics', label: '통계분석', icon: createElement(BarChart3, { size: ICON_SIZE }), ariaLabel: '통계분석 매뉴얼로 이동' },
  { id: 'ai', label: '인공지능', icon: createElement(Brain, { size: ICON_SIZE }), ariaLabel: '인공지능 매뉴얼로 이동' },
  { id: 'classes', label: '수업관리', icon: createElement(GraduationCap, { size: ICON_SIZE }), ariaLabel: '수업관리 매뉴얼로 이동' },
  { id: 'teachers', label: '강사관리', icon: createElement(UserPen, { size: ICON_SIZE }), ariaLabel: '강사관리 매뉴얼로 이동' },
  { id: 'billing', label: '수납관리', icon: createElement(CreditCard, { size: ICON_SIZE }), ariaLabel: '수납관리 매뉴얼로 이동' },
  { id: 'automation', label: '자동화 설정', icon: createElement(Settings, { size: ICON_SIZE }), ariaLabel: '자동화 설정 매뉴얼로 이동' },
  { id: 'alimtalk', label: '알림톡 설정', icon: createElement(MessageCircle, { size: ICON_SIZE }), ariaLabel: '알림톡 설정 매뉴얼로 이동' },
  { id: 'search', label: '검색', icon: createElement(Search, { size: ICON_SIZE }), ariaLabel: '검색 매뉴얼로 이동' },
  { id: 'timeline', label: '타임라인', icon: createElement(Clock, { size: ICON_SIZE }), ariaLabel: '타임라인 매뉴얼로 이동' },
  { id: 'agent', label: '에이전트 모드', icon: createElement(Bot, { size: ICON_SIZE }), ariaLabel: '에이전트 모드 매뉴얼로 이동' },
];

/** 기본 매뉴얼 서브 메뉴 ID */
export const DEFAULT_MANUAL_SUB_MENU: ManualSubMenuId = 'dashboard';

// ============================================================================
// 공통 유틸리티
// ============================================================================

/** URL 쿼리 파라미터 키 (tab) */
export const SUB_MENU_QUERY_PARAM = 'tab';

/** 기본 서브 메뉴 ID */
export const DEFAULT_ATTENDANCE_SUB_MENU: AttendanceSubMenuId = 'today';

/**
 * URL 쿼리 파라미터에서 서브 메뉴 ID 추출
 * @param searchParams - URLSearchParams 객체
 * @param validIds - 유효한 ID 목록
 * @param defaultId - 기본 ID
 */
export function getSubMenuFromUrl<T extends string>(
  searchParams: URLSearchParams,
  validIds: readonly T[],
  defaultId: T
): T {
  const tabParam = searchParams.get(SUB_MENU_QUERY_PARAM);
  if (tabParam && validIds.includes(tabParam as T)) {
    return tabParam as T;
  }
  return defaultId;
}

/**
 * 서브 메뉴 ID를 URL 쿼리 파라미터로 설정
 * @param id - 서브 메뉴 ID
 * @param defaultId - 기본 ID (기본값이면 파라미터 제거)
 */
export function setSubMenuToUrl<T extends string>(
  id: T,
  defaultId: T
): string {
  const searchParams = new URLSearchParams(window.location.search);
  if (id === defaultId) {
    searchParams.delete(SUB_MENU_QUERY_PARAM);
  } else {
    searchParams.set(SUB_MENU_QUERY_PARAM, id);
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : window.location.pathname;
}

// ============================================================================
// 학생관리 페이지 서브 메뉴 설정
// ============================================================================

/** 학생관리 페이지 서브 메뉴 ID */
export type StudentsSubMenuId =
  | 'list'
  | 'add'
  | 'tags'
  | 'statistics';

/** 학생관리 페이지 서브 메뉴 설정 */
export const STUDENTS_SUB_MENU_ITEMS: SubSidebarMenuItem<StudentsSubMenuId>[] = [
  { id: 'list', label: '학생 목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '학생 목록 화면으로 이동' },
  { id: 'add', label: '학생 등록', icon: createElement(UserPlus, { size: ICON_SIZE }), ariaLabel: '학생 등록 화면으로 이동' },
  { id: 'tags', label: '태그 관리', icon: createElement(Tags, { size: ICON_SIZE }), ariaLabel: '태그 관리 화면으로 이동' },
  { id: 'statistics', label: '학생 통계', icon: createElement(TrendingUp, { size: ICON_SIZE }), ariaLabel: '학생 통계 화면으로 이동' },
];

/** 기본 학생관리 서브 메뉴 ID */
export const DEFAULT_STUDENTS_SUB_MENU: StudentsSubMenuId = 'list';

// ============================================================================
// 문자발송 페이지 서브 메뉴 설정
// ============================================================================

/** 문자발송 페이지 서브 메뉴 ID */
export type NotificationsSubMenuId =
  | 'history'
  | 'send'
  | 'templates'
  | 'bulk'
  | 'auto-settings';

/** 문자발송 페이지 서브 메뉴 설정 */
export const NOTIFICATIONS_SUB_MENU_ITEMS: SubSidebarMenuItem<NotificationsSubMenuId>[] = [
  { id: 'history', label: '발송 내역', icon: createElement(History, { size: ICON_SIZE }), ariaLabel: '발송 내역 화면으로 이동' },
  { id: 'send', label: '문자 발송', icon: createElement(Send, { size: ICON_SIZE }), ariaLabel: '문자 발송 화면으로 이동' },
  { id: 'templates', label: '템플릿 관리', icon: createElement(FileText, { size: ICON_SIZE }), ariaLabel: '템플릿 관리 화면으로 이동' },
  { id: 'bulk', label: '단체/예약 발송', icon: createElement(Calendar, { size: ICON_SIZE }), ariaLabel: '단체/예약 발송 화면으로 이동' },
  { id: 'auto-settings', label: '자동 알림 설정', icon: createElement(Bell, { size: ICON_SIZE }), ariaLabel: '자동 알림 설정 화면으로 이동' },
];

/** 기본 문자발송 서브 메뉴 ID */
export const DEFAULT_NOTIFICATIONS_SUB_MENU: NotificationsSubMenuId = 'history';

// ============================================================================
// 통계분석 페이지 서브 메뉴 설정
// ============================================================================

/** 통계분석 페이지 서브 메뉴 ID */
export type AnalyticsSubMenuId =
  | 'overview'
  | 'attendance'
  | 'students'
  | 'revenue';

/** 통계분석 페이지 서브 메뉴 설정 */
export const ANALYTICS_SUB_MENU_ITEMS: SubSidebarMenuItem<AnalyticsSubMenuId>[] = [
  { id: 'overview', label: '전체 현황', icon: createElement(PieChart, { size: ICON_SIZE }), ariaLabel: '전체 현황 화면으로 이동' },
  { id: 'attendance', label: '출결 분석', icon: createElement(CircleCheckBig, { size: ICON_SIZE }), ariaLabel: '출결 분석 화면으로 이동' },
  { id: 'students', label: '학생 분석', icon: createElement(Users, { size: ICON_SIZE }), ariaLabel: '학생 분석 화면으로 이동' },
  { id: 'revenue', label: '매출 분석', icon: createElement(TrendingUp, { size: ICON_SIZE }), ariaLabel: '매출 분석 화면으로 이동' },
];

/** 기본 통계분석 서브 메뉴 ID */
export const DEFAULT_ANALYTICS_SUB_MENU: AnalyticsSubMenuId = 'overview';

// ============================================================================
// 인공지능 페이지 서브 메뉴 설정
// ============================================================================

/** 인공지능 페이지 서브 메뉴 ID */
export type AISubMenuId =
  | 'insights'
  | 'predictions'
  | 'recommendations'
  | 'chat';

/** 인공지능 페이지 서브 메뉴 설정 */
export const AI_SUB_MENU_ITEMS: SubSidebarMenuItem<AISubMenuId>[] = [
  { id: 'insights', label: 'AI 인사이트', icon: createElement(Brain, { size: ICON_SIZE }), ariaLabel: 'AI 인사이트 화면으로 이동' },
  { id: 'predictions', label: '예측 분석', icon: createElement(TrendingUp, { size: ICON_SIZE }), ariaLabel: '예측 분석 화면으로 이동' },
  { id: 'recommendations', label: '추천', icon: createElement(Zap, { size: ICON_SIZE }), ariaLabel: '추천 화면으로 이동' },
  { id: 'chat', label: 'AI 채팅', icon: createElement(MessageCircle, { size: ICON_SIZE }), ariaLabel: 'AI 채팅 화면으로 이동' },
];

/** 기본 인공지능 서브 메뉴 ID */
export const DEFAULT_AI_SUB_MENU: AISubMenuId = 'insights';

// ============================================================================
// 수업관리 페이지 서브 메뉴 설정
// ============================================================================

/** 수업관리 페이지 서브 메뉴 ID */
export type ClassesSubMenuId =
  | 'list'
  | 'schedule'
  | 'curriculum'
  | 'settings';

/** 수업관리 페이지 서브 메뉴 설정 */
export const CLASSES_SUB_MENU_ITEMS: SubSidebarMenuItem<ClassesSubMenuId>[] = [
  { id: 'list', label: '수업 목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '수업 목록 화면으로 이동' },
  { id: 'schedule', label: '시간표', icon: createElement(Calendar, { size: ICON_SIZE }), ariaLabel: '시간표 화면으로 이동' },
  { id: 'curriculum', label: '커리큘럼', icon: createElement(GraduationCap, { size: ICON_SIZE }), ariaLabel: '커리큘럼 화면으로 이동' },
  { id: 'settings', label: '수업 설정', icon: createElement(Settings, { size: ICON_SIZE }), ariaLabel: '수업 설정 화면으로 이동' },
];

/** 기본 수업관리 서브 메뉴 ID */
export const DEFAULT_CLASSES_SUB_MENU: ClassesSubMenuId = 'list';

// ============================================================================
// 강사관리 페이지 서브 메뉴 설정
// ============================================================================

/** 강사관리 페이지 서브 메뉴 ID */
export type TeachersSubMenuId =
  | 'list'
  | 'add'
  | 'schedule'
  | 'performance';

/** 강사관리 페이지 서브 메뉴 설정 */
export const TEACHERS_SUB_MENU_ITEMS: SubSidebarMenuItem<TeachersSubMenuId>[] = [
  { id: 'list', label: '강사 목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '강사 목록 화면으로 이동' },
  { id: 'add', label: '강사 등록', icon: createElement(UserPlus, { size: ICON_SIZE }), ariaLabel: '강사 등록 화면으로 이동' },
  { id: 'schedule', label: '강사 일정', icon: createElement(Calendar, { size: ICON_SIZE }), ariaLabel: '강사 일정 화면으로 이동' },
  { id: 'performance', label: '실적 관리', icon: createElement(TrendingUp, { size: ICON_SIZE }), ariaLabel: '실적 관리 화면으로 이동' },
];

/** 기본 강사관리 서브 메뉴 ID */
export const DEFAULT_TEACHERS_SUB_MENU: TeachersSubMenuId = 'list';

// ============================================================================
// 수납관리 페이지 서브 메뉴 설정
// ============================================================================

/** 수납관리 페이지 서브 메뉴 ID */
export type BillingSubMenuId =
  | 'overview'
  | 'invoices'
  | 'payments'
  | 'settings';

/** 수납관리 페이지 서브 메뉴 설정 */
export const BILLING_SUB_MENU_ITEMS: SubSidebarMenuItem<BillingSubMenuId>[] = [
  { id: 'overview', label: '수납 현황', icon: createElement(Wallet, { size: ICON_SIZE }), ariaLabel: '수납 현황 화면으로 이동' },
  { id: 'invoices', label: '청구서 관리', icon: createElement(Receipt, { size: ICON_SIZE }), ariaLabel: '청구서 관리 화면으로 이동' },
  { id: 'payments', label: '결제 내역', icon: createElement(CircleDollarSign, { size: ICON_SIZE }), ariaLabel: '결제 내역 화면으로 이동' },
  { id: 'settings', label: '수납 설정', icon: createElement(Settings, { size: ICON_SIZE }), ariaLabel: '수납 설정 화면으로 이동' },
];

/** 기본 수납관리 서브 메뉴 ID */
export const DEFAULT_BILLING_SUB_MENU: BillingSubMenuId = 'overview';

// ============================================================================
// 자동화 설정 페이지 서브 메뉴 설정
// ============================================================================

/** 자동화 설정 페이지 서브 메뉴 ID */
export type AutomationSubMenuId =
  | 'rules'
  | 'triggers'
  | 'actions'
  | 'logs';

/** 자동화 설정 페이지 서브 메뉴 설정 */
export const AUTOMATION_SUB_MENU_ITEMS: SubSidebarMenuItem<AutomationSubMenuId>[] = [
  { id: 'rules', label: '자동화 규칙', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '자동화 규칙 화면으로 이동' },
  { id: 'triggers', label: '트리거 설정', icon: createElement(Play, { size: ICON_SIZE }), ariaLabel: '트리거 설정 화면으로 이동' },
  { id: 'actions', label: '액션 설정', icon: createElement(Zap, { size: ICON_SIZE }), ariaLabel: '액션 설정 화면으로 이동' },
  { id: 'logs', label: '실행 로그', icon: createElement(History, { size: ICON_SIZE }), ariaLabel: '실행 로그 화면으로 이동' },
];

/** 기본 자동화 설정 서브 메뉴 ID */
export const DEFAULT_AUTOMATION_SUB_MENU: AutomationSubMenuId = 'rules';

// ============================================================================
// 알림톡 설정 페이지 서브 메뉴 설정
// ============================================================================

/** 알림톡 설정 페이지 서브 메뉴 ID */
export type AlimtalkSubMenuId =
  | 'status'
  | 'channels'
  | 'templates'
  | 'history'
  | 'points';

/** 알림톡 설정 페이지 서브 메뉴 설정 */
export const ALIMTALK_SUB_MENU_ITEMS: SubSidebarMenuItem<AlimtalkSubMenuId>[] = [
  { id: 'status', label: '연동 현황', icon: createElement(Bell, { size: ICON_SIZE }), ariaLabel: '연동 현황 화면으로 이동' },
  { id: 'channels', label: '채널 관리', icon: createElement(Link, { size: ICON_SIZE }), ariaLabel: '채널 관리 화면으로 이동' },
  { id: 'templates', label: '템플릿 관리', icon: createElement(FileText, { size: ICON_SIZE }), ariaLabel: '템플릿 관리 화면으로 이동' },
  { id: 'history', label: '발송 내역', icon: createElement(History, { size: ICON_SIZE }), ariaLabel: '발송 내역 화면으로 이동' },
  { id: 'points', label: '포인트 관리', icon: createElement(CircleDollarSign, { size: ICON_SIZE }), ariaLabel: '포인트 관리 화면으로 이동' },
];

/** 기본 알림톡 설정 서브 메뉴 ID */
export const DEFAULT_ALIMTALK_SUB_MENU: AlimtalkSubMenuId = 'status';
