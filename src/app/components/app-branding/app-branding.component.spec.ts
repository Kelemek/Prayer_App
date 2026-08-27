import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { AppBrandingComponent } from './app-branding.component';

function mockAdminSettingsQuery(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(result)),
      })),
    })),
  };
}

describe('AppBrandingComponent', () => {
  let component: AppBrandingComponent;
  let mockSupabaseService: {
    client: {
      from: ReturnType<typeof vi.fn>;
    };
  };
  let mockChangeDetectorRef: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockChangeDetectorRef = {
      markForCheck: vi.fn(),
    };

    mockSupabaseService = {
      client: {
        from: vi.fn(() => mockAdminSettingsQuery({ data: null, error: null })),
      },
    };

    component = new AppBrandingComponent(
      mockSupabaseService as any,
      mockChangeDetectorRef as ChangeDetectorRef
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('section expand', () => {
    it('should not call loadSettings before section expand', () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings');
      expect(loadSettingsSpy).not.toHaveBeenCalled();
      loadSettingsSpy.mockRestore();
    });

    it('should call loadSettings when section is expanded', () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings').mockResolvedValue();
      component.onSectionToggle();
      expect(loadSettingsSpy).toHaveBeenCalled();
      loadSettingsSpy.mockRestore();
    });
  });

  describe('loadSettings', () => {
    it('should set loading to true initially', async () => {
      component.loading = false;
      const promise = component.loadSettings();
      expect(component.loading).toBe(true);
      await promise;
    });

    it('should load settings successfully', async () => {
      mockSupabaseService.client.from = vi.fn(() =>
        mockAdminSettingsQuery({
          data: {
            app_title: 'Test Church',
            app_subtitle: 'Subtitle',
            church_website_url: 'https://example.com',
            use_logo: true,
            light_mode_logo_blob: 'data:image/png;base64,light',
            dark_mode_logo_blob: 'data:image/png;base64,dark',
          },
          error: null,
        })
      );

      await component.loadSettings();

      expect(component.appTitle).toBe('Test Church');
      expect(component.appSubtitle).toBe('Subtitle');
      expect(component.churchWebsiteUrl).toBe('https://example.com');
      expect(component.useLogo).toBe(true);
      expect(component.lightModeLogoUrl).toBe('data:image/png;base64,light');
      expect(component.darkModeLogoUrl).toBe('data:image/png;base64,dark');
      expect(component.loading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle null data fields gracefully', async () => {
      mockSupabaseService.client.from = vi.fn(() =>
        mockAdminSettingsQuery({
          data: {
            app_title: null,
            use_logo: null,
            light_mode_logo_blob: null,
            dark_mode_logo_blob: null,
            church_website_url: null,
          },
          error: null,
        })
      );

      const originalTitle = component.appTitle;
      await component.loadSettings();
      expect(component.appTitle).toBe(originalTitle);
      expect(component.loading).toBe(false);
    });

    it('should handle error when loading settings fails', async () => {
      mockSupabaseService.client.from = vi.fn(() =>
        mockAdminSettingsQuery({
          data: null,
          error: { message: 'Database error' },
        })
      );

      await component.loadSettings();

      expect(component.error).toBe('Failed to load branding settings');
      expect(component.sectionExpanded).toBe(true);
      expect(component.loading).toBe(false);
    });
  });

  describe('onLogoUpload', () => {
    it('should read file and update lightModeLogoUrl', async () => {
      const base64 = 'data:image/png;base64,test';
      const readAsDataURL = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(function (this: FileReader) {
          Object.defineProperty(this, 'result', { value: base64 });
          this.onload?.({ target: this } as ProgressEvent<FileReader>);
        });

      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      component.onLogoUpload({ target: { files: [mockFile] } } as any, 'light');

      expect(component.uploading).toBe(false);
      expect(component.lightModeLogoUrl).toBe(base64);
      readAsDataURL.mockRestore();
    });

    it('should do nothing if no file is selected', () => {
      const initialUploading = component.uploading;
      component.onLogoUpload({ target: { files: [] } } as any, 'light');
      expect(component.uploading).toBe(initialUploading);
    });
  });

  describe('save', () => {
    it('should set saving to true initially', async () => {
      mockSupabaseService.client.from = vi.fn(() => ({
        upsert: vi.fn(() => Promise.resolve({ error: null })),
      }));
      component.saving = false;
      const promise = component.save();
      expect(component.saving).toBe(true);
      await promise;
    });

    it('should save settings successfully', async () => {
      const upsert = vi.fn(() => Promise.resolve({ error: null }));
      mockSupabaseService.client.from = vi.fn(() => ({ upsert }));

      component.appTitle = 'New Title';
      component.useLogo = true;
      const emitSpy = vi.spyOn(component.onSave, 'emit');

      await component.save();

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          app_title: 'New Title',
          use_logo: true,
        })
      );
      expect(component.success).toBe(true);
      expect(component.saving).toBe(false);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should handle error when saving fails', async () => {
      mockSupabaseService.client.from = vi.fn(() => ({
        upsert: vi.fn(() => Promise.resolve({ error: { message: 'Update failed' } })),
      }));

      await component.save();

      expect(component.error).toBe('Update failed');
      expect(component.success).toBe(false);
      expect(component.saving).toBe(false);
    });
  });
});
