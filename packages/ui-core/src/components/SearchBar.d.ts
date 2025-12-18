/**
 * SearchBar Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
export interface SearchBarProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSearch?: (value: string) => void;
    onClear?: () => void;
    className?: string;
    fullWidth?: boolean;
}
/**
 * SearchBar 컴포넌트
 *
 * 검색 기능을 제공하는 입력 필드
 */
export declare const SearchBar: React.FC<SearchBarProps>;
//# sourceMappingURL=SearchBar.d.ts.map