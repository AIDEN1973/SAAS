/**
 * 매뉴얼 데이터 인덱스
 *
 * [불변 규칙] 모든 매뉴얼은 이 파일에서 통합 관리합니다.
 */

import type { ManualCategory, ManualPage } from '../../types/manual';
import { dashboardManual } from './dashboard-manual';
import { studentsManual } from './students-manual';
import { attendanceManual } from './attendance-manual';
import { notificationsManual } from './notifications-manual';
import { analyticsManual } from './analytics-manual';
import { aiManual } from './ai-manual';
import { classesManual } from './classes-manual';
import { teachersManual } from './teachers-manual';
import { billingManual } from './billing-manual';
import { automationManual } from './automation-manual';
import { alimtalkManual } from './alimtalk-manual';
import { searchManual } from './search-manual';
import { timelineManual } from './timeline-manual';
import { agentManual } from './agent-manual';

/** 페이지별 매뉴얼 맵 (라우트 경로 → 매뉴얼) */
export const manualsByRoute: Record<string, ManualPage> = {
  '/': dashboardManual,
  '/home': dashboardManual,
  '/home/all-cards': dashboardManual,
  '/students': studentsManual,
  '/students/home': studentsManual,
  '/students/list': studentsManual,
  '/students/tasks': studentsManual,
  '/attendance': attendanceManual,
  '/notifications': notificationsManual,
  '/analytics': analyticsManual,
  '/ai': aiManual,
  '/classes': classesManual,
  '/teachers': teachersManual,
  '/billing': billingManual,
  '/billing/home': billingManual,
  '/billing/list': billingManual,
  '/settings/automation': automationManual,
  '/settings/alimtalk': alimtalkManual,
  '/agent': agentManual,
};

/** 카테고리별 매뉴얼 목록 */
export const manualCategories: ManualCategory[] = [
  {
    id: 'dashboard',
    title: '대시보드',
    pages: [dashboardManual],
  },
  {
    id: 'student-management',
    title: '학생 관리',
    pages: [studentsManual, attendanceManual],
  },
  {
    id: 'class-management',
    title: '수업 관리',
    pages: [classesManual, teachersManual],
  },
  {
    id: 'communication',
    title: '커뮤니케이션',
    pages: [notificationsManual],
  },
  {
    id: 'billing',
    title: '수납 관리',
    pages: [billingManual],
  },
  {
    id: 'analytics',
    title: '통계 분석',
    pages: [analyticsManual, aiManual],
  },
  {
    id: 'settings',
    title: '설정',
    pages: [automationManual, alimtalkManual],
  },
  {
    id: 'global',
    title: '글로벌 기능',
    pages: [searchManual, timelineManual, agentManual],
  },
];

/** 모든 매뉴얼 페이지 목록 */
export const allManualPages: ManualPage[] = [
  dashboardManual,
  studentsManual,
  attendanceManual,
  notificationsManual,
  analyticsManual,
  aiManual,
  classesManual,
  teachersManual,
  billingManual,
  automationManual,
  alimtalkManual,
  searchManual,
  timelineManual,
  agentManual,
];

/** 라우트 경로로 매뉴얼 조회 */
export function getManualByRoute(route: string): ManualPage | undefined {
  return manualsByRoute[route];
}

/** 매뉴얼 ID로 매뉴얼 조회 */
export function getManualById(id: string): ManualPage | undefined {
  return allManualPages.find((page) => page.id === id);
}

/**
 * 매뉴얼 페이지 메타데이터 (SSOT - Single Source of Truth)
 *
 * [불변 규칙] 모든 스크립트(verify-manual-sync, auto-update-manual, watch-manual-changes)는
 * 이 객체를 import하여 사용해야 합니다. 다른 곳에 중복 정의하지 마세요.
 *
 * 각 매뉴얼이 커버하는 라우트와 관련 소스 파일을 정의합니다.
 */
export const manualPageMeta: Record<string, {
  /** 이 매뉴얼이 커버하는 라우트 경로들 */
  routes: string[];
  /** 관련 페이지 컴포넌트 파일 (src 기준 상대 경로) */
  sourceFiles: string[];
  /** 한국어 페이지명 */
  koreanName: string;
  /** Lucide 아이콘 이름 */
  icon: string;
}> = {
  dashboard: {
    routes: ['/', '/home', '/home/all-cards'],
    sourceFiles: ['pages/HomePage.tsx', 'pages/AllCardsPage.tsx'],
    koreanName: '대시보드',
    icon: 'LayoutDashboard',
  },
  students: {
    routes: ['/students', '/students/home', '/students/list', '/students/tasks'],
    sourceFiles: ['pages/StudentsPage.tsx', 'pages/StudentsListPage.tsx', 'pages/StudentsHomePage.tsx'],
    koreanName: '학생관리',
    icon: 'Users',
  },
  attendance: {
    routes: ['/attendance'],
    sourceFiles: ['pages/AttendancePage.tsx'],
    koreanName: '출결관리',
    icon: 'CircleCheckBig',
  },
  notifications: {
    routes: ['/notifications'],
    sourceFiles: ['pages/NotificationsPage.tsx'],
    koreanName: '문자발송',
    icon: 'Mail',
  },
  analytics: {
    routes: ['/analytics'],
    sourceFiles: ['pages/AnalyticsPage.tsx'],
    koreanName: '통계분석',
    icon: 'BarChart3',
  },
  ai: {
    routes: ['/ai'],
    sourceFiles: ['pages/AIPage.tsx'],
    koreanName: '인공지능',
    icon: 'Brain',
  },
  classes: {
    routes: ['/classes'],
    sourceFiles: ['pages/ClassesPage.tsx'],
    koreanName: '수업관리',
    icon: 'GraduationCap',
  },
  teachers: {
    routes: ['/teachers'],
    sourceFiles: ['pages/TeachersPage.tsx'],
    koreanName: '강사관리',
    icon: 'UserPen',
  },
  billing: {
    routes: ['/billing', '/billing/home', '/billing/list'],
    sourceFiles: ['pages/BillingPage.tsx', 'pages/BillingHomePage.tsx'],
    koreanName: '수납관리',
    icon: 'CreditCard',
  },
  automation: {
    routes: ['/settings/automation'],
    sourceFiles: ['pages/SettingsPage.tsx', 'pages/settings/AutomationSettingsSection.tsx'],
    koreanName: '자동화 설정',
    icon: 'Settings',
  },
  alimtalk: {
    routes: ['/settings/alimtalk'],
    sourceFiles: ['pages/SettingsPage.tsx'],
    koreanName: '알림톡 설정',
    icon: 'MessageCircle',
  },
  search: {
    routes: [],
    sourceFiles: [],
    koreanName: '검색',
    icon: 'Search',
  },
  timeline: {
    routes: [],
    sourceFiles: [],
    koreanName: '타임라인',
    icon: 'History',
  },
  agent: {
    routes: ['/agent'],
    sourceFiles: ['pages/AgentPage.tsx'],
    koreanName: '에이전트 모드',
    icon: 'Bot',
  },
};
