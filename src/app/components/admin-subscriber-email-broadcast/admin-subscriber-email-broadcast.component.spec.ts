import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { AdminSubscriberEmailBroadcastComponent } from './admin-subscriber-email-broadcast.component';
import { EmailNotificationService } from '../../services/email-notification.service';
import { ToastService } from '../../services/toast.service';

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AdminSubscriberEmailBroadcastComponent', () => {
  let mockEmail: {
    getManualBroadcastRecipientCount: ReturnType<typeof vi.fn>;
    queueAdminManualBroadcastToSubscribers: ReturnType<typeof vi.fn>;
  };
  let mockToast: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = {
      getManualBroadcastRecipientCount: vi.fn().mockResolvedValue(3),
      queueAdminManualBroadcastToSubscribers: vi.fn().mockResolvedValue({ queued: 2 }),
    };
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };
    mockCdr = {
      markForCheck: vi.fn(),
    };
  });

  function createComponent(): AdminSubscriberEmailBroadcastComponent {
    return new AdminSubscriberEmailBroadcastComponent(
      mockEmail as unknown as EmailNotificationService,
      mockToast as unknown as ToastService,
      mockCdr as unknown as ChangeDetectorRef
    );
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  describe('ngOnInit / loadRecipientCount', () => {
    it('loads recipient count on init', async () => {
      mockEmail.getManualBroadcastRecipientCount.mockResolvedValue(42);
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();

      expect(mockEmail.getManualBroadcastRecipientCount).toHaveBeenCalled();
      expect(component.recipientCount).toBe(42);
      expect(component.recipientCountLoading).toBe(false);
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it('handles load failure with toast and null count', async () => {
      mockEmail.getManualBroadcastRecipientCount.mockRejectedValue(new Error('network'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();

      expect(component.recipientCount).toBeNull();
      expect(component.recipientCountLoading).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith('Could not load subscriber count');
      consoleSpy.mockRestore();
    });
  });

  describe('toggleSection', () => {
    it('toggles expanded state and marks for check', () => {
      const component = createComponent();
      expect(component.sectionExpanded).toBe(false);
      component.toggleSection();
      expect(component.sectionExpanded).toBe(true);
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('reloads recipient count when expanding with null count', async () => {
      mockEmail.getManualBroadcastRecipientCount.mockResolvedValue(7);
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      expect(mockEmail.getManualBroadcastRecipientCount).toHaveBeenCalledTimes(1);

      component.sectionExpanded = false;
      component.recipientCount = null;
      component.recipientCountLoading = false;

      component.toggleSection();
      await flushMicrotasks();

      expect(component.sectionExpanded).toBe(true);
      expect(mockEmail.getManualBroadcastRecipientCount).toHaveBeenCalledTimes(2);
      expect(component.recipientCount).toBe(7);
    });
  });

  describe('canSend', () => {
    it('requires subject and body for html and markdown', () => {
      const component = createComponent();
      component.subject = 'Hi';
      component.bodyHtml = 'Body';
      expect(component.canSend).toBe(true);
      component.bodyHtml = '   ';
      expect(component.canSend).toBe(false);
      component.setBodyFormat('markdown');
      component.bodyMarkdown = '**x**';
      expect(component.canSend).toBe(true);
      component.subject = '';
      expect(component.canSend).toBe(false);
    });
  });

  describe('setBodyFormat', () => {
    it('switches format and marks for check', () => {
      const component = createComponent();
      component.setBodyFormat('markdown');
      expect(component.bodyFormat).toBe('markdown');
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('no-ops when format unchanged', () => {
      const component = createComponent();
      mockCdr.markForCheck.mockClear();
      component.setBodyFormat('html');
      expect(mockCdr.markForCheck).not.toHaveBeenCalled();
    });
  });

  describe('onSendClick / onConfirmSend', () => {
    it('opens confirmation when can send and recipients exist', async () => {
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.subject = 'Hello';
      component.bodyHtml = 'Body';
      component.onSendClick();
      expect(component.showConfirmDialog).toBe(true);
    });

    it('does not open dialog when cannot send or no recipients', async () => {
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.recipientCount = 0;
      component.subject = 'Hi';
      component.bodyHtml = 'Body';
      component.onSendClick();
      expect(component.showConfirmDialog).toBe(false);

      component.recipientCount = 3;
      component.subject = '';
      component.onSendClick();
      expect(component.showConfirmDialog).toBe(false);
    });

    it('onCancelSend closes confirmation dialog', () => {
      const component = createComponent();
      component.showConfirmDialog = true;
      component.onCancelSend();
      expect(component.showConfirmDialog).toBe(false);
    });

    it('queues emails on confirm', async () => {
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.subject = 'Hello';
      component.bodyHtml = 'Body';
      await component.onConfirmSend();
      expect(mockEmail.queueAdminManualBroadcastToSubscribers).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('flushes markdown editor before confirm send', async () => {
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.setBodyFormat('markdown');
      component.subject = 'Hello';
      component.bodyMarkdown = 'Body';
      const flush = vi.fn();
      component.richTextEditor = { flushMarkdownToForm: flush } as never;
      await component.onConfirmSend();
      expect(flush).toHaveBeenCalled();
    });

    it('shows info toast when queue returns zero', async () => {
      mockEmail.queueAdminManualBroadcastToSubscribers.mockResolvedValue({ queued: 0 });
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.subject = 'Hello';
      component.bodyHtml = 'Body';
      await component.onConfirmSend();
      expect(mockToast.info).toHaveBeenCalled();
    });

    it('surfaces queue errors', async () => {
      mockEmail.queueAdminManualBroadcastToSubscribers.mockRejectedValue(
        new Error('queue failed')
      );
      const component = createComponent();
      component.ngOnInit();
      await flushMicrotasks();
      component.subject = 'Hello';
      component.bodyHtml = 'Body';
      await component.onConfirmSend();
      expect(mockToast.error).toHaveBeenCalledWith('queue failed');
    });
  });
});
