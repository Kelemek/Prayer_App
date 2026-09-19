import { describe, it, expect, vi } from 'vitest';
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

  it('shows the tools feedback form only after the server reports it is configured', async () => {
    const cdr = { markForCheck: vi.fn() };
    const hidden = new AdminSettingsPanelComponent(
      { isConfigured: vi.fn().mockResolvedValue(false) } as never,
      cdr as never
    );
    hidden.ngOnInit();
    await Promise.resolve();
    expect(hidden.showFeedbackForm).toBe(false);

    const shown = new AdminSettingsPanelComponent(
      { isConfigured: vi.fn().mockResolvedValue(true) } as never,
      cdr as never
    );
    shown.ngOnInit();
    await Promise.resolve();
    expect(shown.showFeedbackForm).toBe(true);
    expect(cdr.markForCheck).toHaveBeenCalled();
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
    expect(html).toContain('app-feedback-form');
    expect(html).toContain('@if (showFeedbackForm)');
    expect(html).not.toContain('app-github-settings');
    expect(html).not.toContain('github_token');
    expect(html).not.toContain('github-settings');
  });

  it('security tab mounts Invite members above Admin User Management for every admin', () => {
    const htmlPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'admin-settings-panel.component.html'
    );
    const html = readFileSync(htmlPath, 'utf-8');
    // The tab header switch also has a security case; the content switch is the last one.
    const security = html.slice(
      html.lastIndexOf("@case ('security')"),
      html.lastIndexOf("@case ('tenant_manager')")
    );
    const inviteAt = security.indexOf('<app-church-member-invite>');
    const adminUsersAt = security.indexOf('<app-admin-user-management>');
    expect(inviteAt).toBeGreaterThan(-1);
    expect(inviteAt).toBeLessThan(adminUsersAt);
    expect(security).not.toContain('isSuperAdmin');
  });

  it('security tab includes church wipe danger zone', () => {
    const htmlPath = join(
      dirname(fileURLToPath(import.meta.url)),
      'admin-settings-panel.component.html'
    );
    const html = readFileSync(htmlPath, 'utf-8');
    const securityBlock = html.match(
      /@case \('security'\) \{[\s\S]*?app-admin-wipe-church[\s\S]*?\}/
    );
    expect(securityBlock).toBeTruthy();
  });
});
