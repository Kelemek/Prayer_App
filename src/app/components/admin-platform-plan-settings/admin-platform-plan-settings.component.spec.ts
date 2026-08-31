import { describe, it, expect, vi } from 'vitest';
import { AdminPlatformPlanSettingsComponent } from './admin-platform-plan-settings.component';
import { PlatformPlanService } from '../../services/platform-plan.service';

describe('AdminPlatformPlanSettingsComponent', () => {
  it('starts collapsed and loads settings on first expand', async () => {
    const loadSettings = vi.fn().mockResolvedValue({ limits: [], practice_modes: [] });
    const component = new AdminPlatformPlanSettingsComponent(
      { loadSettings } as unknown as PlatformPlanService,
      { markForCheck: vi.fn() } as any
    );

    expect(component.sectionExpanded).toBe(false);
    component.onExpandedChange(true);
    expect(component.sectionExpanded).toBe(true);
    await Promise.resolve();
    expect(loadSettings).toHaveBeenCalledTimes(1);

    component.onExpandedChange(false);
    expect(component.sectionExpanded).toBe(false);
    component.onExpandedChange(true);
    await Promise.resolve();
    expect(loadSettings).toHaveBeenCalledTimes(1);
  });
});
