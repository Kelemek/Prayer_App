import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  async function renderPrivacy() {
    return render(PrivacyComponent, {
      providers: [provideRouter([])],
    });
  }

  it('should create', async () => {
    const { fixture } = await renderPrivacy();
    expect(fixture.componentInstance).toBeDefined();
  });

  it('mentions PostHog and analytics cookie choice', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('PostHog');
    expect(text).toContain('Analytics cookies');
  });

  it('names key subprocessors and self-serve account deletion', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Stripe');
    expect(text).toContain('Vercel');
    expect(text).toContain('OpenAI');
    expect(text).toContain('Whisper');
    expect(text).toContain('Notion');
    expect(text).toContain('Delete your account');
    expect(text).toContain('Download my data');
    expect(text).toContain('Settings');
  });

  it('describes self-serve JSON export in Settings', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toMatch(/download your data/i);
    expect(text).not.toMatch(/no self-serve data export/i);
  });

  it('does not say deletion is admin-only', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toMatch(/ask your organization['’]s administrators to delete your account/i);
  });

  it('describes church operator wipe vs member account deletion', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toMatch(/Church administrators/i);
    expect(text).toMatch(/personal prayers and prayer groups/i);
  });
});
