/**
 * useIndustryConfig Hook Unit Tests
 *
 * Test coverage:
 * - isPageVisible: single page visibility check
 * - isAnyPageVisible: OR condition for multiple pages
 * - areAllPagesVisible: AND condition for multiple pages
 * - getRoutePath: route path retrieval
 * - visiblePages / routes / terms: property accessors
 */

import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { IndustryTerms } from '@industry/registry';

// ============================================================================
// Mocks
// ============================================================================

// Mock the academy terms as default
const MOCK_ACADEMY_TERMS: IndustryTerms = {
  PERSON_TYPE_PRIMARY: 'student',
  PERSON_LABEL_PRIMARY: '학생',
  PERSON_LABEL_PLURAL: '학생들',
  PERSON_TYPE_SECONDARY: 'teacher',
  PERSON_LABEL_SECONDARY: '강사',
  PERSON_LABEL_SECONDARY_PLURAL: '강사들',
  GUARDIAN_LABEL: '학부모',
  GROUP_TYPE: 'class',
  GROUP_LABEL: '수업',
  GROUP_LABEL_PLURAL: '수업들',
  ATTENDANCE_LABEL: '출결',
  ABSENCE_LABEL: '결석',
  LATE_LABEL: '지각',
  PRESENT_LABEL: '출석',
  EXCUSED_LABEL: '인정결석',
  CHECK_IN_LABEL: '등원',
  CHECK_OUT_LABEL: '하원',
  TOTAL_LABEL: '총원',
  SESSION_LABEL: '수업',
  CONSULTATION_LABEL: '상담',
  CONSULTATION_LABEL_PLURAL: '상담 내역',
  CONSULTATION_TYPE_LABELS: { counseling: '상담일지', learning: '학습일지', behavior: '행동일지', other: '기타' },
  STATS_TOTAL_COUNT_TITLE: '총 학생 수',
  STATS_NEW_THIS_MONTH_TITLE: '이번 달 신규 등록',
  STATS_ACTIVE_COUNT_TITLE: '활성 학생 수',
  STATS_INACTIVE_COUNT_TITLE: '비활성 학생 수',
  STATS_GROWTH_RATE_TITLE: '월간 학생 성장률',
  STATS_WEEKLY_NEW_TITLE: '이번 주 신규 등록',
  STATS_RETENTION_RATE_TITLE: '학생 유지율',
  EMERGENCY_RISK_LABEL: '이탈 위험 단계',
  EMERGENCY_ABSENT_LABEL: '결석 상태',
  EMERGENCY_CONSULTATION_PENDING_LABEL: '상담 대기 중',
  TAG_LABEL: '태그',
  MESSAGE_LABEL: '메시지',
  CARD_GROUP_LABELS: {
    briefing: 'AI 브리핑',
    student_task: '학생 업무',
    class: '오늘 수업',
    attendance_stats: '출결 통계',
    student_growth_stats: '학생 성장 지표',
    revenue_stats: '매출 통계',
    collection_stats: '수납 통계',
  },
  TASK_TYPE_LABELS: {
    ai_suggested: 'AI 제안',
    risk: '이탈 위험',
    absence: '결석',
    counseling: '상담 필요',
    new_signup: '신규 등록',
  },
  STAFF_ACTIVE: '재직중',
  STAFF_LEAVE: '휴직',
  STAFF_RESIGNED: '퇴직',
  HOMEROOM_TEACHER: '담임',
  ASSISTANT_TEACHER: '부담임',
  STAFF_ID_LABEL: '사원번호',
  STAFF_REVENUE_DISTRIBUTION: '강사 매출 배분',
  MESSAGES: {
    LOADING: '로딩 중...',
    ERROR: '오류',
    SUCCESS: '성공',
    ALERT: '알림',
    CANCEL: '취소',
    SAVE: '저장',
    DELETE_CONFIRM: '삭제하시겠습니까?',
    NO_DATA: '데이터가 없습니다',
    SAVE_SUCCESS: '저장되었습니다',
    SAVE_ERROR: '저장에 실패했습니다',
  },
  BILLING_LABEL: '수납',
  BILLING_HOME_LABEL: '수납 홈',
  INVOICE_LABEL: '청구서',
  INVOICE_LABEL_PLURAL: '청구서들',
  PAYER_LABEL: '학부모',
  PAYMENT_LABEL: '납부',
  OVERDUE_LABEL: '미납',
  COLLECTION_RATE_LABEL: '수납률',
  DUE_DATE_LABEL: '납부 기한',
  AMOUNT_LABEL: '금액',
  SUBJECT_LABEL: '과목',
  GRADE_LABEL: '대상 학년',
  CAPACITY_LABEL: '정원',
  ROOM_LABEL: '강의실',
  ROUTES: {
    PRIMARY_LIST: '/students/list',
    PRIMARY_RISK: '/students/list?filter=risk',
    PRIMARY_ABSENT: '/students/list?filter=absent',
    PRIMARY_CONSULTATION: '/students/list?filter=consultation',
    CLASSES: '/classes',
    TEACHERS: '/teachers',
  },
  VISIBLE_PAGES: {
    primary: true,
    attendance: true,
    classes: true,
    teachers: true,
    billing: true,
    analytics: true,
    ai: true,
    automation: true,
    alimtalk: true,
    appointments: false,
  },
};

