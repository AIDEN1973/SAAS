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
import type { SubSidebarMenuItem, RelatedMenuSection } from '@ui-core/react';
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
  List,
  Send,
  FileText,
  History,
  Calendar,
  PieChart,
  Bell,
  Link,
  Receipt,
  CircleDollarSign,
  Cog,
  MapPin,
  TrendingUp,
  FileBarChart,
  AlertTriangle,
  Lightbulb,
  Briefcase,
  CalendarDays,
  AlertCircle,
  Award,
  BookOpen,
  CreditCard as PaymentIcon,
  CheckCircle,
  MessageSquare,
  Activity,
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
  console.log('[getSubMenuFromUrl] tabParam:', tabParam, 'validIds:', validIds, 'defaultId:', defaultId);
  if (tabParam && validIds.includes(tabParam as T)) {
    console.log('[getSubMenuFromUrl] returning tabParam:', tabParam);
    return tabParam as T;
  }
  console.log('[getSubMenuFromUrl] returning defaultId:', defaultId);
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
  console.log('[setSubMenuToUrl] id:', id, 'defaultId:', defaultId, 'current search:', window.location.search);
  if (id === defaultId) {
    searchParams.delete(SUB_MENU_QUERY_PARAM);
  } else {
    searchParams.set(SUB_MENU_QUERY_PARAM, id);
  }
  const queryString = searchParams.toString();
  const result = queryString ? `?${queryString}` : window.location.pathname;
  console.log('[setSubMenuToUrl] result:', result);
  return result;
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
  {
    id: 'list',
    label: '학생목록',
    icon: createElement(List, { size: ICON_SIZE }),
    ariaLabel: '학생 목록 화면으로 이동',
  },
  {
    id: 'add',
    label: '학생등록',
    icon: createElement(Users, { size: ICON_SIZE }),
    ariaLabel: '학생 등록 화면으로 이동',
  },
  {
    id: 'tags',
    label: '태그관리',
    icon: createElement(BookOpen, { size: ICON_SIZE }),
    ariaLabel: '태그 관리 화면으로 이동',
  },
  {
    id: 'statistics',
    label: '학생통계',
    icon: createElement(BarChart3, { size: ICON_SIZE }),
    ariaLabel: '학생 통계 화면으로 이동',
  },
];

/** 기본 학생관리 서브 메뉴 ID */
export const DEFAULT_STUDENTS_SUB_MENU: StudentsSubMenuId = 'list';

/** 학생관리 관련 메뉴 */
export const STUDENTS_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'classes',
      label: '수업관리',
      icon: createElement(GraduationCap, { size: ICON_SIZE }),
      ariaLabel: '수업 관리 페이지로 이동',
      href: '/classes',
    },
    {
      id: 'teachers',
      label: '강사관리',
      icon: createElement(UserPen, { size: ICON_SIZE }),
      ariaLabel: '강사 관리 페이지로 이동',
      href: '/teachers',
    },
    {
      id: 'billing',
      label: '수납관리',
      icon: createElement(CreditCard, { size: ICON_SIZE }),
      ariaLabel: '수납 관리 페이지로 이동',
      href: '/billing/home',
    },
  ],
};

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

/** 문자발송 관련 메뉴 */
export const NOTIFICATIONS_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'students',
      label: '학생관리',
      icon: createElement(Users, { size: ICON_SIZE }),
      ariaLabel: '학생 관리 페이지로 이동',
      href: '/students/list',
    },
    {
      id: 'alimtalk',
      label: '알림톡 설정',
      icon: createElement(Bell, { size: ICON_SIZE }),
      ariaLabel: '알림톡 설정 페이지로 이동',
      href: '/alimtalk-settings',
    },
  ],
};

// ============================================================================
// 통계분석 페이지 서브 메뉴 설정
// ============================================================================

/** 통계분석 페이지 서브 메뉴 ID */
export type AnalyticsSubMenuId =
  | 'overview'
  | 'regional'
  | 'attendance'
  | 'ai-insights'
  | 'reports';

