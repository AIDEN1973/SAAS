/**
 * Action Engine
 *
 * SDUI v1.1: 스키마에 정의된 액션을 실행하는 엔진
 *
 * 기술문서: SDUI 기술문서 v1.1 - 13. Action Engine
 */
import type { ActionDefinition } from '../types';
export interface ActionContext {
    formData?: Record<string, unknown>;
    selectedRows?: unknown[];
    navigate?: (path: string) => void;
    openDrawer?: (schemaKey: string) => void;
    openModal?: (schemaKey: string) => void;
    setFormValue?: (field: string, value: unknown) => void;
    resetForm?: () => void;
    reloadSchema?: () => Promise<void>;
    showToast?: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void;
    showConfirm?: (title: string, message: string) => Promise<boolean>;
    apiCall?: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
    translations?: Record<string, string>;
}
/**
 * Action Engine
 *
 * 스키마에 정의된 액션을 실행합니다.
 *
 * @param action - 실행할 액션 정의
 * @param context - 실행 컨텍스트
 * @returns 실행 결과
 */
export declare function executeAction(action: ActionDefinition, context: ActionContext): Promise<unknown>;
/**
 * 이벤트에 해당하는 액션들을 실행
 *
 * @param event - 이벤트 이름 (예: 'onSubmit', 'onSubmitSuccess')
 * @param actions - 액션 정의 배열
 * @param context - 실행 컨텍스트
 */
export declare function executeActionsForEvent(event: string, actions: ActionDefinition[], context: ActionContext): Promise<unknown[]>;
//# sourceMappingURL=actionEngine.d.ts.map