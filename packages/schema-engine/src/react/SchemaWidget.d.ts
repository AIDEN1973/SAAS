/**
 * SchemaWidget Component
 *
 * SDUI v1.1: Widget Schema 렌더러(대시보드용 카드/차트/지표)
 *
 * 기술문서: SDUI 기술문서 v1.1 - 15. Widget Engine
 * [불변 규칙] CSS 변수 사용, Tailwind 클래스 직접 사용 금지
 * [불변 규칙] Zero-Trust: @api-sdk/core를 통한 API 호출
 */
import React from 'react';
import type { WidgetSchema } from '../types';
export interface SchemaWidgetProps {
    schema: WidgetSchema;
    className?: string;
    apiCall?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
}
/**
 * SchemaWidget 컴포넌트
 *
 * WidgetSchema를 렌더링합니다.
 * 대시보드용 카드, 차트, 지표 등을 표시합니다.
 */
export declare const SchemaWidget: React.FC<SchemaWidgetProps>;
//# sourceMappingURL=SchemaWidget.d.ts.map