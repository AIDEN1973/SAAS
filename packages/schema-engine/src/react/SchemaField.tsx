/**
 * SchemaField Component
 * 
 * [ë¶ˆë? ê·œì¹™] React Hook Formê³??µí•©??Schema Field Renderer
 * [ë¶ˆë? ê·œì¹™] Condition Rule ê¸°ë°˜ ?™ì  UI ?Œë”ë§? * [ë¶ˆë? ê·œì¹™] Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?Šê³ , core-ui ì»´í¬?ŒíŠ¸ë§??¬ìš©
 * 
 * ê¸°ìˆ ë¬¸ì„œ: docu/?¤í‚¤ë§ˆì—”ì§?txt 8. Renderer ?µí•©
 */

import React from 'react';
import {
  useWatch,
  Controller,
  UseFormRegister,
  Control,
  FieldErrors,
  UseFormSetValue,
} from 'react-hook-form';
import { getConditionalActions } from '../core/conditionEvaluator';
import { buildValidationRules } from '../core/validation';
import type { FormFieldSchema } from '../types';
import { loadWidget } from '../widgets/registry';
import {
  Input,
  Select,
  Checkbox,
  DatePicker,
  FormFieldLayout,
  FormField,
  Textarea,
  Radio,
  Card,
} from '@ui-core/react';
// ? ï¸ ì°¸ê³ : Input ì»´í¬?ŒíŠ¸??TextInput????• ???˜í–‰?©ë‹ˆ??
// ê¸°ìˆ ë¬¸ì„œ?ì„œ??TextInput?¼ë¡œ ëª…ì‹œ?˜ì–´ ?ˆìœ¼?? ?¤ì œ êµ¬í˜„?€ Input ì»´í¬?ŒíŠ¸ë¥??¬ìš©?©ë‹ˆ??

export interface SchemaFieldProps {
  field: FormFieldSchema;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  control: Control<any>;
  // SDUI v1.1: i18n ë²ˆì—­ (? íƒ?? Loader ?¨ê³„?ì„œ ë°”ì¸?©ë˜ì§€ ?Šì? ê²½ìš° ?¬ìš©)
  translations?: Record<string, string>;
  // SDUI v1.1: ?™ì  ?„ë“œ ê°??¤ì • (setValue ?¡ì…˜??
  setValue?: UseFormSetValue<any>;
}

/**
 * SchemaField ì»´í¬?ŒíŠ¸
 * 
 * FormFieldSchemaë¥?React Hook Formê³??µí•©?˜ì—¬ ?Œë”ë§í•©?ˆë‹¤.
 * Condition Rule??ì§€?í•˜???™ì ?¼ë¡œ hidden/disabled/required ?íƒœë¥??œì–´?©ë‹ˆ??
 * 
 * ? ï¸ ?±ëŠ¥ ìµœì ?? React.memoë¡?ê°ì‹¸??ë¶ˆí•„?”í•œ ë¦¬ë Œ?”ë§??ë°©ì??©ë‹ˆ??
 * useWatch??ê°ì‹œ ?„ë“œê°€ ë³€?˜ë©´ ?´ë‹¹ SchemaField ì»´í¬?ŒíŠ¸ê°€ ë¦¬ë Œ?”ë˜ë¯€ë¡?
 * ?„ë“œê°€ 100ê°??´ìƒ?´ë©´ ?±ëŠ¥ ë¬¸ì œê°€ ë°œìƒ?????ˆìŠµ?ˆë‹¤.
 */
