/**
 * Avatar Component
 *
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 * [불변 규칙] 모든 스타일은 design-system 토큰을 사용합니다.
 */
import React from 'react';
import { SizeToken } from '@design-system/core';
export interface AvatarProps {
    src?: string;
    alt?: string;
    name?: string;
    size?: SizeToken;
    className?: string;
    onClick?: () => void;
}
/**
 * Avatar 컴포넌트
 *
 * 프로필 이미지가 없는 경우 이니셜 표시
 */
export declare const Avatar: React.FC<AvatarProps>;
//# sourceMappingURL=Avatar.d.ts.map