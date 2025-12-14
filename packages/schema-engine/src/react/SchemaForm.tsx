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
import { useResponsiveMode } from '@ui-core/react';
import type { FormSchema } from '../types';
import { validateSchema } from '../validator';
import { SchemaField } from './SchemaField';
import { executeActionsForEvent, type ActionContext } from '../core/actionEngine';

export interface SchemaFormProps {
  schema: FormSchema;
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>;
  defaultValues?: Record<string, unknown>;
  className?: string;
  // SDUI v1.1: Action Engine 컨텍스트 (선택적)
  actionContext?: Partial<ActionContext>;
  // SDUI v1.1: i18n 번역 (선택적)
  translations?: Record<string, string>;
  // Card padding 제어 (Drawer/Modal 내부에서 사용 시)
  disableCardPadding?: boolean;
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
  disableCardPadding = false,
}) => {
  // 1) Schema Validation
  const validation = validateSchema(schema);
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  // 2) React Hook Form 초기화
  // defaultValues는 스키마의 defaultValue와 병합
  const mergedDefaultValues = React.useMemo(() => {
    const schemaDefaults: Record<string, unknown> = {};
    schema.form.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        schemaDefaults[field.name] = field.defaultValue;
      }
    });
    return { ...schemaDefaults, ...defaultValues };
  }, [schema, defaultValues]);

  const form: UseFormReturn<Record<string, unknown>> = useForm({
    defaultValues: mergedDefaultValues,
  });

  const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // SDUI v1.1: Action Engine 컨텍스트 구성
  // ⚠️ 중요: watch()는 매번 호출되므로 formData는 최신 값을 반영합니다.
  // actionContext는 외부에서 주입되므로 의존성 배열에 포함합니다.
  const formData = watch();
  const fullActionContext: ActionContext = React.useMemo(() => ({
    formData,
    setFormValue: (field: string, value: unknown) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // 3) Submit 핸들러
  // SDUI v1.1: Action Engine 연동
  const onFormSubmit = async (data: Record<string, unknown>) => {
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
  const mode = useResponsiveMode();

  // SDUI v1.1: 반응형 레이아웃 지원
  // responsive 옵션이 있으면 현재 모드에 맞는 레이아웃 사용
  const effectiveLayout = React.useMemo(() => {
    if (layout?.responsive) {
      const isMobile = mode === 'xs' || mode === 'sm';
      const isTablet = mode === 'md';
      const isDesktop = mode === 'lg' || mode === 'xl';

      if (isMobile && layout.responsive.mobile) {
        return { ...layout, ...layout.responsive.mobile };
      } else if (isTablet && layout.responsive.tablet) {
        return { ...layout, ...layout.responsive.tablet };
      } else if (isDesktop && layout.responsive.desktop) {
        return { ...layout, ...layout.responsive.desktop };
      }
    }
    return layout;
  }, [layout, mode]);

  // Grid columns 계산 (반응형 고려)
  // ⚠️ 중요: SchemaForm에서 직접 반응형 처리를 하여 모바일에서 1열로 강제합니다.
  // Grid 컴포넌트의 자동 반응형 처리에 의존하지 않고 명시적으로 처리합니다.
  const gridColumns = React.useMemo(() => {
    if (effectiveLayout?.columns === 'auto-fit' || effectiveLayout?.columns === 'auto-fill') {
      return effectiveLayout.columns;
    }
    if (typeof effectiveLayout?.columns === 'number') {
      const numColumns = Math.min(effectiveLayout.columns, 12);
      // 반응형 처리: 모바일은 항상 1열, 태블릿은 최대 2열, 데스크톱은 원래 값
      const isMobile = mode === 'xs' || mode === 'sm';
      const isTablet = mode === 'md';

      if (isMobile) {
        return 1;
      } else if (isTablet) {
        return Math.min(numColumns, 2) as 1 | 2;
      } else {
        return numColumns as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
      }
    }
    return 1;
  }, [effectiveLayout, mode]);

  // Grid gap 계산 (반응형 고려)
  // 모바일에서는 더 작은 gap 사용, 데스크톱에서는 원래 값 사용
  const gridGap = React.useMemo(() => {
    const baseGap = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';
    // 모바일에서는 최소 'sm' gap 보장
    if (isMobile) {
      return baseGap === 'xs' ? 'xs' : 'sm';
    }
    return baseGap;
  }, [effectiveLayout?.columnGap, mode]);

  // Card padding 계산 (반응형 고려)
  // 모바일에서도 적절한 padding 보장
  const cardPadding = React.useMemo(() => {
    if (disableCardPadding) return undefined;
    const basePadding = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';
    // 모바일에서는 최소 'sm' padding 보장
    if (isMobile) {
      return basePadding === 'xs' ? 'xs' : 'sm';
    }
    return basePadding;
  }, [effectiveLayout?.columnGap, mode, disableCardPadding]);

  // Form padding 계산 (disableCardPadding일 때 form에 직접 padding 적용)
  // Drawer/Modal 내부에서 사용될 때도 적절한 여백 보장
  const formPadding = React.useMemo(() => {
    if (!disableCardPadding) return undefined;

    const basePadding = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<string, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' padding 보장
    const effectivePadding = isMobile && basePadding !== 'xs' ? 'sm' : basePadding;

    return spacingMap[effectivePadding] || `var(--spacing-${effectivePadding})`;
  }, [disableCardPadding, effectiveLayout?.columnGap, mode]);

  // rowGap 스타일 계산 (반응형 고려)
  const rowGapStyle = React.useMemo(() => {
    const baseRowGap = effectiveLayout?.rowGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<string, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' rowGap 보장
    const effectiveRowGap = isMobile && baseRowGap !== 'xs' ? 'sm' : baseRowGap;

    return {
      rowGap: spacingMap[effectiveRowGap] || `var(--spacing-${effectiveRowGap})`,
    };
  }, [effectiveLayout?.rowGap, mode]);

  return (
    <Card
      padding={cardPadding}
      className={className}
      style={disableCardPadding ? { width: '100%', margin: 0, padding: 0 } : undefined}
    >
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        style={disableCardPadding ? {
          width: '100%',
          padding: formPadding,
        } : undefined}
      >
        <Grid
          columns={gridColumns}
          columnTemplate={effectiveLayout?.columnTemplate}
          minColumnWidth={effectiveLayout?.minColumnWidth}
          gap={gridGap}
          style={rowGapStyle}
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
              gridColumns={typeof gridColumns === 'number' ? gridColumns : undefined}
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
  formRef?: React.RefObject<UseFormReturn<Record<string, unknown>>>;
}

export const SchemaFormWithMethods: React.FC<SchemaFormWithMethodsProps> = ({
  schema,
  onSubmit,
  defaultValues,
  formRef,
  className,
  actionContext,
  translations = {},
  disableCardPadding = false,
}) => {
  const validation = validateSchema(schema);
  if (!validation.valid) {
    throw new Error(`Invalid form schema: ${validation.errors?.message}`);
  }

  const mergedDefaultValues = React.useMemo(() => {
    const schemaDefaults: Record<string, unknown> = {};
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
    setFormValue: (field: string, value: unknown) => setValue(field, value),
    resetForm: () => reset(),
    translations,
    ...actionContext,
  }), [formData, setValue, reset, translations, actionContext]);

  // SDUI v1.1: Action Engine 연동
  const onFormSubmit = async (data: Record<string, unknown>) => {
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
  const mode = useResponsiveMode();

  // SDUI v1.1: 반응형 레이아웃 지원
  // responsive 옵션이 있으면 현재 모드에 맞는 레이아웃 사용
  const effectiveLayout = React.useMemo(() => {
    if (layout?.responsive) {
      const isMobile = mode === 'xs' || mode === 'sm';
      const isTablet = mode === 'md';
      const isDesktop = mode === 'lg' || mode === 'xl';

      if (isMobile && layout.responsive.mobile) {
        return { ...layout, ...layout.responsive.mobile };
      } else if (isTablet && layout.responsive.tablet) {
        return { ...layout, ...layout.responsive.tablet };
      } else if (isDesktop && layout.responsive.desktop) {
        return { ...layout, ...layout.responsive.desktop };
      }
    }
    return layout;
  }, [layout, mode]);

  // Grid columns 계산 (반응형 고려)
  // ⚠️ 중요: SchemaForm에서 직접 반응형 처리를 하여 모바일에서 1열로 강제합니다.
  // Grid 컴포넌트의 자동 반응형 처리에 의존하지 않고 명시적으로 처리합니다.
  const gridColumns = React.useMemo(() => {
    if (effectiveLayout?.columns === 'auto-fit' || effectiveLayout?.columns === 'auto-fill') {
      return effectiveLayout.columns;
    }
    if (typeof effectiveLayout?.columns === 'number') {
      const numColumns = Math.min(effectiveLayout.columns, 12);
      // 반응형 처리: 모바일은 항상 1열, 태블릿은 최대 2열, 데스크톱은 원래 값
      const isMobile = mode === 'xs' || mode === 'sm';
      const isTablet = mode === 'md';

      if (isMobile) {
        return 1;
      } else if (isTablet) {
        return Math.min(numColumns, 2) as 1 | 2;
      } else {
        return numColumns as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
      }
    }
    return 1;
  }, [effectiveLayout, mode]);

  // Grid gap 계산 (반응형 고려)
  // 모바일에서는 더 작은 gap 사용, 데스크톱에서는 원래 값 사용
  const gridGap = React.useMemo(() => {
    const baseGap = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';
    // 모바일에서는 최소 'sm' gap 보장
    if (isMobile) {
      return baseGap === 'xs' ? 'xs' : 'sm';
    }
    return baseGap;
  }, [effectiveLayout?.columnGap, mode]);

  // Card padding 계산 (반응형 고려)
  // 모바일에서도 적절한 padding 보장
  const cardPadding = React.useMemo(() => {
    if (disableCardPadding) return undefined;
    const basePadding = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';
    // 모바일에서는 최소 'sm' padding 보장
    if (isMobile) {
      return basePadding === 'xs' ? 'xs' : 'sm';
    }
    return basePadding;
  }, [effectiveLayout?.columnGap, mode, disableCardPadding]);

  // Form padding 계산 (disableCardPadding일 때 form에 직접 padding 적용)
  // Drawer/Modal 내부에서 사용될 때도 적절한 여백 보장
  const formPadding = React.useMemo(() => {
    if (!disableCardPadding) return undefined;

    const basePadding = effectiveLayout?.columnGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<string, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' padding 보장
    const effectivePadding = isMobile && basePadding !== 'xs' ? 'sm' : basePadding;

    return spacingMap[effectivePadding] || `var(--spacing-${effectivePadding})`;
  }, [disableCardPadding, effectiveLayout?.columnGap, mode]);

  // rowGap 스타일 계산 (반응형 고려)
  const rowGapStyle = React.useMemo(() => {
    const baseRowGap = effectiveLayout?.rowGap || 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<string, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' rowGap 보장
    const effectiveRowGap = isMobile && baseRowGap !== 'xs' ? 'sm' : baseRowGap;

    return {
      rowGap: spacingMap[effectiveRowGap] || `var(--spacing-${effectiveRowGap})`,
    };
  }, [effectiveLayout?.rowGap, mode]);

  return (
    <Card
      padding={cardPadding}
      className={className}
      style={disableCardPadding ? { width: '100%', margin: 0, padding: 0 } : undefined}
    >
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        style={disableCardPadding ? {
          width: '100%',
          padding: formPadding,
        } : undefined}
      >
        <Grid
          columns={gridColumns}
          columnTemplate={effectiveLayout?.columnTemplate}
          minColumnWidth={effectiveLayout?.minColumnWidth}
          gap={gridGap}
          style={rowGapStyle}
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
              gridColumns={typeof gridColumns === 'number' ? gridColumns : undefined}
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

