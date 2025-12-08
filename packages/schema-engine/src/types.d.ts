/**
 * Schema Types
 *
 * [불변 규칙] 스키마는 논리적 구조만 포함, Tailwind 클래스 문자열 사용 금지
 * [불변 규칙] SDUI v1.1 엔터프라이즈 확장판 규격 준수
 *
 * 기술문서: SDUI 기술문서 v1.1
 */
import { SpacingToken, ColorToken, SizeToken } from '@design-system/core';
/**
 * Schema Type
 *
 * SDUI에서 지원하는 스키마 타입
 */
export type SchemaType = 'form' | 'table' | 'detail' | 'filter' | 'widget';
/**
 * Schema Version
 */
export interface SchemaVersion {
    version: string;
    minClient?: string;
    minSupportedClient?: string;
    entity: string;
}
/**
 * Base Schema
 *
 * 모든 스키마의 기본 구조
 * SDUI v1.1 엔터프라이즈 확장판 규격
 */
export interface BaseSchema extends SchemaVersion {
    type: SchemaType;
    tenantScoped?: boolean;
    layout?: any;
    fields?: any[];
    columns?: any[];
    actions?: ActionDefinition[];
    conditions?: any[];
    meta?: Record<string, any>;
}
/**
 * Layout Type
 *
 * SDUI v1.1: 레이아웃 타입 확장
 */
export type LayoutType = 'grid' | 'section' | 'tabs' | 'stepper' | 'drawer' | 'modal' | 'responsive';
/**
 * Layout Schema
 *
 * SDUI v1.1: 다양한 레이아웃 타입 지원
 * [불변 규칙] Tailwind 클래스 문자열 사용 금지, props 기반 전달
 */
export interface LayoutSchema {
    type?: LayoutType;
    columns?: number;
    columnGap?: SpacingToken;
    rowGap?: SpacingToken;
    tabs?: Array<{
        key: string;
        labelKey?: string;
        label?: string;
        fields?: string[];
    }>;
    steps?: Array<{
        key: string;
        labelKey?: string;
        label?: string;
        fields?: string[];
    }>;
    responsive?: {
        mobile?: Partial<LayoutSchema>;
        tablet?: Partial<LayoutSchema>;
        desktop?: Partial<LayoutSchema>;
    };
}
/**
 * Condition Operator
 *
 * SDUI v1.1: 연산자 확장
 */
export type ConditionOperator = '==' | '!=' | 'eq' | 'ne' | '>' | '>=' | '<' | '<=' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'exists' | 'not_exists';
/**
 * Condition Actions
 *
 * SDUI v1.1: then/else 구조 지원
 */
export interface ConditionActions {
    hide?: boolean;
    disable?: boolean;
    require?: boolean;
    setValue?: any;
    setOptions?: {
        type: 'static' | 'api';
        options?: Array<{
            value: string;
            labelKey?: string;
            label?: string;
        }>;
        endpoint?: string;
    };
    switchComponent?: {
        to: string;
    };
}
/**
 * Condition Rule (단일 조건)
 *
 * SDUI v1.1: then/else 구조 지원
 */
export interface ConditionRule {
    field: string;
    op: ConditionOperator;
    value?: any;
    then?: ConditionActions;
    else?: ConditionActions;
    action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}
/**
 * 복수 Condition Rule (AND/OR 지원)
 *
 * 여러 조건을 조합하여 평가할 수 있습니다.
 * - conditions: 평가할 조건들의 배열
 * - logic: 'and' | 'or' - 조건들을 AND 또는 OR로 결합
 * - action: 모든 조건이 충족되었을 때 수행할 액션 (하위 호환성)
 * - then/else: SDUI v1.1 구조 (action보다 우선)
 */
export interface MultiConditionRule {
    conditions: ConditionRule[];
    logic: 'and' | 'or';
    then?: ConditionActions;
    else?: ConditionActions;
    action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}
/**
 * Form Field Schema
 *
 * SDUI v1.1: i18n 키 지원, Custom Widget 지원
 * [불변 규칙] 스키마는 논리적 구조만 정의하고, 스타일은 core-ui가 담당합니다.
 */
