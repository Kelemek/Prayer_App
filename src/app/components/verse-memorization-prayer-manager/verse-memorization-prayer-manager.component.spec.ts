import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerseMemorizationPrayerManagerComponent } from './verse-memorization-prayer-manager.component';
import { VerseMemorizationPrayerService } from '../../services/verse-memorization-prayer.service';
import { MemorizationService } from '../../services/memorization.service';
import { ToastService } from '../../services/toast.service';
import { ApplicationRef, ChangeDetectorRef } from '@angular/core';

describe('VerseMemorizationPrayerManagerComponent', () => {
  let component: VerseMemorizationPrayerManagerComponent;
  let createVerseMemorizationPrayer: ReturnType<typeof vi.fn>;
  let broadcast: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    createVerseMemorizationPrayer = vi.fn();
    broadcast = vi.fn();
    toast = { success: vi.fn(), error: vi.fn() };
    component = new VerseMemorizationPrayerManagerComponent(
      {
        createVerseMemorizationPrayer,
        broadcastVerseMemorizationPrayerNotifications: broadcast,
      } as VerseMemorizationPrayerService,
      { getPreferredTranslation: () => 'esv' } as MemorizationService,
      toast as ToastService,
      { markForCheck: vi.fn(), detectChanges: vi.fn() } as ChangeDetectorRef,
      { tick: vi.fn() } as ApplicationRef
    );
  });

  it('toggles section expansion', () => {
    component.onSectionToggle();
    expect(component.sectionExpanded).toBe(true);
    component.onSectionToggle();
    expect(component.sectionExpanded).toBe(false);
  });

  it('opens picker and confirms passage into send panel', () => {
    component.openPicker();
    expect(component.showPicker).toBe(true);
    component.onPassageConfirmed('John 3:16');
    expect(component.showPicker).toBe(false);
    expect(component.showSendPanel).toBe(true);
    expect(component.pendingReference).toBe('John 3:16');
  });

  it('cancels send panel', () => {
    component.onPassageConfirmed('Romans 8:28');
    component.cancelSend();
    expect(component.showSendPanel).toBe(false);
    expect(component.pendingReference).toBeNull();
  });

  it('publishes verse prayer and opens notification dialog', async () => {
    component.onPassageConfirmed('John 3:16');
    createVerseMemorizationPrayer.mockResolvedValue({
      ok: true,
      prayerId: 'p1',
      verseText: 'For God so loved…',
    });
    await component.sendVersePrayer();
    expect(toast.success).toHaveBeenCalled();
    expect(component.showSendNotificationDialog).toBe(true);
  });

  it('surfaces failure reasons from create service', async () => {
    component.onPassageConfirmed('John 3:16');
    createVerseMemorizationPrayer.mockResolvedValue({ ok: false, reason: 'no_passage' });
    await component.sendVersePrayer();
    expect(toast.error).toHaveBeenCalledWith('No text returned for this passage.');
  });

  it('broadcasts notifications when confirmed', async () => {
    component.onPassageConfirmed('John 3:16');
    createVerseMemorizationPrayer.mockResolvedValue({
      ok: true,
      prayerId: 'p1',
      verseText: 'text',
    });
    await component.sendVersePrayer();
    broadcast.mockResolvedValue(undefined);
    await component.onConfirmSendNotification();
    expect(broadcast).toHaveBeenCalled();
    expect(component.showSendNotificationDialog).toBe(false);
  });

  it('declines notification dialog', () => {
    component.showSendNotificationDialog = true;
    component.onDeclineSendNotification();
    expect(component.showSendNotificationDialog).toBe(false);
  });
});