let mockTerms = MOCK_ACADEMY_TERMS;

vi.mock('@hooks/use-industry-terms', () => ({
  useIndustryTerms: vi.fn(() => mockTerms),
}));

// ============================================================================
// Imports (after mocks due to hoisting)
// ============================================================================

import { useIndustryConfig } from '../index';

// ============================================================================
// Test Helpers
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Tests: useIndustryConfig
// ============================================================================

describe('useIndustryConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTerms = MOCK_ACADEMY_TERMS;
  });

  // --------------------------------------------------------------------------
  // isPageVisible
  // --------------------------------------------------------------------------

  describe('isPageVisible', () => {
    it('returns true for visible pages (academy)', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPageVisible('primary')).toBe(true);
      expect(result.current.isPageVisible('attendance')).toBe(true);
      expect(result.current.isPageVisible('classes')).toBe(true);
      expect(result.current.isPageVisible('billing')).toBe(true);
    });

    it('returns false for hidden pages (academy has no appointments)', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPageVisible('appointments')).toBe(false);
    });

    it('returns false for undefined page keys', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      // properties is not defined in academy VISIBLE_PAGES
      expect(result.current.isPageVisible('properties' as keyof typeof MOCK_ACADEMY_TERMS.VISIBLE_PAGES)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isAnyPageVisible
  // --------------------------------------------------------------------------

  describe('isAnyPageVisible', () => {
    it('returns true when at least one page is visible', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAnyPageVisible(['attendance', 'appointments'])).toBe(true);
    });

    it('returns false when no pages are visible', () => {
      mockTerms = {
        ...MOCK_ACADEMY_TERMS,
        VISIBLE_PAGES: {
          ...MOCK_ACADEMY_TERMS.VISIBLE_PAGES,
          appointments: false,
        },
      };

      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      // appointments is false, properties is undefined
      expect(result.current.isAnyPageVisible(['appointments'])).toBe(false);
    });

    it('returns true when all specified pages are visible', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isAnyPageVisible(['primary', 'classes'])).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // areAllPagesVisible
  // --------------------------------------------------------------------------

  describe('areAllPagesVisible', () => {
    it('returns true when all specified pages are visible', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.areAllPagesVisible(['primary', 'attendance', 'classes'])).toBe(true);
    });

    it('returns false when any specified page is not visible', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.areAllPagesVisible(['primary', 'appointments'])).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getRoutePath
  // --------------------------------------------------------------------------

  describe('getRoutePath', () => {
    it('returns correct route path for existing routes', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.getRoutePath('PRIMARY_LIST')).toBe('/students/list');
      expect(result.current.getRoutePath('CLASSES')).toBe('/classes');
      expect(result.current.getRoutePath('TEACHERS')).toBe('/teachers');
    });

    it('returns undefined for non-existent route keys', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.getRoutePath('APPOINTMENTS' as keyof typeof MOCK_ACADEMY_TERMS.ROUTES)).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Property accessors
  // --------------------------------------------------------------------------

  describe('property accessors', () => {
    it('exposes visiblePages from terms', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.visiblePages).toEqual(MOCK_ACADEMY_TERMS.VISIBLE_PAGES);
    });

    it('exposes routes from terms', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.routes).toEqual(MOCK_ACADEMY_TERMS.ROUTES);
    });

    it('exposes full terms object', () => {
      const { result } = renderHook(() => useIndustryConfig(), {
        wrapper: createWrapper(),
      });

      expect(result.current.terms.PERSON_LABEL_PRIMARY).toBe('학생');
      expect(result.current.terms.GROUP_LABEL).toBe('수업');
    });
  });
});
