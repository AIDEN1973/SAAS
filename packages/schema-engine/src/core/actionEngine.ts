/**
 * Action Engine
 * 
 * SDUI v1.1: ?¤í‚¤ë§ˆì— ?•ì˜???¡ì…˜???¤í–‰?˜ëŠ” ?”ì§„
 * 
 * ê¸°ìˆ ë¬¸ì„œ: SDUI ê¸°ìˆ ë¬¸ì„œ v1.1 - 13. Action Engine
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
  translations?: Record<string, string>;  // i18n ë²ˆì—­
}

/**
 * Action Engine
 * 
 * ?¤í‚¤ë§ˆì— ?•ì˜???¡ì…˜???¤í–‰?©ë‹ˆ??
 * 
 * @param action - ?¤í–‰???¡ì…˜ ?•ì˜
 * @param context - ?¤í–‰ ì»¨í…?¤íŠ¸
 * @returns ?¤í–‰ ê²°ê³¼
 */
export async function executeAction(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { type } = action;
  const translations = context.translations || {};  // SDUI v1.1: context?ì„œ translations ê°€?¸ì˜¤ê¸?
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
 * API ?¸ì¶œ ?¤í–‰
 * 
 * SDUI v1.1: @api-sdk/coreë¥??µí•œ API ?¸ì¶œ (ê¶Œì¥)
 * context.apiCall???†ìœ¼ë©?ê¸°ë³¸ fetch ?¬ìš©
 */
async function executeApiCall(
  action: ActionDefinition,
  context: ActionContext
): Promise<any> {
  const { endpoint, method = 'POST', body } = action;
  
  if (!endpoint) {
    throw new Error('API call action requires endpoint');
  }

  // body ì²˜ë¦¬
  let requestBody: any = body;
  if (body === 'form' && context.formData) {
    requestBody = context.formData;
  } else if (body === 'selectedRows' && context.selectedRows) {
    requestBody = context.selectedRows;
  }

  // ? ï¸ ì¤‘ìš”: Zero-Trust ?ì¹™ - context.apiCall ?ëŠ” @api-sdk/coreë§??¬ìš©
  // fetch fallback?€ ?œê±°?˜ì—ˆ?µë‹ˆ??
  if (context.apiCall) {
    return await context.apiCall(endpoint, method, requestBody);
  }

  // @api-sdk/coreë¥??µí•œ API ?¸ì¶œ (?„ìˆ˜)
  // ? ï¸ ì¤‘ìš”: apiClient.call()?€ table/id/action ?•ì‹???”ë“œ?¬ì¸?¸ë§Œ ì§€?í•©?ˆë‹¤.
  // ?¼ë°˜ HTTP ?”ë“œ?¬ì¸?¸ëŠ” context.apiCall???¬ìš©?˜ê±°?? ì§ì ‘ fetchë¥??¬ìš©?´ì•¼ ?©ë‹ˆ??
  // ?˜ì?ë§?Zero-Trust ?ì¹™???°ë¼ context.apiCall???°ì„  ?¬ìš©?©ë‹ˆ??
  try {
    // apiClient.call()?€ ?¹ì • ?•ì‹(table/id/action)ë§?ì§€?í•˜ë¯€ë¡?
    // ?¼ë°˜ HTTP ?”ë“œ?¬ì¸?¸ì˜ ê²½ìš° context.apiCall???„ìˆ˜?…ë‹ˆ??
    // context.apiCall???†ìœ¼ë©??ëŸ¬ë¥?ë°œìƒ?œí‚µ?ˆë‹¤.
    throw new Error(
      `API call requires context.apiCall for custom endpoints. ` +
      `apiClient.call() only supports table/id/action format. ` +
      `Please provide context.apiCall in ActionContext.`
    );
  } catch (importError) {
    // ? ï¸ ì¤‘ìš”: @api-sdk/coreê°€ ?†ìœ¼ë©?API ?¸ì¶œ ?¤íŒ¨
    // Zero-Trust ?ì¹™???°ë¼ fetch fallback?€ ?œê³µ?˜ì? ?ŠìŠµ?ˆë‹¤.
    throw new Error(
      `API call failed: @api-sdk/core is required but not available. ` +
      `Please provide context.apiCall or ensure @api-sdk/core is installed.`
    );
  }
}

/**
 * ?¤ë¹„ê²Œì´???¤í–‰
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
 * Drawer ?´ê¸°
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
 * Modal ?´ê¸°
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
 * ?„ë“œ ê°??¤ì •
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
 * ??ë¦¬ì…‹
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
 * ?¤í‚¤ë§??¬ë¡œ?? */
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
 * Toast ë©”ì‹œì§€ ?œì‹œ
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
 * ?•ì¸ ?€???ì ?œì‹œ
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
 * ?œì°¨ ?¤í–‰
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
 * ?´ë²¤?¸ì— ?´ë‹¹?˜ëŠ” ?¡ì…˜?¤ì„ ?¤í–‰
 * 
 * @param event - ?´ë²¤???´ë¦„ (?? 'onSubmit', 'onSubmitSuccess')
 * @param actions - ?¡ì…˜ ?•ì˜ ë°°ì—´
 * @param context - ?¤í–‰ ì»¨í…?¤íŠ¸
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
      // ?ëŸ¬ê°€ ë°œìƒ?´ë„ ?¤ìŒ ?¡ì…˜?€ ê³„ì† ?¤í–‰
    }
  }
  
  return results;
}

