type PickerCloseHandler = () => void;

let activeClose: PickerCloseHandler | null = null;

/** Close any other open category picker before opening a new one. */
export function activatePersonalCategoryPicker(close: PickerCloseHandler): void {
  if (activeClose !== close) {
    activeClose?.();
  }
  activeClose = close;
}

export function deactivatePersonalCategoryPicker(close: PickerCloseHandler): void {
  if (activeClose === close) {
    activeClose = null;
  }
}

/** @internal Test helper */
export function resetPersonalCategoryPickerCoordinatorForTests(): void {
  activeClose = null;
}
