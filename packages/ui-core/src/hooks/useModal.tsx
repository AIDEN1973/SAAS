/**
 * useModal Hook
 * 
 * ?„ì—­ ëª¨ë‹¬ ì»¨í…?¤íŠ¸ ê¸°ë°˜ Alert/Confirm ëª¨ë‹¬ ê´€ë¦?Hook
 * [ë¶ˆë? ê·œì¹™] ëª¨ë“  ?¤í??¼ì? design-system ? í°???¬ìš©?œë‹¤.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';

// Alert Modal ?€??
interface AlertModal {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

// Confirm Modal ?€??
interface ConfirmModal {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Context ?€??
interface ModalContextType {
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

/**
 * Modal Provider ì»´í¬?ŒíŠ¸
 * 
 * ??ìµœìƒ?„ì— ë°°ì¹˜?˜ì—¬ ?„ì—­ ëª¨ë‹¬ ê´€ë¦?
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [alertModal, setAlertModal] = useState<AlertModal>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = useCallback((
    message: string,
    title: string = '?Œë¦¼',
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
    });
  }, []);

  const showConfirm = useCallback((
    message: string,
    title: string = '?•ì¸'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        size="sm"
        closeOnOverlayClick={true}
        footer={
          <Button
            variant="solid"
            color={
              alertModal.type === 'error'
                ? 'error'
                : alertModal.type === 'warning'
                ? 'warning'
                : alertModal.type === 'success'
                ? 'success'
                : 'primary'
            }
            onClick={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
            fullWidth
          >
            ?•ì¸
          </Button>
        }
      >
        <div
          style={{
            whiteSpace: 'pre-line',
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text)',
            lineHeight: '1.6',
          }}
        >
          {alertModal.message}
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.onCancel || (() => setConfirmModal((prev) => ({ ...prev, isOpen: false })))}
        title={confirmModal.title}
        size="sm"
        closeOnOverlayClick={false}
        footer={
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', width: '100%' }}>
            <Button
              variant="outline"
              onClick={confirmModal.onCancel || (() => setConfirmModal((prev) => ({ ...prev, isOpen: false })))}
              style={{ flex: 1 }}
            >
              ì·¨ì†Œ
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={confirmModal.onConfirm || (() => setConfirmModal((prev) => ({ ...prev, isOpen: false })))}
              style={{ flex: 1 }}
            >
              ?•ì¸
            </Button>
          </div>
        }
      >
        <div
          style={{
            whiteSpace: 'pre-line',
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-text)',
            lineHeight: '1.6',
          }}
        >
          {confirmModal.message}
        </div>
      </Modal>
    </ModalContext.Provider>
  );
}

/**
 * useModal Hook
 * 
 * ?„ì—­ ëª¨ë‹¬ ì»¨í…?¤íŠ¸?ì„œ showAlert, showConfirm ?¨ìˆ˜ë¥?ê°€?¸ì˜´
 */
export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}

