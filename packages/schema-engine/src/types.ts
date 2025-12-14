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
  minClient?: string;  // SDUI v1.1: minClient가 우선
  minSupportedClient?: string;  // 하위 호환성: minClient가 없으면 사용
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
  tenantScoped?: boolean;  // 기본 true, false인 경우 system-global
  layout?: LayoutSchema;   // 타입별 레이아웃 정의
  fields?: FormFieldSchema[];  // form/detail/filter에서 사용
  columns?: TableColumnSchema[];  // table에서 사용
  actions?: ActionDefinition[];  // 액션 정의
  conditions?: (ConditionRule | MultiConditionRule)[];  // 글로벌 조건 규칙(생략 가능)
  meta?: Record<string, unknown>;  // 메타데이터
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
  type?: LayoutType;  // 기본값: 'grid'
  columns?: number | 'auto-fit' | 'auto-fill';  // grid: 1-12 또는 auto-fit/auto-fill
  columnTemplate?: string;  // 복잡한 그리드 템플릿 (예: '100px repeat(7, 1fr)', 'repeat(5, 1fr)')
  minColumnWidth?: string;  // auto-fit/auto-fill과 함께 사용 (예: '60px', '100px')
  columnGap?: SpacingToken;
  rowGap?: SpacingToken;
  // tabs 레이아웃
  tabs?: Array<{
    key: string;
    labelKey?: string;
    label?: string;
    fields?: string[];  // 해당 탭에 표시할 필드명 배열
  }>;
  // stepper 레이아웃
  steps?: Array<{
    key: string;
    labelKey?: string;
    label?: string;
    fields?: string[];
  }>;
  // responsive 레이아웃
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
export type ConditionOperator =
  | '==' | '!=' | 'eq' | 'ne'  // 동등 비교 (eq/ne는 하위 호환성)
  | '>' | '>=' | '<' | '<=' | 'gt' | 'gte' | 'lt' | 'lte'  // 숫자 비교
  | 'in' | 'not_in'  // 포함 여부
  | 'exists' | 'not_exists';  // 존재 여부

/**
 * Condition Actions
 *
 * SDUI v1.1: then/else 구조 지원
 */
export interface ConditionActions {
  hide?: boolean;
  disable?: boolean;
  require?: boolean;
  setValue?: unknown;  // 필드 값 설정
  setOptions?: {  // 동적 옵션 설정
    type: 'static' | 'api';
    options?: Array<{ value: string; labelKey?: string; label?: string }>;
    endpoint?: string;
  };
  switchComponent?: {  // 컴포넌트 전환
    to: string;  // 'CreditCardInput', 'BankTransferInput' 등
  };
}

/**
 * Condition Rule (단일 조건)
 *
 * SDUI v1.1: then/else 구조 지원
 */
export interface ConditionRule {
  field: string;  // 참조할 필드명
  op: ConditionOperator;
  value?: unknown;  // 비교 값 (exists/not_exists일 경우 불필요)
  // ⚠️ 중요: SDUI v1.1에서 in/not_in 연산자는 value로 스칼라 또는 배열 모두 허용
  // 배열인 경우: fieldValue와 expected 배열 간 교집합/차집합 판단
  // 스칼라인 경우: 기존 동작 유지
  // (향후 intersects/not_intersects 연산자로 더 명확하게 분리 가능하나, 현재는 배열 허용)

  // SDUI v1.1: then/else 구조 (기존 action은 하위 호환성)
  then?: ConditionActions;
  else?: ConditionActions;

  // 하위 호환성: 기존 action 필드
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
  conditions: ConditionRule[];  // 복수 조건 배열
  logic: 'and' | 'or';  // 조건 결합 방식
  // SDUI v1.1: then/else 구조 (action보다 우선)
  then?: ConditionActions;
  else?: ConditionActions;
  // 하위 호환성: 기존 action 필드
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
    // SDUI v1.1: i18n 키 지원 (label/placeholder/description은 하위 호환성)
    labelKey?: string;  // i18n 키 (우선순위)
    label?: string;     // 직접 문자열 (하위 호환성)
    placeholderKey?: string;
    placeholder?: string;
    descriptionKey?: string;
    description?: string;
    tooltipKey?: string;
    tooltip?: string;
    colSpan?: number;  // Grid column span (1-12)
  };
  // SDUI v1.1: options도 i18n 키 지원
  options?: Array<{
    value: string;
    labelKey?: string;  // i18n 키 (우선순위)
    label?: string;     // 직접 문자열 (하위 호환성)
  }>;
  defaultValue?: unknown;
  condition?: ConditionRule;  // 단일 조건부 렌더링 규칙 (하위 호환성)
  conditions?: MultiConditionRule;  // 복수 조건부 렌더링 규칙 (AND/OR 지원) - condition보다 우선
  // ⚠️ 중요: condition과 conditions는 동시에 사용할 수 없습니다.
  // conditions가 있으면 condition은 자동으로 무시됩니다.

  // SDUI v1.1: Custom Widget 지원
  customComponentType?: string;  // 'CreditCardInput' 등

  validation?: {
    required?: boolean | string | { messageKey?: string; message?: string };  // SDUI v1.1: messageKey 지원
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: {
      value: string;  // JSON serializable 패턴 문자열 (예: "^010[0-9]{8}$")
      messageKey?: string;  // SDUI v1.1: i18n 키 지원
      message?: string;      // 하위 호환성
    };
    validate?: (value: unknown) => boolean | string;
    // ⚠️ 중요: validate 함수는 Schema Registry(JSONB)에 저장될 수 없으므로,
    // Registry 기반 운영 시 validate는 사용할 수 없고 pattern 또는 min/max 등 정형 Validation만 허용됩니다.
    // validate 함수는 fallbackSchema(로컬 스키마) 전용입니다.
  };
}

