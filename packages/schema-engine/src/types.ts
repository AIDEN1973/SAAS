/**
 * Schema Types
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆëŠ” ?¼ë¦¬??êµ¬ì¡°ë§??¬í•¨, Tailwind ?´ë˜??ë¬¸ì???¬ìš© ê¸ˆì?
 * [ë¶ˆë? ê·œì¹™] SDUI v1.1 ?”í„°?„ë¼?´ì¦ˆ ?•ì¥??ê·œê²© ì¤€?? * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1
 */

import { SpacingToken, ColorToken, SizeToken } from '@design-system/core';

/**
 * Schema Type
 * 
 * SDUI?ì„œ ì§€?í•˜???¤í‚¤ë§??€?? */
export type SchemaType = 'form' | 'table' | 'detail' | 'filter' | 'widget';

/**
 * Schema Version
 */
export interface SchemaVersion {
  version: string;
  minClient?: string;  // SDUI v1.1: minClientê°€ ?°ì„ 
  minSupportedClient?: string;  // ?˜ìœ„ ?¸í™˜?? minClientê°€ ?†ìœ¼ë©??¬ìš©
  entity: string;
}

/**
 * Base Schema
 * 
 * ëª¨ë“  ?¤í‚¤ë§ˆì˜ ê¸°ë³¸ êµ¬ì¡°
 * SDUI v1.1 ?”í„°?„ë¼?´ì¦ˆ ?•ì¥??ê·œê²©
 */
export interface BaseSchema extends SchemaVersion {
  type: SchemaType;
  tenantScoped?: boolean;  // ê¸°ë³¸ true, false??ê²½ìš° system-global
  layout?: any;            // ?€?…ë³„ ?ˆì´?„ì›ƒ ?•ì˜
  fields?: any[];          // form/detail/filter?ì„œ ?¬ìš©
  columns?: any[];         // table?ì„œ ?¬ìš©
  actions?: ActionDefinition[];  // ?¡ì…˜ ?•ì˜
  conditions?: any[];      // ê¸€ë¡œë²Œ ì¡°ê±´ ê·œì¹™(?ëµ ê°€??
  meta?: Record<string, any>;  // ë©”í??°ì´??}

/**
 * Layout Type
 * 
 * SDUI v1.1: ?ˆì´?„ì›ƒ ?€???•ì¥
 */
export type LayoutType = 'grid' | 'section' | 'tabs' | 'stepper' | 'drawer' | 'modal' | 'responsive';

/**
 * Layout Schema
 * 
 * SDUI v1.1: ?¤ì–‘???ˆì´?„ì›ƒ ?€??ì§€?? * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜??ë¬¸ì???¬ìš© ê¸ˆì?, props ê¸°ë°˜ ?„ë‹¬
 */
export interface LayoutSchema {
  type?: LayoutType;  // ê¸°ë³¸ê°? 'grid'
  columns?: number;  // grid: 1-12 (ê¸°ì¡´ 1-4?ì„œ ?•ì¥)
  columnGap?: SpacingToken;
  rowGap?: SpacingToken;
  // tabs ?ˆì´?„ì›ƒ
  tabs?: Array<{
    key: string;
    labelKey?: string;
    label?: string;
    fields?: string[];  // ?´ë‹¹ ??— ?œì‹œ???„ë“œëª?ë°°ì—´
  }>;
  // stepper ?ˆì´?„ì›ƒ
  steps?: Array<{
    key: string;
    labelKey?: string;
    label?: string;
    fields?: string[];
  }>;
  // responsive ?ˆì´?„ì›ƒ
  responsive?: {
    mobile?: Partial<LayoutSchema>;
    tablet?: Partial<LayoutSchema>;
    desktop?: Partial<LayoutSchema>;
  };
}

/**
 * Condition Operator
 * 
 * SDUI v1.1: ?°ì‚°???•ì¥
 */
export type ConditionOperator = 
  | '==' | '!=' | 'eq' | 'ne'  // ?™ë“± ë¹„êµ (eq/ne???˜ìœ„ ?¸í™˜??
  | '>' | '>=' | '<' | '<=' | 'gt' | 'gte' | 'lt' | 'lte'  // ?«ì ë¹„êµ
  | 'in' | 'not_in'  // ?¬í•¨ ?¬ë?
  | 'exists' | 'not_exists';  // ì¡´ì¬ ?¬ë?

/**
 * Condition Actions
 * 
 * SDUI v1.1: then/else êµ¬ì¡° ì§€?? */
export interface ConditionActions {
  hide?: boolean;
  disable?: boolean;
  require?: boolean;
  setValue?: any;  // ?„ë“œ ê°??¤ì •
  setOptions?: {  // ?™ì  ?µì…˜ ?¤ì •
    type: 'static' | 'api';
    options?: Array<{ value: string; labelKey?: string; label?: string }>;
    endpoint?: string;
  };
  switchComponent?: {  // ì»´í¬?ŒíŠ¸ ?„í™˜
    to: string;  // 'CreditCardInput', 'BankTransferInput' ??  };
}

/**
 * Condition Rule (?¨ì¼ ì¡°ê±´)
 * 
 * SDUI v1.1: then/else êµ¬ì¡° ì§€?? */
export interface ConditionRule {
  field: string;  // ì°¸ì¡°???„ë“œëª?  op: ConditionOperator;
  value?: any;  // ë¹„êµ ê°?(exists/not_exists??ê²½ìš° ë¶ˆí•„??
  // ? ï¸ ì¤‘ìš”: SDUI v1.1?ì„œ in/not_in ?°ì‚°?ëŠ” valueë¡??¤ì¹¼???ëŠ” ë°°ì—´ ëª¨ë‘ ?ˆìš©
  // ë°°ì—´??ê²½ìš°: fieldValue?€ expected ë°°ì—´ ê°?êµì§‘??ì°¨ì§‘???ë‹¨
  // ?¤ì¹¼?¼ì¸ ê²½ìš°: ê¸°ì¡´ ?™ì‘ ? ì?
  // (?¥í›„ intersects/not_intersects ?°ì‚°?ë¡œ ??ëª…í™•?˜ê²Œ ë¶„ë¦¬ ê°€?¥í•˜?? ?„ì¬??ë°°ì—´ ?ˆìš©)
  
