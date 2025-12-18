/**
 * SchemaDetail Component
 *
 * SDUI v1.1: Detail Schema 렌더러(읽기 전용 정보 화면)
 *
 * 기술문서: SDUI 기술문서 v1.1 - 15. Detail Engine
 */
import React from 'react';
import type { DetailSchema } from '../types';
export interface SchemaDetailProps {
    schema: DetailSchema;
    data?: Record<string, unknown>;
    className?: string;
}
/**
 * SchemaDetail 컴포넌트
 *
 * DetailSchema를 읽기 전용으로 렌더링합니다.
 * FormFieldSchema를 사용하되 입력 불가 상태로 표시합니다.
 */
export declare const SchemaDetail: React.FC<SchemaDetailProps>;
//# sourceMappingURL=SchemaDetail.d.ts.map