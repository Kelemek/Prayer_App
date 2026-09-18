import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  it('should create', async () => {
    const { fixture } = await render(PrivacyComponent, {
      providers: [provideRouter([])],
    });
    expect(fixture.componentInstance).toBeDefined();
  });

  it('mentions PostHog and analytics cookie choice', async () => {
    const { fixture } = await render(PrivacyComponent, {
      providers: [provideRouter([])],
    });
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Product analytics (PostHog)');
    expect(text).toContain('Analytics cookies');
  });
});
