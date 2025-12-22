/**
 * i18n / Localization Binding
 *
 * SDUI v1.1: 스키마의 i18n 키를 실제 번역 문자열로 바인딩
 *
 * 기술문서: SDUI 기술문서 v1.1 - 7. i18n / Localization Binding
 */

import type { BaseSchema, FormFieldSchema, FormSchema } from '../types';

export interface I18nTranslations {
  [key: string]: string;
}

export interface I18nBindingOptions {
  tenantId: string;
  locale: string;
  translations?: I18nTranslations;  // 정적 번역 맵
  // SDUI v1.1: Supabase Translation Table 연동 (선택적)
  loadFromDB?: boolean;  // DB에서 번역 로드 여부
  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter 통합
  industryAdapter?: {
    getLabelFromI18n: (i18nKey: string) => string;  // i18n 키 → 업종 Label 변환 함수
  };
}

/**
 * i18n Binding
 *
 * 스키마의 labelKey, placeholderKey 등을 실제 번역 문자열로 변환합니다.
 *
 * @param schema - 원본 스키마
 * @param options - i18n 바인딩 옵션
 * @returns i18n으로 바인딩된 스키마
 */
/**
 * Supabase Translation Table에서 번역 로드
 *
 * SDUI v1.1: i18n_translations 테이블에서 번역을 로드합니다.
 *
 * @param tenantId - 테넌트 ID
 * @param locale - 로케일
 * @returns 번역 맵
 */
async function loadTranslationsFromDB(
  tenantId: string,
  locale: string
): Promise<I18nTranslations> {
  try {
    // 동적 import로 Supabase 클라이언트 로드 (선택적 의존성)
    const { createClient } = await import('@lib/supabase-client');
    const { withTenant } = await import('@lib/supabase-client/db');
    const supabase = createClient();

    // i18n_translations 테이블 조회
    // ⚠️ 참고: 테이블이 아직 없을 수 있으므로 에러 처리
    const { data, error } = await withTenant(
      supabase
        .from('i18n_translations')
        .select('key, value')
        .eq('locale', locale),
      tenantId
    );

    if (error) {
      // 테이블이 없거나 접근 불가한 경우 빈 객체 반환
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
    // Supabase 클라이언트가 없거나 테이블이 없는 경우
    console.warn('i18n_translations table not available, using static translations only');
    return {};
  }
}

/**
 * i18n Binding
 *
 * SDUI v1.1: 스키마의 labelKey, placeholderKey 등을 실제 번역 문자열로 변환합니다.
 * Supabase Translation Table에서 번역을 로드하거나 정적 번역 맵을 사용합니다.
 *
 * @param schema - 원본 스키마
 * @param options - i18n 바인딩 옵션
 * @returns i18n으로 바인딩된 스키마
 */
export async function bindI18n(
  schema: BaseSchema,
  options: I18nBindingOptions
): Promise<BaseSchema> {
  const { translations = {}, locale, tenantId, loadFromDB = false, industryAdapter } = options;

  // SDUI v1.1: Supabase Translation Table에서 번역 로드
  let dbTranslations: I18nTranslations = {};
  if (loadFromDB) {
    dbTranslations = await loadTranslationsFromDB(tenantId, locale);
  }

  // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter 통합
  // Industry Adapter가 있으면 labelKey를 업종별 Label로 변환
  let industryTranslations: I18nTranslations = {};
  if (industryAdapter) {
    // 스키마에서 사용된 모든 labelKey를 수집하여 Industry Adapter로 변환
    // (실제 변환은 bindFieldI18n에서 수행)
    industryTranslations = {}; // 빈 객체로 시작, bindFieldI18n에서 동적으로 변환
  }

  // 정적 번역이 DB 번역보다 우선순위 높음 (override 가능)
  // Industry Adapter 변환은 가장 높은 우선순위
  const allTranslations = { ...dbTranslations, ...translations, ...industryTranslations };

  // 스키마 타입에 따라 처리
  if (schema.type === 'form' && 'form' in schema) {
    return bindFormSchemaI18n(schema as FormSchema, allTranslations, industryAdapter);
  }

  // TODO: table, detail, filter, widget 스키마도 처리

  return schema;
}

/**
 * Form Schema i18n 바인딩
 */
function bindFormSchemaI18n(
  schema: FormSchema,
  translations: I18nTranslations,
  industryAdapter?: { getLabelFromI18n: (i18nKey: string) => string }
): FormSchema {
  const boundSchema = { ...schema };

  if (boundSchema.form) {
    boundSchema.form = {
      ...boundSchema.form,
      fields: boundSchema.form.fields.map((field) => bindFieldI18n(field, translations, industryAdapter)),
      submit: boundSchema.form.submit ? bindSubmitI18n(boundSchema.form.submit, translations, industryAdapter) : undefined,
    };
  }

  return boundSchema;
}

/**
 * Field i18n 바인딩
 * Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter 통합
 */
function bindFieldI18n(
  field: FormFieldSchema,
  translations: I18nTranslations,
  industryAdapter?: { getLabelFromI18n: (i18nKey: string) => string }
): FormFieldSchema {
  const boundField = { ...field };

  if (boundField.ui) {
    // Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter 우선 사용
    // labelKey가 있으면 Industry Adapter로 변환, 없으면 translations에서 조회, 둘 다 없으면 기존 label 유지
    const getLabel = (labelKey?: string, fallbackLabel?: string): string | undefined => {
      if (!labelKey) return fallbackLabel;
      if (industryAdapter) {
        return industryAdapter.getLabelFromI18n(labelKey);
      }
      return translations[labelKey] || fallbackLabel || labelKey;
    };

    boundField.ui = {
      ...boundField.ui,
      label: getLabel(boundField.ui.labelKey, boundField.ui.label),
      placeholder: getLabel(boundField.ui.placeholderKey, boundField.ui.placeholder),
      description: getLabel(boundField.ui.descriptionKey, boundField.ui.description),
      tooltip: getLabel(boundField.ui.tooltipKey, boundField.ui.tooltip),
    };
  }

  // options i18n 바인딩 (Industry Adapter 통합)
  if (boundField.options) {
    boundField.options = boundField.options.map((opt) => ({
      ...opt,
      label: opt.labelKey
        ? (industryAdapter
            ? industryAdapter.getLabelFromI18n(opt.labelKey)
            : translations[opt.labelKey] || opt.labelKey)
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
 * Submit 버튼 i18n 바인딩
 * Automation & AI Industry-Neutral Rule (SSOT): Industry Adapter 통합
 */
function bindSubmitI18n(
  submit: { labelKey?: string; label?: string; [key: string]: unknown },
  translations: I18nTranslations,
  industryAdapter?: { getLabelFromI18n: (i18nKey: string) => string }
): { label: string; [key: string]: unknown } {
  const label = submit.labelKey
    ? (industryAdapter
        ? industryAdapter.getLabelFromI18n(submit.labelKey)
        : translations[submit.labelKey] || submit.labelKey)
    : submit.label || 'Submit';
  return {
    ...submit,
    label,
  };
}
