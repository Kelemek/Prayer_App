import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InfoComponent } from './info.component';

describe('InfoComponent', () => {
  let component: InfoComponent;
  let fixture: ComponentFixture<InfoComponent>;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)' ? false : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    await TestBed.configureTestingModule({
      imports: [InfoComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(InfoComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    fixture?.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('default state', () => {
    it('should have previewFilter as current', () => {
      expect(component.previewFilter).toBe('current');
    });
    it('should have headerPreview as null', () => {
      expect(component.headerPreview).toBeNull();
    });
    it('should have showPromptCategoriesModal false', () => {
      expect(component.showPromptCategoriesModal).toBe(false);
    });
    it('should have showBadgesModal false', () => {
      expect(component.showBadgesModal).toBe(false);
    });
    it('should have showPersonalCategoriesModal false', () => {
      expect(component.showPersonalCategoriesModal).toBe(false);
    });
    it('should have personalActionModal null', () => {
      expect(component.personalActionModal).toBeNull();
    });
    it('should have empty webAppQrUrl and iosStoreQrUrl before init', () => {
      expect(component.webAppQrUrl).toBe('');
      expect(component.iosStoreQrUrl).toBe('');
    });
  });

  describe('ngOnInit', () => {
    it('should set webAppQrUrl and iosStoreQrUrl with encoded URLs', () => {
      component.ngOnInit();
      expect(component.webAppQrUrl).toContain('api.qrserver.com');
      expect(component.webAppQrUrl).toContain(encodeURIComponent('https://cpprayer.cp-church.org/'));
      expect(component.iosStoreQrUrl).toContain('api.qrserver.com');
      expect(component.iosStoreQrUrl).toContain(encodeURIComponent('https://apps.apple.com/us/app/cross-pointe-prayer/id6759469929'));
    });
  });

  describe('openIosStore', () => {
    it('should call window.open with iOS store URL', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      component.openIosStore();
      expect(openSpy).toHaveBeenCalledWith(
        'https://apps.apple.com/us/app/cross-pointe-prayer/id6759469929',
        '_blank',
        'noopener'
      );
      openSpy.mockRestore();
    });
  });

  describe('openAndroidStore', () => {
    it('should call window.open with Google Play store URL', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      component.openAndroidStore();
      expect(openSpy).toHaveBeenCalledWith(
        'https://play.google.com/store/apps/details?id=com.prayerapp.mobile',
        '_blank',
        'noopener'
      );
      openSpy.mockRestore();
    });
  });

  describe('header modal', () => {
    it('should set headerPreview when openHeaderModal is called', () => {
      component.openHeaderModal('help');
      expect(component.headerPreview).toBe('help');
    });

    it('should clear headerPreview when closeHeaderModal is called', () => {
      component.headerPreview = 'help';
      component.closeHeaderModal();
      expect(component.headerPreview).toBeNull();
    });
  });

  describe('prompt categories modal', () => {
    it('should open and close prompt categories modal', () => {
      component.openPromptCategoriesModal();
      expect(component.showPromptCategoriesModal).toBe(true);
      component.closePromptCategoriesModal();
      expect(component.showPromptCategoriesModal).toBe(false);
    });
  });

  describe('badges modal', () => {
    it('should open and close badges modal', () => {
      component.openBadgesModal();
      expect(component.showBadgesModal).toBe(true);
      component.closeBadgesModal();
      expect(component.showBadgesModal).toBe(false);
    });
  });

  describe('personal action modal', () => {
    it('should open and close personal action modal', () => {
      component.openPersonalActionModal('edit');
      expect(component.personalActionModal).toBe('edit');
      component.closePersonalActionModal();
      expect(component.personalActionModal).toBeNull();
    });
  });

  describe('personal categories modal', () => {
    it('should open and close personal categories modal', () => {
      component.openPersonalCategoriesModal();
      expect(component.showPersonalCategoriesModal).toBe(true);
      component.closePersonalCategoriesModal();
      expect(component.showPersonalCategoriesModal).toBe(false);
    });
  });

  describe('template content', () => {
    it('should render hero title and preview header label', () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Prayer Community');
      expect(el.textContent).toContain('Manager');
      const previewHeaders = Array.from(el.querySelectorAll('h2')).map((h) =>
        h.textContent?.trim()
      );
      expect(previewHeaders).toContain('Prayer Manager');
    });
  });
});
