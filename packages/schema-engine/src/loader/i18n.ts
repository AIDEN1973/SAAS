/**
 * i18n / Localization Binding
 * 
 * SDUI v1.1: ?¤í‚¤ë§ˆì˜ i18n ?¤ë? ?¤ì œ ë²ˆì—­ ë¬¸ì?´ë¡œ ë°”ì¸?? * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 7. i18n / Localization Binding
 */

import type { BaseSchema, FormFieldSchema, FormSchema } from '../types';

export interface I18nTranslations {
  [key: string]: string;
}

export interface I18nBindingOptions {
  tenantId: string;
  locale: string;
  translations?: I18nTranslations;  // ?•ì  ë²ˆì—­ ?ŒìŠ¤
  // SDUI v1.1: Supabase Translation Table ?°ë™ (? íƒ??
  loadFromDB?: boolean;  // DB?ì„œ ë²ˆì—­ ë¡œë“œ ?¬ë?
}

/**
 * i18n Binding
 * 
 * ?¤í‚¤ë§??´ì˜ labelKey, placeholderKey ?±ì„ ?¤ì œ ë²ˆì—­ ë¬¸ì?´ë¡œ ë³€?˜í•©?ˆë‹¤.
 * 
 * @param schema - ?ë³¸ ?¤í‚¤ë§? * @param options - i18n ë°”ì¸???µì…˜
 * @returns i18n??ë°”ì¸?©ëœ ?¤í‚¤ë§? */
/**
 * Supabase Translation Table?ì„œ ë²ˆì—­ ë¡œë“œ
 * 
 * SDUI v1.1: i18n_translations ?Œì´ë¸”ì—??ë²ˆì—­??ë¡œë“œ?©ë‹ˆ??
 * 
 * @param tenantId - ?Œë„Œ??ID
 * @param locale - ë¡œì??? * @returns ë²ˆì—­ ë§? */
async function loadTranslationsFromDB(
  tenantId: string,
  locale: string
): Promise<I18nTranslations> {
  try {
    // ?™ì  importë¡?Supabase ?´ë¼?´ì–¸??ë¡œë“œ (? íƒ???˜ì¡´??
    const { createClient } = await import('@lib/supabase-client');
    const supabase = createClient();
    
    // i18n_translations ?Œì´ë¸?ì¡°íšŒ
    // ? ï¸ ì°¸ê³ : ?Œì´ë¸”ì´ ?„ì§ ?†ì„ ???ˆìœ¼ë¯€ë¡??ëŸ¬ ì²˜ë¦¬
    const { data, error } = await supabase
      .from('i18n_translations')
      .select('key, value')
      .eq('tenant_id', tenantId)
      .eq('locale', locale);
    
    if (error) {
      // ?Œì´ë¸”ì´ ?†ê±°???‘ê·¼ ë¶ˆê??¥í•œ ê²½ìš° ë¹?ê°ì²´ ë°˜í™˜
      console.warn(`Failed to load translations from DB: ${error.message}`);
      return {};
    }
    
    // { key: value } ?•íƒœë¡?ë³€??    const translations: I18nTranslations = {};
    if (data) {
      data.forEach((row: { key: string; value: string }) => {
        translations[row.key] = row.value;
      });
    }
    
    return translations;
  } catch (error) {
    // Supabase ?´ë¼?´ì–¸?¸ê? ?†ê±°???Œì´ë¸”ì´ ?†ëŠ” ê²½ìš°
    console.warn('i18n_translations table not available, using static translations only');
    return {};
  }
}

/**
 * i18n Binding
 * 
 * SDUI v1.1: ?¤í‚¤ë§??´ì˜ labelKey, placeholderKey ?±ì„ ?¤ì œ ë²ˆì—­ ë¬¸ì?´ë¡œ ë³€?˜í•©?ˆë‹¤.
 * Supabase Translation Table?ì„œ ë²ˆì—­??ë¡œë“œ?˜ê±°???•ì  ë²ˆì—­ ?ŒìŠ¤ë¥??¬ìš©?©ë‹ˆ??
 * 
 * @param schema - ?ë³¸ ?¤í‚¤ë§? * @param options - i18n ë°”ì¸???µì…˜
 * @returns i18n??ë°”ì¸?©ëœ ?¤í‚¤ë§? */
export async function bindI18n(
  schema: BaseSchema,
  options: I18nBindingOptions
): Promise<BaseSchema> {
  const { translations = {}, locale, tenantId, loadFromDB = false } = options;
  
  // SDUI v1.1: Supabase Translation Table?ì„œ ë²ˆì—­ ë¡œë“œ
  let dbTranslations: I18nTranslations = {};
  if (loadFromDB) {
    dbTranslations = await loadTranslationsFromDB(tenantId, locale);
  }
  
  // ?•ì  ë²ˆì—­??DB ë²ˆì—­ë³´ë‹¤ ?°ì„ ?œìœ„ ?’ìŒ (override ê°€??
  const allTranslations = { ...dbTranslations, ...translations };
  
  // ?¤í‚¤ë§??€?…ì— ?°ë¼ ì²˜ë¦¬
  if (schema.type === 'form' && 'form' in schema) {
    return bindFormSchemaI18n(schema as FormSchema, allTranslations);
  }
  
  // TODO: table, detail, filter, widget ?¤í‚¤ë§ˆë„ ì²˜ë¦¬
  
  return schema;
}

/**
 * Form Schema i18n ë°”ì¸?? */
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
 * Field i18n ë°”ì¸?? */
function bindFieldI18n(
  field: FormFieldSchema,
  translations: I18nTranslations
): FormFieldSchema {
  const boundField = { ...field };
  
  if (boundField.ui) {
    boundField.ui = {
      ...boundField.ui,
      // labelKeyê°€ ?ˆìœ¼ë©?labelë¡?ë³€??(?†ìœ¼ë©?ê¸°ì¡´ label ? ì?)
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
  
  // options i18n ë°”ì¸??  if (boundField.options) {
    boundField.options = boundField.options.map((opt) => ({
      ...opt,
      label: opt.labelKey
        ? translations[opt.labelKey] || opt.labelKey
        : opt.label || opt.value,
    }));
  }
  
  // validation message i18n ë°”ì¸??  if (boundField.validation) {
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
 * Submit ë²„íŠ¼ i18n ë°”ì¸?? */
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

