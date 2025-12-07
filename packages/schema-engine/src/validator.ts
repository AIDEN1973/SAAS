/**
 * Meta-Schema Validator
 * 
 * [ë¶ˆë? ê·œì¹™] ?¤í‚¤ë§?êµ¬ì¡°???¤ìŒ ?¨ê³„?ì„œ ê²€ì¦?
 * - ê°œë°œ(local dev)
 * - CI ë¹Œë“œ ?¨ê³„
 * - ?Œë„Œ??ë°°í¬ ?? * - Schema Registry???±ë¡ ?œì 
 */

import { z } from 'zod';
import { FormSchema, TableSchema, SchemaVersion, ConditionRule, MultiConditionRule } from './types';

/**
 * Schema Version Validator
 * 
 * SDUI v1.1: minClient ?¬ìš© (minSupportedClient???˜ìœ„ ?¸í™˜??
 */
const schemaVersionBase = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  minClient: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),  // SDUI v1.1
  minSupportedClient: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),  // ?˜ìœ„ ?¸í™˜??  entity: z.string().min(1),
});

const schemaVersionSchema = schemaVersionBase.refine((data) => {
  // minClient ?ëŠ” minSupportedClient ì¤??˜ë‚˜???„ìˆ˜
  return !!(data.minClient || data.minSupportedClient);
}, {
  message: 'minClient ?ëŠ” minSupportedClient ì¤??˜ë‚˜???„ìˆ˜?…ë‹ˆ??',
});

/**
 * Layout Schema Validator
 * 
 * SDUI v1.1: columnsë¥?numberë¡??•ì¥ (1-12)
 */
const layoutSchema = z.object({
  type: z.enum(['grid', 'section', 'tabs', 'stepper', 'drawer', 'modal', 'responsive']).optional(),  // SDUI v1.1
  columns: z.union([z.number().min(1).max(12), z.enum(['1', '2', '3', '4'])]).optional(),  // SDUI v1.1: number ?•ì¥
  columnGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
  rowGap: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
  // SDUI v1.1: tabs, stepper, responsive ?ˆì´?„ì›ƒ ì§€??  tabs: z.array(z.object({
    key: z.string(),
    labelKey: z.string().optional(),
    label: z.string().optional(),
    fields: z.array(z.string()).optional(),
  })).optional(),
  steps: z.array(z.object({
    key: z.string(),
    labelKey: z.string().optional(),
    label: z.string().optional(),
    fields: z.array(z.string()).optional(),
  })).optional(),
  responsive: z.object({
    mobile: z.any().optional(),
    tablet: z.any().optional(),
    desktop: z.any().optional(),
  }).optional(),
});

/**
 * Condition Rule Validator (?¨ì¼ ì¡°ê±´)
 * 
 * SDUI v1.1: then/else êµ¬ì¡° ì§€?? ?ˆë¡œ???°ì‚°??ì§€?? */