/** 통계분석 페이지 서브 메뉴 설정 */
export const ANALYTICS_SUB_MENU_ITEMS: SubSidebarMenuItem<AnalyticsSubMenuId>[] = [
  { id: 'overview', label: '전체 현황', icon: createElement(PieChart, { size: ICON_SIZE }), ariaLabel: '전체 현황 화면으로 이동' },
  { id: 'regional', label: '지역별 분석', icon: createElement(MapPin, { size: ICON_SIZE }), ariaLabel: '지역별 분석 화면으로 이동' },
  { id: 'attendance', label: '출석 패턴', icon: createElement(TrendingUp, { size: ICON_SIZE }), ariaLabel: '출석 패턴 화면으로 이동' },
  { id: 'ai-insights', label: 'AI 인사이트', icon: createElement(Lightbulb, { size: ICON_SIZE }), ariaLabel: 'AI 인사이트 화면으로 이동' },
  { id: 'reports', label: '월간 리포트', icon: createElement(FileBarChart, { size: ICON_SIZE }), ariaLabel: '월간 리포트 화면으로 이동' },
];

/** 기본 통계분석 서브 메뉴 ID */
export const DEFAULT_ANALYTICS_SUB_MENU: AnalyticsSubMenuId = 'overview';

// ============================================================================
// 인공지능 페이지 서브 메뉴 설정
// ============================================================================

/** 인공지능 페이지 서브 메뉴 ID */
export type AISubMenuId =
  | 'insights'
  | 'consultation-summary'
  | 'anomaly-detection'
  | 'performance'
  | 'briefing';

/** 인공지능 페이지 서브 메뉴 설정 */
export const AI_SUB_MENU_ITEMS: SubSidebarMenuItem<AISubMenuId>[] = [
  { id: 'insights', label: 'AI 인사이트', icon: createElement(Brain, { size: ICON_SIZE }), ariaLabel: 'AI 인사이트 화면으로 이동' },
  { id: 'consultation-summary', label: '상담 요약', icon: createElement(MessageSquare, { size: ICON_SIZE }), ariaLabel: '상담 요약 화면으로 이동' },
  { id: 'anomaly-detection', label: '이상 탐지', icon: createElement(AlertTriangle, { size: ICON_SIZE }), ariaLabel: '이상 탐지 화면으로 이동' },
  { id: 'performance', label: '성과 분석', icon: createElement(Award, { size: ICON_SIZE }), ariaLabel: '성과 분석 화면으로 이동' },
  { id: 'briefing', label: '브리핑', icon: createElement(Briefcase, { size: ICON_SIZE }), ariaLabel: '브리핑 화면으로 이동' },
];

/** 기본 인공지능 서브 메뉴 ID */
export const DEFAULT_AI_SUB_MENU: AISubMenuId = 'insights';

// ============================================================================
// 수업관리 페이지 서브 메뉴 설정
// ============================================================================

/** 수업관리 페이지 서브 메뉴 ID */
export type ClassesSubMenuId =
  | 'list'
  | 'calendar'
  | 'statistics'
  | 'schedule-conflicts';

/** 수업관리 페이지 서브 메뉴 설정 */
export const CLASSES_SUB_MENU_ITEMS: SubSidebarMenuItem<ClassesSubMenuId>[] = [
  { id: 'list', label: '수업 목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '수업 목록 화면으로 이동' },
  { id: 'calendar', label: '수업 편성표', icon: createElement(CalendarDays, { size: ICON_SIZE }), ariaLabel: '수업 편성표 화면으로 이동' },
  { id: 'statistics', label: '수업 통계', icon: createElement(BarChart3, { size: ICON_SIZE }), ariaLabel: '수업 통계 화면으로 이동' },
  { id: 'schedule-conflicts', label: '일정 충돌', icon: createElement(AlertCircle, { size: ICON_SIZE }), ariaLabel: '일정 충돌 화면으로 이동' },
];

/** 기본 수업관리 서브 메뉴 ID */
export const DEFAULT_CLASSES_SUB_MENU: ClassesSubMenuId = 'list';

/** 수업관리 관련 메뉴 */
export const CLASSES_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'students',
      label: '학생관리',
      icon: createElement(Users, { size: ICON_SIZE }),
      ariaLabel: '학생 관리 페이지로 이동',
      href: '/students/list',
    },
    {
      id: 'teachers',
      label: '강사관리',
      icon: createElement(UserPen, { size: ICON_SIZE }),
      ariaLabel: '강사 관리 페이지로 이동',
      href: '/teachers',
    },
    {
      id: 'attendance',
      label: '출결관리',
      icon: createElement(CircleCheckBig, { size: ICON_SIZE }),
      ariaLabel: '출결 관리 페이지로 이동',
      href: '/attendance',
    },
  ],
};

// ============================================================================
// 강사관리 페이지 서브 메뉴 설정
// ============================================================================

/** 강사관리 페이지 서브 메뉴 ID */
export type TeachersSubMenuId =
  | 'list'
  | 'statistics'
  | 'assignments'
  | 'performance';

