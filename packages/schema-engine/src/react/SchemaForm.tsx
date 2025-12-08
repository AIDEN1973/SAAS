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
import { useForm, UseFormReturn } from 'react-hook-form';
import { Grid, Button, Card } from '@ui-core/react';
import type { FormSchema } from '../types';
import { validateSchema } from '../validator';
import { SchemaField } from './SchemaField';
import { executeActionsForEvent, type ActionContext } from '../core/actionEngine';

export interface SchemaFormProps {
  schema: FormSchema;
  onSubmit?: (data: any) => void | Promise<void>;
  defaultValues?: Record<string, any>;
  className?: string;
  // SDUI v1.1: Action Engine 컨텍스트 (선택적)
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (선택적)
  translations?: Record<string, string>;
}

/**
 * SchemaForm 컴포넌트
 *
 * FormSchema를 React Hook Form과 통합하여 렌더링합니다.
 * SchemaField를 사용하여 개별 필드를 렌더링하고, Condition Rule을 지원합니다.
 */
export const SchemaForm: React.FC<SchemaFormProps> = ({
  schema,
  onSubmit,
  defaultValues,
  className,
  actionContext,
  translations = {},
}) => {
  // 1) Schema Validation
  const validation = validateSchema(schema);
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  // 2) React Hook Form 초기화
  // defaultValues는 스키마의 defaultValue와 병합
  const mergedDefaultValues = React.useMemo(() => {
    const schemaDefaults: Record<string, any> = {};
    schema.form.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        schemaDefaults[field.name] = field.defaultValue;
      }
    });
    return { ...schemaDefaults, ...defaultValues };
  }, [schema, defaultValues]);

  const form: UseFormReturn<any> = useForm({
    defaultValues: mergedDefaultValues,
  });

  const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // SDUI v1.1: Action Engine 컨텍스트 구성
  // ⚠️ 중요: watch()는 매번 호출되므로 formData는 최신 값을 반영합니다.
  // actionContext는 외부에서 주입되므로 의존성 배열에 포함합니다.
  const formData = watch();
  const fullActionContext: ActionContext = React.useMemo(() => ({
    formData,
    setFormValue: (field: string, value: any) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // 3) Submit 핸들러
  // SDUI v1.1: Action Engine 연동
  const onFormSubmit = async (data: any) => {
    try {
      // 스키마에 정의된 onSubmit 액션 실행 (form.actions 우선, 없으면 schema.actions)
      const actions = schema.form.actions || schema.actions;
      if (actions && actions.length > 0) {
        await executeActionsForEvent('onSubmit', actions, {
          ...fullActionContext,
          formData: data,
        });
      }

      // 기존 onSubmit 콜백 실행 (하위 호환성)
      if (onSubmit) {
        await onSubmit(data);
      }

      // onSubmitSuccess 액션 실행
      const successActions = schema.form.actions || schema.actions;
      if (successActions && successActions.length > 0) {
        await executeActionsForEvent('onSubmitSuccess', successActions, {
          ...fullActionContext,
          formData: data,
        });
      }
    } catch (error) {
      // onSubmitError 액션 실행
      const errorActions = schema.form.actions || schema.actions;
      if (errorActions && errorActions.length > 0) {
        await executeActionsForEvent('onSubmitError', errorActions, {
          ...fullActionContext,
          formData: data,
        });
      }
      throw error;
    }
  };

  const { form: formConfig } = schema;
  const layout = formConfig.layout;

  return (
    <Card padding={layout?.columnGap || 'md'} className={className}>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <Grid
          columns={layout?.columns === 'auto-fit' || layout?.columns === 'auto-fill'
            ? layout.columns
            : (typeof layout?.columns === 'number' ? Math.min(layout.columns, 12) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 : 1)}
          columnTemplate={layout?.columnTemplate}
          minColumnWidth={layout?.minColumnWidth}
          gap={layout?.columnGap || 'md'}
        >
          {formConfig.fields.map((field) => (
            <SchemaField
              key={field.name}
              field={field}
              register={register}
              errors={errors}
              control={control}
              translations={translations}
              setValue={setValue}
            />
          ))}
        </Grid>
        {formConfig.submit && (
          <Grid columns={1} gap="md" style={{ marginTop: 'var(--spacing-md)' }}>
            <Button
              type="submit"
              variant={formConfig.submit.variant}
              color={formConfig.submit.color}
              size={formConfig.submit.size}
            >
              {/* SDUI v1.1: i18n 키 지원 */}
              {formConfig.submit.labelKey
                ? (translations[formConfig.submit.labelKey] || formConfig.submit.labelKey)
                : (formConfig.submit.label || 'Submit')}
            </Button>
          </Grid>
        )}
      </form>
    </Card>
  );
};

/**
 * SchemaForm with form methods exposed
 *
 * useForm의 메서드를 외부에서 접근할 수 있도록 하는 고급 컴포넌트
 */
export interface SchemaFormWithMethodsProps extends SchemaFormProps {
  formRef?: React.RefObject<UseFormReturn<any>>;
}

export const SchemaFormWithMethods: React.FC<SchemaFormWithMethodsProps> = ({
  schema,
  onSubmit,
  defaultValues,
  formRef,
  className,
  actionContext,
  translations = {},
}) => {
  const validation = validateSchema(schema);
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  const mergedDefaultValues = React.useMemo(() => {
    const schemaDefaults: Record<string, any> = {};
    schema.form.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        schemaDefaults[field.name] = field.defaultValue;
      }
    });
    return { ...schemaDefaults, ...defaultValues };
  }, [schema, defaultValues]);

  const form = useForm({
    defaultValues: mergedDefaultValues,
  });

  // formRef에 form 인스턴스 할당
  React.useImperativeHandle(formRef, () => form, [form]);

  const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // SDUI v1.1: Action Engine 컨텍스트 구성
  // ⚠️ 중요: watch()는 매번 호출되므로 formData는 최신 값을 반영합니다.
  // actionContext는 외부에서 주입되므로 의존성 배열에 포함합니다.
  const formData = watch();
  const fullActionContext: ActionContext = React.useMemo(() => ({
    formData,
    setFormValue: (field: string, value: any) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // SDUI v1.1: Action Engine 연동
  const onFormSubmit = async (data: any) => {
    try {
      // 스키마에 정의된 onSubmit 액션 실행 (form.actions 우선, 없으면 schema.actions)
      const actions = schema.form.actions || schema.actions;
      if (actions && actions.length > 0) {
        await executeActionsForEvent('onSubmit', actions, {
          ...fullActionContext,
          formData: data,
        });
      }

      // 기존 onSubmit 콜백 실행 (하위 호환성)
      if (onSubmit) {
        await onSubmit(data);
      }

      // onSubmitSuccess 액션 실행
      const successActions = schema.form.actions || schema.actions;
      if (successActions && successActions.length > 0) {
        await executeActionsForEvent('onSubmitSuccess', successActions, {
          ...fullActionContext,
          formData: data,
        });
      }
    } catch (error) {
      // onSubmitError 액션 실행
      const errorActions = schema.form.actions || schema.actions;
      if (errorActions && errorActions.length > 0) {
        await executeActionsForEvent('onSubmitError', errorActions, {
          ...fullActionContext,
          formData: data,
        });
      }
      throw error;
    }
  };

  const { form: formConfig } = schema;
  const layout = formConfig.layout;

  return (
    <Card padding={layout?.columnGap || 'md'} className={className}>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <Grid
          columns={layout?.columns === 'auto-fit' || layout?.columns === 'auto-fill'
            ? layout.columns
            : (typeof layout?.columns === 'number' ? Math.min(layout.columns, 12) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 : 1)}
          columnTemplate={layout?.columnTemplate}
          minColumnWidth={layout?.minColumnWidth}
          gap={layout?.columnGap || 'md'}
        >
          {formConfig.fields.map((field) => (
            <SchemaField
              key={field.name}
              field={field}
              register={register}
              errors={errors}
              control={control}
              translations={translations}
              setValue={setValue}
            />
          ))}
        </Grid>
        {formConfig.submit && (
          <Grid columns={1} gap="md" style={{ marginTop: 'var(--spacing-md)' }}>
            <Button
              type="submit"
              variant={formConfig.submit.variant}
              color={formConfig.submit.color}
              size={formConfig.submit.size}
            >
              {/* SDUI v1.1: i18n 키 지원 */}
              {formConfig.submit.labelKey
                ? (translations[formConfig.submit.labelKey] || formConfig.submit.labelKey)
                : (formConfig.submit.label || 'Submit')}
            </Button>
          </Grid>
        )}
      </form>
    </Card>
  );
};

