// LAYER: UI_COMPONENT
/**
 * AIAnalysisLoadingUI Component
 *
 * AI 분석 로딩 UI 공통 컴포넌트
 * [불변 규칙] CSS 변수만 사용 (하드코딩 금지)
 * [불변 규칙] SSOT UI 디자인 준수
 * [SSOT] 이탈위험 분석, 상담 AI 요약 등 모든 AI 분석 기능에서 재사용
 */

// 애니메이션 점 3개 (에이전트 모드 스타일)
function LoadingDots() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-xs)',
    }}>
      <div className="chatops-loading-dot" />
      <div className="chatops-loading-dot" />
      <div className="chatops-loading-dot" />
    </div>
  );
}

export interface AIAnalysisStep {
  step: number;
  label: string;
  duration: number;
}

export interface AIAnalysisLoadingUIProps {
  steps: readonly AIAnalysisStep[];
  currentStep: number;
  message?: string;
}

/**
 * AI 분석 로딩 UI
 *
 * 레이아웃 구조:
 * - 상단: 애니메이션 점 3개
 * - 중간: 단계별 인디케이터 (숫자 원형) + 현재 단계 문구
 * - 하단: 설명 문구
 */
export function AIAnalysisLoadingUI({
  steps,
  currentStep,
  message = '분석이 완료될 때까지 잠시만 기다려주세요.',
}: AIAnalysisLoadingUIProps) {
  const activeStep = steps.find(s => s.step === currentStep);
  const stepLabel = activeStep?.label || '분석 준비 중';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--spacing-lg)',
      padding: 'var(--spacing-xl)'
    }}>
      {/* 상단: 애니메이션 점 */}
      <LoadingDots />

      {/* 중간: 단계별 인디케이터 + 현재 단계 문구 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
      }}>
        {/* 진행 단계 인디케이터 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}>
          {steps.map((step) => (
            <div
              key={step.step}
              style={{
                width: 'var(--size-avatar-sm)', // 32px
                height: 'var(--size-avatar-sm)', // 32px
                borderRadius: '50%',
                backgroundColor: currentStep >= step.step ? 'var(--color-primary)' : 'var(--color-gray-200)',
                color: currentStep >= step.step ? 'var(--color-white)' : 'var(--color-gray-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                transition: 'var(--transition-all)',
              }}
            >
              {step.step}
            </div>
          ))}
        </div>

        {/* 현재 단계 문구 */}
        <div style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text)',
          textAlign: 'center',
        }}>
          {stepLabel}
        </div>
      </div>

      {/* 하단: 설명 문구 */}
      <div style={{
        fontSize: 'var(--font-size-sm)',
        color: 'var(--color-text-secondary)',
        textAlign: 'center',
      }}>
        {message}
      </div>
    </div>
  );
}
