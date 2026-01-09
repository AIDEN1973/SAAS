// LAYER: UI_COMPONENT
/**
 * RiskAnalysisTab Component
 *
 * 이탈위험 분석 탭
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 */
import { useToast, useIconSize, useIconStrokeWidth, Card, Badge, IconButtonGroup, Button, EmptyState } from '@ui-core/react';
import { AlertTriangle, AlertCircle, CheckCircle2, Lightbulb, RefreshCcw } from 'lucide-react';
import { LayerSectionHeader } from '../components/LayerSectionHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiContext } from '@api-sdk/core';
import { fetchAIInsights } from '@hooks/use-ai-insights';
import { toKST } from '@lib/date-utils';
import { useIndustryTerms } from '@hooks/use-industry-terms';

// 레이어 섹션 본문 카드 스타일
const layerSectionCardStyle: React.CSSProperties = {};

// 이탈위험 분석 탭 컴포넌트
export interface RiskAnalysisTabProps {
  studentId: string | null;
  isEditable: boolean;
}

export function RiskAnalysisTab({
  studentId,
  isEditable,
}: {
  studentId: string | null;
  isEditable: boolean;
}) {
  const { toast } = useToast();
  const terms = useIndustryTerms();
  const queryClient = useQueryClient();
  const context = getApiContext();
  const tenantId = context.tenantId;

  // 훅은 항상 컴포넌트 최상단에서 호출되어야 함 (React Hooks 규칙)
  const titleIconSize = useIconSize();
  const titleIconStrokeWidth = useIconStrokeWidth();
  // [P0-3 확인] useIconSize는 인자를 받을 수 있음 (cssVarName?: string, fallback?: number)
  // 타입 안전: useIconSize('--size-icon-md')는 유효한 시그니처
  const buttonIconSize = useIconSize('--size-icon-md');

  // 빈 상태 아이콘 크기 계산 (CSS 변수 사용, 기본 크기의 4배)
  // const baseIconSize = useIconSize();
  // const emptyStateIconSize = useMemo(() => baseIconSize * 4, [baseIconSize]);
  // const emptyStateIconStrokeWidth = useIconStrokeWidth();

  // 출결 로그와 상담 기록은 현재 탭에서 사용하지 않음 (향후 사용 예정)
  // const thirtyDaysAgo = useMemo(() => {
  //   return toKST().subtract(30, 'day').format('YYYY-MM-DD');
  // }, []);
  // const { data: attendanceLogsData } = useAttendanceLogs({
  //   student_id: studentId || undefined,
  //   date_from: thirtyDaysAgo,
  // });
  // const { data: consultations } = useConsultations(studentId);

  // 이탈위험 분석 결과를 DB에서 불러오기
  const { data: savedRiskAnalysis, isLoading: isLoadingSaved } = useQuery({
    queryKey: ['student-risk-analysis-saved', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      // [불변 규칙] Zero-Trust: UI는 tenantId를 직접 전달하지 않음, Context에서 자동 가져옴
      // [ESLint 규칙] ai_insights 직접 조회 금지: fetchAIInsights 사용
      // [수정] 'risk_analysis'는 유효한 insight_type이 아니므로 제거하고 performance_analysis 사용
      const insights = await fetchAIInsights(tenantId, {
          student_id: studentId,
        insight_type: 'performance_analysis',
          status: 'active',
      });

      if (!insights || insights.length === 0) {
        return null;
      }

      const insight = (insights[0] as unknown) as {
        id: string;
        details: {
          risk_score: number;
          risk_level: 'low' | 'medium' | 'high';
          reasons: string[];
          recommended_actions: string[];
        };
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!insight || !insight.details || typeof insight.details !== 'object') {
        return null;
      }

      const details = insight.details;

      return {
        risk_score: details.risk_score,
        risk_level: details.risk_level,
        reasons: details.reasons,
        recommended_actions: details.recommended_actions,
        analyzed_at: insight.updated_at || insight.created_at,
      };
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 5 * 60 * 1000, // 5분간 캐싱
    refetchOnWindowFocus: false,
  });

  // 이탈위험 분석: 수동으로만 실행 (버튼 클릭 시)
  // [변경] 페이지 접속 시 자동 분석 제거, 재분석 버튼 클릭 시에만 실행
  // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 API 요청 (UI 문서 1.1, 기술문서 2.2 참조)
  const { data: newRiskAnalysis, isLoading: isAnalyzing, refetch: refetchRiskAnalysis } = useQuery({
    queryKey: ['student-risk-analysis', tenantId, studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;

      // [불변 규칙] Zero-Trust: @api-sdk/core를 통해서만 Edge Function 호출
      // apiClient.invokeFunction()은 자동으로 JWT 토큰을 포함하여 요청
      // Edge Function은 JWT에서 tenant_id를 추출합니다 (요청 본문에서 받지 않음)
      const response = await apiClient.invokeFunction<{ risk_score?: number; factors?: string[]; recommendations?: string[] }>(
        'student-risk-analysis',
        {
          student_id: studentId,
        }
      );

      if (response.error) {
        throw new Error(response.error.message || '이탈위험 분석에 실패했습니다.');
      }

      return response.data;
    },
    enabled: false, // [변경] 자동 실행 비활성화, 수동으로만 실행
    staleTime: Infinity, // 캐시된 데이터 유지
    refetchOnWindowFocus: false,
  });

  // 새로 분석한 결과가 있으면 그것을 사용, 없으면 저장된 결과 사용
  // [타입 안정성] 두 타입을 통합하여 처리
  const riskAnalysis = (newRiskAnalysis || savedRiskAnalysis) as {
    risk_score: number;
    risk_level?: 'low' | 'medium' | 'high';
    reasons?: string[];
    recommended_actions?: string[];
    analyzed_at?: string;
    factors?: string[];
    recommendations?: string[];
  } | null | undefined;
  const isLoading = isAnalyzing || isLoadingSaved;

  if (isLoading) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              {terms.EMERGENCY_RISK_LABEL} 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={layerSectionCardStyle}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            분석 중...
          </div>
        </Card>
      </div>
    );
  }

  // 분석 데이터가 없고 로딩 중이 아닌 경우 - 재분석 버튼 표시
  if (!riskAnalysis && !isLoading) {
    return (
      <div>
        <LayerSectionHeader
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
              {terms.EMERGENCY_RISK_LABEL} 분석
            </span>
          }
        />
        <Card padding="md" variant="default" style={layerSectionCardStyle}>
          <EmptyState
            icon={AlertTriangle}
            message="분석 데이터가 없습니다."
            description={`아래 버튼을 클릭하여 ${terms.EMERGENCY_RISK_LABEL} 분석을 시작하세요.`}
            actions={
              isEditable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await refetchRiskAnalysis();
                      toast(`${terms.EMERGENCY_RISK_LABEL} 분석이 완료되었습니다.`, 'success', '알림');
                    } catch (error) {
                      toast(
                        error instanceof Error ? error.message : `${terms.EMERGENCY_RISK_LABEL} 분석에 실패했습니다.`,
                        'error'
                      );
                    }
                  }}
                  disabled={isLoading}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    <RefreshCcw size={buttonIconSize} strokeWidth={titleIconStrokeWidth} />
                    <span>{isLoading ? '분석 중...' : '분석시작'}</span>
                  </span>
                </Button>
              ) : undefined
            }
          />
        </Card>
      </div>
    );
  }

  // 아키텍처 문서 3.7.3 risk_score 레이블 표 준수:
  // 90 이상: Emergency (error), 70-89: 고위험 (error), 40-69: 중위험 (warning), 0-39: 저위험 (success)
  // [타입 안정성] riskAnalysis가 없으면 null 반환
  if (!riskAnalysis || riskAnalysis.risk_score === undefined) {
    return null;
  }

  const getRiskLevelLabel = (riskScore: number): 'Emergency' | '고위험' | '중위험' | '저위험' => {
    if (riskScore >= 90) return 'Emergency';
    if (riskScore >= 70) return '고위험';
    if (riskScore >= 40) return '중위험';
    return '저위험';
  };

  // [타입 안정성] riskAnalysis가 존재하고 risk_score가 정의되어 있음을 확인
  const riskScore = riskAnalysis.risk_score;
  const reasons = riskAnalysis.reasons || riskAnalysis.factors || [];
  const recommendedActions = riskAnalysis.recommended_actions || riskAnalysis.recommendations || [];

  const riskLevelLabel = getRiskLevelLabel(riskScore);
  const riskColor = riskScore >= 70 ? 'error' : riskScore >= 40 ? 'warning' : 'success';
  const riskBgColor = riskScore >= 70 ? 'var(--color-error)' : riskScore >= 40 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div>
      <LayerSectionHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <AlertTriangle size={titleIconSize} strokeWidth={titleIconStrokeWidth} />
            이탈위험 분석
          </span>
        }
      />
      <Card padding="md" variant="default" style={layerSectionCardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)' }}>
          {/* 위험점수 - 주요 지표로 상단에 강조 표시 */}
          <div style={{
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--border-radius-md)',
            backgroundColor: riskBgColor,
            color: 'var(--color-white)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-size-sm)', opacity: 'var(--opacity-secondary)', marginBottom: 'var(--spacing-xs)' }}>
              위험점수
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--spacing-xs)' }}>
              {riskScore}점
            </div>
            <Badge variant="solid" color={riskColor} style={{ backgroundColor: 'var(--color-white)', fontWeight: 'var(--font-weight-bold)', opacity: 'var(--opacity-secondary)', color: riskBgColor }}>
              {riskLevelLabel}
            </Badge>
            {/* 마지막 분석 일시 표시 */}
            {riskAnalysis?.analyzed_at && (
              <div style={{ fontSize: 'var(--font-size-xs)', opacity: 'var(--opacity-secondary)', marginTop: 'var(--spacing-sm)' }}>
                마지막 분석: {toKST(riskAnalysis.analyzed_at).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            )}
          </div>

          {/* 위험요인 - 카드 형태로 개선 */}
          {reasons.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                <AlertCircle size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-error)' }} />
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
                  위험요인
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {reasons.map((reason: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-error)',
                      backgroundColor: 'var(--color-error-50)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                    }}
                  >
                    <AlertCircle size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                    <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height)' }}>
                      {reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 권장조치 - 카드 형태로 개선 */}
          {recommendedActions.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                <Lightbulb size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-primary)' }} />
                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
                  권장조치
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                {recommendedActions.map((action: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius-sm)',
                      border: 'var(--border-width-thin) solid var(--color-primary)',
                      backgroundColor: 'var(--color-primary-50)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-sm)',
                    }}
                  >
                    <CheckCircle2 size={titleIconSize} strokeWidth={titleIconStrokeWidth} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height)' }}>
                      {action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 재분석 버튼 - IconButtonGroup으로 변경 */}
          {riskAnalysis && isEditable && (
            <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
              <IconButtonGroup
                align="right"
                items={[
                  {
                    icon: RefreshCcw,
                    tooltip: '재분석',
                    variant: 'outline',
                    onClick: () => {
                      void (async () => {
                        try {
                          await refetchRiskAnalysis();
                          // 새로 분석한 결과로 인해 쿼리가 무효화되므로 저장된 결과도 다시 불러옴
                          void queryClient.invalidateQueries({ queryKey: ['student-risk-analysis-saved', tenantId, studentId] });
                          toast(`${terms.EMERGENCY_RISK_LABEL} 분석이 완료되었습니다.`, 'success', '알림');
                        } catch (error) {
                          toast(
                            error instanceof Error ? error.message : `${terms.EMERGENCY_RISK_LABEL} 분석에 실패했습니다.`,
                            'error'
                          );
                        }
                      })();
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
