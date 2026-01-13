/**
 * 매뉴얼 바디 컴포넌트
 * 플랫하고 모던한 디자인
 */

import React, { useRef, useEffect } from 'react';
import type {
  ManualPage,
  ManualSection,
  ManualAlert,
  ManualStepGuide,
  ManualScreenGroup,
  ManualTipGroup,
} from '../types/manual';
import { BookOpen, AlertCircle, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Container } from '@ui-core/react';

// 블릿 기호 및 넘버링 배지 스타일을 위한 CSS 삽입
if (typeof document !== 'undefined') {
  const styleId = 'manual-bullet-list-styles-v14';
  // 기존 스타일 제거
  ['manual-bullet-list-styles', 'manual-bullet-list-styles-v2', 'manual-bullet-list-styles-v3', 'manual-bullet-list-styles-v4', 'manual-bullet-list-styles-v5', 'manual-bullet-list-styles-v6', 'manual-bullet-list-styles-v7', 'manual-bullet-list-styles-v8', 'manual-bullet-list-styles-v9', 'manual-bullet-list-styles-v10', 'manual-bullet-list-styles-v11', 'manual-bullet-list-styles-v12', 'manual-bullet-list-styles-v13'].forEach((id) => {
    const oldStyle = document.getElementById(id);
    if (oldStyle) {
      oldStyle.remove();
    }
  });
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .manual-bullet-list {
        list-style: none;
      }
      .manual-bullet-list > li {
        position: relative;
      }
      .manual-bullet-list > li::before {
        content: '•';
        position: absolute;
        left: -0.9em;
        color: var(--color-gray-400);
        font-size: 1em;
        top: 0;
        line-height: inherit;
      }
      .manual-numbered-list {
        list-style: none;
        counter-reset: item;
      }
      .manual-numbered-list > li {
        counter-increment: item;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      }
      .manual-numbered-list > li::before {
        content: counter(item);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 1.5rem;
        height: 1.5rem;
        background-color: var(--color-primary);
        color: var(--color-white);
        border-radius: 50%;
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        line-height: 1;
      }
    `;
    document.head.appendChild(style);
  }
}

// ============================================================================
// 스타일 상수 (SSOT 준수: CSS 변수만 사용)
// ============================================================================
const styles = {
  colors: {
    text: 'var(--color-text)',
    textSecondary: 'var(--color-text-secondary)',
    primary: 'var(--color-primary)',
    border: 'var(--color-gray-200)',
    bgSubtle: 'var(--color-gray-50)',
    // Alert 색상 (프라이머리 통일)
    alertBackground: 'var(--color-primary-40, rgba(var(--color-primary-rgb), 0.4))',
    alertText: 'var(--color-primary)',
  },
  fonts: {
    title: 'var(--font-size-3xl)',
    sectionTitle: 'var(--font-size-2xl)', // 섹션 타이틀 (h2)
    subTitle: 'var(--font-size-lg)', // 서브 타이틀 (h4)
    body: 'var(--font-size-base)',
  },
  weights: {
    title: 'var(--font-weight-extrabold)',
    heading: 'var(--font-weight-bold)',
    semibold: 'var(--font-weight-semibold)',
  },
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    '2xl': 'var(--spacing-2xl)',
    '3xl': 'var(--spacing-3xl)',
  },
  borderRadius: {
    md: 'var(--border-radius-md)',
  },
  lineHeight: {
    relaxed: 'var(--line-height-relaxed)', // 2.0
  },
} as const;

// ============================================================================
// Props
// ============================================================================
export interface ManualBodyProps {
  manual: ManualPage | null;
  currentSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}

// ============================================================================
// 서브 컴포넌트
// ============================================================================

/** 알림 박스 */
function Alert({ alert }: { alert: ManualAlert }) {
  const iconMap = {
    info: AlertCircle,
    warning: AlertTriangle,
    success: CheckCircle,
    error: XCircle,
  };
  const Icon = iconMap[alert.type] || AlertCircle;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: styles.spacing.sm,
        padding: styles.spacing.md,
        backgroundColor: styles.colors.alertBackground,
        borderRadius: styles.borderRadius.md,
        marginTop: styles.spacing.md,
      }}
    >
      <Icon size={16} color={styles.colors.alertText} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: styles.fonts.body, color: styles.colors.primary, lineHeight: styles.lineHeight.relaxed }}>
        {alert.content}
      </span>
    </div>
  );
}

/** 단계 가이드 */
function Steps({ guide, index }: { guide: ManualStepGuide; index: number }) {
  return (
    <div style={{ marginBottom: styles.spacing.lg }}>
      <h4
        style={{
          fontSize: styles.fonts.subTitle,
          fontWeight: styles.weights.semibold,
          color: styles.colors.text,
          marginBottom: styles.spacing.sm,
          display: 'flex',
          alignItems: 'center',
          gap: styles.spacing.sm,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            borderRadius: '50%',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        {guide.title}
      </h4>
      <ul
        style={{
          margin: 0,
          paddingLeft: styles.spacing.lg,
        }}
        className="manual-bullet-list"
      >
        {guide.steps.map((step) => (
          <li
            key={step.step}
            style={{
              fontSize: styles.fonts.body,
              color: styles.colors.text,
              lineHeight: styles.lineHeight.relaxed,
              marginBottom: styles.spacing.sm,
            }}
          >
            {step.content}
          </li>
        ))}
      </ul>
      {guide.alert && <Alert alert={guide.alert} />}
    </div>
  );
}

/** 화면 설명 */
function Screen({ group, index }: { group: ManualScreenGroup; index: number }) {
  return (
    <div style={{ marginBottom: styles.spacing.lg }}>
      <h4
        style={{
          fontSize: styles.fonts.subTitle,
          fontWeight: styles.weights.semibold,
          color: styles.colors.text,
          marginBottom: styles.spacing.sm,
          display: 'flex',
          alignItems: 'center',
          gap: styles.spacing.sm,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            borderRadius: '50%',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        {group.title}
      </h4>
      <ul
        style={{
          margin: 0,
          paddingLeft: styles.spacing.lg,
        }}
        className="manual-bullet-list"
      >
        {group.items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: styles.fonts.body,
              color: styles.colors.text,
              lineHeight: styles.lineHeight.relaxed,
              marginBottom: styles.spacing.sm,
            }}
          >
            <strong>{item.title}</strong> : {item.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 팁/주의사항 */
function Tips({ group, index }: { group: ManualTipGroup; index: number }) {
  const isWarning = group.type === 'warning';
  const Icon = isWarning ? AlertTriangle : CheckCircle;

  return (
    <div
      style={{
        marginBottom: styles.spacing.lg,
        padding: styles.spacing.md,
        backgroundColor: styles.colors.alertBackground,
        borderRadius: styles.borderRadius.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: styles.spacing.sm,
          marginBottom: styles.spacing.sm,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-white)',
            borderRadius: '50%',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-bold)',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <Icon size={16} color={styles.colors.alertText} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: styles.fonts.body, fontWeight: styles.weights.semibold, color: styles.colors.text }}>
          {group.title}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: styles.spacing.xl,
        }}
        className="manual-bullet-list"
      >
        {group.items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: styles.fonts.body,
              color: styles.colors.text,
              lineHeight: styles.lineHeight.relaxed,
              marginBottom: styles.spacing.sm,
            }}
          >
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 섹션 컨텐츠 렌더러 */
function Content({ section }: { section: ManualSection }) {
  switch (section.type) {
    case 'intro':
      return (
        <p
          style={{
            fontSize: styles.fonts.body,
            color: styles.colors.text,
            lineHeight: styles.lineHeight.relaxed,
            margin: 0,
          }}
        >
          {section.intro?.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={i} style={{ color: styles.colors.primary }}>
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            )
          )}
        </p>
      );

    case 'features':
      return (
        <ol
          style={{
            margin: 0,
            paddingLeft: 0,
          }}
          className="manual-numbered-list"
        >
          {section.features?.map((feature, i) => {
            // 콜론(:)을 기준으로 제목과 설명 분리
            const colonIndex = feature.indexOf(':');
            if (colonIndex > 0) {
              const title = feature.substring(0, colonIndex).trim();
              const description = feature.substring(colonIndex + 1).trim();
              return (
                <li
                  key={i}
                  style={{
                    fontSize: styles.fonts.body,
                    color: styles.colors.text,
                    lineHeight: styles.lineHeight.relaxed,
                    marginBottom: styles.spacing.sm,
                  }}
                >
                  <strong style={{ fontWeight: styles.weights.semibold }}>{title}</strong>
                  {description && `: ${description}`}
                </li>
              );
            }
            // 콜론이 없으면 기존 방식대로
            return (
              <li
                key={i}
                style={{
                  fontSize: styles.fonts.body,
                  color: styles.colors.text,
                  lineHeight: styles.lineHeight.relaxed,
                  marginBottom: styles.spacing.sm,
                }}
              >
                {feature}
              </li>
            );
          })}
        </ol>
      );

    case 'steps':
      return (
        <div style={{ counterReset: 'step-guide' }}>
          {section.stepGuides?.map((guide, i) => (
            <Steps key={i} guide={guide} index={i} />
          ))}
        </div>
      );

    case 'screen':
      return (
        <>
          {section.screenGroups?.map((group, i) => (
            <Screen key={i} group={group} index={i} />
          ))}
        </>
      );

    case 'tips':
      return (
        <>
          {section.tipGroups?.map((group, i) => (
            <Tips key={i} group={group} index={i} />
          ))}
        </>
      );

    case 'technical':
      return (
        <ol
          style={{
            margin: 0,
            paddingLeft: 0,
          }}
          className="manual-numbered-list"
        >
          {section.technicalFeatures?.map((feature, i) => (
            <li
              key={i}
              style={{
                fontSize: styles.fonts.body,
                color: styles.colors.text,
                lineHeight: styles.lineHeight.relaxed,
                marginBottom: styles.spacing.sm,
              }}
            >
              {feature}
            </li>
          ))}
        </ol>
      );

    default:
      return (
        <div
          style={{ fontSize: styles.fonts.body, color: styles.colors.text, lineHeight: styles.lineHeight.relaxed }}
          dangerouslySetInnerHTML={{ __html: section.content || '' }}
        />
      );
  }
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================
export function ManualBody({ manual, currentSectionId }: ManualBodyProps) {
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // 매뉴얼 변경 시 스크롤 최상단으로 이동
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [manual?.id]);

  useEffect(() => {
    if (currentSectionId && refs.current[currentSectionId]) {
      refs.current[currentSectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentSectionId]);

  // 빈 상태
  if (!manual) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: styles.colors.textSecondary,
        }}
      >
        <BookOpen size={48} style={{ opacity: 0.3, marginBottom: 'var(--spacing-lg)' }} />
        <p style={{ fontSize: styles.fonts.body }}>좌측에서 매뉴얼을 선택하세요</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--color-white)' }}>
      <Container
        maxWidth="full"
        style={{
          maxWidth: '64rem', // 1024px - 매뉴얼 콘텐츠 최대 너비
        }}
      >
        {/* 타이틀 */}
        <h1
          style={{
            fontSize: styles.fonts.title,
            fontWeight: styles.weights.title,
            color: styles.colors.text,
            marginBottom: styles.spacing.lg,
            lineHeight: 'var(--line-height-tight)',
          }}
        >
          {manual.title}
        </h1>

        {/* 타이틀과 첫 섹션 사이 구분선 */}
        <hr
          style={{
            border: 'none',
            borderTop: `1px solid ${styles.colors.border}`,
            margin: `${styles.spacing.xl} 0`,
          }}
        />

        {/* 섹션 */}
        {manual.sections.map((section, index) => (
          <React.Fragment key={section.id}>
            <section
              ref={(el) => {
                refs.current[section.id] = el;
              }}
              style={{ marginBottom: styles.spacing.lg }}
            >
              <h2
                style={{
                  fontSize: styles.fonts.sectionTitle,
                  fontWeight: styles.weights.heading,
                  color: styles.colors.text,
                  marginBottom: styles.spacing.lg,
                }}
              >
                {section.title}
              </h2>
              <Content section={section} />
            </section>
            {/* 마지막 섹션이 아닌 경우 구분선 표시 */}
            {index < manual.sections.length - 1 && (
              <hr
                style={{
                  border: 'none',
                  borderTop: `1px solid ${styles.colors.border}`,
                  margin: `${styles.spacing.xl} 0`,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </Container>
    </div>
  );
}
