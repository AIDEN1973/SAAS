/**
 * i18n / Localization Binding
 *
 * SDUI v1.1: 스키마의 i18n 키를 실제 번역 문자열로 바인딩
 *
 * 기술문서: SDUI 기술문서 v1.1 - 7. i18n / Localization Binding
 */
import type { BaseSchema } from '../types';
export interface I18nTranslations {
    [key: string]: string;
}
export interface I18nBindingOptions {
    tenantId: string;
    locale: string;
    translations?: I18nTranslations;
    loadFromDB?: boolean;
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
export declare function bindI18n(schema: BaseSchema, options: I18nBindingOptions): Promise<BaseSchema>;
//# sourceMappingURL=i18n.d.ts.map