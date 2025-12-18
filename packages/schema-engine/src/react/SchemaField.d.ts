/**
 * SchemaField Component
 *
 * [불변 규칙] React Hook Form과 통합된 Schema Field Renderer
 * [불변 규칙] Condition Rule 기반 동적 UI 렌더링
 * [불변 규칙] Tailwind 클래스 문자열을 직접 사용하지 않고, ui-core 컴포넌트만 사용
 *
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
 */
import React from 'react';
import { UseFormRegister, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import type { FormFieldSchema } from '../types';
export interface SchemaFieldProps {
    field: FormFieldSchema;
    register: UseFormRegister<Record<string, unknown>>;
    errors: FieldErrors<Record<string, unknown>>;
    control: Control<Record<string, unknown>>;
    translations?: Record<string, string>;
    setValue?: UseFormSetValue<Record<string, unknown>>;
    /**
     * SDUI v1.1: API 클라이언트 주입(선택)
     * - schema-engine은 특정 SDK를 직접 import하지 않습니다.
     * - 앱에서 `@api-sdk/core`의 `apiClient`를 주입하는 방식으로 사용합니다.
     */
    apiClient?: {
        get: (table: string, options?: unknown) => Promise<unknown>;
    };
    gridColumns?: number;
    /**
     * 값이 있을 때 인라인 라벨(placeholder를 좌측 라벨로) 표시 여부
     * - 기본값 true: 수정폼 UX 유지
     * - 필터/검색 UI에서는 false로 전달하여 placeholder가 값 입력 시 제거되도록 함
     */
    showInlineLabelWhenHasValue?: boolean;
}
export declare const SchemaField: React.NamedExoticComponent<SchemaFieldProps>;
//# sourceMappingURL=SchemaField.d.ts.map