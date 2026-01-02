/**
 * AI 분석 기능 페이지 (AI Insights)
 *
 * [LAYER: UI_PAGE]
 *
 * [Phase 1 MVP 범위] 아키텍처 문서 3.7.1, 3578줄:
 * - 상담일지 자동 요약 (저장 시 즉시 생성 - 아키텍처 문서 4101줄)
 * - 학생 출결 이상 탐지 (실시간 감지 및 업데이트 - 아키텍처 문서 4097줄, Phase 1부터 적용)
 * - 반/과목 성과 분석
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
 * [요구사항] 서버가 상담일지 AI 요약 생성, 출결 이상 탐지, 반/과목 성과 분석, 지역 대비 부족 영역 분석, 서버가 월간 운영 리포트 생성 (AI 호출 포함)
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

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ErrorBoundary, useModal, useResponsiveMode , Container, Card, Button, Badge, PageHeader, isMobile } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import { useStudents, useGenerateConsultationAISummary, fetchConsultations, fetchPersons } from '@hooks/use-student';
import { fetchAttendanceLogs } from '@hooks/use-attendance';
import { fetchBillingHistory } from '@hooks/use-billing';
import { fetchAIInsights, useDismissAIInsight } from '@hooks/use-ai-insights';
import type { BillingHistoryItem } from '@hooks/use-billing';
import type { AttendanceLog } from '@services/attendance-service';
import type { Student, StudentConsultation } from '@services/student-service';
import type { Class } from '@services/class-service';
import type { Person } from '@core/party';
import { studentSelectFormSchema } from '../schemas/student-select.schema';
import { useUserRole } from '@hooks/use-auth';
import { useConfig } from '@hooks/use-config';
// [SSOT] Barrel export를 통한 통합 import
import { ROUTES } from '../constants';
import { createSafeNavigate } from '../utils';
import { LocationWarningBanner } from '../components/LocationWarningBanner';

export function AIPage() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const { data: config } = useConfig();
  const mode = useResponsiveMode();
  // [SSOT] 반응형 모드 확인은 SSOT 헬퍼 함수 사용
  const modeUpper = mode.toUpperCase() as 'XS' | 'SM' | 'MD' | 'LG' | 'XL';
  const isMobileMode = isMobile(modeUpper);
  const navigate = useNavigate();
  // [P0-2 수정] SSOT: 네비게이션 보안 유틸리티 사용
  const safeNavigate = useMemo(
    () => createSafeNavigate(navigate),
    [navigate]
  );
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab'); // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
  const { data: userRole } = useUserRole(); // 아키텍처 문서 2.4: Teacher는 요약만 접근 가능
  const isTeacher = userRole === 'teacher'; // Teacher는 요약만 볼 수 있음

  // P0-3: 지역 정보 미설정 경고 배너 상태
  const [locationBannerDismissed, setLocationBannerDismissed] = useState(false);

  // P0-3: 지역 정보 확인 (지역 인사이트 기능 사용 전 필수)
  const locationInfo = useMemo(() => {
    const location = config?.location as { location_code?: string } | undefined;
    return {
      location_code: location?.location_code || '',
    };
  }, [config]);

  // P0-3: 지역 정보 미설정 시 경고 배너 표시
  const showLocationBanner = !locationInfo.location_code && !locationBannerDismissed;

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

      const attendanceAnomalies: Array<{ student_id: string; student_name: string; issue: string; recommendation: string }> = [];
      if (attendanceAnomalyInsights && attendanceAnomalyInsights.length > 0) {
        attendanceAnomalies.push(...attendanceAnomalyInsights.map((insight) => ({
          student_id: insight.related_entity_id || '',
          student_name: (insight.metadata?.student_name as string) || '알 수 없음',
          issue: insight.summary || '',
          recommendation: (insight.details?.recommendation as string) || '학생의 출석 패턴을 분석하고 상담을 진행하세요.',
        })));
      }

      // ai_insights 테이블에 데이터가 없는 경우 fallback: 출결 데이터 기반 간단한 분석
      // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
      let attendanceLogs: AttendanceLog[] = [];
      if (attendanceAnomalies.length === 0) {
        attendanceLogs = await fetchAttendanceLogs(tenantId, {});

        // 학생별 출결 패턴 분석
        const studentAttendanceMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

        attendanceLogs.forEach((log: AttendanceLog) => {
          if (!log.student_id) return;

          if (!studentAttendanceMap.has(log.student_id)) {
            studentAttendanceMap.set(log.student_id, { present: 0, absent: 0, late: 0, total: 0 });
          }

          const stats = studentAttendanceMap.get(log.student_id)!;
          stats.total++;

          if (log.status === 'present') stats.present++;
          else if (log.status === 'absent') stats.absent++;
          else if (log.status === 'late') stats.late++;
        });

        // 출석률이 70% 미만이거나 결석이 3회 이상인 학생 탐지
        // 최대 10명만 조회하여 성능 최적화
        const anomalyStudentIds = Array.from(studentAttendanceMap.entries())
          .filter(([, stats]) => {
            const attendanceRate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
            return attendanceRate < 70 || stats.absent >= 3;
          })
          .slice(0, 10)
          .map(([studentId]) => studentId);

        // 학생 정보 일괄 조회
        // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
        if (anomalyStudentIds.length > 0) {
          const persons = await fetchPersons(tenantId, {
            id: anomalyStudentIds, // 배열을 직접 전달하면 ApiClient가 자동으로 .in() 처리
            person_type: 'student',
          });
          const studentMap = new Map(persons.map((p: Person) => [p.id, p as unknown as Student]));

          for (const studentId of anomalyStudentIds) {
            const stats = studentAttendanceMap.get(studentId)!;
            const attendanceRate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
            const student = studentMap.get(studentId);

            if (student) {
              attendanceAnomalies.push({
                student_id: studentId,
                student_name: student.name || '알 수 없음',
                issue: attendanceRate < 70
                  ? `출석률이 ${attendanceRate.toFixed(1)}%로 낮습니다.`
                  : `최근 결석이 ${stats.absent}회 발생했습니다.`,
                recommendation: attendanceRate < 70
                  ? '학생의 출석 패턴을 분석하고 상담을 진행하세요.'
                  : '결석 원인을 파악하고 학부모와 상의하세요.',
              });
            }
          }
        }
      }

      // 2. 반/과목 성과 분석 (performance_analysis) - 아키텍처 문서 3.7.1: 반/과목 성과 분석
      // P1-1: 통합 쿼리에서 추출 (개별 쿼리 제거)
      const performanceAnalysisInsights = (insightsByType.get('performance_analysis') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let performanceAnalysis: Array<{ class_id: string; class_name: string; performance: string; trend: string; recommendation: string }> = [];
      if (performanceAnalysisInsights && performanceAnalysisInsights.length > 0) {
        performanceAnalysis = performanceAnalysisInsights.map((insight) => ({
          class_id: insight.related_entity_id || '',
          class_name: (insight.metadata?.class_name as string) || '알 수 없음',
          performance: (insight.details?.performance as string) || '보통',
          trend: (insight.details?.trend as string) || '0%',
          recommendation: (insight.details?.recommendation as string) || '출석률 개선을 위해 노력하세요.',
        }));
      }

      // ai_insights 테이블에 데이터가 없는 경우 fallback
      if (performanceAnalysis.length === 0) {
        const classesResponse = await apiClient.get<Class[]>('academy_classes', {
          filters: { status: 'active' },
        });
        const classes = (classesResponse.data as unknown) as Class[] || [];

        // attendanceLogs가 비어있으면 다시 조회
        // 정본 규칙: fetchAttendanceLogs 함수 사용 (Hook의 queryFn 로직 재사용)
        if (attendanceLogs.length === 0) {
          attendanceLogs = await fetchAttendanceLogs(tenantId, {});
        }

        performanceAnalysis = classes.map((cls: Class) => {
          const classLogs = attendanceLogs.filter((log: AttendanceLog) => log.class_id === cls.id);
          const attendanceRate = classLogs.length > 0
            ? (classLogs.filter((log: AttendanceLog) => log.status === 'present').length / classLogs.length) * 100
            : 0;

          return {
            class_id: cls.id,
            class_name: cls.name,
            performance: attendanceRate >= 90 ? '우수' : attendanceRate >= 70 ? '보통' : '개선필요',
            trend: attendanceRate >= 90 ? '+5%' : attendanceRate >= 70 ? '0%' : '-5%',
            recommendation: attendanceRate >= 90
              ? '현재 운영 방식을 유지하세요.'
              : attendanceRate >= 70
              ? '출석률 개선을 위해 노력하세요.'
              : '출석률 개선이 시급합니다.',
          };
        });
      }

      // 3. 지역 대비 비교 (regional_analytics) - 아키텍처 문서 3.7.1: 지역 대비 부족 영역 분석
      // P1-1: 통합 쿼리에서 추출 (개별 쿼리 제거)
      // P0-1: 지역 인사이트 타입 수정 (regional_comparison → regional_analytics)
      const regionalComparisonInsights = (insightsByType.get('regional_analytics') || [])
        .filter(insight => insight.created_at >= `${todayDate}T00:00:00`);

      let regionalComparison: Array<{ area: string; status: string; gap: string; recommendation: string }> = [];
      if (regionalComparisonInsights && regionalComparisonInsights.length > 0) {
        regionalComparison = regionalComparisonInsights.map((insight) => ({
          area: (insight.metadata?.area as string) || '알 수 없음',
          status: (insight.metadata?.status as string) || '보통',
          gap: insight.summary || '',
          recommendation: (insight.details?.recommendation as string) || '지역 평균과 비교하여 개선이 필요합니다.',
        }));
      }

      return {
        weeklyBriefing, // Phase 1 MVP: 주간 브리핑 (아키텍처 문서 3581줄)
        attendanceAnomalies,
        performanceAnalysis,
        regionalComparison,
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

  // 월간 리포트 생성
  const generateReport = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // TODO: Edge Function으로 리포트 생성 요청
      // 현재는 간단한 리포트 데이터 수집
      // 정본 규칙: fetch 함수 사용 (Hook의 queryFn 로직 재사용)
      const currentMonth = toKST().format('YYYY-MM');

      const invoices = await fetchBillingHistory(tenantId, {
        period_start: { gte: `${currentMonth}-01` },
      });

      // 정본 규칙: fetchPersons 함수 사용 (Hook의 queryFn 로직 재사용)
      const students = await fetchPersons(tenantId, {
        person_type: 'student',
      });

      const attendanceLogs = await fetchAttendanceLogs(tenantId, {
        date_from: `${currentMonth}-01T00:00:00`,
      });

      // 리포트 데이터 생성
      const reportData = {
        month: currentMonth,
        total_students: students.length,
        total_invoices: invoices.length,
        total_revenue: invoices.reduce((sum: number, inv: BillingHistoryItem) => sum + (inv.amount_paid || 0), 0),
        total_attendance: attendanceLogs.filter((log: AttendanceLog) => log.status === 'present').length,
        generated_at: toKST().toISOString(),
      };

      // TODO: 리포트를 파일로 저장하거나 다운로드 링크 생성
      // 현재는 데이터만 반환
      return {
        report_id: `report-${currentMonth}-${Date.now()}`,
        ...reportData,
      };
    },
    onSuccess: (data) => {
      showAlert('성공', `월간 운영 리포트가 생성되었습니다. (${data.report_id})`);
      // TODO: 리포트 다운로드 링크 제공
    },
    onError: (error: Error) => {
      showAlert('오류', error.message);
    },
  });

  return (
    <ErrorBoundary>
      <Container maxWidth="xl" padding={isMobileMode ? "sm" : "lg"}>
        <PageHeader
          title="AI 분석"
        />

        {/* P0-3: 지역 정보 미설정 시 안내 배너 표시 */}
        {showLocationBanner && (
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <LocationWarningBanner
              message="지역 인사이트를 사용하려면 위치 정보를 설정하세요"
              onNavigate={() => navigate('/settings')}
              onDismiss={() => setLocationBannerDismissed(true)}
            />
          </div>
        )}

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
                    const element = document.getElementById('attendance-card');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                      safeNavigate(ROUTES.AI_ATTENDANCE);
                    }
                  }}
                >
                  출결 이상 탐지
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
                    const element = document.getElementById('performance-card');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                      safeNavigate(ROUTES.AI_HOME);
                    }
                  }}
                >
                  성과 분석
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
                  상담일지 요약
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
              {/* 아키텍처 문서 3.7.1: 기본 화면에서는 서버가 생성한 "요약 카드" 중심으로 표시 (일부 타입에서만 AI 호출 발생) */}
              {aiInsights && (
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

                  {/* 출결 이상 탐지 요약 카드 - 아키텍처 문서 3.7.1: 학생 출결 이상 탐지 */}
                  {aiInsights.attendanceAnomalies && aiInsights.attendanceAnomalies.length > 0 && (
                    <div id="attendance-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', cursor: 'pointer' }} onClick={() => {
                        // TODO: 하위 페이지 구현 시 navigate('/ai/attendance-anomalies')
                        showAlert('알림', '출결 이상 탐지 상세 분석은 준비 중입니다.');
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            출결 이상 탐지
                          </h2>
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.attendanceAnomalies.length}명의 학생에게 출결 이상이 감지되었습니다.
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

                  {/* 반/과목 성과 분석 요약 카드 - 아키텍처 문서 3.7.1: 반/과목 성과 분석 */}
                  {aiInsights.performanceAnalysis && aiInsights.performanceAnalysis.length > 0 && (
                    <div id="performance-card">
                      <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)', cursor: 'pointer' }} onClick={() => {
                        // TODO: 하위 페이지 구현 시 navigate('/ai/performance')
                        showAlert('알림', '성과 분석 상세 화면은 준비 중입니다.');
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                            반/과목 성과 분석
                          </h2>
                        </div>
                        <p style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                          {aiInsights.performanceAnalysis.length}개 반의 성과를 분석했습니다.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          {aiInsights.performanceAnalysis.slice(0, 3).map((perf: { performance: string; class_name: string; trend: string }, index: number) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                              <Badge color={perf.performance === '우수' ? 'success' : perf.performance === '보통' ? 'info' : 'error'}>
                                {perf.performance}
                              </Badge>
                              <span style={{ color: 'var(--color-text-secondary)' }}>
                                {perf.class_name}: {perf.trend}
                              </span>
                            </div>
                          ))}
                          {aiInsights.performanceAnalysis.length > 3 && (
                            <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              외 {aiInsights.performanceAnalysis.length - 3}개 반...
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
                          {aiInsights.regionalComparison.map((item: { area: string; status: string; gap: string; recommendation: string }, index: number) => (
                            <div
                              key={index}
                              style={{
                                padding: 'var(--spacing-md)',
                                border: `var(--border-width-thin) solid var(--color-border)`,
                                borderRadius: 'var(--border-radius-md)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                                <Badge color={item.status === '부족' ? 'error' : 'success'}>
                                  {item.area}
                                </Badge>
                                <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{item.gap}</span>
                              </div>
                              <div style={{ color: 'var(--color-text-secondary)' }}>
                                {item.recommendation}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <Card padding="lg" style={{ marginBottom: 'var(--spacing-xl)' }}>
                      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <p>지역 비교 데이터가 없습니다.</p>
                        <p style={{ marginTop: 'var(--spacing-xs)' }}>
                          지역 정보를 설정하면 지역 대비 분석을 제공할 수 있습니다.
                        </p>
                      </div>
                    </Card>
                  )}

                  {/* 데이터가 없는 경우 안내 */}
                  {!aiInsights.weeklyBriefing &&
                   (!aiInsights.attendanceAnomalies || aiInsights.attendanceAnomalies.length === 0) &&
                   (!aiInsights.performanceAnalysis || aiInsights.performanceAnalysis.length === 0) &&
                   (!aiInsights.regionalComparison || aiInsights.regionalComparison.length === 0) && (
                    <Card padding="lg">
                      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <p>AI 인사이트 데이터가 없습니다.</p>
                        <p style={{ marginTop: 'var(--spacing-xs)' }}>
                          데이터가 축적되면 AI 분석 결과를 제공합니다.
                        </p>
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동 - tab=consultation일 때 상담일지 요약 표시 */}
              {tabParam === 'consultation' && (
                <div id="consultation-card" style={{ marginTop: 'var(--spacing-md)' }}>
                  <ConsultationSummaryTab />
                </div>
              )}
            </>
          )}
      </Container>
    </ErrorBoundary>
  );
}

/**
 * 상담일지 자동 요약 탭 컴포넌트
 * [요구사항 3.7] 상담일지 자동 요약
 */
function ConsultationSummaryTab() {
  const { showAlert } = useModal();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // 학생 목록 조회
  const { data: students } = useStudents({});
  const { data: studentSelectSchema } = useSchema('student_select', studentSelectFormSchema, 'form');

  // 선택된 학생의 상담일지 조회
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

  const handleGenerateSummary = async (consultationId: string) => {
    if (!selectedStudentId) return;

    try {
      await generateAISummary.mutateAsync({
        consultationId,
        studentId: selectedStudentId,
      });
      showAlert('성공', 'AI 요약이 생성되었습니다.');
    } catch (error) {
      showAlert('오류', error instanceof Error ? error.message : 'AI 요약 생성에 실패했습니다.');
    }
  };

  return (
    <Card padding="lg">
      <h2 style={{ marginBottom: 'var(--spacing-md)' }}>상담일지 자동 요약</h2>

      {/* 학생 선택 - SchemaForm 사용 */}
      {studentSelectSchema && studentSelectSchema.type === 'form' && students && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <SchemaForm
            schema={{
              ...studentSelectSchema,
              form: {
                ...studentSelectSchema.form,
                fields: [
                  {
                    ...studentSelectSchema.form.fields[0],
                    options: [
                      { value: '', label: '학생을 선택하세요' },
                      ...students.map((student) => ({
                        value: student.id,
                        label: student.name,
                      })),
                    ],
                  },
                ],
              },
            }}
            onSubmit={(data: Record<string, unknown>) => {
              setSelectedStudentId((data.student_id as string) || null);
            }}
            defaultValues={{ student_id: selectedStudentId || '' }}
              actionContext={{
              apiCall: async (endpoint: string, method: string, body?: unknown) => {
                if (method === 'POST') {
                  const response = await apiClient.post(endpoint, body as Record<string, unknown>);
                  if (response.error) {
                    throw new Error(response.error.message);
                  }
                  return response.data;
                }
                const response = await apiClient.get(endpoint);
                if (response.error) {
                  throw new Error(response.error.message);
                }
                return response.data;
              },
              showToast: (message: string, variant?: string) => {
                showAlert(message, variant === 'success' ? '성공' : variant === 'error' ? '오류' : '알림');
              },
            }}
          />
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
              {consultations.map((consultation: StudentConsultation) => (
                <Card
                  key={consultation.id}
                  padding="md"
                >
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
                          {generateAISummary.isPending ? '생성 중...' : 'AI 요약 생성'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              상담일지가 없습니다.
            </div>
          )}
        </div>
      )}

      {!selectedStudentId && (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          학생을 선택하면 상담일지 목록이 표시됩니다.
        </div>
      )}
    </Card>
  );
}

