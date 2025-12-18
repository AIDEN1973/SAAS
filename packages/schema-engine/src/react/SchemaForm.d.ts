/**
 * SchemaForm Component
 *
 * [불변 규칙] React Hook Form과 통합된 FormSchema Renderer
 * [불변 규칙] SchemaField를 사용하여 개별 필드 렌더링
 * [불변 규칙] Grid 레이아웃 적용
 * [불변 규칙] SDUI v1.1: Action Engine 연동, i18n 키 지원
 *
 * 기술문서:
 * - docu/스키마엔진.txt 8. Renderer 통합
 * - SDUI 기술문서 v1.1 - 10. Form Engine
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import type { FormSchema } from '../types';
import { type ActionContext } from '../core/actionEngine';
export interface SchemaFormProps {
    schema: FormSchema;
    onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
    defaultValues?: Record<string, unknown>;
    className?: string;
    actionContext?: Partial<ActionContext>;
    translations?: Record<string, string>;
    /**
     * SDUI v1.1: API 클라이언트 주입(선택)
     * - schema-engine은 특정 SDK를 직접 import하지 않습니다.
     * - 앱에서 `@api-sdk/core`의 `apiClient`를 주입하는 방식으로 사용합니다.
     */
    apiClient?: {
        get: (table: string, options?: unknown) => Promise<unknown>;
    };
    disableCardPadding?: boolean;
    /** 카드 내부 타이틀 (타이틀 하단에 구분선 자동 추가) */
    cardTitle?: React.ReactNode;
    /** 타이틀 위치 (기본값: 'top-left') */
    cardTitlePosition?: 'top-left' | 'top-right' | 'top-center';
    /** 타이틀 왼쪽에 표시할 아이콘 (루시드 아이콘) */
    cardTitleIcon?: React.ReactNode;
    /** 취소 버튼 클릭 핸들러 (취소 버튼 표시 여부 결정) */
    onCancel?: () => void;
    /** 취소 버튼 텍스트 (기본값: '취소') */
    cancelLabel?: string;
    /** 삭제 버튼 클릭 핸들러 (삭제 버튼 표시 여부 결정) */
    onDelete?: () => void | Promise<void>;
    /** 삭제 버튼 텍스트 (기본값: '삭제') */
    deleteLabel?: string;
}
/**
 * SchemaForm 컴포넌트
 *
 * FormSchema를 React Hook Form과 통합하여 렌더링합니다.
 * SchemaField를 사용하여 개별 필드를 렌더링하고, Condition Rule을 지원합니다.
 */
export declare const SchemaForm: React.FC<SchemaFormProps>;
/**
 * SchemaForm with form methods exposed
 *
 * useForm의 메서드를 외부에서 접근할 수 있도록 하는 고급 컴포넌트
 */
export interface SchemaFormWithMethodsProps extends SchemaFormProps {
    formRef?: React.RefObject<UseFormReturn<Record<string, unknown>>>;
}
export declare const SchemaFormWithMethods: React.FC<SchemaFormWithMethodsProps>;
//# sourceMappingURL=SchemaForm.d.ts.map