const SchemaFieldComponent: React.FC<SchemaFieldProps> = ({
  field,
  register,
  errors,
  control,
  translations = {},
  setValue: setFormValue,
}) => {
  const { name, kind, ui, options } = field;
  
  // SDUI v1.1: i18n ??ì²˜ë¦¬ (Loader ?¨ê³„?ì„œ ë°”ì¸?©ë˜ì§€ ?Šì? ê²½ìš°)
  // labelKeyê°€ ?ˆìœ¼ë©?translations?ì„œ ì¡°íšŒ, ?†ìœ¼ë©?ê¸°ì¡´ label ?¬ìš©
  const label = ui?.labelKey ? (translations[ui.labelKey] || ui.labelKey) : ui?.label;
  const placeholder = ui?.placeholderKey ? (translations[ui.placeholderKey] || ui.placeholderKey) : ui?.placeholder;
  const description = ui?.descriptionKey ? (translations[ui.descriptionKey] || ui.descriptionKey) : ui?.description;
  
  // 1) ì¡°ê±´ë¶€ ?„ë“œ ê°ì‹œ
  // ?¨ì¼ ì¡°ê±´ ?ëŠ” ë³µìˆ˜ ì¡°ê±´?ì„œ ì°¸ì¡°?˜ëŠ” ëª¨ë“  ?„ë“œë¥?ê°ì‹œ
  const fieldsToWatch = React.useMemo(() => {
    const fields = new Set<string>();
    if (field.condition) {
      fields.add(field.condition.field);
    }
    if (field.conditions) {
      field.conditions.conditions.forEach((rule) => {
        fields.add(rule.field);
      });
    }
    return Array.from(fields);
  }, [field.condition, field.conditions]);

  // ëª¨ë“  ì°¸ì¡° ?„ë“œ ê°?ê´€ì°?  // ? ï¸ ìµœì ?? ì¡°ê±´???†ëŠ” ?„ë“œ??useWatchë¥??¸ì¶œ?˜ì? ?ŠìŒ
  // fieldsToWatch.length === 0?´ë©´ name: []ë¡??„ë‹¬?˜ì—¬ ???„ì²´ êµ¬ë… ë°©ì?
  const hasConditions = fieldsToWatch.length > 0;
  
  const watched = useWatch({
    control,
    name: hasConditions ? fieldsToWatch : [],  // ì¡°ê±´???†ìœ¼ë©?ë¹?ë°°ì—´ë¡??„ë‹¬ (???„ì²´ êµ¬ë… ë°©ì?)
  });
  
  const watchedValues = React.useMemo(() => {
    if (!hasConditions) return {} as Record<string, any>;
    // watchedê°€ ë°°ì—´??ê²½ìš° ?„ë“œëª…ê³¼ ë§¤í•‘
    if (Array.isArray(watched)) {
      return fieldsToWatch.reduce((acc, key, idx) => {
        acc[key] = watched[idx];
        return acc;
      }, {} as Record<string, any>);
    }
    // watchedê°€ ê°ì²´??ê²½ìš° (?¨ì¼ ?„ë“œ)
    return watched as Record<string, any>;
  }, [watched, hasConditions, fieldsToWatch]);

  // 2) ì¡°ê±´ ?‰ê?
  // ? ï¸ ì¤‘ìš”: getConditionalActions??field.conditionsë¥??°ì„  ì²˜ë¦¬?˜ê³ , ?†ìœ¼ë©?field.condition??ì²˜ë¦¬?©ë‹ˆ??
  // ?°ë¼????ƒ ?¸ì¶œ?´ì•¼ ?˜ë©°, field.conditionë§?ì²´í¬?˜ë©´ ???©ë‹ˆ??
  const { isHidden, isDisabled, isRequired, actions: conditionalActions } = getConditionalActions(field, watchedValues);

  // SDUI v1.1: ?™ì  ?µì…˜ ì²˜ë¦¬ (setOptions ?¡ì…˜)
  // ? ï¸ ì¤‘ìš”: dynamicOptions??API ê¸°ë°˜ ?µì…˜ë§??€?¥í•˜ë©? ì´ˆê¸°ê°’ì? undefined?…ë‹ˆ??
  // static ?µì…˜?€ effectiveOptions?ì„œ ì§ì ‘ ?¬ìš©?©ë‹ˆ??
  const [dynamicOptions, setDynamicOptions] = React.useState<Array<{ value: string; labelKey?: string; label?: string }> | undefined>(undefined);
  
  // effectiveOptions: conditionalActions.setOptionsê°€ ?ˆìœ¼ë©??°ì„ , ?†ìœ¼ë©?field.options
  const effectiveOptions = React.useMemo(() => {
    if (conditionalActions && conditionalActions.setOptions) {
      if (conditionalActions.setOptions.type === 'static' && conditionalActions.setOptions.options) {
        return conditionalActions.setOptions.options;
      }
      // API ê¸°ë°˜ ?µì…˜?€ dynamicOptions ?íƒœë¡?ê´€ë¦?      if (conditionalActions.setOptions.type === 'api' && dynamicOptions) {
        return dynamicOptions;
      }
    }
    return options;
  }, [conditionalActions?.setOptions, dynamicOptions, options]);

  // SDUI v1.1: setOptions API ?¸ì¶œ ì²˜ë¦¬
  // ? ï¸ ì¤‘ìš”: ?˜ì¡´??ë°°ì—´?€ endpoint?€ typeë§?ì¶”ì¶œ?˜ì—¬ ?ˆì •?ìœ¼ë¡?ê´€ë¦?  const setOptionsConfig = conditionalActions?.setOptions;
  const setOptionsEndpoint = setOptionsConfig?.type === 'api' ? setOptionsConfig.endpoint : undefined;
  const setOptionsType = setOptionsConfig?.type;
  
  React.useEffect(() => {
    if (setOptionsType === 'api' && setOptionsEndpoint) {
      const endpoint = setOptionsEndpoint; // ?€??ê°€?? ???œì ?ì„œ endpoint??string
      let mounted = true;
      async function loadOptions() {
        try {
          // ? ï¸ ì¤‘ìš”: Zero-Trust ?ì¹™ - @api-sdk/core??apiClientë§??¬ìš©
          // apiClientê°€ ?†ìœ¼ë©??µì…˜ ë¡œë“œ ?¤íŒ¨ (fetch fallback ?œê±°)
          const { apiClient } = await import('@api-sdk/core');
          const res = await apiClient.get(endpoint);
          const data = (res as any).data ?? res;
          
          if (mounted && Array.isArray(data)) {
            setDynamicOptions(
              data.map((item: any) => ({
                value: item.value ?? item.id ?? String(item),
                label: item.label ?? item.name ?? String(item),
                labelKey: item.labelKey,
              })),
            );
          }
        } catch (error) {
          // ? ï¸ ì¤‘ìš”: apiClientê°€ ?†ìœ¼ë©??µì…˜ ë¡œë“œ ?¤íŒ¨ (Zero-Trust ?ì¹™)
          console.error(`[Schema Engine] Failed to load options from API: ${endpoint}. apiClient not available.`, error);
          // ?µì…˜?€ ê¸°ì¡´ field.options ? ì? (dynamicOptions??undefinedë¡?? ì?)
        }
      }
      loadOptions();
      return () => {
        mounted = false;
      };
    } else {
      // setOptionsê°€ ?†ê±°??static ?€?…ì´ë©?dynamicOptions ì´ˆê¸°??      setDynamicOptions(undefined);
    }
  }, [setOptionsEndpoint, setOptionsType]);

  // SDUI v1.1: setValue ?¡ì…˜ ì²˜ë¦¬
  React.useEffect(() => {
    if (conditionalActions?.setValue !== undefined && setFormValue) {
      setFormValue(name, conditionalActions.setValue, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [conditionalActions?.setValue, name, setFormValue]);

  // SDUI v1.1: switchComponent ì²˜ë¦¬
  const effectiveComponentType = conditionalActions?.switchComponent?.to || field.customComponentType;

  if (isHidden) return null;

  // 3) Validation rule ?™ì  ?ìš©
  // ? ï¸ ì¤‘ìš”: ?™ì  required???•ì  requiredë³´ë‹¤ ?°ì„ ?©ë‹ˆ??
  // BaseRules???´ë? required ?µì…˜???ˆì–´?? Condition Rule???˜í•œ ?™ì  requiredê°€ ??–´?ë‹ˆ??
  const baseRules = buildValidationRules(field);
  const finalRules = isRequired
    ? { ...baseRules, required: '?„ìˆ˜ ?…ë ¥ ??ª©?…ë‹ˆ??' }
    : baseRules;

  const error = errors[name]?.message as string | undefined;
  
  // ? ï¸ ì¤‘ìš”: Tailwind ?´ë˜?¤ë? ì§ì ‘ ?¬ìš©?˜ì? ?Šê³ , props ê¸°ë°˜?¼ë¡œ core-ui???„ë‹¬
  // ?¤í‚¤ë§ˆëŠ” ?¼ë¦¬??êµ¬ì¡°ë§??•ì˜?˜ê³ , ?¤í??¼ì? core-uiê°€ ?´ë‹¹?©ë‹ˆ??
  // ê¸°ìˆ ë¬¸ì„œ UI ë¬¸ì„œ 2.3 "schema-engine ??core-ui ?µì‹  ë°©ì‹" ì°¸ì¡°
  // Renderer??layout??êµ¬ì¡°???„ë‹¬ë§??˜í–‰?˜ê³  ?¤í??¼ì„ ì§ì ‘ ?¤ë£¨ì§€ ?Šì•„???©ë‹ˆ??
  const colSpan = ui?.colSpan ?? 12;
  
  // ?? 4) ê°??„ë“œ ?Œë”ë§ì— isDisabled ?ìš©

  // text/email/phone/password ??register
  if (['text', 'email', 'phone', 'password'].includes(kind)) {
    const inputType =
      kind === 'email'
        ? 'email'
        : kind === 'phone'
        ? 'tel'
        : kind === 'password'
        ? 'password'
        : 'text';
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Input
          type={inputType}
          label={label}
          placeholder={placeholder}
          error={error}
          disabled={isDisabled}
          fullWidth
          {...register(name, finalRules)}
        />
      </FormFieldLayout>
    );
  }

  // number ??register
  if (kind === 'number') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Input
          type="number"
          label={label}
          placeholder={placeholder}
          error={error}
          disabled={isDisabled}
          fullWidth
          {...register(name, finalRules)}
        />
      </FormFieldLayout>
    );
  }

  // textarea ??register
  if (kind === 'textarea') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Textarea
          label={label}
          placeholder={placeholder}
          error={error}
          disabled={isDisabled}
          fullWidth
          {...register(name, finalRules)}
        />
      </FormFieldLayout>
    );
  }

  // select / multiselect ??Controller
  if (kind === 'select' || kind === 'multiselect') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Select
              label={label}
              error={error}
              disabled={isDisabled}
              fullWidth
              value={f.value ?? (kind === 'multiselect' ? [] : '')}
              onChange={f.onChange}
              onBlur={f.onBlur}
              multiple={kind === 'multiselect'}
            >
              {effectiveOptions?.map((opt) => {
                const translatedLabel = opt.labelKey ? (translations[opt.labelKey] || opt.labelKey) : opt.label;
                return (
                  <option key={opt.value} value={opt.value}>
                    {translatedLabel}
                  </option>
                );
              })}
            </Select>
          )}
        />
      </FormFieldLayout>
    );
  }

  // radio ??Controller (?¬ëŸ¬ ?µì…˜ ì¤??˜ë‚˜ ? íƒ)
  if (kind === 'radio') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <FormField
          label={label}
          error={error}
          required={isRequired}
        >
          <Controller
            name={name}
            control={control}
            rules={finalRules}
            render={({ field: f }) => (
              <div>
                {effectiveOptions?.map((opt) => {
                  const translatedLabel = opt.labelKey ? (translations[opt.labelKey] || opt.labelKey) : opt.label;
                  return (
                    <Radio
                      key={opt.value}
                      label={translatedLabel}
                      value={opt.value}
                      checked={f.value === opt.value}
                      onChange={(e) => {
                        if (e.target.checked) {
                          f.onChange(opt.value);
                        }
                      }}
                      onBlur={f.onBlur}
                      disabled={isDisabled}
                      fullWidth
                    />
                  );
                })}
              </div>
            )}
          />
        </FormField>
      </FormFieldLayout>
    );
  }

  // checkbox
  if (kind === 'checkbox') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <Checkbox
              label={label}
              checked={!!f.value}
              onChange={(e) => f.onChange(e.target.checked)}
              disabled={isDisabled}
              fullWidth
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // date
  if (kind === 'date') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <DatePicker
              label={label}
              value={f.value}
              onChange={f.onChange}
              disabled={isDisabled}
              error={error}
              fullWidth
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // datetime
  if (kind === 'datetime') {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Controller
          name={name}
          control={control}
          rules={finalRules}
          render={({ field: f }) => (
            <DatePicker
              label={label}
              value={f.value}
              onChange={f.onChange}
              disabled={isDisabled}
              error={error}
              fullWidth
              dateTime={true}
            />
          )}
        />
      </FormFieldLayout>
    );
  }

  // SDUI v1.1: Custom Widget ì§€??(?™ì  ë¡œë”©)
  if (kind === 'custom' && effectiveComponentType) {
    return (
      <CustomWidgetField
        componentType={effectiveComponentType}
        field={field}
        colSpan={colSpan}
        control={control}
        errors={errors}
        isDisabled={isDisabled}
        finalRules={finalRules}
        translations={translations}
      />
    );
  }

  return null;
};

