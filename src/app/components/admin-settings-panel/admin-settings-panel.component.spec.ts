import { describe, it, expect } from 'vitest';
import { AdminSettingsPanelComponent } from './admin-settings-panel.component';
import { ADMIN_SETTINGS_TABS } from '../../lib/admin-settings-tabs';

describe('AdminSettingsPanelComponent', () => {
  it('includes tenant_manager in the settings tab catalog', () => {
    const ids = ADMIN_SETTINGS_TABS.map((tab) => tab.id);
    expect(ids).toContain('tenant_manager');
    expect(ids).not.toContain('platform_plan');
  });

  it('shows tenant manager only for super admins', () => {
    const panel = new AdminSettingsPanelComponent();
    panel.showAnalyticsTab = true;
    panel.isSuperAdmin = false;
    const hidden = panel.visibleSettingsTabs.map((tab) => tab.id);
    expect(hidden).not.toContain('tenant_manager');

    panel.isSuperAdmin = true;
    const visible = panel.visibleSettingsTabs.map((tab) => tab.id);
    expect(visible).toContain('tenant_manager');
  });

  it('hides analytics when the tenant cannot access it', () => {
    const panel = new AdminSettingsPanelComponent();
    panel.showAnalyticsTab = false;
    panel.isSuperAdmin = false;
    expect(panel.visibleSettingsTabs.map((tab) => tab.id)).not.toContain('analytics');
  });
});