const conditionRuleSchema: z.ZodType<ConditionRule> = z.object({
  field: z.string().min(1),
  op: z.enum(['==', '!=', 'eq', 'ne', 'in', 'not_in', 'exists', 'not_exists', 'gt', 'gte', 'lt', 'lte', '>', '>=', '<', '<=']),  // SDUI v1.1: ?ˆë¡œ???°ì‚°??  value: z.any().optional(),  // exists/not_exists??ê²½ìš° ë¶ˆí•„??  // SDUI v1.1: then/else êµ¬ì¡°
  then: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  else: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ
  action: z.enum(['show', 'hide', 'enable', 'disable', 'require']).optional(),
}).refine((data) => {
  // ? ï¸ ì¤‘ìš”: valueê°€ undefined??ConditionRule?€ Meta-Schema ?¨ê³„?ì„œ ê±°ë?
  // eq/ne/in/not_in/gt/gte/lt/lte ?°ì‚°?ëŠ” valueê°€ ?„ìˆ˜ (exists/not_exists ?œì™¸)
  if (data.op !== 'exists' && data.op !== 'not_exists' && data.value === undefined) {
    return false;
  }
  return true;
}, {
  message: 'eq/ne/in/not_in/gt/gte/lt/lte ?°ì‚°?ëŠ” valueê°€ ?„ìˆ˜?…ë‹ˆ?? exists/not_exists ?°ì‚°?ë§Œ valueê°€ ë¶ˆí•„?”í•©?ˆë‹¤.',
}).refine((data) => {
  // SDUI v1.1: in/not_in ?°ì‚°?ëŠ” valueë¡??¤ì¹¼???ëŠ” ë°°ì—´ ëª¨ë‘ ?ˆìš©
  // ë°°ì—´??ê²½ìš°: fieldValue?€ expected ë°°ì—´ ê°?êµì§‘??ì°¨ì§‘???ë‹¨
  // ?¤ì¹¼?¼ì¸ ê²½ìš°: ê¸°ì¡´ ?™ì‘ ? ì?
  // (?¥í›„ intersects/not_intersects ?°ì‚°?ë¡œ ??ëª…í™•?˜ê²Œ ë¶„ë¦¬ ê°€??
  // ?„ì¬??ë°°ì—´ ?ˆìš©?¼ë¡œ ì²˜ë¦¬
  return true;
});

/**
 * Multi Condition Rule Validator (ë³µìˆ˜ ì¡°ê±´ AND/OR)
 * 
 * SDUI v1.1: then/else êµ¬ì¡° ì§€?? */
const multiConditionRuleSchema: z.ZodType<MultiConditionRule> = z.object({
  conditions: z.array(conditionRuleSchema).min(1),
  logic: z.enum(['and', 'or']),
  // SDUI v1.1: then/else êµ¬ì¡° (actionë³´ë‹¤ ?°ì„ )
  then: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  else: z.object({
    hide: z.boolean().optional(),
    disable: z.boolean().optional(),
    require: z.boolean().optional(),
    setValue: z.any().optional(),
    setOptions: z.object({
      type: z.enum(['static', 'api']),
      options: z.array(z.any()).optional(),
      endpoint: z.string().optional(),
    }).optional(),
    switchComponent: z.object({
      to: z.string(),
    }).optional(),
  }).optional(),
  // ?˜ìœ„ ?¸í™˜?? ê¸°ì¡´ action ?„ë“œ
  action: z.enum(['show', 'hide', 'enable', 'disable', 'require']).optional(),
});

/**
 * Form Field Schema Validator
 * 
 * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜??ë¬¸ì???¬ìš© ê¸ˆì? ê²€ì¦? * [ë¶ˆë? ê·œì¹™] Field kindë³?options ê°•ì œ ê²€?? * [ë¶ˆë? ê·œì¹™] ConditionRule êµ¬ì¡°??ê²€ì¦?ê°€?? */
const formFieldSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['text', 'email', 'phone', 'number', 'password', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'date', 'datetime', 'custom']),  // SDUI v1.1: custom ì¶”ê?
  ui: z.object({
    // SDUI v1.1: i18n ??ì§€??    labelKey: z.string().optional(),
    label: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??    placeholderKey: z.string().optional(),
    placeholder: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??    descriptionKey: z.string().optional(),
    description: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??    tooltipKey: z.string().optional(),
    tooltip: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??    colSpan: z.number().min(1).max(12).optional(),
  }).optional(),
  // SDUI v1.1: options??i18n ??ì§€??  options: z.array(z.object({
    value: z.string(),
    labelKey: z.string().optional(),  // SDUI v1.1
    label: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??  })).optional(),
  defaultValue: z.any().optional(),
  condition: conditionRuleSchema.optional(),  // ?¨ì¼ ì¡°ê±´ (?˜ìœ„ ?¸í™˜??
  conditions: multiConditionRuleSchema.optional(),  // ë³µìˆ˜ ì¡°ê±´ (AND/OR)
  // SDUI v1.1: Custom Widget ì§€??  customComponentType: z.string().optional(),
  validation: z.object({
    // SDUI v1.1: messageKey ì§€??    required: z.union([
      z.boolean(),
      z.string(),
      z.object({
        messageKey: z.string().optional(),
        message: z.string().optional(),
      }),
    ]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.object({
      value: z.string(),  // JSON serializable ?¨í„´ ë¬¸ì??(?? "^010[0-9]{8}$")
      messageKey: z.string().optional(),  // SDUI v1.1
      message: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??    }).optional(),
    validate: z.function().optional(),
  }).optional(),
}).refine((data) => {
  // select/multiselect/radio??options ?„ìˆ˜
  if (['select', 'multiselect', 'radio'].includes(data.kind)) {
    return data.options && data.options.length > 0;
  }
  return true;
}, {
  message: 'select/multiselect/radio ?„ë“œ??optionsê°€ ?„ìˆ˜?…ë‹ˆ??',
}).refine((data) => {
  // text/textarea/date ?±ì? optionsê°€ ì¡´ì¬?˜ë©´ ????(custom ?œì™¸)
  if (!['select', 'multiselect', 'radio', 'custom'].includes(data.kind)) {
    return !data.options || data.options.length === 0;
  }
  return true;
}, {
  message: 'text/textarea/date/datetime/number/password/email/phone/checkbox ?„ë“œ??optionsë¥?ê°€ì§????†ìŠµ?ˆë‹¤.',
}).refine((data) => {
  // SDUI v1.1: custom kind??customComponentType ?„ìˆ˜
  if (data.kind === 'custom' && !data.customComponentType) {
    return false;
  }
  return true;
}, {
  message: 'custom kind ?„ë“œ??customComponentType???„ìˆ˜?…ë‹ˆ??',
}).refine((data) => {
  // options ? íš¨??ê²€??ê°•í™”
  if (data.options && data.options.length > 0) {
    // options.value ì¤‘ë³µ ê²€??    const values = data.options.map((opt) => opt.value);
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      return false;
    }
    // options.labelKey ?ëŠ” label ì¤??˜ë‚˜???„ìˆ˜ (SDUI v1.1)
    if (data.options.some((opt) => !opt.labelKey && (!opt.label || opt.label.trim() === ''))) {
      return false;
    }
  }
  return true;
}, {
  message: 'options.value??ì¤‘ë³µ?????†ìœ¼ë©? options.labelKey ?ëŠ” label ì¤??˜ë‚˜???„ìˆ˜?…ë‹ˆ??',
}).refine((data) => {
  // Tailwind ?´ë˜??ë¬¸ì???¬ìš© ê¸ˆì? ê²€ì¦?  // ui.label, ui.placeholder??Tailwind ?´ë˜???¨í„´???¬í•¨?˜ì–´ ?ˆì? ?Šì?ì§€ ?•ì¸
  const tailwindPattern = /^(p|m|w|h|text|bg|border|rounded|flex|grid|col|row|gap|space|justify|items|self|place)-/;
  if (data.ui?.label && tailwindPattern.test(data.ui.label)) {
    return false;
  }
  if (data.ui?.placeholder && tailwindPattern.test(data.ui.placeholder)) {
    return false;
  }
  return true;
}, {
  message: '?¤í‚¤ë§ˆì—??Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?????†ìŠµ?ˆë‹¤. props ê¸°ë°˜?¼ë¡œ ?„ë‹¬?´ì•¼ ?©ë‹ˆ??',
}).refine((data) => {
  // ConditionRule ?í˜¸ ì¶©ëŒ ê²€ì¦? ?¨ì¼ ì¡°ê±´ + ë³µìˆ˜ ì¡°ê±´ ?™ì‹œ ì¡´ì¬ ê¸ˆì?
  if (data.condition && data.conditions) {
    return false;
  }
  return true;
}, {
  message: 'conditionê³?conditions???™ì‹œ???¬ìš©?????†ìŠµ?ˆë‹¤. conditionsê°€ ?ˆìœ¼ë©?condition?€ ë¬´ì‹œ?©ë‹ˆ??',
}).refine((data) => {
  // MultiConditionRule ë¹?ë°°ì—´ ê¸ˆì?
  if (data.conditions && data.conditions.conditions.length === 0) {
    return false;
  }
  return true;
}, {
  message: 'MultiConditionRule??conditions ë°°ì—´?€ ìµœì†Œ 1ê°??´ìƒ??ì¡°ê±´???„ìš”?©ë‹ˆ??',
});