  // SDUI v1.1: then/else êµ¬ì¡° (ê¸°ì¡´ action?€ ?˜ìœ„ ?¸í™˜??
  then?: ConditionActions;
  else?: ConditionActions;
  
  // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ
  action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

/**
 * ë³µìˆ˜ Condition Rule (AND/OR ì§€??
 * 
 * ?¬ëŸ¬ ì¡°ê±´??ì¡°í•©?˜ì—¬ ?‰ê??????ˆìŠµ?ˆë‹¤.
 * - conditions: ?‰ê???ì¡°ê±´?¤ì˜ ë°°ì—´
 * - logic: 'and' | 'or' - ì¡°ê±´?¤ì„ AND ?ëŠ” ORë¡?ê²°í•©
 * - action: ëª¨ë“  ì¡°ê±´??ì¶©ì¡±?˜ì—ˆ?????˜í–‰???¡ì…˜ (?˜ìœ„ ?¸í™˜??
 * - then/else: SDUI v1.1 êµ¬ì¡° (actionë³´ë‹¤ ?°ì„ )
 */
export interface MultiConditionRule {
  conditions: ConditionRule[];  // ë³µìˆ˜ ì¡°ê±´ ë°°ì—´
  logic: 'and' | 'or';  // ì¡°ê±´ ê²°í•© ë°©ì‹
  // SDUI v1.1: then/else êµ¬ì¡° (actionë³´ë‹¤ ?°ì„ )
  then?: ConditionActions;
  else?: ConditionActions;
  // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ
  action?: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

/**
 * Form Field Schema
 * 
 * SDUI v1.1: i18n ??ì§€?? Custom Widget ì§€?? * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§ˆëŠ” ?¼ë¦¬??êµ¬ì¡°ë§??•ì˜?˜ê³ , ?¤í??¼ì? core-uiê°€ ?´ë‹¹?©ë‹ˆ??
 */
export interface FormFieldSchema {
  name: string;
  kind: 'text' | 'email' | 'phone' | 'number' | 'password' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'datetime' | 'custom';
  ui?: {
    // SDUI v1.1: i18n ??ì§€??(label/placeholder/description?€ ?˜ìœ„ ?¸í™˜??
    labelKey?: string;  // i18n ??(?°ì„ ?œìœ„)
    label?: string;     // ì§ì ‘ ë¬¸ì??(?˜ìœ„ ?¸í™˜??
    placeholderKey?: string;
    placeholder?: string;
    descriptionKey?: string;
    description?: string;
    tooltipKey?: string;
    tooltip?: string;
    colSpan?: number;  // Grid column span (1-12)
  };
  // SDUI v1.1: options??i18n ??ì§€??  options?: Array<{ 
    value: string; 
    labelKey?: string;  // i18n ??(?°ì„ ?œìœ„)
    label?: string;     // ì§ì ‘ ë¬¸ì??(?˜ìœ„ ?¸í™˜??
  }>;
  defaultValue?: any;
  condition?: ConditionRule;  // ?¨ì¼ ì¡°ê±´ë¶€ ?Œë”ë§?ê·œì¹™ (?˜ìœ„ ?¸í™˜??
  conditions?: MultiConditionRule;  // ë³µìˆ˜ ì¡°ê±´ë¶€ ?Œë”ë§?ê·œì¹™ (AND/OR ì§€?? - conditionë³´ë‹¤ ?°ì„ 
  // ? ï¸ ì¤‘ìš”: conditionê³?conditions???™ì‹œ???¬ìš©?????†ìŠµ?ˆë‹¤.
  // conditionsê°€ ?ˆìœ¼ë©?condition?€ ?ë™?¼ë¡œ ë¬´ì‹œ?©ë‹ˆ??
  
