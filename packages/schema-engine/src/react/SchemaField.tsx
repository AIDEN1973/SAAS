/**
 * SchemaField Component
 * 
 * [불변 규칙] React Hook Form과 통합된 Schema Field Renderer
 * [불변 규칙] Condition Rule 기반 동적 UI 렌더링
 * [불변 규칙] Tailwind 클래스를 직접 사용하지 않고, core-ui 컴포넌트만 사용
 * 
 * 기술문서: docu/스키마엔진.txt 8. Renderer 통합
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
// ⚠️ 참고: Input 컴포넌트는 TextInput의 역할을 수행합니다.
// 기술문서에서는 TextInput으로 명시되어 있으나, 실제 구현은 Input 컴포넌트를 사용합니다.

export interface SchemaFieldProps {
  field: FormFieldSchema;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  control: Control<any>;
  // SDUI v1.1: i18n 번역 (선택적, Loader 단계에서 바인딩되지 않은 경우 사용)
  translations?: Record<string, string>;
  // SDUI v1.1: 동적 필드 값 설정 (setValue 액션용)
  setValue?: UseFormSetValue<any>;
}

/**
 * SchemaField 컴포넌트
 * 
 * FormFieldSchema를 React Hook Form과 통합하여 렌더링합니다.
 * Condition Rule을 지원하여 동적으로 hidden/disabled/required 상태를 제어합니다.
 * 
 * ⚠️ 성능 최적화: React.memo로 감싸서 불필요한 리렌더링을 방지합니다.
 * useWatch는 감시 필드가 변하면 해당 SchemaField 컴포넌트가 리렌더되므로,
 * 필드가 100개 이상이면 성능 문제가 발생할 수 있습니다.
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
  
  // SDUI v1.1: i18n 키 처리 (Loader 단계에서 바인딩되지 않은 경우)
  // labelKey가 있으면 translations에서 조회, 없으면 기존 label 사용
  const label = ui?.labelKey ? (translations[ui.labelKey] || ui.labelKey) : ui?.label;
  const placeholder = ui?.placeholderKey ? (translations[ui.placeholderKey] || ui.placeholderKey) : ui?.placeholder;
  // const description = ui?.descriptionKey ? (translations[ui.descriptionKey] || ui.descriptionKey) : ui?.description; // TODO: 향후 사용 예정
  
  // 1) 조건부 필드 감시
  // 단일 조건 또는 복수 조건에서 참조하는 모든 필드를 감시
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

  // 모든 참조 필드 값 관찰
  // ⚠️ 최적화: 조건이 없는 필드는 useWatch를 호출하지 않음
  // fieldsToWatch.length === 0이면 name: []로 전달하여 폼 전체 구독 방지
  const hasConditions = fieldsToWatch.length > 0;
  
  const watched = useWatch({
    control,
    name: hasConditions ? fieldsToWatch : [],  // 조건이 없으면 빈 배열로 전달 (폼 전체 구독 방지)
  });
  
  const watchedValues = React.useMemo(() => {
    if (!hasConditions) return {} as Record<string, any>;
    // watched가 배열인 경우 필드명과 매핑
    if (Array.isArray(watched)) {
      return fieldsToWatch.reduce((acc, key, idx) => {
        acc[key] = watched[idx];
        return acc;
      }, {} as Record<string, any>);
    }
    // watched가 객체인 경우 (단일 필드)
    return watched as Record<string, any>;
  }, [watched, hasConditions, fieldsToWatch]);

  // 2) 조건 평가
  // ⚠️ 중요: getConditionalActions는 field.conditions를 우선 처리하고, 없으면 field.condition을 처리합니다.
  // 따라서 항상 호출해야 하며, field.condition만 체크하면 안 됩니다.
  const { isHidden, isDisabled, isRequired, actions: conditionalActions } = getConditionalActions(field, watchedValues);

  // SDUI v1.1: 동적 옵션 처리 (setOptions 액션)
  // ⚠️ 중요: dynamicOptions는 API 기반 옵션만 저장하며, 초기값은 undefined입니다.
  // static 옵션은 effectiveOptions에서 직접 사용합니다.
  const [dynamicOptions, setDynamicOptions] = React.useState<Array<{ value: string; labelKey?: string; label?: string }> | undefined>(undefined);
  
  // effectiveOptions: conditionalActions.setOptions가 있으면 우선, 없으면 field.options
  const effectiveOptions = React.useMemo(() => {
    if (conditionalActions && conditionalActions.setOptions) {
      if (conditionalActions.setOptions.type === 'static' && conditionalActions.setOptions.options) {
        return conditionalActions.setOptions.options;
      }
      // API 기반 옵션은 dynamicOptions 상태로 관리
      if (conditionalActions.setOptions.type === 'api' && dynamicOptions) {
        return dynamicOptions;
      }
    }
    return options;
  }, [conditionalActions?.setOptions, dynamicOptions, options]);

  // SDUI v1.1: setOptions API 호출 처리
  // ⚠️ 중요: 의존성 배열은 endpoint와 type만 추출하여 안정적으로 관리
  const setOptionsConfig = conditionalActions?.setOptions;
  const setOptionsEndpoint = setOptionsConfig?.type === 'api' ? setOptionsConfig.endpoint : undefined;
  const setOptionsType = setOptionsConfig?.type;
  
  React.useEffect(() => {
    if (setOptionsType === 'api' && setOptionsEndpoint) {
      const endpoint = setOptionsEndpoint; // 타입 가드: 이 시점에서 endpoint는 string
      let mounted = true;
      async function loadOptions() {
        try {
          // ⚠️ 중요: Zero-Trust 원칙 - @api-sdk/core의 apiClient만 사용
          // apiClient가 없으면 옵션 로드 실패 (fetch fallback 제거)
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
          // ⚠️ 중요: apiClient가 없으면 옵션 로드 실패 (Zero-Trust 원칙)
          console.error(`[Schema Engine] Failed to load options from API: ${endpoint}. apiClient not available.`, error);
          // 옵션은 기존 field.options 유지 (dynamicOptions는 undefined로 유지)
        }
      }
      loadOptions();
      return () => {
        mounted = false;
      };
    } else {
      // setOptions가 없거나 static 타입이면 dynamicOptions 초기화
      setDynamicOptions(undefined);
    }
  }, [setOptionsEndpoint, setOptionsType]);

  // SDUI v1.1: setValue 액션 처리
  React.useEffect(() => {
    if (conditionalActions?.setValue !== undefined && setFormValue) {
      setFormValue(name, conditionalActions.setValue, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [conditionalActions?.setValue, name, setFormValue]);

  // SDUI v1.1: switchComponent 처리
  const effectiveComponentType = conditionalActions?.switchComponent?.to || field.customComponentType;

  if (isHidden) return null;

  // 3) Validation rule 동적 적용
  // ⚠️ 중요: 동적 required는 정적 required보다 우선합니다.
  // BaseRules에 이미 required 옵션이 있어도, Condition Rule에 의한 동적 required가 덮어씁니다.
  const baseRules = buildValidationRules(field);
  const finalRules = isRequired
    ? { ...baseRules, required: '필수 입력 항목입니다.' }
    : baseRules;

  const error = errors[name]?.message as string | undefined;
  
  // ⚠️ 중요: Tailwind 클래스를 직접 사용하지 않고, props 기반으로 core-ui에 전달
  // 스키마는 논리적 구조만 정의하고, 스타일은 core-ui가 담당합니다.
  // 기술문서 UI 문서 2.3 "schema-engine ↔ core-ui 통신 방식" 참조
  // Renderer는 layout의 구조적 전달만 수행하고 스타일을 직접 다루지 않아야 합니다.
  const colSpan = ui?.colSpan ?? 12;
  
  // 🍀 4) 각 필드 렌더링에 isDisabled 적용

  // text/email/phone/password → register
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

  // number → register
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

  // textarea → register
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

  // select / multiselect → Controller
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

  // radio → Controller (여러 옵션 중 하나 선택)
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

  // SDUI v1.1: Custom Widget 지원 (동적 로딩)
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
 * SDUI v1.1: Custom Widget을 동적으로 로드하여 렌더링합니다.
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
}> = ({ componentType, field, colSpan, control, errors, isDisabled, finalRules, translations: _translations = {} }) => {
  const [CustomComponent, setCustomComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function loadComponent() {
      try {
        setLoading(true);
        setError(null);
        
        // SDUI v1.1: Widget Not Found 처리 강화
        const Component = await loadWidget(componentType);
        
        if (mounted) {
          if (!Component) {
            // Widget이 레지스트리에 없거나 로드 실패
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
        <div>위젯 로딩 중: {componentType}...</div>
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
              위젯 로드 실패: {componentType}
            </strong>
            {error && (
              <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                {error.message}
              </div>
            )}
            <div style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              이 필드는 렌더링되지 않습니다. 스키마의 customComponentType을 확인하거나 위젯을 등록해주세요.
            </div>
          </div>
        </Card>
      </FormFieldLayout>
    );
  }

  // Custom Widget에 전달할 props
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
    value: undefined, // Controller에서 관리
    onChange: undefined, // Controller에서 관리
    // 추가 필드 속성 전달
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

// ⚠️ 성능 최적화: React.memo로 감싸서 불필요한 리렌더링 방지
export const SchemaField = React.memo(SchemaFieldComponent);

