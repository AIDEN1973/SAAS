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
  ...props
}, ref) => {
  // 라벨을 플레이스홀더로 사용
  const inputPlaceholder = placeholder || label;

  // 내부 상태로 입력값 추적 (React Hook Form의 register와 호환)
  const [internalValue, setInternalValue] = React.useState<string>('');
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // ref 병합 (forwardRef와 내부 ref 모두 지원)
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  // value prop이 변경되면 내부 상태도 업데이트 (controlled component 지원)
  React.useEffect(() => {
    if (valueProp !== undefined && valueProp !== null) {
      setInternalValue(String(valueProp));
    } else {
      setInternalValue('');
    }
  }, [valueProp]);

  // 실제 사용할 value (valueProp이 있으면 사용, 없으면 내부 상태 사용)
  const value = valueProp !== undefined ? (valueProp ?? '') : internalValue;

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
    const currentValue = valueProp !== undefined ? (valueProp ?? '') : internalValue;
    if (currentValue === undefined || currentValue === null || currentValue === '') return true;
    if (typeof currentValue === 'string') return currentValue.trim() === '';
    if (typeof currentValue === 'number') return false; // 숫자는 항상 값이 있음
    return String(currentValue).trim() === '';
  }, [valueProp, internalValue]);
  const hasValue = !isEmpty;

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

  const inputStyle: React.CSSProperties = {
    ...sizeStyles[size],
    border: 'none',
    borderBottom: `var(--border-width-form-bottom) solid transparent`, // styles.css 토큰: 레이아웃 유지를 위해 항상 2px, 색상은 투명
    borderRadius: 0,
    backgroundColor: 'var(--color-white)', // styles.css 토큰: 폼 필드 배경색
    color: 'var(--color-text)', // styles.css 토큰: 폼 필드 텍스트 색상
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    transition: 'var(--transition-all)', // styles.css 토큰: transition
    fontFamily: 'var(--font-family)', // styles.css 토큰: 폰트 패밀리
    fontSize: 'var(--font-size-base)', // styles.css 토큰: 폼 필드 폰트 사이즈
    fontWeight: 'var(--font-weight-normal)', // styles.css 토큰: 폼 필드 폰트 웨이트
    lineHeight: 'var(--line-height)', // styles.css 토큰: 폼 필드 라인 높이
    boxSizing: 'border-box', // styles.css 토큰: 폼 필드 box-sizing
    boxShadow: hasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)') // 값이 있으면 2px 테두리
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)'), // 값이 없으면 1px 테두리
  };

  // React Hook Form의 onBlur와 컴포넌트의 포커스 스타일 관리 병합 (styles.css 토큰 사용)
  const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 항상 transparent 유지 (레이아웃 고정)
    e.currentTarget.style.boxShadow = error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)'; // styles.css 토큰: 포커스 시 항상 시각적 2px 테두리
    onFocus?.(e);
  }, [error, onFocus]);

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    e.currentTarget.style.borderBottomColor = 'transparent'; // styles.css 토큰: 투명으로 변경
    // 값이 있으면 2px 유지, 값이 없으면 1px로 복원
    e.currentTarget.style.boxShadow = hasValue
      ? (error ? 'var(--shadow-form-bottom-focus-error)' : 'var(--shadow-form-bottom-focus)')
      : (error ? 'var(--shadow-form-bottom-default-error)' : 'var(--shadow-form-bottom-default)');
    onBlur?.(e);
  }, [error, onBlur, hasValue]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <div style={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
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
          onChange={(e) => {
            const newValue = e.target.value;
            setInternalValue(newValue);
            onChange?.(e);
            // props에서 onChange가 있으면 호출 (React Hook Form의 register)
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
      </div>
      {error && (
        <span
          style={{
            color: 'var(--color-form-error)', // styles.css 토큰: 폼 필드 에러 메시지 색상
            marginTop: 'var(--spacing-xs)', // styles.css 토큰: 에러 메시지 상단 여백
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
