/**
 * FormFieldLayout Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] colSpan을 props로 받아 Grid 레이아웃을 구성합니다.
 * [불변 규칙] core-ui가 필요에 따라 Tailwind token class로 변환합니다.
 *
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
 */

import React from 'react';
import { clsx } from 'clsx';

export interface FormFieldLayoutProps {
  children: React.ReactNode;
  colSpan?: number;  // Grid column span (1-12, 기본값 12)
  className?: string;
}

/**
 * FormFieldLayout 컴포넌트
 *
 * 스키마 필드를 colSpan으로 Grid 레이아웃으로 변환합니다.
 * 12-column grid 시스템을 사용합니다.
 *
 * ⚠️ 중요: gridColumn을 "span colSpan" 형식으로 사용하여 자동 배치되도록 합니다.
 * 이렇게 하면 Grid의 실제 컬럼 수와 관계없이 올바르게 배치됩니다.
 */
export const FormFieldLayout: React.FC<FormFieldLayoutProps> = ({
  children,
  colSpan = 12,
  className,
}) => {
  // colSpan을 1-12 범위로 제한
  const normalizedColSpan = Math.max(1, Math.min(12, colSpan));

  // Grid column span 계산
  // "span colSpan" 형식을 사용하여 자동으로 다음 사용 가능한 위치에 배치
  // 이렇게 하면 Grid의 실제 컬럼 수와 관계없이 올바르게 작동합니다.
  const gridColumnSpan = `span ${normalizedColSpan}`;

  return (
    <div
      className={clsx(className)}
      style={{
        gridColumn: gridColumnSpan,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

