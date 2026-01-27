/**
 * AI 분석 기능 페이지 (AI Insights)
 *
 * [LAYER: UI_PAGE]
 *
 * [Phase 1 MVP 범위] 아키텍처 문서 3.7.1, 3578줄:
 * - 상담일지 자동 요약 (저장 시 즉시 생성 - 아키텍처 문서 4101줄)
 * - 인원 출결 이상 탐지 (실시간 감지 및 업데이트 - 아키텍처 문서 4097줄, Phase 1부터 적용)
 * - 그룹/과목 성과를를 분석
 * - 지역 대비 부족 영역 분석
 * - 서버가 월간 운영 리포트 생성 (AI 호출 포함)
 * - 주간 브리핑 (매주 월요일 07:00 - 아키텍처 문서 3581줄, Phase 1)
 *
 * [Phase 2+ 범위] 아키텍처 문서 3582줄:
 * - Daily briefing (서버가 매일 07:00 생성, AI 호출 포함)
 * - 고급 인사이트 실시간 감지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성 (아키텍처 문서 352줄: AI 인사이트는 30% SDUI)
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 서버가 상담일지 AI 요약 생성, 출결 이상 탐지, 그룹/과목 성과 분석, 지역 대비 부족 영역 분석, 서버가 월간 운영 리포트 생성 (AI 호출 포함)
 *
 * [문서 준수]
 * - 아키텍처 문서: 3.7.1 (AI 브리핑 카드, AI-First Workflow, 요약 카드 중심)
 * - 아키텍처 문서: 3.7.2 (AI 인사이트 데이터 업데이트 주기 - Risk detection 실시간, 상담일지 요약 저장 시 즉시)
 * - 아키텍처 문서: 3.7.3 (AI Insight 정확도 보정 - 업종별 가중치)
 * - 아키텍처 문서: 3578줄 (AI 인사이트 스케줄 - Phase 1: 주간 브리핑, Phase 2+: Daily briefing)
 * - 아키텍처 문서: 2.4 (역할별 접근 제어 - Teacher는 /ai/insights/summary만 접근 가능)
 * - 기술문서: 기본 AI 인사이트 (3종) - Phase 1 MVP
 * - 유아이 문서: 6. Responsive UX (반응형 브레이크포인트 표준)
 * - 유아이 문서: 1.1 Zero-Trust UI Layer
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Badge, PageHeader, isMobile, isTablet, Modal, Drawer, EmptyState, SubSidebar } from '@ui-core/react';
import { MapPin, Sparkles, FileText } from 'lucide-react';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import { useStudents, useGenerateConsultationAISummary, fetchConsultations } from '@hooks/use-student';
import { fetchAIInsights, useDismissAIInsight } from '@hooks/use-ai-insights';
import type { StudentConsultation } from '@services/student-service';
import { useUserRole } from '@hooks/use-auth';
import { useStoreLocation } from '@hooks/use-config';
import { useIndustryTerms } from '@hooks/use-industry-terms';
import { AIAnalysisLoadingUI } from './students/components/AIAnalysisLoadingUI';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES, AI_SUB_MENU_ITEMS, DEFAULT_AI_SUB_MENU, getSubMenuFromUrl, setSubMenuToUrl } from '../constants';
import type { AISubMenuId } from '../constants';
import { createSafeNavigate, p } from '../utils';

// 성과 분석 인사이트 생성 단계 정의 (컴포넌트 외부에 정의하여 불필요한 재생성 방지)
const PERFORMANCE_INSIGHTS_STEPS = [
  { step: 1, label: '데이터 수집 중', duration: 1000 },
  { step: 2, label: 'AI 성과 분석 중', duration: 4000 },
  { step: 3, label: '인사이트 생성 중', duration: 800 },
] as const;

export function AIPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const isTabletMode = isTablet(modeUpper);
  // 서브사이드바 축소 상태 (태블릿 모드 기본값, 사용자 토글 가능)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isTabletMode);
  // 태블릿 모드 변경 시 축소 상태 동기화
  useEffect(() => {
    setSidebarCollapsed(isTabletMode);
  }, [isTabletMode]);
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab'); // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동

  // 서브 메뉴 상태
  const validIds = AI_SUB_MENU_ITEMS.map(item => item.id) as readonly AISubMenuId[];
  const selectedSubMenu = getSubMenuFromUrl(searchParams, validIds, DEFAULT_AI_SUB_MENU);

  const handleSubMenuChange = useCallback((id: AISubMenuId) => {
    const newUrl = setSubMenuToUrl(id, DEFAULT_AI_SUB_MENU);
    navigate(newUrl);
  }, [navigate]);
  const { data: userRole } = useUserRole(); // 아키텍처 문서 2.4: Teacher는 요약만 접근 가능
  const isTeacher = userRole === 'teacher'; // Teacher는 요약만 볼 수 있음
  const terms = useIndustryTerms();

  // SSOT: core_stores.region_id → core_regions 조인으로 지역정보 조회
  const { data: storeLocation } = useStoreLocation();
  const _locationInfo = useMemo(() => {
    return {
      location_code: storeLocation?.location_code || '',
    };
  }, [storeLocation]);
  // locationInfo 변수는 향후 지역별 AI 인사이트 필터링에 사용 예정
  void _locationInfo;

  // 한 페이지에 하나의 기능 원칙 준수: 종합 인사이트만 메인으로 표시
  // 나머지 기능은 별도 페이지로 분리 (빠른 링크로 접근)
  // AI 인사이트 조회 - 아키텍처 문서 3.7.1: ai_insights 테이블에서 조회
  const { data: aiInsights, isLoading } = useQuery({
    queryKey: ['ai-insights', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // 아키텍처 문서 3.7.1: ai_insights 테이블에서 insight_type별로 조회
      const todayDate = toKST().format('YYYY-MM-DD');

      // Phase 1 MVP: 주간 브리핑 조회 (매주 월요일 07:00 생성 - 아키텍처 문서 3581줄)
      // 주간 브리핑은 이번 주 월요일부터 오늘까지의 데이터를 포함
      const today = toKST();
      const dayOfWeek = today.day(); // 0=일요일, 1=월요일, ..., 6=토요일
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 월요일부터 며칠 지났는지
      // dayjs의 subtract는 immutable이므로 새로운 객체 반환
      const thisWeekMonday = today.subtract(daysSinceMonday, 'day').format('YYYY-MM-DD');

      // P1-1: N+1 쿼리 최적화 - 모든 AI 인사이트를 한 번에 조회
      // 5개의 개별 쿼리 대신 1개의 통합 쿼리로 성능 향상
      interface AIInsightBase {
        id: string;
        insight_type: string;
        title?: string;
        summary: string;
        insights?: string;
        created_at: string;
        action_url?: string;
        details?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        related_entity_id?: string;
        status: string;
      }

      // 필요한 모든 인사이트 타입을 한 번에 조회
      const allInsights = await fetchAIInsights(tenantId, {
        status: 'active',
        created_at: { gte: `${thisWeekMonday}T00:00:00` },
        // insight_type은 지정하지 않아 모든 타입 조회
      });

      // 타입별로 분류
      const insightsByType = new Map<string, AIInsightBase[]>();
      if (allInsights && allInsights.length > 0) {
        for (const insight of allInsights) {
          const type = insight.insight_type;
          if (!insightsByType.has(type)) {
            insightsByType.set(type, []);
          }
          insightsByType.get(type)!.push(insight as AIInsightBase);
        }
      }

      // 주간 브리핑 추출
      interface WeeklyBriefingInsight {
        id: string;
        insight_type: string;
        title: string;
        summary: string;
        insights?: string;
        created_at: string;
        action_url?: string;
        details?: Record<string, unknown>;
      }

      let weeklyBriefing: WeeklyBriefingInsight | null = null;
      const weeklyBriefingInsights = insightsByType.get('weekly_briefing') || [];
      if (weeklyBriefingInsights.length > 0) {
        weeklyBriefing = weeklyBriefingInsights[0] as WeeklyBriefingInsight;
      } else {
        // Phase 2+ 호환: daily_briefing 조회 (이번 주 월요일 이후)
        const dailyBriefingInsights = insightsByType.get('daily_briefing') || [];
        if (dailyBriefingInsights.length > 0) {
          weeklyBriefing = dailyBriefingInsights[0] as WeeklyBriefingInsight;
        }
      }

      // 1. 출결 이상 탐지 (attendance_anomaly)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      interface AttendanceAnomalyInsight {
        id: string;
        related_entity_id?: string;
        summary: string;
        metadata?: { student_name?: string };
        details?: { recommendation?: string };
      }

      // 오늘 생성된 attendance_anomaly만 필터링
      const attendanceAnomalyInsights = (insightsByType.get('attendance_anomaly') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      // AI 기반 출결 이상 탐지 (ai_insights 테이블에서만 조회, fallback 없음)
      const attendanceAnomalies: Array<{ student_id: string; student_name: string; issue: string; recommendation: string }> = [];
      if (attendanceAnomalyInsights && attendanceAnomalyInsights.length > 0) {
        attendanceAnomalies.push(...attendanceAnomalyInsights.map((insight) => ({
          student_id: insight.related_entity_id || '',
          student_name: (insight.metadata?.student_name as string) || '알 수 없음',
          issue: insight.summary || '',
          recommendation: (insight.details?.recommendation as string) || '',
        })));
      }
      // [AI 기반 전환] Fallback 로직 제거 - AI 인사이트가 없으면 빈 배열 반환

      // 2. 그룹/과목 성과 분석 (performance_analysis) - 아키텍처 문서 3.7.1: 그룹/과목 성과 분석
      // P1-1: 통합 쿼리에서 추출 (개별 쿼리 제거)
      const performanceAnalysisInsights = (insightsByType.get('performance_analysis') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      // detail_insights 타입 정의
      interface DetailInsight {
        type: 'improvement' | 'strength' | 'pattern' | 'comparison';
        title: string;
        description: string;
        severity?: 'high' | 'medium' | 'low';
      }

      let performanceAnalysis: Array<{
        class_id: string;
        class_name: string;
        subject?: string;
        grade?: string;
        performance: string;
        trend: string;
        recommendation: string;
        detail_insights?: DetailInsight[];
        // 출석 관련
        attendance_rate?: number;
        absent_rate?: number;
        late_rate?: number;
        attendance_trend?: string;
        // 관리 대상 관련
        student_count?: number;
        max_students?: number;
        capacity_rate?: number;
        new_enrollments?: number;
        withdrawals?: number;
        enrollment_trend?: string;
        // 상담 관련
        consultation_count?: number;
        learning_consultations?: number;
        behavior_consultations?: number;
        // 수납 관련
        billing_collection_rate?: number;
        overdue_count?: number;
        total_revenue?: number;
        // 스태프 관련
        teacher_count?: number;
        has_main_teacher?: boolean;
      }> = [];
      if (performanceAnalysisInsights && performanceAnalysisInsights.length > 0) {
        performanceAnalysis = performanceAnalysisInsights.map((insight) => {
          // Edge Function에서 생성된 details 필드 파싱
          const details = insight.details as Record<string, unknown> || {};

          return {
            class_id: insight.related_entity_id || (details.class_id as string) || '',
            class_name: (details.class_name as string) || (insight.metadata?.class_name as string) || '알 수 없음',
            subject: details.subject as string | undefined,
            grade: details.grade as string | undefined,
            performance: (details.performance as string) || '',
            trend: (details.trend as string) || (details.attendance_trend as string) || '',
            recommendation: (details.recommendation as string) || '',
            // AI가 생성한 detail_insights 배열 (generate-performance-insights Edge Function)
            detail_insights: (details.detail_insights as DetailInsight[]) || undefined,
            // 출석 관련
            attendance_rate: details.attendance_rate as number | undefined,
            absent_rate: details.absent_rate as number | undefined,
            late_rate: details.late_rate as number | undefined,
            attendance_trend: details.attendance_trend as string | undefined,
            // 관리 대상 관련
            student_count: (details.student_count as number) || (insight.metadata?.student_count as number) || undefined,
            max_students: details.max_students as number | undefined,
            capacity_rate: details.capacity_rate as number | undefined,
            new_enrollments: details.new_enrollments as number | undefined,
            withdrawals: details.withdrawals as number | undefined,
            enrollment_trend: details.enrollment_trend as string | undefined,
            // 상담 관련
            consultation_count: details.consultation_count as number | undefined,
            learning_consultations: details.learning_consultations as number | undefined,
            behavior_consultations: details.behavior_consultations as number | undefined,
            // 수납 관련
            billing_collection_rate: details.billing_collection_rate as number | undefined,
            overdue_count: details.overdue_count as number | undefined,
            total_revenue: details.total_revenue as number | undefined,
            // 스태프 관련
            teacher_count: details.teacher_count as number | undefined,
            has_main_teacher: details.has_main_teacher as boolean | undefined,
          };
        });
      }

      // [AI 기반 전환] Fallback 로직 제거 - AI 인사이트가 없으면 빈 배열 반환

      // 3. 지역 대비 비교 (regional_analytics) - 아키텍처 문서 3.7.1: 지역 대비 부족 영역 분석
      // P1-1: 통합 쿼리에서 추출 (개별 쿼리 제거)
      // P0-1: 지역 인사이트 타입 수정 (regional_comparison → regional_analytics)
      const regionalComparisonInsights = (insightsByType.get('regional_analytics') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let regionalComparison: Array<{ area: string; status: string; gap: string; recommendation: string }> = [];
      if (regionalComparisonInsights && regionalComparisonInsights.length > 0) {
        regionalComparison = regionalComparisonInsights.map((insight) => ({
          area: (insight.metadata?.area as string) || '',
          status: (insight.metadata?.status as string) || '',
          gap: insight.summary || '',
          recommendation: (insight.details?.recommendation as string) || '',
        }));
      }

      // 4. Phase 2: 선제적 추천 (proactive_recommendation)
      const proactiveRecommendationInsights = (insightsByType.get('proactive_recommendation') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let proactiveRecommendation: {
        summary: string;
        recommendations: Array<{
          type: string;
          priority: string;
          title: string;
          description: string;
          target_count: number;
          suggested_action: string;
        }>;
        high_priority_count: number;
      } | null = null;

      if (proactiveRecommendationInsights.length > 0) {
        const insight = proactiveRecommendationInsights[0];
        const details = insight.details as Record<string, unknown> || {};
        proactiveRecommendation = {
          summary: insight.summary,
          recommendations: (details.recommendations as Array<{
            type: string;
            priority: string;
            title: string;
            description: string;
            target_count: number;
            suggested_action: string;
          }>) || [],
          high_priority_count: (details.high_priority_count as number) || 0,
        };
      }

      // 5. Phase 2: 자동화 패턴 분석 (meta_automation_pattern)
      const metaAutomationPatternInsights = (insightsByType.get('meta_automation_pattern') || [])
        .filter(insight => insight.created_at >= `${thisWeekMonday}T00:00:00`);

      let metaAutomationPattern: {
        summary: string;
        patterns: Array<{
          type: string;
          title: string;
          description: string;
          metric_value?: number;
          trend?: string;
          recommendation?: string;
        }>;
        overall_success_rate: number;
      } | null = null;

      if (metaAutomationPatternInsights.length > 0) {
        const insight = metaAutomationPatternInsights[0];
        const details = insight.details as Record<string, unknown> || {};
        const overallStats = details.overall_stats as Record<string, unknown> || {};
        metaAutomationPattern = {
          summary: insight.summary,
          patterns: (details.patterns as Array<{
            type: string;
            title: string;
            description: string;
            metric_value?: number;
            trend?: string;
            recommendation?: string;
          }>) || [],
          overall_success_rate: (overallStats.success_rate as number) || 0,
        };
      }

      // 6. Phase 2: 일일 자동화 요약 (daily_automation_digest)
      const dailyAutomationDigestInsights = (insightsByType.get('daily_automation_digest') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let dailyAutomationDigest: {
        summary: string;
        total_count: number;
        success_count: number;
        failed_count: number;
        success_rate: number;
        has_failures: boolean;
      } | null = null;

      if (dailyAutomationDigestInsights.length > 0) {
        const insight = dailyAutomationDigestInsights[0];
        const details = insight.details as Record<string, unknown> || {};
        dailyAutomationDigest = {
          summary: insight.summary,
          total_count: (details.total_count as number) || 0,
          success_count: (details.success_count as number) || 0,
          failed_count: (details.failed_count as number) || 0,
          success_rate: (details.success_rate as number) || 0,
          has_failures: (details.failed_count as number) > 0,
        };
      }

      // 7. Phase 2: 일일 브리핑 (daily_briefing)
      const dailyBriefingInsights = (insightsByType.get('daily_briefing') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let dailyBriefing: {
        id: string;
        title: string;
        summary: string;
        details?: Record<string, unknown>;
      } | null = null;

      if (dailyBriefingInsights.length > 0) {
        const insight = dailyBriefingInsights[0];
        dailyBriefing = {
          id: insight.id,
          title: insight.title || '오늘의 브리핑',
          summary: insight.summary,
          details: insight.details,
        };
      }

      return {
        weeklyBriefing, // Phase 1 MVP: 주간 브리핑 (아키텍처 문서 3581줄)
        attendanceAnomalies,
        performanceAnalysis,
        regionalComparison,
        // Phase 2 기능
        dailyBriefing,
        proactiveRecommendation,
        metaAutomationPattern,
        dailyAutomationDigest,
      };
    },
    enabled: !!tenantId,
    staleTime: 60000, // 아키텍처 문서 3.7.2: Risk detection은 실시간 감지, UI는 1분 캐싱
    refetchInterval: 300000, // 아키텍처 문서 3.7.2: Phase 1 MVP는 주간 브리핑, Risk detection은 5분마다 갱신
  });

  // URL 쿼리 파라미터에 따라 해당 섹션으로 스크롤 (아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동)
  useEffect(() => {
    if (tabParam && !isLoading) {
      // 데이터 로딩 완료 후 스크롤 (아키텍처 문서 3818줄)
      setTimeout(() => {
        const element = document.getElementById(`${tabParam}-card`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [tabParam, isLoading]);

  // P2-2: AI Dismiss 기능
  const dismissInsight = useDismissAIInsight();

  // 성과 분석 상세 모달 상태
  const [showPerformanceDetail, setShowPerformanceDetail] = useState(false);
  // 출결 이상 탐지 상세 모달 상태
  const [showAttendanceDetail, setShowAttendanceDetail] = useState(false);

  // AI 분석 진행 상태 추적
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<number>(0);

  // 월간 리포트 생성 - Edge Function 호출
  // Edge Function 응답 타입 정의
  interface GenerateInsightsResponse {
    success: boolean;
    generated_count?: number;
    date?: string;
    error?: string;
  }

  const generateReport = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // [P0 수정] api-sdk를 통해 Edge Function 호출 (fetch 직접 호출 금지)
      const response = await apiClient.invokeFunction<GenerateInsightsResponse>('generate-performance-insights', {});

      if (!response.success) {
        throw new Error(response.error?.message ?? 'AI 인사이트 생성에 실패했습니다.');
      }

      const result = response.data as GenerateInsightsResponse;
      return {
        success: result?.success ?? true,
        generated_count: result?.generated_count ?? 0,
        date: result?.date ?? toKST().format('YYYY-MM-DD'),
      };
    },
    onSuccess: (data) => {
      // [캐시 동기화] AI 인사이트 생성 후 관련 캐시 무효화
      void queryClient.invalidateQueries({ queryKey: ['ai-insights', tenantId] });
      if (data.generated_count > 0) {
        showAlert(`${data.generated_count}개의 AI 성과 분석 인사이트가 생성되었습니다.`, '성공');
      } else {
        showAlert('AI 인사이트가 이미 최신 상태입니다.', '알림');
      }
    },
    onError: (error: Error) => {
      showAlert(error.message, '오류');
    },
  });

  // 성과 분석 진행 단계 시뮬레이션
  useEffect(() => {
    if (!generateReport.isPending) {
      setCurrentAnalysisStep(0);
      return;
    }

    // 분석 시작 시 첫 단계로 이동
    setCurrentAnalysisStep(1);

    // 각 단계별로 타이머 설정
    const timers: NodeJS.Timeout[] = [];
    let accumulatedTime = 0;

    PERFORMANCE_INSIGHTS_STEPS.forEach((step, index) => {
      if (index === 0) return; // 첫 단계는 즉시 시작

      accumulatedTime += PERFORMANCE_INSIGHTS_STEPS[index - 1].duration;
      const timer = setTimeout(() => {
        setCurrentAnalysisStep(step.step);
      }, accumulatedTime);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [generateReport.isPending]);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', minHeight: 'var(--height-full)' }}>
        {/* 서브 사이드바 (모바일에서는 숨김, 태블릿에서는 축소) */}
        {!isMobileMode && (
          <SubSidebar
            title="인공지능"
            items={AI_SUB_MENU_ITEMS}
            selectedId={selectedSubMenu}
            onSelect={handleSubMenuChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            testId="ai-sub-sidebar"
          />
        )}

        {/* 메인 콘텐츠 */}
        <Container maxWidth="xl" padding={isMobileMode ? "sm" : "lg"} style={{ flex: 1 }}>
          <PageHeader
            title={AI_SUB_MENU_ITEMS.find(item => item.id === selectedSubMenu)?.label || "인공지능"}
          />

        {/* 아키텍처 문서 3.7.1: 빠른 분석 링크 (상세 분석은 별도 페이지에서 제공) */}
        {/* 아키텍처 문서 2.4: Teacher는 요약만 접근 가능, 상세 분석 버튼은 숨김 */}
        {!isTeacher && (
          <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
                  빠른 분석:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
                    if (aiInsights?.attendanceAnomalies && aiInsights.attendanceAnomalies.length > 0) {
                      setShowAttendanceDetail(true);
                    } else {
                      showAlert(`${terms.ABSENCE_LABEL}이상탐지 데이터가 없습니다.\nAI 분석이 완료되면 결과를 확인할 수 있습니다.`, '알림');
                    }
                  }}
                >
                  {terms.ABSENCE_LABEL}이상탐지
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
                    if (aiInsights?.performanceAnalysis && aiInsights.performanceAnalysis.length > 0) {
                      setShowPerformanceDetail(true);
                    } else {
                      showAlert('성과분석 데이터가 없습니다.\n"월간 리포트 생성" 버튼을 클릭하여 AI 분석을 실행하세요.', '알림');
                    }
                  }}
                >
                  성과분석
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateReport.mutate()}
                  disabled={generateReport.isPending}
                >
                  {generateReport.isPending ? '생성 중...' : '월간 리포트 생성'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
                    safeNavigate(ROUTES.AI_CONSULTATION);
                  }}
                >
                  {terms.CONSULTATION_LABEL_PLURAL} 요약
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Phase 1 MVP: 주간 브리핑 카드로 스크롤
                    if (aiInsights?.weeklyBriefing) {
                      const element = document.getElementById('weekly-briefing-card');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    } else {
                      showAlert('주간 브리핑 데이터가 없습니다.\n매주 월요일 07:00에 자동 생성됩니다.', '알림');
                    }
                  }}
                >
                  주간 브리핑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 지역 비교 카드로 스크롤
                    if (aiInsights?.regionalComparison && aiInsights.regionalComparison.length > 0) {
                      const element = document.getElementById('regional-card');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    } else {
                      showAlert('지역 비교 데이터가 없습니다.\n지역 정보를 설정하면 분석을 제공합니다.', '알림');
                    }
                  }}
                >
                  지역 비교
                </Button>
                {/* Phase 2 버튼들 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (aiInsights?.dailyBriefing) {
                      const element = document.getElementById('daily-briefing-card');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    } else {
                      showAlert('일일 브리핑 데이터가 없습니다.\n매일 07:00에 자동 생성됩니다.', '알림');
                    }
                  }}
                >
                  일일 브리핑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (aiInsights?.proactiveRecommendation) {
                      const element = document.getElementById('proactive-recommendation-card');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    } else {
                      showAlert('선제적 추천 데이터가 없습니다.\n매일 08:00에 자동 생성됩니다.', '알림');
                    }
                  }}
                >
                  선제적 추천
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (aiInsights?.dailyAutomationDigest) {
                      const element = document.getElementById('automation-digest-card');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    } else {
                      showAlert('자동화 요약 데이터가 없습니다.\n매일 23:00에 자동 생성됩니다.', '알림');
                    }
                  }}
                >
                  자동화 요약
                </Button>
              </div>
            </Card>
          )}
          {isTeacher && (
            <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
              <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                요약 정보만 제공됩니다. 상세 분석은 관리자에게 문의하세요.
              </div>
            </Card>
          )}

          {/* 콘텐츠 영역 */}
          {isLoading ? (
            <Card padding="lg">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                로딩 중...
              </div>
            </Card>
          ) : (
            <>
              {/* AI 인사이트 탭 (기본) */}
              {selectedSubMenu === 'insights' && aiInsights && (
                <>
                  {/* Phase 1 MVP: 주간 브리핑 카드 (아키텍처 문서 3581줄: 매주 월요일 07:00 생성) */}
                  {aiInsights.weeklyBriefing && (
                    <div id="weekly-briefing-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                              주간 브리핑
                            </h2>
                            <Badge variant="outline" color="info">
                              Phase 1 MVP
                            </Badge>
                          </div>
                          {/* P2-2: Dismiss 버튼 */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissInsight.mutate(aiInsights.weeklyBriefing!.id)}
                            disabled={dismissInsight.isPending}
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            무시
                          </Button>
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.weeklyBriefing.title || '이번 주 요약'}
                        </h3>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.weeklyBriefing.summary}
                        </p>
                        {aiInsights.weeklyBriefing.details && typeof aiInsights.weeklyBriefing.details === 'object' && (
                          <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                            {Object.entries(aiInsights.weeklyBriefing.details).map(([key, value]: [string, unknown]) => (
                              <div key={key} style={{ marginBottom: 'var(--spacing-xs)' }}>
                                <strong>{key}:</strong> {typeof value === 'string' ? value : JSON.stringify(value)}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>
                  )}

                  {/* 출결 이상탐지 요약 카드 - 아키텍처 문서 3.7.1: 인원 출결 이상 탐지 */}
                  {aiInsights.attendanceAnomalies && aiInsights.attendanceAnomalies.length > 0 && (
                    <div id="attendance-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', cursor: 'pointer' }} onClick={() => {
                        setShowAttendanceDetail(true);
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            {terms.ABSENCE_LABEL}이상탐지
                          </h2>
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.attendanceAnomalies.length}명의 {terms.PERSON_LABEL_PRIMARY}에게 {terms.ABSENCE_LABEL} 이상이 감지되었습니다.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {aiInsights.attendanceAnomalies.slice(0, 3).map((anomaly: { student_name: string; issue: string }, index: number) => (
                            <div key={index} style={{ color: 'var(--color-text-secondary)' }}>
                              • {anomaly.student_name}: {anomaly.issue}
                            </div>
                          ))}
                          {aiInsights.attendanceAnomalies.length > 3 && (
                            <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              외 {aiInsights.attendanceAnomalies.length - 3}건...
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          클릭하여 상세 분석 보기 →
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* 그룹/과목 성과분석 요약 카드 - 아키텍처 문서 3.7.1: 그룹/과목 성과 분석 */}
                  {aiInsights.performanceAnalysis && aiInsights.performanceAnalysis.length > 0 && (
                    <div id="performance-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', cursor: 'pointer' }} onClick={() => {
                        setShowPerformanceDetail(true);
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            {terms.GROUP_LABEL}/{terms.SUBJECT_LABEL}성과분석
                          </h2>
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.performanceAnalysis.length}개 {terms.GROUP_LABEL}의 성과를 분석했습니다.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {aiInsights.performanceAnalysis.slice(0, 3).map((perf: { performance: string; class_name: string; trend: string }, index: number) => {
                            // 성과 등급별 색상 결정 (빈 값일 경우 gray)
                            const perfColor = perf.performance === '우수' ? 'success' :
                                              perf.performance === '양호' ? 'info' :
                                              perf.performance === '보통' ? 'warning' :
                                              perf.performance === '개선 필요' ? 'error' : 'gray';
                            return (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Badge color={perfColor}>
                                  {perf.performance || '분석 중'}
                                </Badge>
                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                  {perf.class_name}: {perf.trend || '-'}
                                </span>
                              </div>
                            );
                          })}
                          {aiInsights.performanceAnalysis.length > 3 && (
                            <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              외 {aiInsights.performanceAnalysis.length - 3}개 {terms.GROUP_LABEL}...
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          클릭하여 상세 분석 보기 →
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* 지역 대비 부족 영역 분석 요약 카드 - 아키텍처 문서 3.7.1: 지역 대비 부족 영역 분석 */}
                  {aiInsights.regionalComparison && aiInsights.regionalComparison.length > 0 ? (
                    <div id="regional-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            지역 대비 부족 영역
                          </h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                          {aiInsights.regionalComparison.map((item: { area: string; status: string; gap: string; recommendation: string }, index: number) => {
                            // 상태별 색상 결정 (빈 값일 경우 gray)
                            const statusColor = item.status === '부족' ? 'error' :
                                                item.status === '우수' ? 'success' :
                                                item.status === '보통' ? 'info' : 'gray';
                            return (
                              <div
                                key={index}
                                style={{
                                  padding: 'var(--spacing-md)',
                                  border: `var(--border-width-thin) solid var(--color-border)`,
                                  borderRadius: 'var(--border-radius-md)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                  <Badge color={statusColor}>
                                    {item.area || '지역'}
                                  </Badge>
                                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{item.gap || '-'}</span>
                                </div>
                                {item.recommendation && (
                                  <div style={{ color: 'var(--color-text-secondary)' }}>
                                    {item.recommendation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <EmptyState
                        icon={MapPin}
                        message="지역 비교 데이터가 없습니다."
                        description="지역 정보를 설정하면 지역 대비 분석을 제공할 수 있습니다."
                      />
                    </Card>
                  )}

                  {/* ========== Phase 2 카드들 ========== */}

                  {/* Phase 2: 일일 브리핑 카드 */}
                  {aiInsights.dailyBriefing && (
                    <div id="daily-briefing-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                              오늘의 브리핑
                            </h2>
                            <Badge variant="outline" color="primary">
                              Phase 2
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissInsight.mutate(aiInsights.dailyBriefing!.id)}
                            disabled={dismissInsight.isPending}
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            무시
                          </Button>
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.dailyBriefing.title}
                        </h3>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)', whiteSpace: 'pre-wrap' }}>
                          {aiInsights.dailyBriefing.summary}
                        </p>
                      </Card>
                    </div>
                  )}

                  {/* Phase 2: 선제적 추천 카드 */}
                  {aiInsights.proactiveRecommendation && (
                    <div id="proactive-recommendation-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            선제적 추천
                          </h2>
                          <Badge variant="outline" color="primary">
                            Phase 2
                          </Badge>
                          {aiInsights.proactiveRecommendation.high_priority_count > 0 && (
                            <Badge color="error">
                              긴급 {aiInsights.proactiveRecommendation.high_priority_count}건
                            </Badge>
                          )}
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)', whiteSpace: 'pre-wrap' }}>
                          {aiInsights.proactiveRecommendation.summary}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                          {aiInsights.proactiveRecommendation.recommendations.slice(0, 5).map((rec, index) => {
                            const priorityColor = rec.priority === 'high' ? 'error' :
                                                  rec.priority === 'medium' ? 'warning' : 'info';
                            return (
                              <div
                                key={index}
                                style={{
                                  padding: 'var(--spacing-md)',
                                  border: `var(--border-width-thin) solid var(--color-border)`,
                                  borderRadius: 'var(--border-radius-md)',
                                  borderLeft: `4px solid var(--color-${priorityColor})`,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                  <Badge color={priorityColor} size="sm">
                                    {rec.priority === 'high' ? '긴급' : rec.priority === 'medium' ? '중요' : '참고'}
                                  </Badge>
                                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{rec.title}</span>
                                  {rec.target_count > 0 && (
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                      ({rec.target_count}건)
                                    </span>
                                  )}
                                </div>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                  {rec.description}
                                </p>
                                <p style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', margin: 0, marginTop: 'var(--spacing-xs)' }}>
                                  권장: {rec.suggested_action}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Phase 2: 일일 자동화 요약 카드 */}
                  {aiInsights.dailyAutomationDigest && (
                    <div id="automation-digest-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            오늘의 자동화 요약
                          </h2>
                          <Badge variant="outline" color="primary">
                            Phase 2
                          </Badge>
                          {aiInsights.dailyAutomationDigest.has_failures && (
                            <Badge color="error">
                              실패 {aiInsights.dailyAutomationDigest.failed_count}건
                            </Badge>
                          )}
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)', whiteSpace: 'pre-wrap' }}>
                          {aiInsights.dailyAutomationDigest.summary}
                        </p>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: 'var(--spacing-md)',
                          padding: 'var(--spacing-md)',
                          backgroundColor: 'var(--color-background-secondary)',
                          borderRadius: 'var(--border-radius-md)',
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                              {aiInsights.dailyAutomationDigest.total_count}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>총 실행</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                              {aiInsights.dailyAutomationDigest.success_count}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>성공</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                              {aiInsights.dailyAutomationDigest.failed_count}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>실패</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: 'var(--font-size-2xl)',
                              fontWeight: 'var(--font-weight-bold)',
                              color: aiInsights.dailyAutomationDigest.success_rate >= 90 ? 'var(--color-success)' :
                                     aiInsights.dailyAutomationDigest.success_rate >= 70 ? 'var(--color-warning)' : 'var(--color-error)'
                            }}>
                              {aiInsights.dailyAutomationDigest.success_rate}%
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>성공률</div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Phase 2: 자동화 패턴 분석 카드 (주간) */}
                  {aiInsights.metaAutomationPattern && (
                    <div id="meta-automation-pattern-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            자동화 패턴 분석
                          </h2>
                          <Badge variant="outline" color="primary">
                            Phase 2
                          </Badge>
                          <Badge color={aiInsights.metaAutomationPattern.overall_success_rate >= 90 ? 'success' :
                                        aiInsights.metaAutomationPattern.overall_success_rate >= 70 ? 'warning' : 'error'}>
                            주간 성공률 {aiInsights.metaAutomationPattern.overall_success_rate}%
                          </Badge>
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)', whiteSpace: 'pre-wrap' }}>
                          {aiInsights.metaAutomationPattern.summary}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                          {aiInsights.metaAutomationPattern.patterns.slice(0, 4).map((pattern, index) => {
                            const trendIcon = pattern.trend === 'up' ? '↑' :
                                              pattern.trend === 'down' ? '↓' : '→';
                            const trendColor = pattern.trend === 'up' ? 'var(--color-success)' :
                                               pattern.trend === 'down' ? 'var(--color-error)' : 'var(--color-text-secondary)';
                            return (
                              <div
                                key={index}
                                style={{
                                  padding: 'var(--spacing-sm)',
                                  backgroundColor: 'var(--color-background-secondary)',
                                  borderRadius: 'var(--border-radius-md)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{pattern.title}</span>
                                  {pattern.metric_value !== undefined && (
                                    <span style={{ color: trendColor, fontWeight: 'var(--font-weight-bold)' }}>
                                      {trendIcon} {pattern.metric_value}{pattern.type === 'time_distribution' ? '시' : '%'}
                                    </span>
                                  )}
                                </div>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                  {pattern.description}
                                </p>
                                {pattern.recommendation && (
                                  <p style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', margin: 0, marginTop: 'var(--spacing-xs)' }}>
                                    {pattern.recommendation}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* 데이터가 없는 경우 안내 */}
                  {!aiInsights.weeklyBriefing &&
                   !aiInsights.dailyBriefing &&
                   (!aiInsights.attendanceAnomalies || aiInsights.attendanceAnomalies.length === 0) &&
                   (!aiInsights.performanceAnalysis || aiInsights.performanceAnalysis.length === 0) &&
                   (!aiInsights.regionalComparison || aiInsights.regionalComparison.length === 0) &&
                   !aiInsights.proactiveRecommendation &&
                   !aiInsights.dailyAutomationDigest &&
                   !aiInsights.metaAutomationPattern && (
                    <Card padding="lg">
                      <EmptyState
                        icon={Sparkles}
                        message="AI 인사이트 데이터가 없습니다."
                        description="데이터가 축적되면 AI 분석 결과를 제공합니다."
                      />
                    </Card>
                  )}
                </>
              )}

              {/* 상담요약 탭 */}
              {selectedSubMenu === 'consultation-summary' && (
                <div id="consultation-card">
                  <ConsultationSummaryTab />
                </div>
              )}

              {/* 이상탐지 탭 */}
              {selectedSubMenu === 'anomaly-detection' && (
                <>
                <Card padding="lg">
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>{terms.ABSENCE_LABEL}이상탐지</h3>
                  {aiInsights?.attendanceAnomalies && aiInsights.attendanceAnomalies.length > 0 ? (
                    <AttendanceAnomalyDetailContent
                      attendanceAnomalies={aiInsights.attendanceAnomalies}
                      onNavigateToStudent={(studentId) => {
                        safeNavigate(ROUTES.STUDENT_DETAIL(studentId));
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={Sparkles}
                      message={`${terms.ABSENCE_LABEL}이상탐지 데이터가 없습니다.`}
                      description="AI 분석이 완료되면 결과를 확인할 수 있습니다."
                    />
                  )}
                </Card>
                </>
              )}

              {/* 성과분석 탭 */}
              {selectedSubMenu === 'performance' && (
                <>
                <Card padding="lg">
                  <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>{terms.GROUP_LABEL}/{terms.SUBJECT_LABEL}성과분석</h3>
                  {generateReport.isPending ? (
                    <AIAnalysisLoadingUI
                      steps={PERFORMANCE_INSIGHTS_STEPS}
                      currentStep={currentAnalysisStep}
                      message="AI 성과 분석이 완료될 때까지 잠시만 기다려주세요."
                    />
                  ) : aiInsights?.performanceAnalysis && aiInsights.performanceAnalysis.length > 0 ? (
                    <PerformanceDetailContent
                      performanceAnalysis={aiInsights.performanceAnalysis}
                      onNavigateToClass={(classId) => {
                        safeNavigate(ROUTES.CLASS_DETAIL(classId));
                      }}
                    />
                  ) : (
                    <EmptyState
                      icon={Sparkles}
                      message="성과분석 데이터가 없습니다."
                      description='"월간 리포트 생성" 버튼을 클릭하여 AI 분석을 실행하세요.'
                    />
                  )}
                </Card>
                </>
              )}

              {/* 브리핑 탭 */}
              {selectedSubMenu === 'briefing' && (
                <>
                  {/* 주간 브리핑 */}
                  {aiInsights?.weeklyBriefing ? (
                    <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)' }}>주간 브리핑</h3>
                      <div style={{
                        padding: 'var(--spacing-md)',
                        backgroundColor: 'var(--color-background-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {aiInsights.weeklyBriefing.summary}
                      </div>
                    </Card>
                  ) : (
                    <Card padding="lg" style={{ marginBottom: 'var(--spacing-md)' }}>
                      <EmptyState
                        icon={Sparkles}
                        message="주간 브리핑 데이터가 없습니다."
                        description="매주 월요일 07:00에 자동 생성됩니다."
                      />
                    </Card>
                  )}

                  {/* 일일 브리핑 */}
                  {aiInsights?.dailyBriefing ? (
                    <Card padding="lg">
                      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>일일 브리핑</h2>
                      <div style={{
                        padding: 'var(--spacing-md)',
                        backgroundColor: 'var(--color-background-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {aiInsights.dailyBriefing.summary}
                      </div>
                    </Card>
                  ) : (
                    <Card padding="lg">
                      <EmptyState
                        icon={Sparkles}
                        message="일일 브리핑 데이터가 없습니다."
                        description="매일 07:00에 자동 생성됩니다."
                      />
                    </Card>
                  )}
                </>
              )}

              {/* 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동 - tab=consultation일 때 상담일지 요약 표시 */}
              {tabParam === 'consultation' && selectedSubMenu === 'insights' && (
                <div id="consultation-card" style={{ marginTop: 'var(--spacing-md)' }}>
                  <ConsultationSummaryTab />
                </div>
              )}
            </>
          )}

          {/* 성과분석 상세 모달 */}
          {isMobileMode ? (
            <Drawer
              isOpen={showPerformanceDetail}
              onClose={() => setShowPerformanceDetail(false)}
              title={`${terms.GROUP_LABEL}/${terms.SUBJECT_LABEL}성과분석 상세`}
              position="bottom"
            >
              <PerformanceDetailContent
                performanceAnalysis={aiInsights?.performanceAnalysis || []}
                onNavigateToClass={(classId) => {
                  setShowPerformanceDetail(false);
                  safeNavigate(ROUTES.CLASS_DETAIL(classId));
                }}
              />
            </Drawer>
          ) : (
            <Modal
              isOpen={showPerformanceDetail}
              onClose={() => setShowPerformanceDetail(false)}
              title={`${terms.GROUP_LABEL}/${terms.SUBJECT_LABEL}성과분석 상세`}
              size="lg"
            >
              <PerformanceDetailContent
                performanceAnalysis={aiInsights?.performanceAnalysis || []}
                onNavigateToClass={(classId) => {
                  setShowPerformanceDetail(false);
                  safeNavigate(ROUTES.CLASS_DETAIL(classId));
                }}
              />
            </Modal>
          )}

          {/* 출결 이상탐지 상세 모달 */}
          {isMobileMode ? (
            <Drawer
              isOpen={showAttendanceDetail}
              onClose={() => setShowAttendanceDetail(false)}
              title={`${terms.ABSENCE_LABEL}이상탐지 상세`}
              position="bottom"
            >
              <AttendanceAnomalyDetailContent
                attendanceAnomalies={aiInsights?.attendanceAnomalies || []}
                onNavigateToStudent={(studentId) => {
                  setShowAttendanceDetail(false);
                  safeNavigate(ROUTES.STUDENT_DETAIL(studentId));
                }}
              />
            </Drawer>
          ) : (
            <Modal
              isOpen={showAttendanceDetail}
              onClose={() => setShowAttendanceDetail(false)}
              title={`${terms.ABSENCE_LABEL}이상탐지 상세`}
              size="lg"
            >
              <AttendanceAnomalyDetailContent
                attendanceAnomalies={aiInsights?.attendanceAnomalies || []}
                onNavigateToStudent={(studentId) => {
                  setShowAttendanceDetail(false);
                  safeNavigate(ROUTES.STUDENT_DETAIL(studentId));
                }}
              />
            </Modal>
          )}
      </Container>
      </div>
    </ErrorBoundary>
  );
}

// AI 요약 생성 단계 정의
const AI_CONSULTATION_SUMMARY_STEPS = [
  { step: 1, label: '상담 내용 분석 중', duration: 500 },
  { step: 2, label: 'AI 요약 생성 중', duration: 2000 },
  { step: 3, label: '결과 저장 중', duration: 300 },
] as const;

/**
 * 상담일지 자동 요약 탭 컴포넌트
 * [요구사항 3.7] 상담일지 자동 요약
 */
function ConsultationSummaryTab() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const terms = useIndustryTerms();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);
  const [currentSummaryStep, setCurrentSummaryStep] = useState<number>(0);

  // 관리 대상 목록 조회
  const { data: students } = useStudents({});

  // 선택된 관리 대상의 상담일지 조회
  const { data: consultations, isLoading: consultationsLoading } = useQuery({
    queryKey: ['consultations', tenantId, selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];

      // 정본 규칙: fetchConsultations 함수 사용 (Hook의 queryFn 로직 재사용)
      if (!tenantId) return [];
      return fetchConsultations(tenantId, {
        student_id: selectedStudentId,
      });
    },
    enabled: !!tenantId && !!selectedStudentId,
  });

  // 서버가 AI 요약 생성
  const generateAISummary = useGenerateConsultationAISummary();

  // AI 요약 생성 진행 단계 시뮬레이션
  useEffect(() => {
    if (!generatingSummaryId) {
      setCurrentSummaryStep(0);
      return;
    }

    // 분석 시작 시 첫 단계로 이동
    setCurrentSummaryStep(1);

    // 각 단계별로 타이머 설정
    const timers: NodeJS.Timeout[] = [];
    let accumulatedTime = 0;

    AI_CONSULTATION_SUMMARY_STEPS.forEach((step, index) => {
      if (index === 0) return; // 첫 단계는 즉시 시작

      accumulatedTime += AI_CONSULTATION_SUMMARY_STEPS[index - 1].duration;
      const timer = setTimeout(() => {
        setCurrentSummaryStep(step.step);
      }, accumulatedTime);
      timers.push(timer);
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [generatingSummaryId]);

  const handleGenerateSummary = async (consultationId: string) => {
    if (!selectedStudentId) return;

    try {
      setGeneratingSummaryId(consultationId);
      await generateAISummary.mutateAsync({
        consultationId,
        studentId: selectedStudentId,
      });
      showAlert('AI 요약이 생성되었습니다.', '성공');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'AI 요약 생성에 실패했습니다.', '오류');
    } finally {
      setGeneratingSummaryId(null);
    }
  };

  return (
    <Card padding="lg">
      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>{terms.CONSULTATION_LABEL_PLURAL} 자동 요약</h2>

      {/* 관리 대상 선택 */}
      {students && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
            {terms.PERSON_LABEL_PRIMARY} 선택
          </label>
          <select
            value={selectedStudentId || ''}
            onChange={(e) => setSelectedStudentId(e.target.value || null)}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--border-radius-md)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <option value="">{terms.PERSON_LABEL_PRIMARY}을 선택하세요</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 상담일지 목록 */}
      {selectedStudentId && (
        <div>
          {consultationsLoading ? (
            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
              로딩 중...
            </div>
          ) : consultations && consultations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {consultations.map((consultation: StudentConsultation) => {
                // AI 요약 생성 중인지 확인
                const isGenerating = generatingSummaryId === consultation.id;

                return (
                <Card
                  key={consultation.id}
                  padding="md"
                >
                  {/* AI 요약 생성 중일 때 로딩 UI 표시 */}
                  {isGenerating ? (
                    <AIAnalysisLoadingUI
                      steps={AI_CONSULTATION_SUMMARY_STEPS}
                      currentStep={currentSummaryStep}
                      message="AI 요약이 완료될 때까지 잠시만 기다려주세요."
                    />
                  ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>
                          {toKST(consultation.consultation_date).format('YYYY-MM-DD')}
                        </h4>
                        <Badge variant="outline">
                          {consultation.consultation_type === 'counseling' ? '상담' :
                           consultation.consultation_type === 'learning' ? '학습' :
                           consultation.consultation_type === 'behavior' ? '행동' : '기타'}
                        </Badge>
                      </div>
                      <p style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap', marginBottom: 'var(--spacing-sm)' }}>
                        {consultation.content}
                      </p>
                      {consultation.ai_summary ? (
                        <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                          <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                            AI 요약
                          </p>
                          <p style={{ color: 'var(--color-text-secondary)' }}>
                            {consultation.ai_summary}
                          </p>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateSummary(consultation.id)}
                          disabled={generateAISummary.isPending}
                        >
                          AI 요약 생성
                        </Button>
                      )}
                    </div>
                  </div>
                  )}
                </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              message={`${terms.CONSULTATION_LABEL_PLURAL}${p.이가(terms.CONSULTATION_LABEL_PLURAL)} 없습니다.`}
            />
          )}
        </div>
      )}

      {!selectedStudentId && (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          {terms.PERSON_LABEL_PRIMARY}{p.을를(terms.PERSON_LABEL_PRIMARY)} 선택하면 {terms.CONSULTATION_LABEL_PLURAL} 목록이 표시됩니다.
        </div>
      )}
    </Card>
  );
}

/**
 * 성과 분석 상세 모달 내용 컴포넌트
 *
 * [아키텍처 문서 4559-4567] AI Insight는 "데이터 분석 인사이트" 레이어
 * - purpose: 'data_analysis_insights' (데이터 분석 인사이트)
 * - action_required: false (정보 제공만)
 * - 클릭 시 그룹 편집이 아닌 상세 인사이트 정보 제공
 */
interface DetailInsightItem {
  type: 'improvement' | 'strength' | 'pattern' | 'comparison' | 'warning' | 'opportunity';
  title: string;
  description: string;
  severity?: 'high' | 'medium' | 'low';
  category?: 'attendance' | 'enrollment' | 'consultation' | 'billing' | 'capacity' | 'teacher';
}

interface PerformanceDetailContentProps {
  performanceAnalysis: Array<{
    class_id: string;
    class_name: string;
    subject?: string;
    grade?: string;
    performance: string;
    trend: string;
    recommendation: string;
    detail_insights?: DetailInsightItem[];
    // 출석 관련
    attendance_rate?: number;
    absent_rate?: number;
    late_rate?: number;
    attendance_trend?: string;
    // 관리 대상 관련
    student_count?: number;
    max_students?: number;
    capacity_rate?: number;
    new_enrollments?: number;
    withdrawals?: number;
    enrollment_trend?: string;
    // 상담 관련
    consultation_count?: number;
    learning_consultations?: number;
    behavior_consultations?: number;
    // 수납 관련
    billing_collection_rate?: number;
    overdue_count?: number;
    total_revenue?: number;
    // 스태프 관련
    teacher_count?: number;
    has_main_teacher?: boolean;
  }>;
  onNavigateToClass: (classId: string) => void;
}

function PerformanceDetailContent({ performanceAnalysis, onNavigateToClass }: PerformanceDetailContentProps) {
  const terms = useIndustryTerms();
  // 선택된 그룹의 상세 인사이트를 보여주는 상태
  const [selectedClassIndex, setSelectedClassIndex] = useState<number | null>(null);

  if (performanceAnalysis.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        message="성과분석 데이터가 없습니다."
      />
    );
  }

  // 성과별 통계 계산
  const stats = {
    excellent: performanceAnalysis.filter(p => p.performance === '우수').length,
    normal: performanceAnalysis.filter(p => p.performance === '보통').length,
    needsImprovement: performanceAnalysis.filter(p => p.performance === '개선필요').length,
  };

  // 선택된 그룹의 상세 인사이트 뷰
  if (selectedClassIndex !== null) {
    const selectedClass = performanceAnalysis[selectedClassIndex];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* 뒤로가기 버튼 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedClassIndex(null)}
          style={{ alignSelf: 'flex-start' }}
        >
          ← 전체 목록으로
        </Button>

        {/* 그룹 정보 헤더 */}
        <div style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
            <Badge color={selectedClass.performance === '우수' ? 'success' : selectedClass.performance === '보통' ? 'info' : 'error'} style={{ fontSize: 'var(--font-size-base)' }}>
              {selectedClass.performance}
            </Badge>
            <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
              {selectedClass.class_name}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>추세:</span>
            <span style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: selectedClass.trend.startsWith('+') ? 'var(--color-success)' : selectedClass.trend.startsWith('-') ? 'var(--color-error)' : 'var(--color-text)'
            }}>
              {selectedClass.trend}
            </span>
          </div>
        </div>

        {/* AI 분석 인사이트 */}
        <Card padding="lg">
          <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ color: 'var(--color-primary)' }}>✨</span> AI 분석 인사이트
          </h4>

          {/* 종합 지표 대시보드 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-sm)',
            marginBottom: 'var(--spacing-md)'
          }}>
            {/* 출석률 */}
            {selectedClass.attendance_rate !== undefined && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: selectedClass.attendance_rate >= 90 ? 'var(--color-success)' : selectedClass.attendance_rate >= 70 ? 'var(--color-info)' : 'var(--color-error)' }}>
                  {selectedClass.attendance_rate}%
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>출석률</div>
              </div>
            )}
            {/* 정원 충족률 */}
            {selectedClass.capacity_rate !== undefined && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: selectedClass.capacity_rate >= 80 ? 'var(--color-success)' : selectedClass.capacity_rate >= 50 ? 'var(--color-info)' : 'var(--color-warning)' }}>
                  {selectedClass.capacity_rate}%
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.CAPACITY_LABEL} 충족</div>
              </div>
            )}
            {/* 수납률 */}
            {selectedClass.billing_collection_rate !== undefined && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: selectedClass.billing_collection_rate >= 90 ? 'var(--color-success)' : selectedClass.billing_collection_rate >= 70 ? 'var(--color-info)' : 'var(--color-error)' }}>
                  {selectedClass.billing_collection_rate}%
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>수납률</div>
              </div>
            )}
            {/* 관리 대상 수 */}
            {selectedClass.student_count !== undefined && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                  {selectedClass.student_count}{selectedClass.max_students ? `/${selectedClass.max_students}` : ''}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.PERSON_LABEL_PRIMARY} 수</div>
              </div>
            )}
            {/* 상담 건수 */}
            {selectedClass.consultation_count !== undefined && selectedClass.consultation_count > 0 && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                  {selectedClass.consultation_count}건
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>상담</div>
              </div>
            )}
            {/* 스태프 배정 */}
            {selectedClass.teacher_count !== undefined && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background-secondary)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: selectedClass.has_main_teacher ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {selectedClass.teacher_count}명
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{terms.PERSON_LABEL_SECONDARY}</div>
              </div>
            )}
          </div>

          {/* 세부 현황 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
            {/* 등록/이탈 현황 */}
            {(selectedClass.new_enrollments !== undefined || selectedClass.withdrawals !== undefined) && (
              <div style={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>등록/이탈</div>
                <span style={{ color: 'var(--color-success)' }}>+{selectedClass.new_enrollments || 0}</span>
                <span style={{ color: 'var(--color-text-secondary)' }}> / </span>
                <span style={{ color: 'var(--color-error)' }}>-{selectedClass.withdrawals || 0}</span>
                {selectedClass.enrollment_trend && (
                  <span style={{ marginLeft: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>({selectedClass.enrollment_trend})</span>
                )}
              </div>
            )}
            {/* 미납 현황 */}
            {selectedClass.overdue_count !== undefined && selectedClass.overdue_count > 0 && (
              <div style={{ padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)' }}>
                <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>미납</div>
                <span style={{ color: 'var(--color-error)', fontWeight: 'var(--font-weight-semibold)' }}>{selectedClass.overdue_count}건</span>
              </div>
            )}
          </div>

          {/* 핵심 권장 사항 */}
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            borderLeft: '4px solid var(--color-primary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <p style={{ color: 'var(--color-text)', lineHeight: 1.6, margin: 0 }}>
              {selectedClass.recommendation}
            </p>
          </div>

          {/* 상세 인사이트 목록 */}
          {selectedClass.detail_insights && selectedClass.detail_insights.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <h5 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0, marginBottom: 'var(--spacing-xs)' }}>
                상세 분석
              </h5>
              {selectedClass.detail_insights.map((insight, idx) => {
                // 인사이트 타입별 색상 및 아이콘
                const getInsightStyle = () => {
                  switch (insight.type) {
                    case 'improvement':
                      return {
                        borderColor: insight.severity === 'high' ? 'var(--color-error)' : insight.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-info)',
                        icon: '⚠️',
                        badgeColor: insight.severity === 'high' ? 'error' : insight.severity === 'medium' ? 'warning' : 'info',
                      };
                    case 'strength':
                      return {
                        borderColor: 'var(--color-success)',
                        icon: '✅',
                        badgeColor: 'success' as const,
                      };
                    case 'pattern':
                      return {
                        borderColor: 'var(--color-info)',
                        icon: '📊',
                        badgeColor: 'info' as const,
                      };
                    case 'comparison':
                      return {
                        borderColor: 'var(--color-primary)',
                        icon: '📈',
                        badgeColor: 'primary' as const,
                      };
                    case 'warning':
                      return {
                        borderColor: 'var(--color-error)',
                        icon: '🚨',
                        badgeColor: 'error' as const,
                      };
                    case 'opportunity':
                      return {
                        borderColor: 'var(--color-success)',
                        icon: '💡',
                        badgeColor: 'success' as const,
                      };
                    default:
                      return {
                        borderColor: 'var(--color-border)',
                        icon: '💡',
                        badgeColor: 'gray' as const,
                      };
                  }
                };

                // 카테고리별 라벨
                const getCategoryLabel = () => {
                  switch (insight.category) {
                    case 'attendance': return terms.PRESENT_LABEL;
                    case 'enrollment': return '등록';
                    case 'consultation': return terms.CONSULTATION_LABEL;
                    case 'billing': return terms.BILLING_LABEL;
                    case 'capacity': return terms.CAPACITY_LABEL;
                    case 'teacher': return terms.PERSON_LABEL_SECONDARY;
                    default: return null;
                  }
                };
                const categoryLabel = getCategoryLabel();
                const style = getInsightStyle();

                return (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--spacing-md)',
                      backgroundColor: 'var(--color-background)',
                      borderRadius: 'var(--border-radius-md)',
                      borderLeft: `4px solid ${style.borderColor}`,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                      <span>{style.icon}</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                        {insight.title}
                      </span>
                      {categoryLabel && (
                        <Badge color="gray" style={{ fontSize: 'var(--font-size-xs)' }}>
                          {categoryLabel}
                        </Badge>
                      )}
                      {insight.severity && (
                        <Badge color={style.badgeColor as 'error' | 'warning' | 'info' | 'success'} style={{ fontSize: 'var(--font-size-xs)' }}>
                          {insight.severity === 'high' ? '높음' : insight.severity === 'medium' ? '중간' : '낮음'}
                        </Badge>
                      )}
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {insight.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 그룹 관리 페이지 이동 버튼 - 선택적 액션 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateToClass(selectedClass.class_id)}
          >
            {terms.GROUP_LABEL} 관리 페이지로 이동 →
          </Button>
        </div>
      </div>
    );
  }

  // 전체 목록 뷰
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 요약 통계 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
            {stats.excellent}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>우수</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-info)' }}>
            {stats.normal}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>보통</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
            {stats.needsImprovement}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>개선필요</div>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div style={{
        padding: 'var(--spacing-sm)',
        backgroundColor: 'var(--color-info-bg)',
        borderRadius: 'var(--border-radius-sm)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-info)'
      }}>
        💡 각 {terms.GROUP_LABEL}을 클릭하면 상세 AI 분석 인사이트를 확인할 수 있습니다.
      </div>

      {/* 그룹별 상세 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {performanceAnalysis.map((perf, index) => (
          <Card
            key={index}
            padding="md"
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedClassIndex(index)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                  <Badge color={perf.performance === '우수' ? 'success' : perf.performance === '보통' ? 'info' : 'error'}>
                    {perf.performance}
                  </Badge>
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {perf.class_name}
                  </span>
                  {perf.attendance_rate !== undefined && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      (출석률 {perf.attendance_rate.toFixed(1)}%)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>추세:</span>
                  <span style={{
                    fontWeight: 'var(--font-weight-semibold)',
                    color: perf.trend.startsWith('+') ? 'var(--color-success)' : perf.trend.startsWith('-') ? 'var(--color-error)' : 'var(--color-text)'
                  }}>
                    {perf.trend}
                  </span>
                  {perf.student_count !== undefined && (
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      • {perf.student_count}명
                    </span>
                  )}
                </div>
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--color-background-secondary)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)'
                }}>
                  {perf.recommendation}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                {perf.detail_insights && perf.detail_insights.length > 0 && (
                  <Badge color="primary" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {perf.detail_insights.length}개 인사이트
                  </Badge>
                )}
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  상세 보기 →
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * 출결 이상 탐지 상세 모달 내용 컴포넌트
 */
interface AttendanceAnomalyDetailContentProps {
  attendanceAnomalies: Array<{
    student_id: string;
    student_name: string;
    issue: string;
    recommendation: string;
  }>;
  onNavigateToStudent: (studentId: string) => void;
}

function AttendanceAnomalyDetailContent({ attendanceAnomalies, onNavigateToStudent }: AttendanceAnomalyDetailContentProps) {
  const terms = useIndustryTerms();

  if (attendanceAnomalies.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        message={`${terms.ABSENCE_LABEL}이상탐지 데이터가 없습니다.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* 요약 */}
      <div style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-md)',
        borderLeft: '4px solid var(--color-warning)'
      }}>
        <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
          {attendanceAnomalies.length}명의 {terms.PERSON_LABEL_PRIMARY}에게 {terms.ABSENCE_LABEL} 이상 감지
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          각 {terms.PERSON_LABEL_PRIMARY}을 클릭하면 상세 정보를 확인하고 조치를 취할 수 있습니다.
        </div>
      </div>

      {/* 관리 대상별 상세 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {attendanceAnomalies.map((anomaly, index) => (
          <Card
            key={index}
            padding="md"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigateToStudent(anomaly.student_id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <Badge color="warning">주의</Badge>
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {anomaly.student_name}
                  </span>
                </div>
                <div style={{
                  marginBottom: 'var(--spacing-sm)',
                  color: 'var(--color-text)',
                  fontWeight: 'var(--font-weight-medium)'
                }}>
                  {anomaly.issue}
                </div>
                <div style={{
                  padding: 'var(--spacing-sm)',
                  backgroundColor: 'var(--color-background-secondary)',
                  borderRadius: 'var(--border-radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)'
                }}>
                  권장 조치: {anomaly.recommendation}
                </div>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                상세 보기 →
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

