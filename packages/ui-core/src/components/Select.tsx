/**
 * Select Component
 *
 * [불변 규칙] Atlaskit Select를 래핑하여 사용합니다.
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 Atlaskit 테마를 사용합니다.
 */

import React from 'react';
import AKSelect from '@atlaskit/select';
import { SizeToken } from '@design-system/core';

export interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  size?: SizeToken;
  fullWidth?: boolean;
  children?: React.ReactNode;
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  onBlur?: () => void;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  size = 'md',
  fullWidth = false,
  className,
  children,
  value,
  onChange,
  onBlur,
  multiple = false,
  disabled,
  ...props
}) => {
  // children을 options로 변환
  const options = React.useMemo(() => {
    if (!children) return [];
    return React.Children.toArray(children)
      .filter((child): child is React.ReactElement => React.isValidElement(child))
      .map((child) => {
        const childProps = child.props as { value?: string; children?: React.ReactNode };
        return {
          label: String(childProps.children || childProps.value || ''),
          value: String(childProps.value || ''),
        };
      });
  }, [children]);

  const selectedValue = React.useMemo(() => {
    if (!value) return null;
    if (multiple && Array.isArray(value)) {
      return options.filter((opt) => value.includes(opt.value));
    }
    return options.find((opt) => opt.value === value) || null;
  }, [value, options, multiple]);

  return (
    <AKSelect
      label={label}
      isInvalid={!!error}
      errorMessage={error}
      helperText={helperText}
      isDisabled={disabled}
      isMulti={multiple}
      options={options}
      value={selectedValue}
      onChange={(selected) => {
        if (onChange) {
          if (multiple && Array.isArray(selected)) {
            onChange(selected.map((s: any) => s.value));
          } else if (!multiple && selected && !Array.isArray(selected)) {
            onChange((selected as any).value);
          }
        }
      }}
      onBlur={onBlur}
      className={className}
      {...props}
    />
  );
};
