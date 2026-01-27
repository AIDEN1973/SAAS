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
  MessageSquare,
  Activity,
  Tag,
} from 'lucide-react';

/** 아이콘 크기 (CSS 변수 참조) */
const ICON_SIZE = 16;

// ============================================================================
// 동적 메뉴 라벨 생성 헬퍼 (업종 중립)
// ============================================================================

/**
 * 업종 중립 메뉴 라벨 생성을 위한 ID 타입
 *
 * [불변 규칙] 메뉴 ID는 업종과 무관하게 일관된 키를 사용
 * [불변 규칙] 실제 라벨은 IndustryTerms를 통해 동적으로 생성
 */
export type DynamicMenuLabelId =
  // 주요 대상(학생/회원) 관련
  | 'primary_list'       // {PERSON}목록
  | 'primary_add'        // {PERSON}등록
  | 'primary_statistics' // {PERSON}통계
  | 'primary_management' // {PERSON}관리
  // 보조 대상(강사/트레이너) 관련
  | 'secondary_list'     // {SECONDARY}목록
  | 'secondary_add'      // {SECONDARY}등록
  | 'secondary_statistics' // {SECONDARY}통계
  | 'secondary_assignments' // {SECONDARY} 담당 과목
  | 'secondary_performance' // {SECONDARY} 성과
  | 'secondary_management'  // {SECONDARY}관리
  // 그룹(수업/클래스) 관련
  | 'group_list'         // {GROUP}목록
  | 'group_add'          // {GROUP}등록
  | 'group_calendar'     // {GROUP}편성표
  | 'group_statistics'   // {GROUP}통계
  | 'group_conflicts'    // 일정 충돌
  | 'group_management'   // {GROUP}관리
  | 'group_assignment'   // {GROUP}배정
  // 상담/태그 관련
  | 'consultation_list'  // 상담관리
  | 'tag_management'     // 태그관리
  // 출결 관련
  | 'attendance_today'   // 오늘출결
  | 'attendance_history' // 출결기록
  | 'attendance_stats'   // 출결통계
  | 'attendance_settings' // 출결설정
  | 'attendance_management'; // 출결관리

/**
 * 동적 메뉴 라벨 생성 함수
 *
 * IndustryTerms를 사용하여 업종에 맞는 메뉴 라벨을 생성합니다.
 *
 * @param labelId 라벨 ID
 * @param terms IndustryTerms 객체
 * @returns 업종에 맞는 라벨 문자열
 *
 * @example
 * ```tsx
 * const terms = useIndustryTerms();
 * const label = getDynamicMenuLabel('primary_list', terms);
 * // Academy: "학생목록"
 * // Gym: "회원목록"
 * // Salon: "고객목록"
 * ```
 */
export function getDynamicMenuLabel(
  labelId: DynamicMenuLabelId,
  terms: {
    PERSON_LABEL_PRIMARY: string;
    PERSON_LABEL_SECONDARY: string;
    GROUP_LABEL: string;
    CONSULTATION_LABEL: string;
    ATTENDANCE_LABEL: string;
    TAG_LABEL: string;
  }
): string {
  const labelMap: Record<DynamicMenuLabelId, string> = {
    // 주요 대상 관련
    primary_list: `${terms.PERSON_LABEL_PRIMARY}목록`,
    primary_add: `${terms.PERSON_LABEL_PRIMARY}등록`,
    primary_statistics: `${terms.PERSON_LABEL_PRIMARY}통계`,
    primary_management: `${terms.PERSON_LABEL_PRIMARY}관리`,
    // 보조 대상 관련
    secondary_list: `${terms.PERSON_LABEL_SECONDARY}목록`,
    secondary_add: `${terms.PERSON_LABEL_SECONDARY}등록`,
    secondary_statistics: `${terms.PERSON_LABEL_SECONDARY}통계`,
    secondary_assignments: `담당과목`,
    secondary_performance: `${terms.PERSON_LABEL_SECONDARY}성과`,
    secondary_management: `${terms.PERSON_LABEL_SECONDARY}관리`,
    // 그룹 관련
    group_list: `${terms.GROUP_LABEL}목록`,
    group_add: `${terms.GROUP_LABEL}등록`,
    group_calendar: `${terms.GROUP_LABEL}편성표`,
    group_statistics: `${terms.GROUP_LABEL}통계`,
    group_conflicts: `일정충돌`,
    group_management: `${terms.GROUP_LABEL}관리`,
    group_assignment: `${terms.GROUP_LABEL}배정`,
    // 상담/태그 관련
    consultation_list: `${terms.CONSULTATION_LABEL}관리`,
    tag_management: `${terms.TAG_LABEL}관리`,
    // 출결 관련
    attendance_today: `오늘${terms.ATTENDANCE_LABEL}`,
    attendance_history: `${terms.ATTENDANCE_LABEL}기록`,
    attendance_stats: `${terms.ATTENDANCE_LABEL}통계`,
    attendance_settings: `${terms.ATTENDANCE_LABEL}설정`,
    attendance_management: `${terms.ATTENDANCE_LABEL}관리`,
  };

  return labelMap[labelId] || labelId;
}