/**
 * Form Schema Validator
 */
export const formSchemaValidator = schemaVersionBase.extend({
  form: z.object({
    layout: layoutSchema.optional(),
    fields: z.array(formFieldSchema),
    submit: z.object({
      labelKey: z.string().optional(),  // SDUI v1.1
      label: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??      variant: z.enum(['solid', 'outline', 'ghost']).optional(),
      color: z.enum(['primary', 'secondary', 'success', 'warning', 'error', 'info']).optional(),
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    }).optional(),
  }),
});

/**
 * Table Column Schema Validator
 * 
 * SDUI v1.1: i18n ??ì§€?? widthë¥?numberë¡?ë³€ê²? */
const tableColumnSchema = z.object({
  key: z.string().min(1),
  labelKey: z.string().optional(),  // SDUI v1.1
  label: z.string().optional(),  // ?˜ìœ„ ?¸í™˜??  width: z.union([z.number(), z.string()]).optional(),  // SDUI v1.1: number ì§€??  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),  // SDUI v1.1
  type: z.enum(['text', 'number', 'date', 'tag', 'badge', 'custom']).optional(),  // SDUI v1.1
  render: z.enum(['text', 'date', 'number', 'currency', 'custom']).optional(),  // ?˜ìœ„ ?¸í™˜??}).refine((data) => {
  // labelKey ?ëŠ” label ì¤??˜ë‚˜???„ìˆ˜
  return !!(data.labelKey || data.label);
}, {
  message: 'labelKey ?ëŠ” label ì¤??˜ë‚˜???„ìˆ˜?…ë‹ˆ??',
});

/**
 * Table Schema Validator
 * 
 * SDUI v1.1: dataSource, rowActions, bulkActions, selection ì§€?? */
