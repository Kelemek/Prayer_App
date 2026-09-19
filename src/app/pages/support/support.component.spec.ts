import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { SupportComponent } from './support.component';

async function renderSupport() {
  return render(SupportComponent, { providers: [provideRouter([])] });
}

describe('SupportComponent', () => {
  it('points people to in-app Help and Send Feedback first', async () => {
    await renderSupport();

    expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent?.trim())
    ).toEqual(['Start in the app', 'Members', 'Church admins', 'Privacy and terms']);
    expect(screen.getByText(/Tap the \? button in the header/)).toBeTruthy();
    expect(screen.getAllByText(/Send Feedback/).length).toBeGreaterThan(0);
  });

  it('tells church admins where invites, approvals, and billing live', async () => {
    const { container } = await renderSupport();
    const text = container.textContent ?? '';

    expect(text).toContain('Invite members');
    expect(text).toContain('Create invite');
    expect(text).toContain('Billing & invoices');
    expect(text).toContain('Admin User Management');
  });

  it('is self-serve: no placeholder email and no circular contact advice', async () => {
    const { container } = await renderSupport();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/example\.com/);
    expect(text).not.toMatch(/when the app was set up/);
    expect(text).not.toMatch(/person who invited you/);
  });

  it('links to info, privacy, and terms', async () => {
    await renderSupport();

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/info');
    expect(hrefs).toContain('/privacy');
    expect(hrefs).toContain('/terms');
    expect(hrefs).toContain('/');
  });
});
