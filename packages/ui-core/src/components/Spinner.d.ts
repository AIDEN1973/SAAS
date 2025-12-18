/**
 * Spinner Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import { ColorToken, SizeToken } from '@design-system/core';
export interface SpinnerProps {
    size?: SizeToken;
    color?: ColorToken;
    className?: string;
}
/**
 * Spinner 컴포넌트
 *
 * 로딩 스피너
 */
export declare const Spinner: React.FC<SpinnerProps>;
//# sourceMappingURL=Spinner.d.ts.map