/**
 * Action Definition
 *
 * SDUI v1.1: Action Engine 지원
 */
export type ActionType =
  | 'api.call'
  | 'navigate'
  | 'openDrawer'
  | 'openModal'
  | 'setValue'
  | 'reset'
  | 'reloadSchema'
  | 'toast'
  | 'confirm'
  | 'sequence';

export interface ActionDefinition {
  event: string;  // 'onSubmit', 'onSubmitSuccess', 'onRowClick' 등
  type: ActionType;
  // api.call
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: 'form' | 'selectedRows' | Record<string, unknown>;
  // navigate
  to?: string;
  // openDrawer / openModal
  schemaKey?: string;  // 열 스키마 키
  // setValue
  field?: string;
  value?: unknown;
  // toast
  messageKey?: string;
  message?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  // confirm
  titleKey?: string;
  title?: string;
  confirmMessageKey?: string;  // SDUI v1.1: i18n 키 (messageKey와 구분)
  confirmMessage?: string;     // 하위 호환성 (message와 구분)
  // sequence
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
      labelKey?: string;  // SDUI v1.1: i18n 키 지원
      label?: string;     // 하위 호환성
      variant?: 'solid' | 'outline' | 'ghost';
      color?: ColorToken;
      size?: SizeToken;
    };
    actions?: ActionDefinition[];  // SDUI v1.1: Form 전용 액션 (schema.actions보다 우선)
  };
}

/**
 * Table Column Schema
 *
 * SDUI v1.1: i18n 키 지원, 필터링 지원
 */
export interface TableColumnSchema {
  key: string;
  labelKey?: string;  // SDUI v1.1: i18n 키 지원
  label?: string;      // 하위 호환성
  width?: number;      // string에서 number로 변경
  sortable?: boolean;
  filterable?: boolean;  // SDUI v1.1: 필터링 지원
  type?: 'text' | 'number' | 'date' | 'tag' | 'badge' | 'custom';
  render?: 'text' | 'date' | 'number' | 'currency' | 'custom';  // 하위 호환성
}

/**
 * Table Schema
 *
 * SDUI v1.1: dataSource, rowActions, bulkActions 지원
 * SDUI v1.2: rowActionHandlers 추가 (Action Engine 연결)
 */
export interface TableSchema extends BaseSchema {
  type: 'table';
  table: {
    dataSource: {  // SDUI v1.1: API 기반 데이터 소스
      type: 'api';
      endpoint: string;
      method?: 'GET' | 'POST';
    };
    columns: TableColumnSchema[];
    rowActions?: string[];  // 'edit', 'delete', 'view' 등 (하위 호환성)
    rowActionHandlers?: {  // SDUI v1.2: Action Engine 연결 (권장)
      [actionKey: string]: ActionDefinition;
    };
    bulkActions?: string[];  // 'delete', 'export' 등
    pagination?: {
      pageSizeOptions?: number[];  // SDUI v1.1: 페이지 크기 옵션
      defaultPageSize?: number;     // pageSize에서 변경
      pageSize?: number;            // 하위 호환성
    };
    selection?: 'none' | 'single' | 'multiple';  // SDUI v1.1: 행 선택
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
    fields: FormFieldSchema[];  // FormFieldSchema 재사용 (읽기 전용)
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
    fields: FormFieldSchema[];  // FormFieldSchema 재사용
    // submit이 아닌 "필터 변경 이벤트" 발생
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
    componentType: string;  // 'chart', 'metric', 'card' 등
    dataSource?: {
      type: 'api';
      endpoint: string;
      method?: 'GET' | 'POST';
    };
    config?: Record<string, unknown>;  // 위젯별 설정
    refreshInterval?: number;  // 자동 새로고침 간격 (ms)
  };
}

/**
 * UI Schema (통합)
 *
 * SDUI v1.1: 모든 스키마 타입 포함
 */
export type UISchema = FormSchema | TableSchema | DetailSchema | FilterSchema | WidgetSchema;

