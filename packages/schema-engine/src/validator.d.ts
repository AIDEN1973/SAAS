/**
 * Meta-Schema Validator
 *
 * [불�? 규칙] ?�키�?구조???�음 ?�계?�서 검�?
 * - 개발(local dev)
 * - CI 빌드 ?�계
 * - ?�넌??배포 ?? * - Schema Registry???�록 ?�점
 */
import { z } from 'zod';
import { SchemaVersion, ConditionRule, MultiConditionRule } from './types';
/**
 * Form Schema Validator
 */
export declare const formSchemaValidator: z.ZodObject<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
} & {
    form: z.ZodObject<{
        layout: z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<["grid", "section", "tabs", "stepper", "drawer", "modal", "responsive"]>>;
            columns: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodEnum<["1", "2", "3", "4"]>]>>;
            columnGap: z.ZodOptional<z.ZodEnum<["xs", "sm", "md", "lg", "xl", "2xl", "3xl"]>>;
            rowGap: z.ZodOptional<z.ZodEnum<["xs", "sm", "md", "lg", "xl", "2xl", "3xl"]>>;
            tabs: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                labelKey: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }, {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }>, "many">>;
            steps: z.ZodOptional<z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                labelKey: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }, {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }>, "many">>;
            responsive: z.ZodOptional<z.ZodObject<{
                mobile: z.ZodOptional<z.ZodAny>;
                tablet: z.ZodOptional<z.ZodAny>;
                desktop: z.ZodOptional<z.ZodAny>;
            }, "strip", z.ZodTypeAny, {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            }, {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            }>>;
        }, "strip", z.ZodTypeAny, {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        }, {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        }>>;
        fields: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
            name: z.ZodString;
            kind: z.ZodEnum<["text", "email", "phone", "number", "password", "textarea", "select", "multiselect", "radio", "checkbox", "date", "datetime", "custom"]>;
            ui: z.ZodOptional<z.ZodObject<{
                labelKey: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
                placeholderKey: z.ZodOptional<z.ZodString>;
                placeholder: z.ZodOptional<z.ZodString>;
                descriptionKey: z.ZodOptional<z.ZodString>;
                description: z.ZodOptional<z.ZodString>;
                tooltipKey: z.ZodOptional<z.ZodString>;
                tooltip: z.ZodOptional<z.ZodString>;
                colSpan: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            }, {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            }>>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                labelKey: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }, {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }>, "many">>;
            defaultValue: z.ZodOptional<z.ZodAny>;
            condition: z.ZodOptional<z.ZodType<ConditionRule, z.ZodTypeDef, ConditionRule>>;
            conditions: z.ZodOptional<z.ZodType<MultiConditionRule, z.ZodTypeDef, MultiConditionRule>>;
            customComponentType: z.ZodOptional<z.ZodString>;
            validation: z.ZodOptional<z.ZodObject<{
                required: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodObject<{
                    messageKey: z.ZodOptional<z.ZodString>;
                    message: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                }, {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                }>]>>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                minLength: z.ZodOptional<z.ZodNumber>;
                maxLength: z.ZodOptional<z.ZodNumber>;
                pattern: z.ZodOptional<z.ZodObject<{
                    value: z.ZodString;
                    messageKey: z.ZodOptional<z.ZodString>;
                    message: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                }, {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                }>>;
                validate: z.ZodOptional<z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>>;
            }, "strip", z.ZodTypeAny, {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            }, {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }>, "many">;
        submit: z.ZodOptional<z.ZodObject<{
            labelKey: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
            size: z.ZodOptional<z.ZodEnum<["xs", "sm", "md", "lg", "xl"]>>;
        }, "strip", z.ZodTypeAny, {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        }, {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        fields: {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        } | undefined;
        submit?: {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        } | undefined;
    }, {
        fields: {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        } | undefined;
        submit?: {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    form: {
        fields: {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        } | undefined;
        submit?: {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        } | undefined;
    };
    version: string;
    minClient?: string | undefined;
    minSupportedClient?: string | undefined;
}, {
    form: {
        fields: {
            name: string;
            kind: "number" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "date" | "datetime" | "custom";
            options?: {
                value: string;
                labelKey?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            validation?: {
                required?: string | boolean | {
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                min?: number | undefined;
                max?: number | undefined;
                minLength?: number | undefined;
                maxLength?: number | undefined;
                pattern?: {
                    value: string;
                    message?: string | undefined;
                    messageKey?: string | undefined;
                } | undefined;
                validate?: ((...args: unknown[]) => unknown) | undefined;
            } | undefined;
            ui?: {
                labelKey?: string | undefined;
                label?: string | undefined;
                placeholderKey?: string | undefined;
                placeholder?: string | undefined;
                descriptionKey?: string | undefined;
                description?: string | undefined;
                tooltipKey?: string | undefined;
                tooltip?: string | undefined;
                colSpan?: number | undefined;
            } | undefined;
            defaultValue?: any;
            condition?: ConditionRule | undefined;
            conditions?: MultiConditionRule | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: any;
                tablet?: any;
                desktop?: any;
            } | undefined;
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            columns?: number | "1" | "2" | "3" | "4" | undefined;
            columnGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            rowGap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | undefined;
            steps?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
        } | undefined;
        submit?: {
            labelKey?: string | undefined;
            label?: string | undefined;
            size?: "xs" | "sm" | "md" | "lg" | "xl" | undefined;
        } | undefined;
    };
    version: string;
    minClient?: string | undefined;
    minSupportedClient?: string | undefined;
}>;
export declare const tableSchemaValidator: z.ZodObject<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
} & {
    table: z.ZodObject<{
        dataSource: z.ZodObject<{
            type: z.ZodLiteral<"api">;
            endpoint: z.ZodString;
            method: z.ZodOptional<z.ZodEnum<["GET", "POST"]>>;
        }, "strip", z.ZodTypeAny, {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        }, {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        }>;
        columns: z.ZodArray<z.ZodEffects<z.ZodObject<{
            key: z.ZodString;
            labelKey: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
            width: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
            sortable: z.ZodOptional<z.ZodBoolean>;
            filterable: z.ZodOptional<z.ZodBoolean>;
            type: z.ZodOptional<z.ZodEnum<["text", "number", "date", "tag", "badge", "custom"]>>;
            render: z.ZodOptional<z.ZodEnum<["text", "date", "number", "currency", "custom"]>>;
        }, "strip", z.ZodTypeAny, {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }>, {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }>, "many">;
        rowActions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        bulkActions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        pagination: z.ZodOptional<z.ZodObject<{
            pageSizeOptions: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
            defaultPageSize: z.ZodOptional<z.ZodNumber>;
            pageSize: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        }, {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        }>>;
        selection: z.ZodOptional<z.ZodEnum<["none", "single", "multiple"]>>;
        virtualization: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        columns: {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }[];
        dataSource: {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        };
        rowActions?: string[] | undefined;
        bulkActions?: string[] | undefined;
        pagination?: {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        } | undefined;
        selection?: "none" | "single" | "multiple" | undefined;
        virtualization?: boolean | undefined;
    }, {
        columns: {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }[];
        dataSource: {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        };
        rowActions?: string[] | undefined;
        bulkActions?: string[] | undefined;
        pagination?: {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        } | undefined;
        selection?: "none" | "single" | "multiple" | undefined;
        virtualization?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    table: {
        columns: {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }[];
        dataSource: {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        };
        rowActions?: string[] | undefined;
        bulkActions?: string[] | undefined;
        pagination?: {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        } | undefined;
        selection?: "none" | "single" | "multiple" | undefined;
        virtualization?: boolean | undefined;
    };
    version: string;
    minClient?: string | undefined;
    minSupportedClient?: string | undefined;
}, {
    table: {
        columns: {
            key: string;
            type?: "number" | "text" | "date" | "custom" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "text" | "date" | "custom" | "currency" | undefined;
        }[];
        dataSource: {
            type: "api";
            endpoint: string;
            method?: "GET" | "POST" | undefined;
        };
        rowActions?: string[] | undefined;
        bulkActions?: string[] | undefined;
        pagination?: {
            pageSizeOptions?: number[] | undefined;
            defaultPageSize?: number | undefined;
            pageSize?: number | undefined;
        } | undefined;
        selection?: "none" | "single" | "multiple" | undefined;
        virtualization?: boolean | undefined;
    };
    version: string;
    minClient?: string | undefined;
    minSupportedClient?: string | undefined;
}>;
/**
 * Schema Validator
 *
 * [불�? 규칙] ?�행 ?�드 존재??검�??�함
 */
export declare function validateSchema(schema: unknown): {
    valid: boolean;
    errors?: z.ZodError;
};
/**
 * Schema Version 체크
 *
 * SDUI v1.1: minClient를 사용하여 클라이언트 버전 호환성 체크
 */
export declare function checkSchemaVersion(schema: SchemaVersion, clientVersion: string): {
    compatible: boolean;
    requiresUpdate?: boolean;
    requiresMigration?: boolean;
};
//# sourceMappingURL=validator.d.ts.map