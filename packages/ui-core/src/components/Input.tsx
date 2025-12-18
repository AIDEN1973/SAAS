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

  // 플레이스홀더에서 키워드를 볼드 처리하는 함수
  const renderPlaceholderWithBold = React.useCallback((text: string) => {
    const keywords = ['이름', '학년', '클래스', '재원상태'];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    keywords.forEach((keyword) => {
      const index = text.indexOf(keyword, lastIndex);
      if (index !== -1) {
        // 키워드 이전 텍스트 추가
        if (index > lastIndex) {
          parts.push(text.substring(lastIndex, index));
        }
        // 키워드를 볼드 처리
        parts.push(
          <strong key={`${keyword}-${index}`} style={{ fontWeight: 'var(--font-weight-extrabold)' }}>
            {keyword}
          </strong>
        );
        lastIndex = index + keyword.length;
      }
    });

    // 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, []);

  // 값이 비어있는지 확인 (빈 문자열, 공백만 있는 문자열도 빈 값으로 처리)
  // valueProp이 있으면 valueProp 사용, 없으면 internalValue 사용 (실시간 업데이트)
  const isEmpty = React.useMemo(() => {
    const currentValue = isControlled ? (valueProp ?? '') : internalValue;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (typeof currentValue === 'string') return currentValue.trim() === '';
    if (typeof currentValue === 'number') return false; // 숫자는 항상 값이 있음
    return String(currentValue).trim() === '';
  }, [isControlled, valueProp, internalValue]);
  const hasValue = !isEmpty;
  // ⚠️ IME 안정성: 입력(포커스/조합) 중에는 레이아웃이 바뀌면 안 됨.
  // 기존 로직은 값이 1글자라도 들어오면(useInline=true) DOM 구조가 바뀌며(래퍼/placeholder 모드 전환)
  // 한글 조합이 'ㅅ'에서 끊길 수 있음.
  // 따라서 포커스 중이거나 조합 중에는 인라인 라벨 모드로 전환하지 않고, 포커스 아웃 이후에만 적용.
  const useInline = showInlineLabelWhenHasValue && hasValue && !isFocused && !isComposingRef.current;

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

  // 수정모드(값이 있을 때): 인라인 라벨 + 입력값을 래퍼로 감싸고 밑줄은 래퍼에 적용
  // 따라서 input 자체는 밑줄 없이, 래퍼에서 관리
  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    // 수정모드일 때는 래퍼에 밑줄 적용, 그렇지 않으면 input에 직접 적용
    borderBottom: useInline ? 'none' : `var(--border-width-form-bottom) solid transparent`,
    borderRadius: 0,
    backgroundColor: 'transparent', // 래퍼 배경과 통합
    color: 'var(--color-text)', // styles.css 토큰: 폼 필드 텍스트 색상
    outline: 'none',
    flex: useInline ? 1 : undefined, // 수정모드에서 남은 공간 채우기
    width: useInline ? 'auto' : (fullWidth ? '100%' : 'auto'),
    minWidth: useInline ? 0 : undefined, // flex 환경에서 shrink 허용
    transition: 'var(--transition-all)', // styles.css 토큰: transition
    fontFamily: 'var(--font-family)', // styles.css 토큰: 폰트 패밀리
    fontSize: 'var(--font-size-base)', // styles.css 토큰: 폼 필드 폰트 사이즈
    fontWeight: 'var(--font-weight-normal)', // styles.css 토큰: 폼 필드 폰트 웨이트
    lineHeight: 'var(--line-height)', // styles.css 토큰: 폼 필드 라인 높이
    boxSizing: 'border-box', // styles.css 토큰: 폼 필드 box-sizing
    // 수정모드가 아닐 때만 input에 직접 밑줄 적용
    boxShadow: useInline ? 'none' : (isFocused
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)')),
  };

  // 수정모드(값이 있을 때) 래퍼 스타일: 인라인 라벨 + 입력값을 감싸고 밑줄 적용
  const inlineWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'var(--color-white)',
    borderBottom: `var(--border-width-form-bottom) solid transparent`,
    boxShadow: isFocused
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)'),
    boxSizing: 'border-box',
    transition: 'var(--transition-all)',
  };

  // 래퍼 ref (수정모드에서 포커스 스타일 적용용)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합 (styles.css 토큰 사용)
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // 수정모드에서는 래퍼에 스타일 적용, 그렇지 않으면 input에 직접 적용
    const targetEl = (useInline ? wrapperRef.current : null) || e.currentTarget;
    targetEl.style.borderBottomColor = 'transparent';
    targetEl.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)';
    onFocus?.(e);
  }, [error, onFocus, useInline]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // 수정모드에서는 래퍼에 스타일 적용, 그렇지 않으면 input에 직접 적용
    const targetEl = (useInline ? wrapperRef.current : null) || e.currentTarget;
    targetEl.style.borderBottomColor = 'transparent';
    targetEl.style.boxShadow = error
      ? 'var(--shadow-form-bottom-default-error)'
      : 'var(--shadow-form-bottom-default)';
    onBlur?.(e);
  }, [error, onBlur, useInline]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        {/* 수정모드(값이 있을 때): 인라인 라벨 + 입력값을 래퍼로 감싸고 밑줄은 래퍼에 적용 */}
        {useInline ? (
          <div ref={wrapperRef} style={inlineWrapperStyle}>
            {/* 인라인 라벨(항목명): 값이 있을 때 좌측에 표시 */}
            {inputPlaceholder && (
              <span
                style={{
                  color: 'var(--color-form-inline-label)',
                  marginRight: 'var(--spacing-form-inline-label-gap)',
                  whiteSpace: 'nowrap',
                  fontSize: 'var(--font-size-base)',
                  fontFamily: 'var(--font-family)',
                  fontWeight: 'var(--font-weight-normal)',
                  lineHeight: 'var(--line-height)',
                  paddingTop: sizeStyles[size].paddingTop,
                  paddingBottom: sizeStyles[size].paddingBottom,
                  paddingLeft: sizeStyles[size].paddingLeft,
                  flexShrink: 0,
                  minWidth: 'var(--width-form-inline-label)', // 고정 너비로 결과값 세로 정렬
                }}
              >
                {inputPlaceholder}
              </span>
            )}
            <input
              ref={(node) => {
                inputRef.current = node;
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }
              }}
              className={clsx(className)}
              style={inputStyle}
              placeholder=""
              value={value}
              onCompositionStart={(e) => {
                isComposingRef.current = true;
                if ((import.meta as any).env?.DEV) {
                  console.log('[IME][Input] compositionstart', {
                    name: (props as any)?.name,
                    isControlled,
                    valueProp,
                    value,
                    data: (e as unknown as CompositionEvent).data,
                  });
                }
                (props as any).onCompositionStart?.(e);
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                if ((import.meta as any).env?.DEV) {
                  console.log('[IME][Input] compositionend', {
                    name: (props as any)?.name,
                    isControlled,
                    valueProp,
                    value,
                    data: (e as unknown as CompositionEvent).data,
                  });
                }
                (props as any).onCompositionEnd?.(e);
              }}
              onChange={(e) => {
                const newValue = e.target.value;
                // controlled 모드에서는 외부(onChange)가 상태를 소유하므로 내부 상태 업데이트 금지
                if (!isControlled) setInternalValue(newValue);
                if ((import.meta as any).env?.DEV) {
                  const nativeIsComposing = (e.nativeEvent as any)?.isComposing;
                  console.log('[IME][Input] change', {
                    name: (props as any)?.name,
                    isControlled,
                    isComposingRef: isComposingRef.current,
                    nativeIsComposing,
                    newValue,
                    prevValue: value,
                  });
                }
                onChange?.(e);
                (props as any).onChange?.(e);
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              {...props}
            />
          </div>
        ) : (
          /* 입력모드(값이 없을 때): input에 직접 밑줄 적용 */
          <>
            <input
              ref={(node) => {
                inputRef.current = node;
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }
              }}
              className={clsx(className)}
              style={inputStyle}
              placeholder=""
              value={value}
              onCompositionStart={(e) => {
                isComposingRef.current = true;
                if ((import.meta as any).env?.DEV) {
                  console.log('[IME][Input] compositionstart', {
                    name: (props as any)?.name,
                    isControlled,
                    valueProp,
                    value,
                    data: (e as unknown as CompositionEvent).data,
                  });
                }
                (props as any).onCompositionStart?.(e);
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                if ((import.meta as any).env?.DEV) {
                  console.log('[IME][Input] compositionend', {
                    name: (props as any)?.name,
                    isControlled,
                    valueProp,
                    value,
                    data: (e as unknown as CompositionEvent).data,
                  });
                }
                (props as any).onCompositionEnd?.(e);
              }}
              onChange={(e) => {
                const newValue = e.target.value;
                // controlled 모드에서는 외부(onChange)가 상태를 소유하므로 내부 상태 업데이트 금지
                if (!isControlled) setInternalValue(newValue);
                if ((import.meta as any).env?.DEV) {
                  const nativeIsComposing = (e.nativeEvent as any)?.isComposing;
                  console.log('[IME][Input] change', {
                    name: (props as any)?.name,
                    isControlled,
                    isComposingRef: isComposingRef.current,
                    nativeIsComposing,
                    newValue,
                    prevValue: value,
                  });
                }
                onChange?.(e);
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
                {renderPlaceholderWithBold(inputPlaceholder)}
              </div>
            )}
          </>
        )}
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
            marginTop: 'var(--spacing-xs)', // styles.css 토큰: 에러 메시지 상단 여백
            // 요구사항: 에러 메시지를 2pt 작게 표시 (공통 컴포넌트 기준)
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
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
});
