/**
 * FormFieldLayout Component
 * 
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] colSpan을 props로 받아 Grid 레이아웃을 구성합니다.
 * [불변 규칙] core-ui가 내부적으로 Tailwind token class로 변환합니다.
 * 
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
 */

import React from 'react';
import { clsx } from 'clsx';

export interface FormFieldLayoutProps {
  children: React.ReactNode;
  colSpan?: number;  // Grid column span (1-12, 기본값: 12)
  className?: string;
}

/**
 * FormFieldLayout 컴포넌트
 * 
 * 스키마 필드의 colSpan을 Grid 레이아웃으로 변환합니다.
 * 12-column grid 시스템을 사용합니다.
 */
export const FormFieldLayout: React.FC<FormFieldLayoutProps> = ({
  children,
  colSpan = 12,
  className,
}) => {
  // colSpan을 1-12 범위로 제한
  const normalizedColSpan = Math.max(1, Math.min(12, colSpan));
  
  // Grid column span 계산 (12-column grid 기준)
  const gridColumnSpan = `${normalizedColSpan} / span ${normalizedColSpan}`;

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