export interface FormFieldSchema {
    name: string;
    kind: 'text' | 'email' | 'phone' | 'number' | 'password' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'datetime' | 'custom';
    ui?: {
        labelKey?: string;
        label?: string;
        placeholderKey?: string;
        placeholder?: string;
        descriptionKey?: string;
        description?: string;
        tooltipKey?: string;
        tooltip?: string;
        colSpan?: number;
    };
    options?: Array<{
        value: string;
        labelKey?: string;
        label?: string;
    }>;
    defaultValue?: any;
    condition?: ConditionRule;
    conditions?: MultiConditionRule;
    customComponentType?: string;
    validation?: {
        required?: boolean | string | {
            messageKey?: string;
            message?: string;
        };
        min?: number;
        max?: number;
        minLength?: number;
        maxLength?: number;
        pattern?: {
            value: string;
            messageKey?: string;
            message?: string;
        };
        validate?: (value: any) => boolean | string;
    };
}
/**
 * Action Definition
 *
 * SDUI v1.1: Action Engine 지원
 */
export type ActionType = 'api.call' | 'navigate' | 'openDrawer' | 'openModal' | 'setValue' | 'reset' | 'reloadSchema' | 'toast' | 'confirm' | 'sequence';
export interface ActionDefinition {
    event: string;
    type: ActionType;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: 'form' | 'selectedRows' | Record<string, any>;
    to?: string;
    schemaKey?: string;
    field?: string;
    value?: any;
    messageKey?: string;
    message?: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
    titleKey?: string;
    title?: string;
    confirmMessageKey?: string;
    confirmMessage?: string;
    actions?: ActionDefinition[];
}
/**
 * Form Schema
 *
 * SDUI v1.1: i18n 키 지원, Action Engine 지원
 * [불변 규칙] React Hook Form과 통합하여 사용합니다.
 */
export interface FormSchema extends BaseSchema {
    type: 'form';
    form: {
        layout?: LayoutSchema;
        fields: FormFieldSchema[];
        submit?: {
            labelKey?: string;
            label?: string;
            variant?: 'solid' | 'outline' | 'ghost';
            color?: ColorToken;
            size?: SizeToken;
        };
        actions?: ActionDefinition[];
    };
}
/**
 * Table Column Schema
 *
 * SDUI v1.1: i18n 키 지원, 필터링 지원
 */
export interface TableColumnSchema {
    key: string;
    labelKey?: string;
    label?: string;
    width?: number;
    sortable?: boolean;
    filterable?: boolean;
    type?: 'text' | 'number' | 'date' | 'tag' | 'badge' | 'custom';
    render?: 'text' | 'date' | 'number' | 'currency' | 'custom';
}
/**
 * Table Schema
 *
 * SDUI v1.1: dataSource, rowActions, bulkActions 지원
 */
export interface TableSchema extends BaseSchema {
    type: 'table';
    table: {
        dataSource: {
            type: 'api';
            endpoint: string;
            method?: 'GET' | 'POST';
        };
        columns: TableColumnSchema[];
        rowActions?: string[];
        bulkActions?: string[];
        pagination?: {
            pageSizeOptions?: number[];
            defaultPageSize?: number;
            pageSize?: number;
        };
        selection?: 'none' | 'single' | 'multiple';
        virtualization?: boolean;
    };
}
/**
 * Detail Schema
 *
 * SDUI v1.1: 읽기 전용 정보 화면
 */
export interface DetailSchema extends BaseSchema {
    type: 'detail';
    detail: {
        layout?: LayoutSchema;
        fields: FormFieldSchema[];
    };
}
/**
 * Filter Schema
 *
 * SDUI v1.1: Table 상단 검색 조건 영역
 */
export interface FilterSchema extends BaseSchema {
    type: 'filter';
    filter: {
        layout?: LayoutSchema;
        fields: FormFieldSchema[];
    };
}
/**
 * Widget Schema
 *
 * SDUI v1.1: 대시보드용 카드/차트/지표
 */
export interface WidgetSchema extends BaseSchema {
    type: 'widget';
    widget: {
        componentType: string;
        dataSource?: {
            type: 'api';
            endpoint: string;
            method?: 'GET' | 'POST';
        };
        config?: Record<string, any>;
    };
}
/**
 * UI Schema (통합)
 *
 * SDUI v1.1: 모든 스키마 타입 포함
 */
export type UISchema = FormSchema | TableSchema | DetailSchema | FilterSchema | WidgetSchema;
//# sourceMappingURL=types.d.ts.map