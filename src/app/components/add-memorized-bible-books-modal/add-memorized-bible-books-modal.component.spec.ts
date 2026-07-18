import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddMemorizedBibleBooksModalComponent } from './add-memorized-bible-books-modal.component';
import { MemorizationService } from '../../services/memorization.service';
import { ToastService } from '../../services/toast.service';

describe('AddMemorizedBibleBooksModalComponent', () => {
  let component: AddMemorizedBibleBooksModalComponent;
  let addBibleBooks: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    addBibleBooks = vi.fn(async () => ({ ok: true }));
    toast = { success: vi.fn(), error: vi.fn() };
    component = new AddMemorizedBibleBooksModalComponent(
      { addBibleBooks } as unknown as MemorizationService,
      toast as unknown as ToastService
    );
    component.isOpen = true;
    component.scope = 'ot';
  });

  it('adds bible books and emits on success', async () => {
    const added = vi.fn();
    const onClose = vi.fn();
    component.added.subscribe(added);
    component.onClose.subscribe(onClose);

    await component.handleAdd();

    expect(addBibleBooks).toHaveBeenCalledWith('ot', 'esv');
    expect(toast.success).toHaveBeenCalledWith(
      'Added Bible Books (OT) to your memorization list.'
    );
    expect(added).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(component.submitting).toBe(false);
  });

  it('shows duplicate error without closing', async () => {
    addBibleBooks.mockResolvedValue({ ok: false, reason: 'duplicate' });
    const onClose = vi.fn();
    component.onClose.subscribe(onClose);

    await component.handleAdd();

    expect(toast.error).toHaveBeenCalledWith(
      'Bible Books (OT) is already in your memorization list.'
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
