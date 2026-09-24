import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HomeHeaderComponent } from './home-header.component';
import { BRANDING_SERVICE_TOKEN } from '../app-logo/app-logo.component';

const componentDir = dirname(fileURLToPath(import.meta.url));

@Component({ template: '', standalone: true })
class PresentationRouteStubComponent {}

describe('HomeHeaderComponent', () => {
  const handlers = {
    openHelp: vi.fn(),
    toggleSearchPanel: vi.fn(),
    openUserSettings: vi.fn(),
    onPresentationLinkClick: vi.fn(),
    openPrayerForm: vi.fn(),
  };

  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readFileSync(join(componentDir, url), 'utf-8'))
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const branding$ = new BehaviorSubject({
      useLogo: false,
      lightLogo: null,
      darkLogo: null,
      appTitle: 'Prayer',
      lastModified: null,
    });
    TestBed.configureTestingModule({
      imports: [HomeHeaderComponent],
      providers: [
        provideRouter([
          { path: 'presentation', component: PresentationRouteStubComponent },
        ]),
        {
          provide: BRANDING_SERVICE_TOKEN,
          useValue: {
            branding$,
            initialize: vi.fn(async () => undefined),
            getBranding: () => branding$.value,
            getImageUrl: () => '',
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createFixture(showSearchPanel = false) {
    const fixture = TestBed.createComponent(HomeHeaderComponent);
    fixture.componentInstance.showSearchPanel = showSearchPanel;
    fixture.componentInstance.presentationHandoffQueryParams = { from: 'home' };
    fixture.componentInstance.handlers = handlers;
    fixture.detectChanges();
    return fixture;
  }

  it('renders header shell class', () => {
    const fixture = createFixture();
    expect(fixture.componentInstance.headerShellClass).toContain('contrast-chip-surface');
    expect(fixture.nativeElement.querySelector('header')).toBeTruthy();
  });

  it('wires mobile help and search handlers', () => {
    const fixture = createFixture(true);
    const search = fixture.nativeElement.querySelector(
      '#tour-btn-search-mobile'
    ) as HTMLButtonElement;
    search?.click();
    expect(handlers.toggleSearchPanel).toHaveBeenCalled();
    const helpBtn = fixture.nativeElement.querySelector(
      'button[title="Help"]'
    ) as HTMLButtonElement;
    helpBtn?.click();
    expect(handlers.openHelp).toHaveBeenCalled();
  });

  it('wires settings, presentation, and prayer form actions', async () => {
    const fixture = createFixture();
    const settings = fixture.nativeElement.querySelector(
      '#tour-btn-settings-desktop'
    ) as HTMLButtonElement;
    settings?.click();
    expect(handlers.openUserSettings).toHaveBeenCalled();

    const presentation = fixture.nativeElement.querySelector(
      '#tour-btn-prayer-mode-desktop'
    ) as HTMLAnchorElement;
    presentation?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(handlers.onPresentationLinkClick).toHaveBeenCalled();

    const request = fixture.nativeElement.querySelector(
      '#tour-btn-new-prayer-request-desktop'
    ) as HTMLButtonElement;
    request?.click();
    expect(handlers.openPrayerForm).toHaveBeenCalled();
    fixture.destroy();
  });

  it('re-emits logo status changes', () => {
    const fixture = createFixture();
    const emitted = vi.fn();
    fixture.componentInstance.logoStatusChange.subscribe(emitted);
    fixture.componentInstance.logoStatusChange.emit(true);
    expect(emitted).toHaveBeenCalledWith(true);
  });
});
