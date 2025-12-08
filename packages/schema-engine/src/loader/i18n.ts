/**
 * i18n / Localization Binding
 * 
 * SDUI v1.1: ?�키마의 i18n ?��? ?�제 번역 문자?�로 바인?? * 
 * 기술문서: SDUI 기술문서 v1.1 - 7. i18n / Localization Binding
 */

import type { BaseSchema, FormFieldSchema, FormSchema } from '../types';

export interface I18nTranslations {
  [key: string]: string;
}

export interface I18nBindingOptions {
  tenantId: string;
  locale: string;
  translations?: I18nTranslations;  // ?�적 번역 ?�스
  // SDUI v1.1: Supabase Translation Table ?�동 (?�택??
  loadFromDB?: boolean;  // DB?�서 번역 로드 ?��?
}

/**
 * i18n Binding
 * 
 * ?�키�??�의 labelKey, placeholderKey ?�을 ?�제 번역 문자?�로 변?�합?�다.
 * 
 * @param schema - ?�본 ?�키�? * @param options - i18n 바인???�션
 * @returns i18n??바인?�된 ?�키�? */
/**
 * Supabase Translation Table?�서 번역 로드
 * 
 * SDUI v1.1: i18n_translations ?�이블에??번역??로드?�니??
 * 
 * @param tenantId - ?�넌??ID
 * @param locale - 로�??? * @returns 번역 �? */
async function loadTranslationsFromDB(
  tenantId: string,
  locale: string
): Promise<I18nTranslations> {
  try {
    // ?�적 import�?Supabase ?�라?�언??로드 (?�택???�존??
    const { createClient } = await import('@lib/supabase-client');
    const supabase = createClient();
    
    // i18n_translations ?�이�?조회
    // ?�️ 참고: ?�이블이 ?�직 ?�을 ???�으므�??�러 처리
    const { data, error } = await supabase
      .from('i18n_translations')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .eq('locale', locale);
    
    if (error) {
      // ?�이블이 ?�거???�근 불�??�한 경우 �?객체 반환
      console.warn(`Failed to load translations from DB: ${error.message}`);
      return {};
    }
    
    // { key: value } 형태로 변환
    const translations: I18nTranslations = {};
    if (data) {
      data.forEach((row: { key: string; value: string }) => {
        translations[row.key] = row.value;
      });
    }
    
    return translations;
  } catch (error) {
    // Supabase ?�라?�언?��? ?�거???�이블이 ?�는 경우
    console.warn('i18n_translations table not available, using static translations only');
    return {};
  }
}

/**
 * i18n Binding
 * 
 * SDUI v1.1: ?�키�??�의 labelKey, placeholderKey ?�을 ?�제 번역 문자?�로 변?�합?�다.
 * Supabase Translation Table?�서 번역??로드?�거???�적 번역 ?�스�??�용?�니??
 * 
 * @param schema - ?�본 ?�키�? * @param options - i18n 바인???�션
 * @returns i18n??바인?�된 ?�키�? */
export async function bindI18n(
  schema: BaseSchema,
  options: I18nBindingOptions
): Promise<BaseSchema> {
  const { translations = {}, locale, tenantId, loadFromDB = false } = options;
  
  // SDUI v1.1: Supabase Translation Table?�서 번역 로드
  let dbTranslations: I18nTranslations = {};
  if (loadFromDB) {
    dbTranslations = await loadTranslationsFromDB(tenantId, locale);
  }
  
  // ?�적 번역??DB 번역보다 ?�선?�위 ?�음 (override 가??
  const allTranslations = { ...dbTranslations, ...translations };
  
  // ?�키�??�?�에 ?�라 처리
  if (schema.type === 'form' && 'form' in schema) {
    return bindFormSchemaI18n(schema as FormSchema, allTranslations);
  }
  
  // TODO: table, detail, filter, widget ?�키마도 처리
  
  return schema;
}

/**
 * Form Schema i18n 바인?? */
function bindFormSchemaI18n(
  schema: FormSchema,
  translations: I18nTranslations
): FormSchema {
  const boundSchema = { ...schema };
  
  if (boundSchema.form) {
    boundSchema.form = {
      ...boundSchema.form,
      fields: boundSchema.form.fields.map((field) => bindFieldI18n(field, translations)),
      submit: boundSchema.form.submit ? bindSubmitI18n(boundSchema.form.submit, translations) : undefined,
    };
  }
  
  return boundSchema;
}

/**
 * Field i18n 바인?? */
function bindFieldI18n(
  field: FormFieldSchema,
  translations: I18nTranslations
): FormFieldSchema {
  const boundField = { ...field };
  
  if (boundField.ui) {
    boundField.ui = {
      ...boundField.ui,
      // labelKey가 ?�으�?label�?변??(?�으�?기존 label ?��?)
      label: boundField.ui.labelKey 
        ? translations[boundField.ui.labelKey] || boundField.ui.labelKey
        : boundField.ui.label,
      placeholder: boundField.ui.placeholderKey
        ? translations[boundField.ui.placeholderKey] || boundField.ui.placeholderKey
        : boundField.ui.placeholder,
      description: boundField.ui.descriptionKey
        ? translations[boundField.ui.descriptionKey] || boundField.ui.descriptionKey
        : boundField.ui.description,
      tooltip: boundField.ui.tooltipKey
        ? translations[boundField.ui.tooltipKey] || boundField.ui.tooltipKey
        : boundField.ui.tooltip,
    };
  }
  
  // options i18n 바인딩
  if (boundField.options) {
    boundField.options = boundField.options.map((opt) => ({
      ...opt,
      label: opt.labelKey
        ? translations[opt.labelKey] || opt.labelKey
        : opt.label || opt.value,
    }));
  }
  
  // validation message i18n 바인딩
  if (boundField.validation) {
    if (typeof boundField.validation.required === 'object' && boundField.validation.required.messageKey) {
      boundField.validation.required = {
        ...boundField.validation.required,
        message: translations[boundField.validation.required.messageKey] || boundField.validation.required.messageKey,
      };
    }
    
    if (boundField.validation.pattern?.messageKey) {
      boundField.validation.pattern = {
        ...boundField.validation.pattern,
        message: translations[boundField.validation.pattern.messageKey] || boundField.validation.pattern.messageKey,
      };
    }
  }
  
  return boundField;
}

/**
 * Submit 버튼 i18n 바인?? */
function bindSubmitI18n(
  submit: { labelKey?: string; label?: string; [key: string]: any },
  translations: I18nTranslations
): { label: string; [key: string]: any } {
  return {
    ...submit,
    label: submit.labelKey
      ? translations[submit.labelKey] || submit.labelKey
      : submit.label || 'Submit',
  };
}


