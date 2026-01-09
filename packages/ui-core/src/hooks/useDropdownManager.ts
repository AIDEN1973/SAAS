/**
 * useDropdownManager Hook
 *
 * 전역 드롭다운 상태를 관리하여 한 번에 하나의 드롭다운만 열리도록 합니다.
 * Select, DatePicker 등 드롭다운 컴포넌트에서 사용합니다.
 */

type DropdownCloseCallback = () => void;

// 전역 상태: 현재 열린 드롭다운의 close 콜백
let activeDropdownClose: DropdownCloseCallback | null = null;

/**
 * 드롭다운이 열릴 때 호출합니다.
 * 기존에 열린 드롭다운이 있으면 먼저 닫습니다.
 */
export function registerOpenDropdown(closeCallback: DropdownCloseCallback): void {
  // 기존에 열린 드롭다운이 있으면 닫기
  if (activeDropdownClose && activeDropdownClose !== closeCallback) {
    activeDropdownClose();
  }
  activeDropdownClose = closeCallback;
}

/**
 * 드롭다운이 닫힐 때 호출합니다.
 * 현재 활성 드롭다운을 해제합니다.
 */
export function unregisterDropdown(closeCallback: DropdownCloseCallback): void {
  if (activeDropdownClose === closeCallback) {
    activeDropdownClose = null;
  }
}

/**
 * 현재 열린 드롭다운을 닫습니다.
 */
export function closeActiveDropdown(): void {
  if (activeDropdownClose) {
    activeDropdownClose();
    activeDropdownClose = null;
  }
}
