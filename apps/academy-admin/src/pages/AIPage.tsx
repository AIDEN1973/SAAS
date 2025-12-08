/**
 * AI 분석 기능 페이지
 *
 * [불변 규칙] api-sdk를 통해서만 API 요청
 * [불변 규칙] SDUI 스키마 기반 화면 자동 생성
 * [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
 * [요구사항] 상담일지 자동 요약, 출결 이상 탐지, 반/과목 성과 분석, 지역 대비 부족 영역 분석, 월간 운영 리포트 자동 생성
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary, useModal } from '@ui-core/react';
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

  const [selectedTab, setSelectedTab] = useState<'insights' | 'attendance' | 'performance' | 'report' | 'consultation'>('insights');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const generateAISummary = useGenerateConsultationAISummary();

  // AI 인사이트 조회 (플레이스홀더)
  const { data: aiInsights, isLoading } = useQuery({
    queryKey: ['ai-insights', tenantId],
    queryFn: async () => {
      // TODO: 실제 AI 인사이트 API 엔드포인트 구현 필요
      return {
        attendanceAnomalies: [
          {
            student_id: 'student-1',
            student_name: '홍길동',
            issue: '최근 4주간 월요일 지각률이 지역 평균보다 12% 높습니다.',
            recommendation: '등원 시간 재조정 및 반 개편을 고려하세요.',
          },
        ],
        performanceAnalysis: [
          {
            class_id: 'class-1',
            class_name: '수학 기초반',
            performance: '우수',
            trend: '+5%',
            recommendation: '현재 운영 방식을 유지하세요.',
          },
        ],
        regionalComparison: [
          {
            area: '출석률',
            status: '부족',
            gap: '-4%',
            recommendation: '지역 평균 대비 출석률 개선이 필요합니다.',
          },
        ],
      };
    },
    enabled: !!tenantId,
  });

  // 월간 리포트 생성
  const generateReport = useMutation({
    mutationFn: async () => {
      // TODO: 실제 리포트 생성 API 엔드포인트 구현 필요
      return {
        report_id: 'report-1',
        generated_at: toKST().toISOString(),
      };
    },
    onSuccess: () => {
      showAlert('성공', '월간 운영 리포트가 생성되었습니다.');
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

          {/* 탭 선택 */}
          <Card padding="md" variant="default" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <Button
                variant={selectedTab === 'insights' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setSelectedTab('insights')}
              >
                종합 인사이트
              </Button>
              <Button
                variant={selectedTab === 'attendance' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setSelectedTab('attendance')}
              >
                출결 이상 탐지
              </Button>
              <Button
                variant={selectedTab === 'performance' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setSelectedTab('performance')}
              >
                성과 분석
              </Button>
              <Button
                variant={selectedTab === 'report' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setSelectedTab('report')}
              >
                월간 리포트
              </Button>
              <Button
                variant={selectedTab === 'consultation' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setSelectedTab('consultation')}
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
              {selectedTab === 'insights' && aiInsights && (
                <Card padding="lg" variant="default">
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>종합 인사이트</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {aiInsights.regionalComparison.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 'var(--spacing-md)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
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
              )}

              {selectedTab === 'attendance' && aiInsights && (
                <Card padding="lg" variant="default">
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>출결 이상 탐지</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {aiInsights.attendanceAnomalies.map((anomaly, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 'var(--spacing-md)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-xs)' }}>
                          {anomaly.student_name}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                          {anomaly.issue}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                          💡 {anomaly.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {selectedTab === 'performance' && aiInsights && (
                <Card padding="lg" variant="default">
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>반/과목 성과 분석</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {aiInsights.performanceAnalysis.map((analysis, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 'var(--spacing-md)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                          <Badge color={analysis.performance === '우수' ? 'success' : 'warning'}>
                            {analysis.performance}
                          </Badge>
                          <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{analysis.class_name}</span>
                          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
                            {analysis.trend}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                          {analysis.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {selectedTab === 'report' && (
                <Card padding="lg" variant="default">
                  <h2 style={{ marginBottom: 'var(--spacing-md)' }}>월간 운영 리포트</h2>
                  <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                    <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                      월간 운영 리포트를 생성하여 다운로드할 수 있습니다.
                    </p>
                    <Button
                      variant="solid"
                      onClick={() => generateReport.mutate()}
                      disabled={generateReport.isPending}
                    >
                      {generateReport.isPending ? '생성 중...' : '리포트 생성'}
                    </Button>
                  </div>
                </Card>
              )}

              {/* 상담일지 자동 요약 탭 - [요구사항 3.7] 상담일지 자동 요약 */}
              {selectedTab === 'consultation' && <ConsultationSummaryTab />}
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
                        <div style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-background-secondary)', borderRadius: 'var(--radius-md)' }}>
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

