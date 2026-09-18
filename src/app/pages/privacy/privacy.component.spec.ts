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
    expect(text).toContain('Settings');
  });

  it('does not say deletion is admin-only', async () => {
    const { fixture } = await renderPrivacy();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toMatch(/ask your organization['’]s administrators to delete your account/i);
  });
});
