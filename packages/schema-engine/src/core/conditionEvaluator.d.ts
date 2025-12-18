/**
 * Condition Rule Evaluator
 *
 * [불변 규칙] Condition Rule 평가는 schema-engine/core에 위치합니다.
 * [불변 규칙] 단일 조건 및 복수 조건(AND/OR) 모두 지원
 * [불변 규칙] SDUI v1.1: then/else 구조, 비교 연산자 지원
 *
 * 기술문서:
 * - docu/스키마엔진.txt 7.2, 7.3
 * - SDUI 기술문서 v1.1 - 12. Condition Engine
 */
import type { ConditionRule, MultiConditionRule, FormFieldSchema } from '../types';
/**
 * 단일 Condition Rule 평가 함수
 *
 * SDUI v1.1: 비교 연산자 지원 (==, !=, not_exists)
 *
 * @param rule - 평가할 Condition Rule
 * @param fieldValue - 참조 필드의 현재 값
 * @returns 조건 충족 여부 (boolean)
 */
export declare function evaluateConditionRule(rule: ConditionRule, fieldValue: unknown): boolean;
/**
 * 복수 Condition Rule 평가 함수
 *
 * 여러 조건을 AND/OR로 결합하여 평가합니다.
 *
 * @param multiRule - MultiConditionRule
 * @param watchedValues - useWatch로 관찰한 필드 값들
 * @returns 조건 충족 여부 (boolean)
 */
export declare function evaluateMultiConditionRule(multiRule: MultiConditionRule, watchedValues: Record<string, unknown>): boolean;
/**
 * Condition Rule 집계 함수
 *
 * 필드의 Condition Rule(단일 또는 복수)을 평가하여 hidden/disabled/required 상태를 결정합니다.
 * SDUI v1.1: then/else 구조 지원 및 동적 액션(setValue, setOptions, switchComponent) 반환
 *
 * @param field - FormFieldSchema
 * @param watchedValues - useWatch로 관찰한 필드 값들 (Record<string, unknown>)
 * @returns { isHidden, isDisabled, isRequired, actions }
 */
export declare function getConditionalActions(field: FormFieldSchema, watchedValues: Record<string, unknown>): {
    isHidden: boolean;
    isDisabled: boolean;
    isRequired: boolean;
    actions?: {
        setValue?: unknown;
        setOptions?: {
            type: 'static' | 'api';
            options?: Array<{
                value: string;
                labelKey?: string;
                label?: string;
            }>;
            endpoint?: string;
        };
        switchComponent?: {
            to: string;
        };
    };
};
//# sourceMappingURL=conditionEvaluator.d.ts.map