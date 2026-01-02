/**
 * 라우트 상수 정의
 *
 * [불변 규칙] 모든 라우트 문자열은 이 파일에서 SSOT로 관리
 * 라우트 변경 시 이 파일만 수정하면 전체 앱에 반영됨
 */

export const ROUTES = {
  // 홈
  HOME: '/',

  // 학생 관련
  STUDENTS_LIST: '/students/list',
  STUDENTS_RISK: '/students/list?filter=risk',
  STUDENTS_ABSENT: '/students/list?filter=absent',
  STUDENTS_CONSULTATION: '/students/list?filter=consultation',
  STUDENT_DETAIL: (studentId: string, panel?: string) => {
    const params = new URLSearchParams();
    params.set('studentId', studentId);
    if (panel) params.set('panel', panel);
    return `/students/list?${params.toString()}`;
  },

  // 출석 관련
  ATTENDANCE: '/attendance',
  ATTENDANCE_BY_CLASS: (classId: string) => `/attendance?class_id=${classId}`,
  KIOSK_CHECK_IN: '/kiosk-check-in',

  // 청구/수납 관련
  BILLING_HOME: '/billing/home',
  BILLING_LIST: (status?: string) => {
    if (status) {
      return `/billing/list?status=${status}`;
    }
    return '/billing/list';
  },

  // 반 관련
  CLASSES: '/classes',

  // 강사 관련
  TEACHERS: '/teachers',

  // 자동화 설정
  AUTOMATION_SETTINGS: '/automation-settings',

  // AI 분석 관련
  AI_HOME: '/ai',
  AI_CONSULTATION: '/ai?tab=consultation',
  AI_ATTENDANCE: '/ai?tab=attendance',
} as const;

export type RouteKey = keyof typeof ROUTES;