/** 강사관리 페이지 서브 메뉴 설정 */
export const TEACHERS_SUB_MENU_ITEMS: SubSidebarMenuItem<TeachersSubMenuId>[] = [
  { id: 'list', label: '강사 목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '강사 목록 화면으로 이동' },
  { id: 'statistics', label: '강사 통계', icon: createElement(BarChart3, { size: ICON_SIZE }), ariaLabel: '강사 통계 화면으로 이동' },
  { id: 'assignments', label: '담당 과목', icon: createElement(BookOpen, { size: ICON_SIZE }), ariaLabel: '담당 과목 화면으로 이동' },
  { id: 'performance', label: '강사 성과', icon: createElement(Award, { size: ICON_SIZE }), ariaLabel: '강사 성과 화면으로 이동' },
];

/** 기본 강사관리 서브 메뉴 ID */
export const DEFAULT_TEACHERS_SUB_MENU: TeachersSubMenuId = 'list';

/** 강사관리 관련 메뉴 */
export const TEACHERS_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'classes',
      label: '수업관리',
      icon: createElement(GraduationCap, { size: ICON_SIZE }),
      ariaLabel: '수업 관리 페이지로 이동',
      href: '/classes',
    },
    {
      id: 'students',
      label: '학생관리',
      icon: createElement(Users, { size: ICON_SIZE }),
      ariaLabel: '학생 관리 페이지로 이동',
      href: '/students/list',
    },
  ],
};

// ============================================================================
// 수납관리 페이지 서브 메뉴 설정
// ============================================================================

/** 수납관리 페이지 서브 메뉴 ID */
export type BillingSubMenuId =
  | 'invoices'
  | 'payments'
  | 'products'
  | 'settings';

/** 수납관리 페이지 서브 메뉴 설정 */
export const BILLING_SUB_MENU_ITEMS: SubSidebarMenuItem<BillingSubMenuId>[] = [
  { id: 'invoices', label: '청구서 관리', icon: createElement(Receipt, { size: ICON_SIZE }), ariaLabel: '청구서 관리 화면으로 이동' },
  { id: 'payments', label: '결제 내역', icon: createElement(CircleDollarSign, { size: ICON_SIZE }), ariaLabel: '결제 내역 화면으로 이동' },
  { id: 'products', label: '상품 관리', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '상품 관리 화면으로 이동' },
  { id: 'settings', label: '수납 설정', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '수납 설정 화면으로 이동' },
];

/** 기본 수납관리 서브 메뉴 ID */
export const DEFAULT_BILLING_SUB_MENU: BillingSubMenuId = 'invoices';

/** 수납관리 관련 메뉴 */
export const BILLING_RELATED_MENUS: RelatedMenuSection = {
  title: '관련 메뉴',
  items: [
    {
      id: 'students',
      label: '학생관리',
      icon: createElement(Users, { size: ICON_SIZE }),
      ariaLabel: '학생 관리 페이지로 이동',
      href: '/students/list',
    },
    {
      id: 'notifications',
      label: '문자발송',
      icon: createElement(Send, { size: ICON_SIZE }),
      ariaLabel: '문자 발송 페이지로 이동',
      href: '/notifications',
    },
  ],
};

// ============================================================================
// 자동화 설정 페이지 서브 메뉴 설정
// ============================================================================

/** 자동화 설정 페이지 서브 메뉴 ID */
export type AutomationSubMenuId =
  | 'rules'
  | 'payment'
  | 'attendance'
  | 'notification'
  | 'statistics';

/** 자동화 설정 페이지 서브 메뉴 설정 */
export const AUTOMATION_SUB_MENU_ITEMS: SubSidebarMenuItem<AutomationSubMenuId>[] = [
  { id: 'rules', label: '자동화 규칙', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '자동화 규칙 화면으로 이동' },
  { id: 'payment', label: '결제 자동화', icon: createElement(PaymentIcon, { size: ICON_SIZE }), ariaLabel: '결제 자동화 화면으로 이동' },
  { id: 'attendance', label: '출결 자동화', icon: createElement(CheckCircle, { size: ICON_SIZE }), ariaLabel: '출결 자동화 화면으로 이동' },
  { id: 'notification', label: '알림 자동화', icon: createElement(Bell, { size: ICON_SIZE }), ariaLabel: '알림 자동화 화면으로 이동' },
  { id: 'statistics', label: '자동화 통계', icon: createElement(Activity, { size: ICON_SIZE }), ariaLabel: '자동화 통계 화면으로 이동' },
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
