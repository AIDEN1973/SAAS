/**
 * Meta-Schema Validator
 *
 * [불변 규칙] 스키마 구조는 다음 계층에서 검증
 * - 개발(local dev)
 * - CI 빌드 계층
 * - 클라이언트 배포 시
 * - Schema Registry에 등록 시점
 */
import { z } from 'zod';
import { SchemaVersion } from './types';
/**
 * Form Schema Validator
 */
export declare const formSchemaValidator: z.ZodObject<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
} & {
    type: z.ZodLiteral<"form">;
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
                mobile: z.ZodOptional<z.ZodUnknown>;
                tablet: z.ZodOptional<z.ZodUnknown>;
                desktop: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }>>;
        }, "strip", z.ZodTypeAny, {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            defaultValue: z.ZodOptional<z.ZodUnknown>;
            condition: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                field: z.ZodString;
                op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                value: z.ZodOptional<z.ZodUnknown>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
            conditions: z.ZodOptional<z.ZodObject<{
                conditions: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                    field: z.ZodString;
                    op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                    value: z.ZodOptional<z.ZodUnknown>;
                    then: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    else: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
                }, "strip", z.ZodTypeAny, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, "many">;
                logic: z.ZodEnum<["and", "or"]>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
} & {
    type: z.ZodLiteral<"form">;
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
                mobile: z.ZodOptional<z.ZodUnknown>;
                tablet: z.ZodOptional<z.ZodUnknown>;
                desktop: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }>>;
        }, "strip", z.ZodTypeAny, {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            defaultValue: z.ZodOptional<z.ZodUnknown>;
            condition: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                field: z.ZodString;
                op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                value: z.ZodOptional<z.ZodUnknown>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
            conditions: z.ZodOptional<z.ZodObject<{
                conditions: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                    field: z.ZodString;
                    op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                    value: z.ZodOptional<z.ZodUnknown>;
                    then: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    else: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
                }, "strip", z.ZodTypeAny, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, "many">;
                logic: z.ZodEnum<["and", "or"]>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
} & {
    type: z.ZodLiteral<"form">;
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
                mobile: z.ZodOptional<z.ZodUnknown>;
                tablet: z.ZodOptional<z.ZodUnknown>;
                desktop: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }, {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            }>>;
        }, "strip", z.ZodTypeAny, {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            defaultValue: z.ZodOptional<z.ZodUnknown>;
            condition: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                field: z.ZodString;
                op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                value: z.ZodOptional<z.ZodUnknown>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
            conditions: z.ZodOptional<z.ZodObject<{
                conditions: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodObject<{
                    field: z.ZodString;
                    op: z.ZodEnum<["==", "!=", "eq", "ne", "in", "not_in", "exists", "not_exists", "gt", "gte", "lt", "lte", ">", ">=", "<", "<="]>;
                    value: z.ZodOptional<z.ZodUnknown>;
                    then: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    else: z.ZodOptional<z.ZodObject<{
                        hide: z.ZodOptional<z.ZodBoolean>;
                        disable: z.ZodOptional<z.ZodBoolean>;
                        require: z.ZodOptional<z.ZodBoolean>;
                        setValue: z.ZodOptional<z.ZodUnknown>;
                        setOptions: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<["static", "api"]>;
                            options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                            endpoint: z.ZodOptional<z.ZodString>;
                        }, "strip", z.ZodTypeAny, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }, {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        }>>;
                        switchComponent: z.ZodOptional<z.ZodObject<{
                            to: z.ZodString;
                        }, "strip", z.ZodTypeAny, {
                            to: string;
                        }, {
                            to: string;
                        }>>;
                    }, "strip", z.ZodTypeAny, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }, {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    }>>;
                    action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
                }, "strip", z.ZodTypeAny, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }, {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }>, "many">;
                logic: z.ZodEnum<["and", "or"]>;
                then: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                else: z.ZodOptional<z.ZodObject<{
                    hide: z.ZodOptional<z.ZodBoolean>;
                    disable: z.ZodOptional<z.ZodBoolean>;
                    require: z.ZodOptional<z.ZodBoolean>;
                    setValue: z.ZodOptional<z.ZodUnknown>;
                    setOptions: z.ZodOptional<z.ZodObject<{
                        type: z.ZodEnum<["static", "api"]>;
                        options: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
                        endpoint: z.ZodOptional<z.ZodString>;
                    }, "strip", z.ZodTypeAny, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }, {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    }>>;
                    switchComponent: z.ZodOptional<z.ZodObject<{
                        to: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        to: string;
                    }, {
                        to: string;
                    }>>;
                }, "strip", z.ZodTypeAny, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }, {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                }>>;
                action: z.ZodOptional<z.ZodEnum<["show", "hide", "enable", "disable", "require"]>>;
            }, "strip", z.ZodTypeAny, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }, {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            }>>;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }>, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }, {
            name: string;
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
            kind: "number" | "date" | "custom" | "text" | "email" | "phone" | "password" | "textarea" | "select" | "multiselect" | "radio" | "checkbox" | "datetime";
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
            defaultValue?: unknown;
            condition?: {
                field: string;
                op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                value?: unknown;
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            conditions?: {
                conditions: {
                    field: string;
                    op: "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "==" | "!=" | "ne" | ">" | ">=" | "<" | "<=" | "not_in" | "exists" | "not_exists";
                    value?: unknown;
                    then?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    else?: {
                        hide?: boolean | undefined;
                        disable?: boolean | undefined;
                        require?: boolean | undefined;
                        setValue?: unknown;
                        setOptions?: {
                            type: "static" | "api";
                            options?: unknown[] | undefined;
                            endpoint?: string | undefined;
                        } | undefined;
                        switchComponent?: {
                            to: string;
                        } | undefined;
                    } | undefined;
                    action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
                }[];
                logic: "and" | "or";
                then?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                else?: {
                    hide?: boolean | undefined;
                    disable?: boolean | undefined;
                    require?: boolean | undefined;
                    setValue?: unknown;
                    setOptions?: {
                        type: "static" | "api";
                        options?: unknown[] | undefined;
                        endpoint?: string | undefined;
                    } | undefined;
                    switchComponent?: {
                        to: string;
                    } | undefined;
                } | undefined;
                action?: "show" | "hide" | "enable" | "disable" | "require" | undefined;
            } | undefined;
            customComponentType?: string | undefined;
        }[];
        layout?: {
            type?: "grid" | "section" | "tabs" | "stepper" | "drawer" | "modal" | "responsive" | undefined;
            tabs?: {
                key: string;
                labelKey?: string | undefined;
                label?: string | undefined;
                fields?: string[] | undefined;
            }[] | undefined;
            responsive?: {
                mobile?: unknown;
                tablet?: unknown;
                desktop?: unknown;
            } | undefined;
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
}, z.ZodTypeAny, "passthrough">>;
export declare const tableSchemaValidator: z.ZodObject<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }>, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }>, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    version: z.ZodString;
    minClient: z.ZodOptional<z.ZodString>;
    minSupportedClient: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }>, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
        }, {
            key: string;
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
            type?: "number" | "date" | "custom" | "text" | "tag" | "badge" | undefined;
            labelKey?: string | undefined;
            label?: string | undefined;
            width?: string | number | undefined;
            sortable?: boolean | undefined;
            filterable?: boolean | undefined;
            render?: "number" | "date" | "custom" | "text" | "currency" | undefined;
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
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema Validator
 *
 * [불변 규칙] 실행 코드 존재 여부 검증
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