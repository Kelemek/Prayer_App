import { describe, it, expect, vi } from 'vitest';
import { UserSettingsFeedbackSectionComponent } from './user-settings-feedback-section.component';

describe('UserSettingsFeedbackSectionComponent', () => {
  it('hides the feedback card until the server reports it is configured', async () => {
    const cdr = { markForCheck: vi.fn() };
    const hidden = new UserSettingsFeedbackSectionComponent(
      { isConfigured: vi.fn().mockResolvedValue(false) } as never,
      cdr as never
    );
    hidden.ngOnInit();
    await Promise.resolve();
    expect(hidden.showFeedbackForm).toBe(false);

    const shown = new UserSettingsFeedbackSectionComponent(
      { isConfigured: vi.fn().mockResolvedValue(true) } as never,
      cdr as never
    );
    shown.ngOnInit();
    await Promise.resolve();
    expect(shown.showFeedbackForm).toBe(true);
    expect(cdr.markForCheck).toHaveBeenCalled();
  });
});
