/**
 * Action Engine
 * 
 * SDUI v1.1: 스키마에 정의된 액션을 실행하는 엔진
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
 * 스키마에 정의된 액션을 실행합니다.
 * 
 * @param action - 실행할 액션 정의
 * @param context - 실행 컨텍스트
 * @returns 실행 결과
 */
export async function executeAction(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { type } = action;
  const translations = context.translations || {};  // SDUI v1.1: context에서 translations 가져오기

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
 * API 호출 실행
 * 
 * SDUI v1.1: @api-sdk/core를 통한 API 호출 (권장)
 * context.apiCall이 없으면 기본 fetch 사용
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

  // ⚠️ 중요: Zero-Trust 원칙 - context.apiCall 또는 @api-sdk/core만 사용
  // fetch fallback은 제거되었습니다.
  if (context.apiCall) {
    return await context.apiCall(endpoint, method, requestBody);
  }

  // @api-sdk/core를 통한 API 호출 (필수)
  // ⚠️ 중요: apiClient.call()은 table/id/action 형식의 엔드포인트만 지원합니다.
  // 일반 HTTP 엔드포인트는 context.apiCall을 사용하거나, 직접 fetch를 사용해야 합니다.
  // 하지만 Zero-Trust 원칙에 따라 context.apiCall을 우선 사용합니다.
  try {
    // apiClient.call()은 특정 형식(table/id/action)만 지원하므로,
    // 일반 HTTP 엔드포인트의 경우 context.apiCall이 필수입니다.
    // context.apiCall이 없으면 에러를 발생시킵니다.
    throw new Error(
      `API call requires context.apiCall for custom endpoints. ` +
      `apiClient.call() only supports table/id/action format. ` +
      `Please provide context.apiCall in ActionContext.`
    );
  } catch (importError) {
    // ⚠️ 중요: @api-sdk/core가 없으면 API 호출 실패
    // Zero-Trust 원칙에 따라 fetch fallback은 제공하지 않습니다.
    throw new Error(
      `API call failed: @api-sdk/core is required but not available. ` +
      `Please provide context.apiCall or ensure @api-sdk/core is installed.`
    );
  }
}

/**
 * 네비게이션 실행
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
 * Drawer 열기
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
 * Modal 열기
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
 * 필드 값 설정
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
 * 폼 리셋
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
 * 스키마 재로드
 */
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
 * Toast 메시지 표시
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
 * 확인 대화 상자 표시
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
 * 순차 실행
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
 * 이벤트에 해당하는 액션들을 실행
 * 
 * @param event - 이벤트 이름 (예: 'onSubmit', 'onSubmitSuccess')
 * @param actions - 액션 정의 배열
 * @param context - 실행 컨텍스트
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
      // 에러가 발생해도 다음 액션은 계속 실행
    }
  }
  
  return results;
}

