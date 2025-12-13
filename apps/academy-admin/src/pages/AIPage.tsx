/**
 * AI 분석 기능 페이지 (AI Insights)
 *
 * [Phase 1 MVP 범위] 아키텍처 문서 3.7.1, 3578줄:
 * - 상담일지 자동 요약 (저장 시 즉시 생성 - 아키텍처 문서 4101줄)
 * - 학생 출결 이상 탐지 (실시간 감지 및 업데이트 - 아키텍처 문서 4097줄, Phase 1부터 적용)
 * - 반/과목 성과 분석
 * - 지역 대비 부족 영역 분석
 * - 월간 운영 리포트 자동 생성
 * - 주간 브리핑 (매주 월요일 07:00 - 아키텍처 문서 3581줄, Phase 1)
 *
 * [Phase 2+ 범위] 아키텍처 문서 3582줄:
 * - Daily briefing (매일 07:00 자동 생성)
 * - 고급 인사이트 실시간 감지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성 (아키텍처 문서 352줄: AI 인사이트는 30% SDUI)
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 상담일지 자동 요약, 출결 이상 탐지, 반/과목 성과 분석, 지역 대비 부족 영역 분석, 월간 운영 리포트 자동 생성
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

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Card, Button, Badge } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import { useStudents, useGenerateConsultationAISummary } from '@hooks/use-student';
import { studentSelectFormSchema } from '../schemas/student-select.schema';
import { useUserRole } from '@hooks/use-auth';

export function AIPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab'); // 아키텍처 문서 3818줄: 각 카드 클릭 시 상세 분석 화면으로 자동 이동
  const { data: userRole } = useUserRole(); // 아키텍처 문서 2.4: Teacher는 요약만 접근 가능
  const isTeacher = userRole === 'teacher'; // Teacher는 요약만 볼 수 있음

  // 한 페이지에 하나의 기능 원칙 준수: 종합 인사이트만 메인으로 표시
  // 나머지 기능은 별도 페이지로 분리 (빠른 링크로 접근)
  const generateAISummary = useGenerateConsultationAISummary();

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

      // 주간 브리핑 조회 (Phase 1 MVP는 주간 브리핑, Phase 2+는 daily_briefing)
      // 현재는 Phase 1 MVP이므로 weekly_briefing 또는 이번 주 월요일 이후의 daily_briefing 조회
      const weeklyBriefingResponse = await apiClient.get<any>('ai_insights', {
        filters: {
          insight_type: 'weekly_briefing', // Phase 1: 주간 브리핑
          created_at: { gte: `${thisWeekMonday}T00:00:00` },
          status: 'active',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 1,
      });

      // weekly_briefing이 없으면 daily_briefing으로 fallback (Phase 2+ 호환성)
      let weeklyBriefing = null;
      if (!weeklyBriefingResponse.error && weeklyBriefingResponse.data && weeklyBriefingResponse.data.length > 0) {
        weeklyBriefing = weeklyBriefingResponse.data[0];
      } else {
        // Phase 2+ 호환: daily_briefing 조회 (이번 주 월요일 이후)
        const dailyBriefingResponse = await apiClient.get<any>('ai_insights', {
          filters: {
            insight_type: 'daily_briefing',
            created_at: { gte: `${thisWeekMonday}T00:00:00` },
            status: 'active',
          },
          orderBy: { column: 'created_at', ascending: false },
          limit: 1,
        });
        if (!dailyBriefingResponse.error && dailyBriefingResponse.data && dailyBriefingResponse.data.length > 0) {
          weeklyBriefing = dailyBriefingResponse.data[0];
        }
      }

      // 1. 출결 이상 탐지 (attendance_anomaly)
      const attendanceAnomalyResponse = await apiClient.get<any>('ai_insights', {
        filters: {
          insight_type: 'attendance_anomaly',
          created_at: { gte: `${todayDate}T00:00:00` },
          status: 'active',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 10,
      });

      const attendanceAnomalies: any[] = [];
      if (!attendanceAnomalyResponse.error && attendanceAnomalyResponse.data) {
        attendanceAnomalies.push(...attendanceAnomalyResponse.data.map((insight: any) => ({
          student_id: insight.related_entity_id,
          student_name: insight.metadata?.student_name || '알 수 없음',
          issue: insight.summary,
          recommendation: insight.details?.recommendation || '학생의 출석 패턴을 분석하고 상담을 진행하세요.',
        })));
      }

      // ai_insights 테이블에 데이터가 없는 경우 fallback: 출결 데이터 기반 간단한 분석
      let attendanceLogs: any[] = [];
      if (attendanceAnomalies.length === 0) {
        const attendanceLogsResponse = await apiClient.get<any>('attendance_logs', {
          filters: {},
          orderBy: { column: 'occurred_at', ascending: false },
          limit: 100,
        });

        attendanceLogs = attendanceLogsResponse.data || [];

        // 학생별 출결 패턴 분석
        const studentAttendanceMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

        attendanceLogs.forEach((log: any) => {
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
          .filter(([_, stats]) => {
            const attendanceRate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
            return attendanceRate < 70 || stats.absent >= 3;
          })
          .slice(0, 10)
          .map(([studentId]) => studentId);

        // 학생 정보 일괄 조회
        if (anomalyStudentIds.length > 0) {
          const studentsResponse = await apiClient.get<any>('persons', {
            filters: { id: { in: anomalyStudentIds } },
          });

          const students = studentsResponse.data || [];
          const studentMap = new Map(students.map((s: any) => [s.id, s]));

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
      const performanceAnalysisResponse = await apiClient.get<any>('ai_insights', {
        filters: {
          insight_type: 'performance_analysis',
          created_at: { gte: `${todayDate}T00:00:00` },
          status: 'active',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 10,
      });

      let performanceAnalysis: any[] = [];
      if (!performanceAnalysisResponse.error && performanceAnalysisResponse.data) {
        performanceAnalysis = performanceAnalysisResponse.data.map((insight: any) => ({
          class_id: insight.related_entity_id,
          class_name: insight.metadata?.class_name || '알 수 없음',
          performance: insight.details?.performance || '보통',
          trend: insight.details?.trend || '0%',
          recommendation: insight.details?.recommendation || '출석률 개선을 위해 노력하세요.',
        }));
      }

      // ai_insights 테이블에 데이터가 없는 경우 fallback
      if (performanceAnalysis.length === 0) {
        const classesResponse = await apiClient.get<any>('academy_classes', {
          filters: { status: 'active' },
        });
        const classes = classesResponse.data || [];

        // attendanceLogs가 비어있으면 다시 조회
        if (attendanceLogs.length === 0) {
          const attendanceLogsResponse = await apiClient.get<any>('attendance_logs', {
            filters: {},
            orderBy: { column: 'occurred_at', ascending: false },
            limit: 100,
          });
          attendanceLogs = attendanceLogsResponse.data || [];
        }

        performanceAnalysis = classes.map((cls: any) => {
          const classLogs = attendanceLogs.filter((log: any) => log.class_id === cls.id);
          const attendanceRate = classLogs.length > 0
            ? (classLogs.filter((log: any) => log.status === 'present').length / classLogs.length) * 100
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

      // 3. 지역 대비 비교 (regional_comparison) - 아키텍처 문서 3.7.1: 지역 대비 부족 영역 분석
      const regionalComparisonResponse = await apiClient.get<any>('ai_insights', {
        filters: {
          insight_type: 'regional_comparison',
          created_at: { gte: `${todayDate}T00:00:00` },
          status: 'active',
        },
        orderBy: { column: 'created_at', ascending: false },
        limit: 10,
      });

      let regionalComparison: any[] = [];
      if (!regionalComparisonResponse.error && regionalComparisonResponse.data) {
        regionalComparison = regionalComparisonResponse.data.map((insight: any) => ({
          area: insight.metadata?.area || '알 수 없음',
          status: insight.metadata?.status || '보통',
          gap: insight.summary,
          recommendation: insight.details?.recommendation || '지역 평균과 비교하여 개선이 필요합니다.',
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

  // 월간 리포트 생성
  const generateReport = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');

      // TODO: Edge Function으로 리포트 생성 요청
      // 현재는 간단한 리포트 데이터 수집
      const currentMonth = toKST().format('YYYY-MM');

      const invoicesResponse = await apiClient.get<any>('invoices', {
        filters: {
          period_start: { gte: `${currentMonth}-01` },
        },
      });

      const studentsResponse = await apiClient.get<any>('persons', {
        filters: {},
      });

      const attendanceLogsResponse = await apiClient.get<any>('attendance_logs', {
        filters: {
          occurred_at: { gte: `${currentMonth}-01T00:00:00` },
        },
      });

      const invoices = invoicesResponse.data || [];
      const students = studentsResponse.data || [];
      const attendanceLogs = attendanceLogsResponse.data || [];

      // 리포트 데이터 생성
      const reportData = {
        month: currentMonth,
        total_students: students.length,
        total_invoices: invoices.length,
        total_revenue: invoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0),
        total_attendance: attendanceLogs.filter((log: any) => log.status === 'present').length,
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
      <Container maxWidth="xl" padding={isMobile ? "sm" : "lg"}>
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            AI 분석
          </h1>

          {/* 아키텍처 문서 3.7.1: 빠른 분석 링크 (상세 분석은 별도 페이지에서 제공) */}
          {/* 아키텍처 문서 2.4: Teacher는 요약만 접근 가능, 상세 분석 버튼은 숨김 */}
          {!isTeacher && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
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
                      navigate('/ai?tab=attendance');
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
                      navigate('/ai?tab=performance');
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
                    navigate('/ai?tab=consultation');
                  }}
                >
                  상담일지 요약
                </Button>
              </div>
            </Card>
          )}
          {isTeacher && (
            <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                요약 정보만 제공됩니다. 상세 분석은 관리자에게 문의하세요.
              </div>
            </Card>
          )}

          {/* 콘텐츠 영역 */}
          {isLoading ? (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                로딩 중...
              </div>
            </Card>
          ) : (
            <>
              {/* 아키텍처 문서 3.7.1: 기본 화면에서는 AI가 자동 생성한 "요약 카드" 중심으로 표시 */}
              {aiInsights && (
                <>
                  {/* Phase 1 MVP: 주간 브리핑 카드 (아키텍처 문서 3581줄: 매주 월요일 07:00 생성) */}
                  {aiInsights.weeklyBriefing && (
                    <div id="weekly-briefing-card">
                      <Card padding="lg" variant="elevated" style={{ marginBottom: 'var(--spacing-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-xl)' }}>📅</div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                          주간 브리핑
                        </h2>
                        <Badge variant="outline" color="info">
                          Phase 1 MVP
                        </Badge>
                      </div>
                      <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-sm)' }}>
                        {aiInsights.weeklyBriefing.title || '이번 주 요약'}
                      </h3>
                      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                        {aiInsights.weeklyBriefing.summary}
                      </p>
                      {aiInsights.weeklyBriefing.details && typeof aiInsights.weeklyBriefing.details === 'object' && (
                        <div style={{ marginTop: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {Object.entries(aiInsights.weeklyBriefing.details).map(([key, value]: [string, any]) => (
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
                      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)', cursor: 'pointer' }} onClick={() => {
                      // TODO: 하위 페이지 구현 시 navigate('/ai/attendance-anomalies')
                      showAlert('알림', '출결 이상 탐지 상세 분석은 준비 중입니다.');
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-xl)' }}>⚠️</div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                          출결 이상 탐지
                        </h2>
                      </div>
                      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                        {aiInsights.attendanceAnomalies.length}명의 학생에게 출결 이상이 감지되었습니다.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                        {aiInsights.attendanceAnomalies.slice(0, 3).map((anomaly: any, index: number) => (
                          <div key={index} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                            • {anomaly.student_name}: {anomaly.issue}
                          </div>
                        ))}
                        {aiInsights.attendanceAnomalies.length > 3 && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
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
                      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)', cursor: 'pointer' }} onClick={() => {
                      // TODO: 하위 페이지 구현 시 navigate('/ai/performance')
                      showAlert('알림', '성과 분석 상세 화면은 준비 중입니다.');
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-xl)' }}>📊</div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                          반/과목 성과 분석
                        </h2>
                      </div>
                      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
                        {aiInsights.performanceAnalysis.length}개 반의 성과를 분석했습니다.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                        {aiInsights.performanceAnalysis.slice(0, 3).map((perf: any, index: number) => (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <Badge color={perf.performance === '우수' ? 'success' : perf.performance === '보통' ? 'info' : 'error'}>
                              {perf.performance}
                            </Badge>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                              {perf.class_name}: {perf.trend}
                            </span>
                          </div>
                        ))}
                        {aiInsights.performanceAnalysis.length > 3 && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
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
                      <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontSize: 'var(--font-size-xl)' }}>📍</div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                          지역 대비 부족 영역
                        </h2>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {aiInsights.regionalComparison.map((item: any, index: number) => (
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
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                              {item.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                      </Card>
                    </div>
                  ) : (
                    <Card padding="lg" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
                      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <p>지역 비교 데이터가 없습니다.</p>
                        <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
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
                    <Card padding="lg" variant="default">
                      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        <p>AI 인사이트 데이터가 없습니다.</p>
                        <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
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
        </div>
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

      const response = await apiClient.get<any>('student_consultations', {
        filters: { student_id: selectedStudentId },
        orderBy: { column: 'consultation_date', ascending: false },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data || [];
    },
    enabled: !!tenantId && !!selectedStudentId,
  });

  // AI 요약 생성
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
    <Card padding="lg" variant="default">
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
            onSubmit={(data) => {
              setSelectedStudentId(data.student_id || null);
            }}
            defaultValues={{ student_id: selectedStudentId || '' }}
            actionContext={{
              apiCall: async (endpoint: string, method: string, body?: any) => {
                if (method === 'POST') {
                  const response = await apiClient.post(endpoint, body);
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
              {consultations.map((consultation: any) => (
                <Card
                  key={consultation.id}
                  padding="md"
                  variant="default"
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
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', whiteSpace: 'pre-wrap', marginBottom: 'var(--spacing-sm)' }}>
                        {consultation.content}
                      </p>
                      {consultation.ai_summary ? (
                        <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
                          <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                            🤖 AI 요약
                          </p>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
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
                          {generateAISummary.isPending ? '생성 중...' : '🤖 AI 요약 생성'}
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