/**
 * 동적 ariaLabel 생성 함수
 *
 * @param labelId 라벨 ID
 * @param terms IndustryTerms 객체
 * @returns 접근성 라벨 문자열
 */
export function getDynamicAriaLabel(
  labelId: DynamicMenuLabelId,
  terms: {
    PERSON_LABEL_PRIMARY: string;
    PERSON_LABEL_SECONDARY: string;
    GROUP_LABEL: string;
    CONSULTATION_LABEL: string;
    ATTENDANCE_LABEL: string;
    TAG_LABEL: string;
  }
): string {
  const ariaLabelMap: Record<DynamicMenuLabelId, string> = {
    // 주요 대상 관련
    primary_list: `${terms.PERSON_LABEL_PRIMARY} 목록 화면으로 이동`,
    primary_add: `${terms.PERSON_LABEL_PRIMARY} 등록 화면으로 이동`,
    primary_statistics: `${terms.PERSON_LABEL_PRIMARY} 통계 화면으로 이동`,
    primary_management: `${terms.PERSON_LABEL_PRIMARY} 관리 화면으로 이동`,
    // 보조 대상 관련
    secondary_list: `${terms.PERSON_LABEL_SECONDARY}목록 화면으로 이동`,
    secondary_add: `${terms.PERSON_LABEL_SECONDARY} 등록 화면으로 이동`,
    secondary_statistics: `${terms.PERSON_LABEL_SECONDARY}통계 화면으로 이동`,
    secondary_assignments: `담당과목 화면으로 이동`,
    secondary_performance: `${terms.PERSON_LABEL_SECONDARY}성과 화면으로 이동`,
    secondary_management: `${terms.PERSON_LABEL_SECONDARY}관리 화면으로 이동`,
    // 그룹 관련
    group_list: `${terms.GROUP_LABEL} 목록 화면으로 이동`,
    group_add: `${terms.GROUP_LABEL} 등록 화면으로 이동`,
    group_calendar: `${terms.GROUP_LABEL} 편성표 화면으로 이동`,
    group_statistics: `${terms.GROUP_LABEL} 통계 화면으로 이동`,
    group_conflicts: `일정 충돌 화면으로 이동`,
    group_management: `${terms.GROUP_LABEL} 관리 화면으로 이동`,
    group_assignment: `${terms.GROUP_LABEL} 배정 화면으로 이동`,
    // 상담/태그 관련
    consultation_list: `${terms.CONSULTATION_LABEL} 관리 화면으로 이동`,
    tag_management: `${terms.TAG_LABEL} 관리 화면으로 이동`,
    // 출결 관련
    attendance_today: `오늘 ${terms.ATTENDANCE_LABEL} 관리 화면으로 이동`,
    attendance_history: `${terms.ATTENDANCE_LABEL} 기록 조회 화면으로 이동`,
    attendance_stats: `${terms.ATTENDANCE_LABEL} 통계 화면으로 이동`,
    attendance_settings: `${terms.ATTENDANCE_LABEL} 설정 화면으로 이동`,
    attendance_management: `${terms.ATTENDANCE_LABEL} 관리 화면으로 이동`,
  };

  return ariaLabelMap[labelId] || `${labelId} 화면으로 이동`;
}

/**
 * 동적 메뉴 아이템 생성 헬퍼
 *
 * 기존 정적 메뉴 아이템에 동적 라벨을 적용합니다.
 *
 * @param items 정적 메뉴 아이템 배열
 * @param labelMapping ID별 DynamicMenuLabelId 매핑
 * @param terms IndustryTerms 객체
 * @returns 동적 라벨이 적용된 메뉴 아이템 배열
 *
 * @example
 * ```tsx
 * const terms = useIndustryTerms();
 * const dynamicItems = applyDynamicLabels(
 *   STUDENTS_SUB_MENU_ITEMS,
 *   {
 *     list: 'primary_list',
 *     add: 'primary_add',
 *     statistics: 'primary_statistics',
 *   },
 *   terms
 * );
 * ```
 */
