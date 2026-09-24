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

  it('loads limits and practice modes into editable state', async () => {
    const loadSettings = vi.fn().mockResolvedValue({
      limits: [
        {
          plan_tier: 'free',
          max_groups_owned: 2,
          max_members_per_group: 8,
        },
      ],
      practice_modes: [
        { plan_tier: 'free', practice_mode: 'recite', enabled: true },
      ],
    });
    const component = new AdminPlatformPlanSettingsComponent(
      { loadSettings } as unknown as PlatformPlanService,
      { markForCheck: vi.fn() } as any
    );

    await component.load();

    expect(component.groupLimits.free.max_groups_owned).toBe(2);
    expect(component.practiceModeEnabled.free.recite).toBe(true);
    expect(component.loading).toBe(false);
  });

  it('surfaces load errors', async () => {
    const component = new AdminPlatformPlanSettingsComponent(
      { loadSettings: vi.fn().mockResolvedValue(null) } as unknown as PlatformPlanService,
      { markForCheck: vi.fn() } as any
    );

    await component.load();

    expect(component.errorMessage).toContain('Failed to load');
  });

  it('saves tier settings and reports success or failure', async () => {
    const saveGroupLimits = vi.fn().mockResolvedValue(true);
    const savePracticeModes = vi.fn().mockResolvedValue(true);
    const component = new AdminPlatformPlanSettingsComponent(
      {
        loadSettings: vi.fn(),
        saveGroupLimits,
        savePracticeModes,
      } as unknown as PlatformPlanService,
      { markForCheck: vi.fn() } as any
    );

    await component.saveTier('pro');
    expect(component.successMessage).toContain('Pro settings saved');

    savePracticeModes.mockResolvedValueOnce(false);
    await component.saveTier('free');
    expect(component.errorMessage).toContain('Failed to save Free');
  });
});
