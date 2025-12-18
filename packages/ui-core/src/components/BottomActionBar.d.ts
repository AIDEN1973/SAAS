/**
 * Bottom Action Bar
 *
 * Mobile 전용: Bottom Action Bar
 * [불변 규칙] Mobile에서 Bottom Action Bar를 하단으로 사용
 * [불변 규칙] 스키마에서는 Tailwind 클래스를 직접 사용하지 않습니다.
 */
import React from 'react';
export interface BottomActionBarProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}
/**
 * Bottom Action Bar
 * Mobile에서만 표시, Desktop에서는 헤더로 이동
 */
export declare const BottomActionBar: React.FC<BottomActionBarProps>;
//# sourceMappingURL=BottomActionBar.d.ts.map