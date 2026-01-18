/**
 * AddressInput Component
 *
 * 카카오 우편번호 서비스를 사용한 하이브리드 주소 입력 컴포넌트
 * - 직접 입력 가능
 * - 우편번호 검색 버튼으로 카카오 주소 API 사용 가능
 *
 * [불변 규칙] Tailwind 클래스 직접 사용 금지, CSS Variables 사용
 */

import React, { useCallback, useRef } from 'react';
import { Search } from 'lucide-react';

export interface AddressInputProps {
  value?: string;
  onChange?: (address: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Daum Postcode API 타입 정의
interface DaumPostcodeData {
  address: string;
  addressType: string;
  bname: string;
  buildingName: string;
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J'; // R: 도로명, J: 지번
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        width?: string | number;
        height?: string | number;
      }) => {
        open: () => void;
      };
    };
  }
}

export function AddressInput({
  value = '',
  onChange,
  onBlur,
  placeholder = '주소를 입력하거나 검색 버튼을 클릭하세요',
  disabled = false,
  className = '',
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  const handleSearchClick = useCallback(() => {
    if (!window.daum?.Postcode) {
      alert('우편번호 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const postcode = new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        // 사용자가 선택한 주소 타입에 따라 주소 결정
        const fullAddress = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;

        // 건물명이 있으면 추가
        let address = fullAddress;
        if (data.buildingName) {
          address += ` (${data.buildingName})`;
        }

        onChange?.(address);

        // 포커스를 input으로 이동
        inputRef.current?.focus();
      },
      width: '100%',
      height: 500,
    });

    postcode.open();
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        width: '100%',
      }}
    >
      {/* Input wrapper - 테두리 처리 */}
      <div
        style={{
          flex: 1,
          minWidth: 0, // flex item이 축소될 수 있도록 함
          position: 'relative',
          backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
          border: isFocused
            ? 'var(--border-width-thin) solid var(--color-primary)'
            : 'var(--border-width-thin) solid var(--color-gray-200)',
          borderRadius: 'var(--border-radius-xs)',
          boxSizing: 'border-box',
          transition: 'var(--transition-all)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            paddingTop: 'var(--spacing-sm)',
            paddingBottom: 'var(--spacing-sm)',
            paddingLeft: 'var(--spacing-form-horizontal-left)',
            paddingRight: 'var(--spacing-form-horizontal-right)',
            border: 'none',
            borderRadius: 'var(--border-radius-xs)',
            backgroundColor: 'transparent',
            color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-text)',
            outline: 'none',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 'var(--font-weight-normal)',
            lineHeight: 'var(--line-height)',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>

      {/* 검색 버튼 */}
      <button
        type="button"
        onClick={handleSearchClick}
        disabled={disabled}
        aria-label="주소 검색"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 'var(--spacing-sm)',
          paddingRight: 'var(--spacing-sm)',
          border: 'var(--border-width-thin) solid var(--color-primary)',
          borderRadius: 'var(--border-radius-xs)',
          backgroundColor: disabled ? 'var(--color-form-disabled-bg)' : 'var(--color-white)',
          color: disabled ? 'var(--color-form-disabled-text)' : 'var(--color-primary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transition-all)',
          minWidth: '40px',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            e.currentTarget.style.color = 'var(--color-white)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-white)';
            e.currentTarget.style.color = 'var(--color-primary)';
          }
        }}
      >
        <Search size={16} />
      </button>
    </div>
  );
}