/**
 * Custom Widget Field Component
 * 
 * SDUI v1.1: Custom Widget???™ì ?¼ë¡œ ë¡œë“œ?˜ì—¬ ?Œë”ë§í•©?ˆë‹¤.
 */
const CustomWidgetField: React.FC<{
  componentType: string;
  field: FormFieldSchema;
  colSpan: number;
  control: Control<any>;
  errors: FieldErrors<any>;
  isDisabled: boolean;
  finalRules: any;
  translations?: Record<string, string>;
}> = ({ componentType, field, colSpan, control, errors, isDisabled, finalRules, translations = {} }) => {
  const [CustomComponent, setCustomComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadComponent() {
      try {
        setLoading(true);
        setError(null);
        
        // SDUI v1.1: Widget Not Found ì²˜ë¦¬ ê°•í™”
        const Component = await loadWidget(componentType);
        
        if (mounted) {
          if (!Component) {
            // Widget???ˆì??¤íŠ¸ë¦¬ì— ?†ê±°??ë¡œë“œ ?¤íŒ¨
            const registeredWidgets = await import('../widgets/registry').then(m => m.getRegisteredWidgets());
            setError(new Error(
              `Widget "${componentType}" not found in registry. ` +
              `Registered widgets: ${registeredWidgets.length > 0 ? registeredWidgets.join(', ') : 'none'}. ` +
              `Please register the widget using registerWidget() or check the componentType.`
            ));
            setCustomComponent(null);
          } else {
            setCustomComponent(() => Component);
            setError(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setCustomComponent(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadComponent();

    return () => {
      mounted = false;
    };
  }, [componentType]);

  if (loading) {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <div>?„ì ¯ ë¡œë”© ì¤? {componentType}...</div>
      </FormFieldLayout>
    );
  }

  if (error || !CustomComponent) {
    return (
      <FormFieldLayout colSpan={colSpan}>
        <Card
          variant="outlined"
          padding="md"
          style={{
            borderColor: 'var(--color-error)',
            backgroundColor: 'var(--color-error-light)',
          }}
        >
          <div>
            <strong style={{ color: 'var(--color-error)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>
              ?„ì ¯ ë¡œë“œ ?¤íŒ¨: {componentType}
            </strong>
            {error && (
              <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                {error.message}
              </div>
            )}
            <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              ???„ë“œ???Œë”ë§ë˜ì§€ ?ŠìŠµ?ˆë‹¤. ?¤í‚¤ë§ˆì˜ customComponentType???•ì¸?˜ê±°???„ì ¯???±ë¡?´ì£¼?¸ìš”.
            </div>
          </div>
        </Card>
      </FormFieldLayout>
    );
  }

  // Custom Widget???„ë‹¬??props
  const widgetProps = {
    name: field.name,
    label: field.ui?.label,
    labelKey: field.ui?.labelKey,
    placeholder: field.ui?.placeholder,
    placeholderKey: field.ui?.placeholderKey,
    disabled: isDisabled,
    error: errors[field.name]?.message as string | undefined,
    control,
    rules: finalRules,
    value: undefined, // Controller?ì„œ ê´€ë¦?    onChange: undefined, // Controller?ì„œ ê´€ë¦?    // ì¶”ê? ?„ë“œ ?ì„± ?„ë‹¬
    defaultValue: field.defaultValue,
    options: field.options,
  };

  return (
    <FormFieldLayout colSpan={colSpan}>
      <Controller
        name={field.name}
        control={control}
        rules={finalRules}
        render={({ field: f }) => (
          <CustomComponent
            {...widgetProps}
            value={f.value}
            onChange={f.onChange}
            onBlur={f.onBlur}
          />
        )}
      />
    </FormFieldLayout>
  );
};

// ? ï¸ ?±ëŠ¥ ìµœì ?? React.memoë¡?ê°ì‹¸??ë¶ˆí•„?”í•œ ë¦¬ë Œ?”ë§ ë°©ì?
export const SchemaField = React.memo(SchemaFieldComponent);

