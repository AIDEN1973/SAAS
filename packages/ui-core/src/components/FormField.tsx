/**
 * FormField Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormField 컴포넌트
 *
 * 입력 필드를 감싸는 헬퍼 컴포넌트
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  children,
  className,
}) => {
  return (
    <div
      className={clsx(className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        width: '100%',
      }}
    >
      {label && (
        <label
          style={{
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text)',
          }}
        >
          {label}
          {required && (
            <span
              style={{
                color: 'var(--color-error)',
                marginLeft: 'var(--spacing-xs)',
              }}
            >
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <span
          style={{
            color: 'var(--color-error)',
            // 요구사항: 에러 메시지를 2pt 작게 표시 (공통 컴포넌트 기준)
            // HARD-CODE-EXCEPTION: 에러 메시지 폰트 크기 조정을 위한 고정 오프셋 값 (디자인 시스템 요구사항)
            fontSize: 'calc(var(--font-size-sm) - 2px)',
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

