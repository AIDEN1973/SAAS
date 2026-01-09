/**
 * Input Component
 *
 * [불변 규칙] 스키마에서 Tailwind 클래스를 직접 사용하지 않는다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용한다.
 */

import React from 'react';
import { clsx } from 'clsx';
import { SizeToken } from '@design-system/core';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  /**
   * 값이 있을 때 좌측에 인라인 라벨(항목명)을 표시할지 여부
   * - 수정폼(편집 모드): true
   * - 필터/검색 UI: false (값이 들어가면 placeholder가 사라져야 함)
   */
  showInlineLabelWhenHasValue?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  onFocus,
  onBlur,
  placeholder,
  value: valueProp,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showInlineLabelWhenHasValue = true,
  ...props
}, ref) => {
  // 라벨을 플레이스홀더로 사용
  const inputPlaceholder = placeholder || label;

  // 내부 상태로 입력값 추적 (React Hook Form의 register와 호환)
  const [internalValue, setInternalValue] = React.useState<string>('');
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // ⚠️ IME(한글) 조합 안정성:
  // - SchemaField(react-hook-form Controller)는 valueProp을 전달하는 controlled 방식
  // - controlled인데도 internalValue를 useEffect로 계속 동기화하면 IME 조합이 끊길 수 있음(예: 'ㅅ'만 입력되고 멈춤)
  // - 따라서 controlled일 때는 internalValue를 사용/동기화하지 않는다.
  const isControlled = valueProp !== undefined;
  const isComposingRef = React.useRef(false);

  // ref 병합 (forwardRef와 내부 ref 모두 지원)
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  // value prop이 변경되면 내부 상태도 업데이트 (controlled component 지원)
  React.useEffect(() => {
    // controlled 모드에서는 내부 상태 동기화 금지 (IME 조합 안정성)
    if (isControlled) return;
    if (valueProp !== undefined && valueProp !== null) setInternalValue(String(valueProp));
    else setInternalValue('');
  }, [valueProp]);

  // 실제 사용할 value (valueProp이 있으면 사용, 없으면 내부 상태 사용)
  const value = isControlled ? (valueProp ?? '') : internalValue;


  // 값이 비어있는지 확인 (빈 문자열, 공백만 있는 문자열도 빈 값으로 처리)
  const isEmpty = React.useMemo(() => {
    const currentValue = isControlled ? (valueProp ?? '') : internalValue;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (typeof currentValue === 'string') return currentValue.trim() === '';
    if (typeof currentValue === 'number') return false; // 숫자는 항상 값이 있음
    return String(currentValue).trim() === '';
  }, [isControlled, valueProp, internalValue]);

  const sizeStyles: Record<SizeToken, React.CSSProperties> = {
    xs: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    sm: {
      paddingTop: 'var(--spacing-xs)',
      paddingBottom: 'var(--spacing-xs)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    md: {
      paddingTop: 'var(--spacing-sm)',
      paddingBottom: 'var(--spacing-sm)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    lg: {
      paddingTop: 'var(--spacing-md)',
      paddingBottom: 'var(--spacing-md)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
    xl: {
      paddingTop: 'var(--spacing-lg)',
      paddingBottom: 'var(--spacing-lg)',
      paddingLeft: 'var(--spacing-form-horizontal-left)', // styles.css 준수: 폼 필드 좌측 여백 토큰 사용
      paddingRight: 'var(--spacing-form-horizontal-right)', // styles.css 준수: 폼 필드 우측 여백 토큰 사용
    },
  };

  // 단순 입력 폼: input 요소의 스타일 (테두리 없음, 래퍼에서 처리)
  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderRadius: 'var(--border-radius-xs)',
    backgroundColor: 'var(--color-white)',
    color: 'var(--color-text)',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)',
    fontFamily: 'var(--font-family)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-normal)',
    lineHeight: 'var(--line-height)',
    boxSizing: 'border-box',
  };

  // 래퍼 스타일: input을 감싸고 사방 테두리 적용 (카드 스타일과 동일)
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
    backgroundColor: 'var(--color-white)',
    border: isFocused
      ? (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-primary)')
      : (error ? 'var(--border-width-thin) solid var(--color-form-error)' : 'var(--border-width-thin) solid var(--color-gray-200)'),
    borderRadius: 'var(--border-radius-xs)',
    boxSizing: 'border-box',
    transition: 'var(--transition-all)',
  };

  // 래퍼 ref
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (wrapperRef.current) {
      wrapperRef.current.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-primary)';
    }
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (wrapperRef.current) {
      wrapperRef.current.style.borderColor = error ? 'var(--color-form-error)' : 'var(--color-gray-200)';
    }
    onBlur?.(e);
  }, [error, onBlur]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div ref={wrapperRef} style={wrapperStyle}>
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
              (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }
          }}
          className={clsx(className)}
          style={inputStyle}
          placeholder=""
          value={value}
          onCompositionStart={(e) => {
            isComposingRef.current = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            if ((import.meta as any).env?.DEV) {
              console.log('[IME][Input] compositionstart', {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                name: (props as any)?.name,
                isControlled,
                valueProp,
                value,
                data: (e as unknown as CompositionEvent).data,
              });
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (props as any).onCompositionStart?.(e);
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            if ((import.meta as any).env?.DEV) {
              console.log('[IME][Input] compositionend', {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                name: (props as any)?.name,
                isControlled,
                valueProp,
                value,
                data: (e as unknown as CompositionEvent).data,
              });
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (props as any).onCompositionEnd?.(e);
          }}
          onChange={(e) => {
            const newValue = e.target.value;
            if (!isControlled) setInternalValue(newValue);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            if ((import.meta as any).env?.DEV) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              const nativeIsComposing = (e.nativeEvent as any)?.isComposing;
              console.log('[IME][Input] change', {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                name: (props as any)?.name,
                isControlled,
                isComposingRef: isComposingRef.current,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                nativeIsComposing,
                newValue,
                prevValue: value,
              });
            }
            onChange?.(e);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            (props as any).onChange?.(e);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {isEmpty && !isFocused && inputPlaceholder && (
          <div
            style={{
              position: 'absolute',
              left: sizeStyles[size].paddingLeft as string,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-base)',
              fontFamily: 'var(--font-family)',
              fontWeight: 'var(--font-weight-normal)',
              lineHeight: 'var(--line-height)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: `calc(100% - ${sizeStyles[size].paddingLeft} - ${sizeStyles[size].paddingRight})`,
            }}
          >
            {inputPlaceholder}
          </div>
        )}
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
            marginTop: 'var(--spacing-xs)', // styles.css 토큰: 에러 메시지 상단 여백
            fontSize: 'var(--font-size-xxs)', // 11px - 에러 메시지
          }}
        >
          {error}
        </span>
      )}
      {helperText && !error && (
        <span
          style={{
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
});
