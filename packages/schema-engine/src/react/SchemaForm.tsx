/**
 * SchemaForm Component
 * 
 * [ë¶ˆë? ê·œì¹™] React Hook Formê³??µí•©??FormSchema Renderer
 * [ë¶ˆë? ê·œì¹™] SchemaFieldë¥??¬ìš©?˜ì—¬ ê°œë³„ ?„ë“œ ?Œë”ë§? * [ë¶ˆë? ê·œì¹™] Grid ?ˆì´?„ì›ƒ ?ìš©
 * [ë¶ˆë? ê·œì¹™] SDUI v1.1: Action Engine ?°ë™, i18n ??ì§€?? * 
 * ê¸°ìˆ ë¬¸ì„œ: 
 * - docu/?¤í‚¤ë§ˆì—”ì§?txt 8. Renderer ?µí•©
 * - SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 10. Form Engine
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
  // SDUI v1.1: Action Engine ì»¨í…?¤íŠ¸ (? íƒ??
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n ë²ˆì—­ (? íƒ??
  translations?: Record<string, string>;
}

/**
 * SchemaForm ì»´í¬?ŒíŠ¸
 * 
 * FormSchemaë¥?React Hook Formê³??µí•©?˜ì—¬ ?Œë”ë§í•©?ˆë‹¤.
 * SchemaFieldë¥??¬ìš©?˜ì—¬ ê°œë³„ ?„ë“œë¥??Œë”ë§í•˜ê³? Condition Rule??ì§€?í•©?ˆë‹¤.
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

  // 2) React Hook Form ì´ˆê¸°??  // defaultValues???¤í‚¤ë§ˆì˜ defaultValue?€ ë³‘í•©
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

  // SDUI v1.1: Action Engine ì»¨í…?¤íŠ¸ êµ¬ì„±
  // ? ï¸ ì¤‘ìš”: watch()??ë§¤ë²ˆ ?¸ì¶œ?˜ë?ë¡?formData??ìµœì‹  ê°’ì„ ë°˜ì˜?©ë‹ˆ??
  // actionContext???¸ë??ì„œ ì£¼ì…?˜ë?ë¡??˜ì¡´??ë°°ì—´???¬í•¨?©ë‹ˆ??
  const formData = watch();
  const fullActionContext: ActionContext = React.useMemo(() => ({
    formData,
    setFormValue: (field: string, value: any) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // 3) Submit ?¸ë“¤??  // SDUI v1.1: Action Engine ?°ë™
  const onFormSubmit = async (data: any) => {
    try {
      // ?¤í‚¤ë§ˆì— ?•ì˜??onSubmit ?¡ì…˜ ?¤í–‰ (form.actions ?°ì„ , ?†ìœ¼ë©?schema.actions)
      const actions = schema.form.actions || schema.actions;
      if (actions && actions.length > 0) {
        await executeActionsForEvent('onSubmit', actions, {
          ...fullActionContext,
          formData: data,
        });
      }

      // ê¸°ì¡´ onSubmit ì½œë°± ?¤í–‰ (?˜ìœ„ ?¸í™˜??
      if (onSubmit) {
        await onSubmit(data);
      }

      // onSubmitSuccess ?¡ì…˜ ?¤í–‰
      const successActions = schema.form.actions || schema.actions;
      if (successActions && successActions.length > 0) {
        await executeActionsForEvent('onSubmitSuccess', successActions, {
          ...fullActionContext,
          formData: data,
        });
      }
    } catch (error) {
      // onSubmitError ?¡ì…˜ ?¤í–‰
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
          // ? ï¸ ì°¸ê³ : Grid ì»´í¬?ŒíŠ¸???„ì¬ 1-4ê¹Œì?ë§?ì§€?í•˜ì§€ë§? ?¤í‚¤ë§ˆì—?œëŠ” 1-12ë¥??ˆìš©?©ë‹ˆ??
          // 5 ?´ìƒ??ê°’ì? 4ë¡??œí•œ?©ë‹ˆ?? ?¥í›„ core-ui Grid ì»´í¬?ŒíŠ¸ê°€ ?•ì¥?˜ë©´ ?œê±° ?ˆì •.
          columns={Math.min((layout?.columns || 1), 4) as 1 | 2 | 3 | 4}
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
              {/* SDUI v1.1: i18n ??ì§€??*/}
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
 * useForm??ë©”ì„œ?œë? ?¸ë??ì„œ ?‘ê·¼?????ˆë„ë¡??˜ëŠ” ê³ ê¸‰ ì»´í¬?ŒíŠ¸
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

  // formRef??form ?¸ìŠ¤?´ìŠ¤ ? ë‹¹
  React.useImperativeHandle(formRef, () => form, [form]);

  const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // SDUI v1.1: Action Engine ì»¨í…?¤íŠ¸ êµ¬ì„±
  // ? ï¸ ì¤‘ìš”: watch()??ë§¤ë²ˆ ?¸ì¶œ?˜ë?ë¡?formData??ìµœì‹  ê°’ì„ ë°˜ì˜?©ë‹ˆ??
  // actionContext???¸ë??ì„œ ì£¼ì…?˜ë?ë¡??˜ì¡´??ë°°ì—´???¬í•¨?©ë‹ˆ??
  const formData = watch();
  const fullActionContext: ActionContext = React.useMemo(() => ({
    formData,
    setFormValue: (field: string, value: any) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // SDUI v1.1: Action Engine ?°ë™
  const onFormSubmit = async (data: any) => {
    try {
      // ?¤í‚¤ë§ˆì— ?•ì˜??onSubmit ?¡ì…˜ ?¤í–‰ (form.actions ?°ì„ , ?†ìœ¼ë©?schema.actions)
      const actions = schema.form.actions || schema.actions;
      if (actions && actions.length > 0) {
        await executeActionsForEvent('onSubmit', actions, {
          ...fullActionContext,
          formData: data,
        });
      }

      // ê¸°ì¡´ onSubmit ì½œë°± ?¤í–‰ (?˜ìœ„ ?¸í™˜??
      if (onSubmit) {
        await onSubmit(data);
      }

      // onSubmitSuccess ?¡ì…˜ ?¤í–‰
      const successActions = schema.form.actions || schema.actions;
      if (successActions && successActions.length > 0) {
        await executeActionsForEvent('onSubmitSuccess', successActions, {
          ...fullActionContext,
          formData: data,
        });
      }
    } catch (error) {
      // onSubmitError ?¡ì…˜ ?¤í–‰
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
          // ? ï¸ ì°¸ê³ : Grid ì»´í¬?ŒíŠ¸???„ì¬ 1-4ê¹Œì?ë§?ì§€?í•˜ì§€ë§? ?¤í‚¤ë§ˆì—?œëŠ” 1-12ë¥??ˆìš©?©ë‹ˆ??
          // 5 ?´ìƒ??ê°’ì? 4ë¡??œí•œ?©ë‹ˆ?? ?¥í›„ core-ui Grid ì»´í¬?ŒíŠ¸ê°€ ?•ì¥?˜ë©´ ?œê±° ?ˆì •.
          columns={Math.min((layout?.columns || 1), 4) as 1 | 2 | 3 | 4}
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
              {/* SDUI v1.1: i18n ??ì§€??*/}
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

