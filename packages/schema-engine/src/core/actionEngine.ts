/**
 * Action Engine
 * 
 * SDUI v1.1: ?�키마에 ?�의???�션???�행?�는 ?�진
 * 
 * 기술문서: SDUI 기술문서 v1.1 - 13. Action Engine
 */

import type { ActionDefinition } from '../types';

export interface ActionContext {
  formData?: Record<string, any>;
  selectedRows?: any[];
  navigate?: (path: string) => void;
  openDrawer?: (schemaKey: string) => void;
  openModal?: (schemaKey: string) => void;
  setFormValue?: (field: string, value: any) => void;
  resetForm?: () => void;
  reloadSchema?: () => Promise<void>;
  showToast?: (message: string, variant: 'success' | 'error' | 'warning' | 'info') => void;
  showConfirm?: (title: string, message: string) => Promise<boolean>;
  apiCall?: (endpoint: string, method: string, body?: any) => Promise<any>;
  translations?: Record<string, string>;  // i18n 번역
}

/**
 * Action Engine
 * 
 * ?�키마에 ?�의???�션???�행?�니??
 * 
 * @param action - ?�행???�션 ?�의
 * @param context - ?�행 컨텍?�트
 * @returns ?�행 결과
 */
export async function executeAction(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { type } = action;
  const translations = context.translations || {};  // SDUI v1.1: context?�서 translations 가?�오�?
  try {
    switch (type) {
      case 'api.call':
        return await executeApiCall(action, context);
      
      case 'navigate':
        return executeNavigate(action, context);
      
      case 'openDrawer':
        return executeOpenDrawer(action, context);
      
      case 'openModal':
        return executeOpenModal(action, context);
      
      case 'setValue':
        return executeSetValue(action, context);
      
      case 'reset':
        return executeReset(action, context);
      
      case 'reloadSchema':
        return await executeReloadSchema(action, context);
      
      case 'toast':
        return executeToast(action, context, translations);
      
      case 'confirm':
        return await executeConfirm(action, context, translations);
      
      case 'sequence':
        return await executeSequence(action, context);
      
      default:
        console.warn(`Unknown action type: ${type}`);
        return null;
    }
  } catch (error) {
    console.error(`Action execution failed: ${type}`, error);
    throw error;
  }
}

/**
 * API ?�출 ?�행
 * 
 * SDUI v1.1: @api-sdk/core�??�한 API ?�출 (권장)
 * context.apiCall???�으�?기본 fetch ?�용
 */
async function executeApiCall(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { endpoint, method = 'POST', body } = action;
  
  if (!endpoint) {
    throw new Error('API call action requires endpoint');
  }

  // body 처리
  let requestBody: any = body;
  if (body === 'form' && context.formData) {
    requestBody = context.formData;
  } else if (body === 'selectedRows' && context.selectedRows) {
    requestBody = context.selectedRows;
  }

  // ?�️ 중요: Zero-Trust ?�칙 - context.apiCall ?�는 @api-sdk/core�??�용
  // fetch fallback?� ?�거?�었?�니??
  if (context.apiCall) {
    return await context.apiCall(endpoint, method, requestBody);
  }

  // @api-sdk/core�??�한 API ?�출 (?�수)
  // ?�️ 중요: apiClient.call()?� table/id/action ?�식???�드?�인?�만 지?�합?�다.
  // ?�반 HTTP ?�드?�인?�는 context.apiCall???�용?�거?? 직접 fetch�??�용?�야 ?�니??
  // ?��?�?Zero-Trust ?�칙???�라 context.apiCall???�선 ?�용?�니??
  try {
    // apiClient.call()?� ?�정 ?�식(table/id/action)�?지?�하므�?
    // ?�반 HTTP ?�드?�인?�의 경우 context.apiCall???�수?�니??
    // context.apiCall???�으�??�러�?발생?�킵?�다.
    throw new Error(
      `API call requires context.apiCall for custom endpoints. ` +
      `apiClient.call() only supports table/id/action format. ` +
      `Please provide context.apiCall in ActionContext.`
    );
  } catch (importError) {
    // ?�️ 중요: @api-sdk/core가 ?�으�?API ?�출 ?�패
    // Zero-Trust ?�칙???�라 fetch fallback?� ?�공?��? ?�습?�다.
    throw new Error(
      `API call failed: @api-sdk/core is required but not available. ` +
      `Please provide context.apiCall or ensure @api-sdk/core is installed.`
    );
  }
}

/**
 * ?�비게이???�행
 */
