import { describe, it, expect } from 'vitest';
import { AdminSettingsPanelComponent } from './admin-settings-panel.component';
import { ADMIN_SETTINGS_TABS } from '../../lib/admin-settings-tabs';

describe('AdminSettingsPanelComponent', () => {
  it('includes tenant_manager in the settings tab catalog', () => {
    expect(ADMIN_SETTINGS_TABS.map((tab) => tab.id)).toContain('tenant_manager');
  });

  it('shows tenant_manager only for super admins', () => {
    const panel = new AdminSettingsPanelComponent();
    panel.showAnalyticsTab = true;
    panel.isSuperAdmin = false;
    expect(panel.visibleSettingsTabs.map((tab) => tab.id)).not.toContain('tenant_manager');

    panel.isSuperAdmin = true;
    expect(panel.visibleSettingsTabs.map((tab) => tab.id)).toContain('tenant_manager');
  });

  it('hides analytics when the tenant cannot access it', () => {
    const panel = new AdminSettingsPanelComponent();
    panel.showAnalyticsTab = false;
    panel.isSuperAdmin = false;
    expect(panel.visibleSettingsTabs.map((tab) => tab.id)).not.toContain('analytics');
  });
});
