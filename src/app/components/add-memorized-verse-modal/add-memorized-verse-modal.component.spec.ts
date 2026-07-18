import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddMemorizedVerseModalComponent } from './add-memorized-verse-modal.component';
import { ScriptureService } from '../../services/scripture.service';
import { MemorizationService } from '../../services/memorization.service';
import { ToastService } from '../../services/toast.service';

describe('AddMemorizedVerseModalComponent', () => {
  let component: AddMemorizedVerseModalComponent;
  let scripture: { getPassage: ReturnType<typeof vi.fn> };
  let memorization: {
    getPreferredTranslation: ReturnType<typeof vi.fn>;
    addVerse: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    scripture = { getPassage: vi.fn(async () => ({ text: 'In the beginning' })) };
    memorization = {
      getPreferredTranslation: vi.fn(() => 'esv'),
      addVerse: vi.fn(async () => ({ ok: true })),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    component = new AddMemorizedVerseModalComponent(
      scripture as unknown as ScriptureService,
      memorization as unknown as MemorizationService,
      toast as unknown as ToastService
    );
  });

  it('adds passage and emits on success', async () => {
    const added = vi.fn();
    const onClose = vi.fn();
    component.added.subscribe(added);
    component.onClose.subscribe(onClose);

    await component.onPassageConfirmed('Genesis 1:1');

    expect(memorization.addVerse).toHaveBeenCalledWith(
      'Genesis 1:1',
      'esv',
      'In the beginning'
    );
    expect(toast.success).toHaveBeenCalled();
    expect(added).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(component.adding).toBe(false);
  });

  it('shows duplicate error without closing', async () => {
    memorization.addVerse.mockResolvedValue({ ok: false, reason: 'duplicate' });
    const onClose = vi.fn();
    component.onClose.subscribe(onClose);

    await component.onPassageConfirmed('John 3:16');

    expect(toast.error).toHaveBeenCalledWith(
      'This passage is already in your memorization list.'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects empty passage text', async () => {
    scripture.getPassage.mockResolvedValue({ text: '   ' });
    await component.onPassageConfirmed('John 3:16');
    expect(toast.error).toHaveBeenCalledWith('No text returned for this passage.');
    expect(memorization.addVerse).not.toHaveBeenCalled();
  });
});
