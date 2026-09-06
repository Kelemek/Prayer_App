import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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

  it('defaults isChurchTenant to true so church content stays available', () => {
    const panel = new AdminSettingsPanelComponent();
    expect(panel.isChurchTenant).toBe(true);
  });

  it('content template gates verse memorization manager behind isChurchTenant', () => {
    const htmlPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'admin-settings-panel.component.html'
    );
    const html = readFileSync(htmlPath, 'utf-8');
    const churchBlock = html.match(
      /@if \(isChurchTenant\) \{[\s\S]*?app-verse-memorization-prayer-manager[\s\S]*?\}/
    );
    expect(churchBlock).toBeTruthy();
    expect(html).toContain('app-memorization-recommendations-manager');
  });
});