  // SDUI v1.1: Custom Widget ì§€??  customComponentType?: string;  // 'CreditCardInput' ??  
  validation?: {
    required?: boolean | string | { messageKey?: string; message?: string };  // SDUI v1.1: messageKey ì§€??    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: {
      value: string;  // JSON serializable ?¨í„´ ë¬¸ì??(?? "^010[0-9]{8}$")
      messageKey?: string;  // SDUI v1.1: i18n ??ì§€??      message?: string;      // ?˜ìœ„ ?¸í™˜??    };
    validate?: (value: any) => boolean | string;
    // ? ï¸ ì¤‘ìš”: validate ?¨ìˆ˜??Schema Registry(JSONB)???€?¥ë  ???†ìœ¼ë¯€ë¡?
    // Registry ê¸°ë°˜ ?´ì˜ ??validate???¬ìš©?????†ê³  pattern ?ëŠ” min/max ???•í˜• Validationë§??ˆìš©?©ë‹ˆ??
    // validate ?¨ìˆ˜??fallbackSchema(ë¡œì»¬ ?¤í‚¤ë§? ?„ìš©?…ë‹ˆ??
  };
}

/**
 * Action Definition
 * 
 * SDUI v1.1: Action Engine ì§€?? */
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
  event: string;  // 'onSubmit', 'onSubmitSuccess', 'onRowClick' ??  type: ActionType;
  // api.call
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: 'form' | 'selectedRows' | Record<string, any>;
  // navigate
  to?: string;
  // openDrawer / openModal
  schemaKey?: string;  // ???¤í‚¤ë§???  // setValue
  field?: string;
  value?: any;
  // toast
  messageKey?: string;
  message?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  // confirm
  titleKey?: string;
  title?: string;
  confirmMessageKey?: string;  // SDUI v1.1: i18n ??(messageKey?€ êµ¬ë¶„)
  confirmMessage?: string;     // ?˜ìœ„ ?¸í™˜??(message?€ êµ¬ë¶„)
  // sequence
  actions?: ActionDefinition[];
}

/**
 * Form Schema
 * 
 * SDUI v1.1: i18n ??ì§€?? Action Engine ì§€?? * [ë¶ˆë? ê·œì¹™] React Hook Formê³??µí•©?˜ì—¬ ?¬ìš©?©ë‹ˆ??
 */
export interface FormSchema extends BaseSchema {
  type: 'form';
  form: {
    layout?: LayoutSchema;
    fields: FormFieldSchema[];
    submit?: {
      labelKey?: string;  // SDUI v1.1: i18n ??ì§€??      label?: string;     // ?˜ìœ„ ?¸í™˜??      variant?: 'solid' | 'outline' | 'ghost';
      color?: ColorToken;
      size?: SizeToken;
    };
    actions?: ActionDefinition[];  // SDUI v1.1: Form ?„ìš© ?¡ì…˜ (schema.actionsë³´ë‹¤ ?°ì„ )
  };
}

/**
 * Table Column Schema
 * 
 * SDUI v1.1: i18n ??ì§€?? ?„í„°ë§?ì§€?? */
export interface TableColumnSchema {
  key: string;
  labelKey?: string;  // SDUI v1.1: i18n ??ì§€??  label?: string;      // ?˜ìœ„ ?¸í™˜??  width?: number;      // string?ì„œ numberë¡?ë³€ê²?  sortable?: boolean;
  filterable?: boolean;  // SDUI v1.1: ?„í„°ë§?ì§€??  type?: 'text' | 'number' | 'date' | 'tag' | 'badge' | 'custom';
  render?: 'text' | 'date' | 'number' | 'currency' | 'custom';  // ?˜ìœ„ ?¸í™˜??}

/**
 * Table Schema
 * 
 * SDUI v1.1: dataSource, rowActions, bulkActions ì§€?? */
export interface TableSchema extends BaseSchema {
  type: 'table';
  table: {
    dataSource: {  // SDUI v1.1: API ê¸°ë°˜ ?°ì´???ŒìŠ¤
      type: 'api';
      endpoint: string;
      method?: 'GET' | 'POST';
    };
    columns: TableColumnSchema[];
    rowActions?: string[];  // 'edit', 'delete', 'view' ??    bulkActions?: string[];  // 'delete', 'export' ??    pagination?: {
      pageSizeOptions?: number[];  // SDUI v1.1: ?˜ì´ì§€ ?¬ê¸° ?µì…˜
      defaultPageSize?: number;     // pageSize?ì„œ ë³€ê²?      pageSize?: number;            // ?˜ìœ„ ?¸í™˜??    };
    selection?: 'none' | 'single' | 'multiple';  // SDUI v1.1: ??? íƒ
    virtualization?: boolean;
  };
}

/**
 * Detail Schema
 * 
 * SDUI v1.1: ?½ê¸° ?„ìš© ?•ë³´ ?”ë©´
 */
export interface DetailSchema extends BaseSchema {
  type: 'detail';
  detail: {
    layout?: LayoutSchema;
    fields: FormFieldSchema[];  // FormFieldSchema ?¬ì‚¬??(?½ê¸° ?„ìš©)
  };
}

/**
 * Filter Schema
 * 
 * SDUI v1.1: Table ?ë‹¨ ê²€??ì¡°ê±´ ?ì—­
 */
export interface FilterSchema extends BaseSchema {
  type: 'filter';
  filter: {
    layout?: LayoutSchema;
    fields: FormFieldSchema[];  // FormFieldSchema ?¬ì‚¬??    // submit???„ë‹Œ "?„í„° ë³€ê²??´ë²¤?? ë°œìƒ
  };
}

/**
 * Widget Schema
 * 
 * SDUI v1.1: ?€?œë³´?œìš© ì¹´ë“œ/ì°¨íŠ¸/ì§€?? */
export interface WidgetSchema extends BaseSchema {
  type: 'widget';
  widget: {
    componentType: string;  // 'chart', 'metric', 'card' ??    dataSource?: {
      type: 'api';
      endpoint: string;
      method?: 'GET' | 'POST';
    };
    config?: Record<string, any>;  // ?„ì ¯ë³??¤ì •
  };
}

/**
 * UI Schema (?µí•©)
 * 
 * SDUI v1.1: ëª¨ë“  ?¤í‚¤ë§??€???¬í•¨
 */
export type UISchema = FormSchema | TableSchema | DetailSchema | FilterSchema | WidgetSchema;

