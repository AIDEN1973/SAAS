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
    pages: [timelineManual, agentManual],
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