export const tableSchemaValidator = schemaVersionBase.extend({
  table: z.object({
    dataSource: z.object({  // SDUI v1.1: API ê¸°ë°˜ ?°ì´???ŒìŠ¤
      type: z.literal('api'),
      endpoint: z.string().min(1),
      method: z.enum(['GET', 'POST']).optional(),
    }),
    columns: z.array(tableColumnSchema),
    rowActions: z.array(z.string()).optional(),  // SDUI v1.1
    bulkActions: z.array(z.string()).optional(),  // SDUI v1.1
    pagination: z.object({
      pageSizeOptions: z.array(z.number()).optional(),  // SDUI v1.1
      defaultPageSize: z.number().min(1).optional(),  // SDUI v1.1
      pageSize: z.number().min(1).optional(),  // ?˜ìœ„ ?¸í™˜??    }).optional(),
    selection: z.enum(['none', 'single', 'multiple']).optional(),  // SDUI v1.1
    virtualization: z.boolean().optional(),
  }),
});

/**
 * Schema Validator
 * 
 * [ë¶ˆë? ê·œì¹™] ? í–‰ ?„ë“œ ì¡´ì¬??ê²€ì¦??¬í•¨
 */
export function validateSchema(schema: unknown): {
  valid: boolean;
  errors?: z.ZodError;
} {
  try {
    // Form Schema ê²€ì¦??œë„
    const parsed = formSchemaValidator.parse(schema) as FormSchema;
    
    // conditionê³?conditions ?™ì‹œ ?¬ìš© ê²€ì¦?    const conditionConflictFields: string[] = [];
    // ? í–‰ ?„ë“œ ì¡´ì¬??ê²€ì¦? condition/conditions?ì„œ ì°¸ì¡°?˜ëŠ” ?„ë“œê°€ ?¤í‚¤ë§ˆì— ë°˜ë“œ??ì¡´ì¬?´ì•¼ ??    const fieldNames = new Set(parsed.form.fields.map((f) => f.name));
    const missingFields: string[] = [];
    
    for (const field of parsed.form.fields) {
      // ? ï¸ ì¤‘ìš”: conditionê³?conditions???™ì‹œ???¬ìš©?????†ìŠµ?ˆë‹¤.
      // conditionsê°€ ?ˆëŠ” ê²½ìš° condition?€ ê¸ˆì??©ë‹ˆ??
      if (field.condition && field.conditions) {
        conditionConflictFields.push(`?„ë“œ "${field.name}"?ì„œ conditionê³?conditionsë¥??™ì‹œ???¬ìš©?????†ìŠµ?ˆë‹¤. conditionsê°€ ?ˆëŠ” ê²½ìš° condition?€ ê¸ˆì??©ë‹ˆ??`);
      }
      
      // ?¨ì¼ ì¡°ê±´ ê²€ì¦?      if (field.condition) {
        if (!fieldNames.has(field.condition.field)) {
          missingFields.push(`?„ë“œ "${field.name}"??condition??ì°¸ì¡°?˜ëŠ” ?„ë“œ "${field.condition.field}"ê°€ ?¤í‚¤ë§ˆì— ì¡´ì¬?˜ì? ?ŠìŠµ?ˆë‹¤.`);
        }
      }
      
      // ë³µìˆ˜ ì¡°ê±´ ê²€ì¦?      if (field.conditions) {
        for (const rule of field.conditions.conditions) {
          if (!fieldNames.has(rule.field)) {
            missingFields.push(`?„ë“œ "${field.name}"??conditionsê°€ ì°¸ì¡°?˜ëŠ” ?„ë“œ "${rule.field}"ê°€ ?¤í‚¤ë§ˆì— ì¡´ì¬?˜ì? ?ŠìŠµ?ˆë‹¤.`);
          }
        }
      }
    }
    
    if (conditionConflictFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: conditionConflictFields.join(' '),
          },
        ]),
      };
    }
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: new z.ZodError([
          {
            code: 'custom',
            path: [],
            message: missingFields.join(' '),
          },
        ]),
      };
    }
    
    return { valid: true };
  } catch (formError) {
    if (formError instanceof z.ZodError) {
      // Table Schema ê²€ì¦??œë„
      try {
        tableSchemaValidator.parse(schema);
        return { valid: true };
      } catch (tableError) {
        if (tableError instanceof z.ZodError) {
          return {
            valid: false,
            errors: tableError,
          };
        }
      }
    }
    return {
      valid: false,
      errors: formError as z.ZodError,
    };
  }
}

/**
 * Schema Version ì²´í¬
 * 
 * SDUI v1.1: minClientë¥??¬ìš©?˜ì—¬ ?´ë¼?´ì–¸??ë²„ì „ ?¸í™˜??ì²´í¬
 */
export function checkSchemaVersion(
  schema: SchemaVersion,
  clientVersion: string
): {
  compatible: boolean;
  requiresUpdate?: boolean;
  requiresMigration?: boolean;
} {
  // SDUI v1.1: minClientë¥??¬ìš©?˜ì—¬ ?´ë¼?´ì–¸??ë²„ì „ê³?ë¹„êµ
  const minClientVersion = schema.minClient;
  if (!minClientVersion) {
    // minClientê°€ ?†ìœ¼ë©??¸í™˜ ê°€?¥ìœ¼ë¡?ê°„ì£¼ (?˜ìœ„ ?¸í™˜??
    return { compatible: true };
  }

  const [minClientMajor, minClientMinor] = minClientVersion.split('.').map(Number);
  const [clientMajor, clientMinor] = clientVersion.split('.').map(Number);

  // ?´ë¼?´ì–¸??ë²„ì „??minClientë³´ë‹¤ ??œ¼ë©??…ë°?´íŠ¸ ?„ìš”
  if (clientMajor < minClientMajor || (clientMajor === minClientMajor && clientMinor < minClientMinor)) {
    return {
      compatible: false,
      requiresUpdate: true,
      requiresMigration: false,  // minClient ì²´í¬??Migrationê³?ë¬´ê?
    };
  }

  // ?¸í™˜ ê°€??  return { compatible: true };
}

