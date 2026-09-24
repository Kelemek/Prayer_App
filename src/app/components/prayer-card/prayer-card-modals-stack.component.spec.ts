import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrayerCardModalsStackComponent } from './prayer-card-modals-stack.component';
import * as portal from '../../lib/prayer-card-modals-portal';

vi.mock('../../lib/prayer-card-modals-portal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/prayer-card-modals-portal')>();
  return {
    ...actual,
    isInsideCdkVirtualScrollContent: vi.fn(() => true),
    portalPrayerCardModalsHostToBody: vi.fn(() => ({ kind: 'body' })),
    restorePrayerCardModalsHostFromBody: vi.fn(),
  };
});

const componentDir = dirname(fileURLToPath(import.meta.url));

describe('PrayerCardModalsStackComponent', () => {
  let fixture: ComponentFixture<PrayerCardModalsStackComponent>;

  beforeAll(async () => {
    await resolveComponentResources((url) => {
      const file = url.replace(/^\.\//, '');
      const stackPath = join(componentDir, file);
      try {
        return Promise.resolve(readFileSync(stackPath, 'utf-8'));
      } catch {
        return Promise.resolve('<!-- test stub -->');
      }
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PrayerCardModalsStackComponent],
    })
      .overrideComponent(PrayerCardModalsStackComponent, {
        set: { template: '', imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PrayerCardModalsStackComponent, {
      autoDetectChanges: false,
    });
    fixture.componentInstance.prayerId = 'p1';
    fixture.componentInstance.reminderSessionEmail = 'user@example.com';
    fixture.componentInstance.prayerItemKind = 'community';
    fixture.componentInstance.prayerFor = 'Ann';
    fixture.componentInstance.titleSnapshot = 'Health';
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('portals modals to the body when a modal is open inside virtual scroll', () => {
    fixture.componentInstance.showPrayForModal = true;
    fixture.componentInstance.ngOnChanges();
    expect(portal.portalPrayerCardModalsHostToBody).toHaveBeenCalled();
  });

  it('restores the host when all modals close', () => {
    fixture.componentInstance.showPrayForModal = true;
    fixture.componentInstance.ngOnChanges();
    fixture.componentInstance.showPrayForModal = false;
    fixture.componentInstance.ngOnChanges();
    expect(portal.restorePrayerCardModalsHostFromBody).toHaveBeenCalled();
  });

  it('restores portal state on destroy', () => {
    fixture.componentInstance.showConfirmationDialog = true;
    fixture.componentInstance.ngOnChanges();
    fixture.componentInstance.ngOnDestroy();
    expect(portal.restorePrayerCardModalsHostFromBody).toHaveBeenCalled();
  });

  it('does not portal when outside virtual scroll and no anchor yet', () => {
    vi.mocked(portal.isInsideCdkVirtualScrollContent).mockReturnValue(false);
    fixture.componentInstance.showPrayForModal = true;
    fixture.componentInstance.ngOnChanges();
    expect(portal.portalPrayerCardModalsHostToBody).not.toHaveBeenCalled();
  });

  it('keeps portaling after anchor is set even outside virtual scroll', () => {
    vi.mocked(portal.isInsideCdkVirtualScrollContent).mockReturnValue(true);
    fixture.componentInstance.showPrayForModal = true;
    fixture.componentInstance.ngOnChanges();
    vi.mocked(portal.isInsideCdkVirtualScrollContent).mockReturnValue(false);
    fixture.componentInstance.showPrayForModal = false;
    fixture.componentInstance.ngOnChanges();
    expect(portal.restorePrayerCardModalsHostFromBody).toHaveBeenCalled();
  });
});