function executeNavigate(
  action: ActionDefinition,
  context: ActionContext
): void {
  const { to } = action;
  
  if (!to) {
    throw new Error('Navigate action requires "to" path');
  }

  if (!context.navigate) {
    throw new Error('navigate function not provided in context');
  }

  context.navigate(to);
}

/**
 * Drawer ?�기
 */
function executeOpenDrawer(
  action: ActionDefinition,
  context: ActionContext
): void {
  const { schemaKey } = action;
  
  if (!schemaKey) {
    throw new Error('OpenDrawer action requires schemaKey');
  }

  if (!context.openDrawer) {
    throw new Error('openDrawer function not provided in context');
  }

  context.openDrawer(schemaKey);
}

/**
 * Modal ?�기
 */
function executeOpenModal(
  action: ActionDefinition,
  context: ActionContext
): void {
  const { schemaKey } = action;
  
  if (!schemaKey) {
    throw new Error('OpenModal action requires schemaKey');
  }

  if (!context.openModal) {
    throw new Error('openModal function not provided in context');
  }

  context.openModal(schemaKey);
}

/**
 * ?�드 �??�정
 */
function executeSetValue(
  action: ActionDefinition,
  context: ActionContext
): void {
  const { field, value } = action;
  
  if (!field) {
    throw new Error('SetValue action requires field');
  }

  if (!context.setFormValue) {
    throw new Error('setFormValue function not provided in context');
  }

  context.setFormValue(field, value);
}

/**
 * ??리셋
 */
function executeReset(
  action: ActionDefinition,
  context: ActionContext
): void {
  if (!context.resetForm) {
    throw new Error('resetForm function not provided in context');
  }

  context.resetForm();
}

/**
 * ?�키�??�로?? */
async function executeReloadSchema(
  action: ActionDefinition,
  context: ActionContext
): Promise<void> {
  if (!context.reloadSchema) {
    throw new Error('reloadSchema function not provided in context');
  }

  await context.reloadSchema();
}

/**
 * Toast 메시지 ?�시
 */
function executeToast(
  action: ActionDefinition,
  context: ActionContext,
  translations: Record<string, string>
): void {
  const { messageKey, message, variant = 'info' } = action;
  
  const toastMessage = messageKey 
    ? (translations[messageKey] || messageKey)
    : (message || '');
  
  if (!toastMessage) {
    throw new Error('Toast action requires messageKey or message');
  }

  if (!context.showToast) {
    throw new Error('showToast function not provided in context');
  }

  context.showToast(toastMessage, variant);
}

/**
 * ?�인 ?�???�자 ?�시
 */
async function executeConfirm(
  action: ActionDefinition,
  context: ActionContext,
  translations: Record<string, string>
): Promise<boolean> {
  const { titleKey, title, confirmMessageKey, confirmMessage: confirmMsg } = action;
  
  const confirmTitle = titleKey 
    ? (translations[titleKey] || titleKey)
    : (title || '');
  
  const finalConfirmMessage = confirmMessageKey
    ? (translations[confirmMessageKey] || confirmMessageKey)
    : (confirmMsg || '');

  if (!confirmTitle || !finalConfirmMessage) {
    throw new Error('Confirm action requires titleKey/title and confirmMessageKey/confirmMessage');
  }

  if (!context.showConfirm) {
    throw new Error('showConfirm function not provided in context');
  }

  return await context.showConfirm(confirmTitle, finalConfirmMessage);
}

/**
 * ?�차 ?�행
 */
async function executeSequence(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { actions } = action;
  
  if (!actions || actions.length === 0) {
    throw new Error('Sequence action requires actions array');
  }

  const results: any[] = [];
  
  for (const subAction of actions) {
    const result = await executeAction(subAction, context);
    results.push(result);
  }
  
  return results;
}

/**
 * ?�벤?�에 ?�당?�는 ?�션?�을 ?�행
 * 
 * @param event - ?�벤???�름 (?? 'onSubmit', 'onSubmitSuccess')
 * @param actions - ?�션 ?�의 배열
 * @param context - ?�행 컨텍?�트
 */
export async function executeActionsForEvent(
  event: string,
  actions: ActionDefinition[],
  context: ActionContext
): Promise<any[]> {
  const relevantActions = actions.filter((action) => action.event === event);
  
  const results: any[] = [];
  
  for (const action of relevantActions) {
    try {
      const result = await executeAction(action, context);
      results.push(result);
    } catch (error) {
      console.error(`Failed to execute action for event ${event}:`, error);
      // ?�러가 발생?�도 ?�음 ?�션?� 계속 ?�행
    }
  }
  
  return results;
}