export function applyDynamicLabels<T extends string>(
  items: SubSidebarMenuItem<T>[],
  labelMapping: Partial<Record<T, DynamicMenuLabelId>>,
  terms: {
    PERSON_LABEL_PRIMARY: string;
    PERSON_LABEL_SECONDARY: string;
    GROUP_LABEL: string;
    CONSULTATION_LABEL: string;
    ATTENDANCE_LABEL: string;
    TAG_LABEL: string;
  }
): SubSidebarMenuItem<T>[] {
  return items.map((item) => {
    const dynamicLabelId = labelMapping[item.id];
    if (dynamicLabelId) {
      return {
        ...item,
        label: getDynamicMenuLabel(dynamicLabelId, terms),
        ariaLabel: getDynamicAriaLabel(dynamicLabelId, terms),
      };
    }
    return item;
  });
}

/**
 * 학생관리 메뉴의 동적 라벨 매핑
 */
export const STUDENTS_MENU_LABEL_MAPPING: Partial<Record<StudentsSubMenuId, DynamicMenuLabelId>> = {
  list: 'primary_list',
  add: 'primary_add',
  statistics: 'primary_statistics',
  consultations: 'consultation_list',
  tags: 'tag_management',
  'class-assignment': 'group_assignment',
};

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

/** 출결관리 메뉴의 동적 라벨 매핑 */
export const ATTENDANCE_MENU_LABEL_MAPPING: Partial<Record<AttendanceSubMenuId, DynamicMenuLabelId>> = {
  today: 'attendance_today',
  history: 'attendance_history',
  statistics: 'attendance_stats',
  settings: 'attendance_settings',
};

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
  | 'statistics'
  | 'consultations'
  | 'class-assignment';

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
    opensInModalOrNewWindow: true,
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
  {
    id: 'consultations',
    label: '상담관리',
    icon: createElement(MessageSquare, { size: ICON_SIZE }),
    ariaLabel: '상담 관리 화면으로 이동',
  },
  {
    id: 'class-assignment',
    label: '수업배정',
    icon: createElement(GraduationCap, { size: ICON_SIZE }),
    ariaLabel: '수업 배정 화면으로 이동',
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
  | 'tag-filter'
  | 'auto-settings';

/** 문자발송 페이지 서브 메뉴 설정 */
export const NOTIFICATIONS_SUB_MENU_ITEMS: SubSidebarMenuItem<NotificationsSubMenuId>[] = [
  { id: 'history', label: '발송 내역', icon: createElement(History, { size: ICON_SIZE }), ariaLabel: '발송 내역 화면으로 이동' },
  { id: 'send', label: '문자 발송', icon: createElement(Send, { size: ICON_SIZE }), ariaLabel: '문자 발송 화면으로 이동' },
  { id: 'templates', label: '템플릿 관리', icon: createElement(FileText, { size: ICON_SIZE }), ariaLabel: '템플릿 관리 화면으로 이동' },
  { id: 'bulk', label: '단체/예약 발송', icon: createElement(Calendar, { size: ICON_SIZE }), ariaLabel: '단체/예약 발송 화면으로 이동' },
  { id: 'tag-filter', label: '태그 필터 발송', icon: createElement(Tag, { size: ICON_SIZE }), ariaLabel: '태그 필터 발송 화면으로 이동' },
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
  { id: 'consultation-summary', label: '상담요약', icon: createElement(MessageSquare, { size: ICON_SIZE }), ariaLabel: '상담 요약 화면으로 이동' },
  { id: 'anomaly-detection', label: '이상탐지', icon: createElement(AlertTriangle, { size: ICON_SIZE }), ariaLabel: '이상 탐지 화면으로 이동' },
  { id: 'performance', label: '성과분석', icon: createElement(Award, { size: ICON_SIZE }), ariaLabel: '성과 분석 화면으로 이동' },
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
  { id: 'list', label: '수업목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '수업 목록 화면으로 이동' },
  { id: 'calendar', label: '수업편성표', icon: createElement(CalendarDays, { size: ICON_SIZE }), ariaLabel: '수업 편성표 화면으로 이동' },
  { id: 'statistics', label: '수업통계', icon: createElement(BarChart3, { size: ICON_SIZE }), ariaLabel: '수업 통계 화면으로 이동' },
  { id: 'schedule-conflicts', label: '일정충돌', icon: createElement(AlertCircle, { size: ICON_SIZE }), ariaLabel: '일정 충돌 화면으로 이동' },
];

/** 기본 수업관리 서브 메뉴 ID */
export const DEFAULT_CLASSES_SUB_MENU: ClassesSubMenuId = 'list';

/** 수업관리 메뉴의 동적 라벨 매핑 */
export const CLASSES_MENU_LABEL_MAPPING: Partial<Record<ClassesSubMenuId, DynamicMenuLabelId>> = {
  list: 'group_list',
  calendar: 'group_calendar',
  statistics: 'group_statistics',
  'schedule-conflicts': 'group_conflicts',
};

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
  | 'add'
  | 'statistics'
  | 'assignments'
  | 'performance';

/** 강사관리 페이지 서브 메뉴 설정 */
export const TEACHERS_SUB_MENU_ITEMS: SubSidebarMenuItem<TeachersSubMenuId>[] = [
  { id: 'list', label: '강사목록', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '강사목록 화면으로 이동' },
  { id: 'add', label: '강사등록', icon: createElement(UserPen, { size: ICON_SIZE }), ariaLabel: '강사 등록 화면으로 이동', opensInModalOrNewWindow: true },
  { id: 'statistics', label: '강사통계', icon: createElement(BarChart3, { size: ICON_SIZE }), ariaLabel: '강사통계 화면으로 이동' },
  { id: 'assignments', label: '담당과목', icon: createElement(BookOpen, { size: ICON_SIZE }), ariaLabel: '담당과목 화면으로 이동' },
  { id: 'performance', label: '강사성과', icon: createElement(Award, { size: ICON_SIZE }), ariaLabel: '강사성과 화면으로 이동' },
];

/** 기본 강사관리 서브 메뉴 ID */
export const DEFAULT_TEACHERS_SUB_MENU: TeachersSubMenuId = 'list';

/** 강사관리 메뉴의 동적 라벨 매핑 */
export const TEACHERS_MENU_LABEL_MAPPING: Partial<Record<TeachersSubMenuId, DynamicMenuLabelId>> = {
  list: 'secondary_list',
  add: 'secondary_add',
  statistics: 'secondary_statistics',
  assignments: 'secondary_assignments',
  performance: 'secondary_performance',
};

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
  { id: 'payments', label: '결제내역', icon: createElement(CircleDollarSign, { size: ICON_SIZE }), ariaLabel: '결제내역 화면으로 이동' },
  { id: 'products', label: '상품관리', icon: createElement(List, { size: ICON_SIZE }), ariaLabel: '상품관리 화면으로 이동' },
  { id: 'settings', label: '수납설정', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '수납설정 화면으로 이동' },
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
  | 'statistics';

/** 자동화 설정 페이지 서브 메뉴 설정 */
export const AUTOMATION_SUB_MENU_ITEMS: SubSidebarMenuItem<AutomationSubMenuId>[] = [
  { id: 'rules', label: '자동화 규칙', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '자동화 규칙 화면으로 이동' },
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

// ============================================================================
// 통합 설정 페이지 서브 메뉴 설정
// ============================================================================

/** 통합 설정 페이지 서브 메뉴 ID */
export type SettingsSubMenuId =
  | 'store'        // 매장 정보
  | 'automation'   // 자동화
  | 'permissions'; // 권한 관리
// NOTE: 알림톡(alimtalk) 설정은 super-admin으로 이동됨

/** 통합 설정 페이지 서브 메뉴 설정 */
export const SETTINGS_SUB_MENU_ITEMS: SubSidebarMenuItem<SettingsSubMenuId>[] = [
  { id: 'store', label: '매장정보', icon: createElement(Briefcase, { size: ICON_SIZE }), ariaLabel: '매장 정보 설정 화면으로 이동' },
  { id: 'automation', label: '자동화', icon: createElement(Cog, { size: ICON_SIZE }), ariaLabel: '자동화 설정 화면으로 이동' },
  { id: 'permissions', label: '권한관리', icon: createElement(Settings, { size: ICON_SIZE }), ariaLabel: '권한 관리 화면으로 이동' },
];

/** 기본 통합 설정 서브 메뉴 ID */
export const DEFAULT_SETTINGS_SUB_MENU: SettingsSubMenuId = 'store';
