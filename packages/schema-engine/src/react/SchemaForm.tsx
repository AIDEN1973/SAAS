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
import { Grid, Button, Card, ActionButtonGroup } from '@ui-core/react';
import { useResponsiveMode } from '@ui-core/react';
import { Trash2, X as XIcon, Save } from 'lucide-react';
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
  /**
   * SDUI v1.1: API 클라이언트 주입(선택)
   * - schema-engine은 특정 SDK를 직접 import하지 않습니다.
   * - 앱에서 `@api-sdk/core`의 `apiClient`를 주입하는 방식으로 사용합니다.
   */
  apiClient?: { get: (table: string, options?: any) => Promise<any> };
  // Card padding 제어 (Drawer/Modal 내부에서 사용 시)
  disableCardPadding?: boolean;
  /** 카드 내부 타이틀 (타이틀 하단에 구분선 자동 추가) */
  cardTitle?: React.ReactNode;
  /** 타이틀 위치 (기본값: 'top-left') */
  cardTitlePosition?: 'top-left' | 'top-right' | 'top-center';
  /** 타이틀 왼쪽에 표시할 아이콘 (루시드 아이콘) */
  cardTitleIcon?: React.ReactNode;
  /** 카드 variant (기본값: 'default') */
  cardVariant?: 'default' | 'elevated' | 'outlined';
  /** 카드 style override (레이어 메뉴 등에서 배경/테두리 제거 용도) */
  cardStyle?: React.CSSProperties;
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
export const SchemaForm: React.FC<SchemaFormProps> = ({
  schema,
  onSubmit,
  defaultValues,
  className,
  actionContext,
  translations = {},
  apiClient,
  disableCardPadding = false,
  cardTitle,
  cardTitlePosition = 'top-left',
  cardTitleIcon,
  cardVariant = 'default',
  cardStyle,
  onCancel,
  cancelLabel = '취소',
  onDelete,
  deleteLabel = '삭제',
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
    // [불변 규칙] React Hook Form 기본 모드 사용 (문서 준수)
    // mode는 기본값 'onSubmit' 사용 (성능 최적화)
  });

  const { register, control, handleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // defaultValues가 변경될 때 폼 값 업데이트
  // [불변 규칙] React Hook Form의 reset을 사용하여 defaultValues 변경 시 폼 값 업데이트
  // [성능 최적화] 얕은 비교를 사용하여 실제로 변경되었을 때만 reset 호출
  const prevMergedDefaultValuesRef = React.useRef<Record<string, unknown>>(mergedDefaultValues);
  React.useEffect(() => {
    // 얕은 비교: 키 개수와 값 비교 (JSON.stringify보다 효율적)
    const hasChanged = Object.keys(mergedDefaultValues).some(
      key => prevMergedDefaultValuesRef.current[key] !== mergedDefaultValues[key]
    ) || Object.keys(prevMergedDefaultValuesRef.current).some(
      key => !(key in mergedDefaultValues)
    );

    if (!hasChanged) {
      return; // 변경되지 않았으면 건너뜀
    }

    if ((import.meta as any).env?.DEV) {
      console.log('[IME][SchemaForm] reset triggered by mergedDefaultValues change', {
        changedKeys: Object.keys(mergedDefaultValues).filter(
          (key) => prevMergedDefaultValuesRef.current[key] !== mergedDefaultValues[key]
        ),
      });
    }

    prevMergedDefaultValuesRef.current = mergedDefaultValues;
    reset(mergedDefaultValues, {
      keepDefaultValues: false,
      keepValues: false,
    });
  }, [reset, mergedDefaultValues]);

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
  // 리스트 카드와 동일한 패딩('md') 사용
  const cardPadding = React.useMemo(() => {
    if (disableCardPadding) return undefined;
    // 리스트 카드 기준으로 'md' 패딩 사용
    return 'md';
  }, [disableCardPadding]);

  // Form padding 계산 (disableCardPadding일 때 form에 직접 padding 적용)
  // Drawer/Modal 내부에서 사용될 때도 적절한 여백 보장
  const formPadding = React.useMemo(() => {
    if (!disableCardPadding) return undefined;

    type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    const basePadding: SpacingKey = 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<SpacingKey, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' padding 보장
    const effectivePadding = isMobile ? 'sm' : basePadding;

    return spacingMap[effectivePadding] || `var(--spacing-${effectivePadding})`;
  }, [disableCardPadding, effectiveLayout?.columnGap, mode]);

  // rowGap 스타일 계산 (반응형 고려)
  const rowGapStyle = React.useMemo(() => {
    type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    const baseRowGap = (effectiveLayout?.rowGap || 'md') as SpacingKey;
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<SpacingKey, string> = {
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
      variant={cardVariant}
      title={cardTitle}
      titlePosition={cardTitlePosition}
      titleIcon={cardTitleIcon}
      style={{
        ...(disableCardPadding ? {
          width: 'var(--width-full)',
          margin: 'var(--spacing-none)',
          padding: 'var(--spacing-none)',
        } : undefined),
        ...(cardStyle || undefined),
      }}
    >
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        style={disableCardPadding ? {
          width: 'var(--width-full)',
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
              apiClient={apiClient}
              gridColumns={typeof gridColumns === 'number' ? gridColumns : undefined}
            />
          ))}
        </Grid>
        {(formConfig.submit || onCancel) && (
          <ActionButtonGroup
            marginTop="md"
            gap="sm"
            iconVariant="small"
            items={[
              ...(onDelete && onCancel && formConfig.submit ? [{
                key: 'delete',
                label: deleteLabel,
                icon: <Trash2 />,
                variant: 'outline' as const,
                color: 'error' as const,
                size: formConfig.submit?.size || 'md',
                onClick: onDelete,
                type: 'button' as const,
              }] : []),
              ...(onCancel ? [{
                key: 'cancel',
                label: cancelLabel,
                icon: <XIcon />,
                variant: 'outline' as const,
                size: formConfig.submit?.size || 'md',
                onClick: onCancel,
                type: 'button' as const,
              }] : []),
              ...(formConfig.submit ? [{
                key: 'submit',
                label: formConfig.submit.labelKey
                  ? (translations[formConfig.submit.labelKey] || formConfig.submit.labelKey)
                  : (formConfig.submit.label || 'Submit'),
                icon: <Save />,
                variant: formConfig.submit.variant,
                color: formConfig.submit.color,
                size: formConfig.submit.size,
                type: 'submit' as const,
              }] : []),
            ]}
          />
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
  cardTitle,
  cardTitlePosition = 'top-left',
  cardTitleIcon,
  cardVariant = 'default',
  cardStyle,
  onCancel,
  cancelLabel = '취소',
  onDelete,
  deleteLabel = '삭제',
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

  // defaultValues가 변경될 때 폼 값 업데이트
  // [중요] 마운트 시에도 reset을 호출하여 defaultValues가 확실히 적용되도록 함
  React.useEffect(() => {
    reset(mergedDefaultValues);
  }, [reset, mergedDefaultValues]);

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
  // 리스트 카드와 동일한 패딩('md') 사용
  const cardPadding = React.useMemo(() => {
    if (disableCardPadding) return undefined;
    // 리스트 카드 기준으로 'md' 패딩 사용
    return 'md';
  }, [disableCardPadding]);

  // Form padding 계산 (disableCardPadding일 때 form에 직접 padding 적용)
  // Drawer/Modal 내부에서 사용될 때도 적절한 여백 보장
  const formPadding = React.useMemo(() => {
    if (!disableCardPadding) return undefined;

    type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    const basePadding: SpacingKey = 'md';
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<SpacingKey, string> = {
      xs: 'var(--spacing-xs)',
      sm: 'var(--spacing-sm)',
      md: 'var(--spacing-md)',
      lg: 'var(--spacing-lg)',
      xl: 'var(--spacing-xl)',
      '2xl': 'var(--spacing-2xl)',
      '3xl': 'var(--spacing-3xl)',
    };

    // 모바일에서는 최소 'sm' padding 보장
    const effectivePadding = isMobile ? 'sm' : basePadding;

    return spacingMap[effectivePadding] || `var(--spacing-${effectivePadding})`;
  }, [disableCardPadding, effectiveLayout?.columnGap, mode]);

  // rowGap 스타일 계산 (반응형 고려)
  const rowGapStyle = React.useMemo(() => {
    type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
    const baseRowGap = (effectiveLayout?.rowGap || 'md') as SpacingKey;
    const isMobile = mode === 'xs' || mode === 'sm';

    const spacingMap: Record<SpacingKey, string> = {
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
      variant={cardVariant}
      title={cardTitle}
      titlePosition={cardTitlePosition}
      titleIcon={cardTitleIcon}
      style={{
        ...(disableCardPadding ? {
          width: 'var(--width-full)',
          margin: 'var(--spacing-none)',
          padding: 'var(--spacing-none)',
        } : undefined),
        ...(cardStyle || undefined),
      }}
    >
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        style={disableCardPadding ? {
          width: 'var(--width-full)',
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
        {(formConfig.submit || onCancel) && (
          <ActionButtonGroup
            marginTop="md"
            gap="sm"
            items={[
              ...(onDelete && onCancel && formConfig.submit ? [{
                key: 'delete',
                label: deleteLabel,
                icon: <Trash2 />,
                variant: 'outline' as const,
                color: 'error' as const,
                size: formConfig.submit?.size || 'md',
                onClick: onDelete,
                type: 'button' as const,
              }] : []),
              ...(onCancel ? [{
                key: 'cancel',
                label: cancelLabel,
                icon: <XIcon />,
                variant: 'outline' as const,
                size: formConfig.submit?.size || 'md',
                onClick: onCancel,
                type: 'button' as const,
              }] : []),
              ...(formConfig.submit ? [{
                key: 'submit',
                label: formConfig.submit.labelKey
                  ? (translations[formConfig.submit.labelKey] || formConfig.submit.labelKey)
                  : (formConfig.submit.label || 'Submit'),
                icon: <Save />,
                variant: formConfig.submit.variant,
                color: formConfig.submit.color,
                size: formConfig.submit.size,
                type: 'submit' as const,
              }] : []),
            ]}
          />
        )}
      </form>
    </Card>
  );
};

