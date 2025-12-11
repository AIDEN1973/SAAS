/**
 * AI 분석 기능 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 상담일지 자동 요약, 출결 이상 탐지, 반/과목 성과 분석, 지역 대비 부족 영역 분석, 월간 운영 리포트 자동 생성
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal, useResponsiveMode } from '@ui-core/react';
import { Container, Card, Button, Badge } from '@ui-core/react';
import { SchemaForm } from '@schema-engine';
import { useSchema } from '@hooks/use-schema';
import { apiClient, getApiContext } from '@api-sdk/core';
import { toKST } from '@lib/date-utils';
import { useStudents, useGenerateConsultationAISummary } from '@hooks/use-student';
import { studentSelectFormSchema } from '../schemas/student-select.schema';

export function AIPage() {
  const { showAlert } = useModal();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;
  const mode = useResponsiveMode();
  const isMobile = mode === 'xs' || mode === 'sm';
  const isTablet = mode === 'md';
  const navigate = useNavigate();

  // 한 페이지에 하나의 기능 원칙 준수: 종합 인사이트만 메인으로 표시
  // 나머지 기능은 별도 페이지로 분리 (빠른 링크로 접근)
  const generateAISummary = useGenerateConsultationAISummary();

  // AI 인사이트 조회
  const { data: aiInsights, isLoading } = useQuery({
    queryKey: ['ai-insights', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // TODO: ai_insights 테이블이 생성되면 실제 조회로 변경
      // 현재는 출결 데이터 기반 간단한 분석
      const attendanceLogsResponse = await apiClient.get<any>('attendance_logs', {
        filters: {},
        orderBy: { column: 'occurred_at', ascending: false },
        limit: 100,
      });

      const attendanceLogs = attendanceLogsResponse.data || [];

      // 출결 이상 탐지 (실제 데이터 기반 간단한 분석)
      // TODO: ai_insights 테이블이 생성되면 실제 AI 분석으로 대체
      const attendanceAnomalies: any[] = [];

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

      // 반/과목 성과 분석
      const classesResponse = await apiClient.get<any>('academy_classes', {
        filters: { status: 'active' },
      });
      const classes = classesResponse.data || [];

      const performanceAnalysis = classes.map((cls: any) => {
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

      // 지역 대비 비교 (TODO: regional_metrics_daily 테이블 구현 후 활성화)
      const regionalComparison: any[] = [];
      // const regionalResponse = await apiClient.get<any>('regional_metrics_daily', {
      //   filters: {},
      // });

      return {
        attendanceAnomalies,
        performanceAnalysis,
        regionalComparison,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 300000, // 5분마다 갱신
  });

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
      <Container maxWidth="xl" padding="lg">
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h1 style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text)'
          }}>
            AI 분석
          </h1>

          {/* 빠른 링크 (한 페이지에 하나의 기능 원칙 준수: 종합 인사이트만 메인, 나머지는 별도 페이지) */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginRight: 'var(--spacing-sm)' }}>
                빠른 분석:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ai/attendance-anomalies')}
              >
                출결 이상 탐지
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ai/performance')}
              >
                성과 분석
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ai/monthly-report')}
              >
                월간 리포트
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ai/consultation-summary')}
              >
                상담일지 요약
              </Button>
            </div>
          </Card>

          {/* 콘텐츠 영역 */}
          {isLoading ? (
            <Card padding="lg" variant="default">
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                로딩 중...
              </div>
            </Card>
          ) : (
            <>
              {/* 종합 인사이트만 표시 (한 페이지에 하나의 기능 원칙) */}
              {aiInsights && (
                <Card padding="lg" variant="default">
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>종합 인사이트</h2>
                  {aiInsights.regionalComparison && aiInsights.regionalComparison.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                      {aiInsights.regionalComparison.map((item, index) => (
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
                  ) : (
                    <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      <p>지역 비교 데이터가 없습니다.</p>
                      <p style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>
                        지역 정보를 설정하면 지역 대비 분석을 제공할 수 있습니다.
                      </p>
                    </div>
                  )}
                </Card>
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

