import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { AppBrandingComponent } from './app-branding.component';

describe('AppBrandingComponent', () => {
  let component: AppBrandingComponent;
  let mockSupabaseService: {
    client: {
      rpc: ReturnType<typeof vi.fn>;
      auth: { getSession: ReturnType<typeof vi.fn> };
    };
  };
  let mockTenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };
  let mockChangeDetectorRef: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockChangeDetectorRef = {
      markForCheck: vi.fn(),
    };

    mockTenantContext = {
      getActiveTenant: vi.fn(() => ({ id: 'tenant-a' })),
    };

    mockSupabaseService = {
      client: {
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
        auth: {
          getSession: vi.fn(() =>
            Promise.resolve({ data: { session: { user: { email: 'admin@example.com' } } } })
          ),
        },
      },
    };

    component = new AppBrandingComponent(
      mockSupabaseService as any,
      mockTenantContext as any,
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
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({
          data: [
            {
              app_title: 'Test Church',
              church_website_url: 'https://example.com',
              use_logo: true,
              light_mode_logo_blob: 'data:image/png;base64,light',
              dark_mode_logo_blob: 'data:image/png;base64,dark',
            },
          ],
          error: null,
        })
      );

      await component.loadSettings();

      expect(mockSupabaseService.client.rpc).toHaveBeenCalledWith(
        'get_tenant_branding_settings',
        expect.objectContaining({
          p_tenant_id: 'tenant-a',
          p_email: 'admin@example.com',
        })
      );
      expect(component.appTitle).toBe('Test Church');
      expect(component.churchWebsiteUrl).toBe('https://example.com');
      expect(component.useLogo).toBe(true);
      expect(component.lightModeLogoUrl).toBe('data:image/png;base64,light');
      expect(component.darkModeLogoUrl).toBe('data:image/png;base64,dark');
      expect(component.loading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle null data fields gracefully', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({
          data: [
            {
              app_title: null,
              use_logo: null,
              light_mode_logo_blob: null,
              dark_mode_logo_blob: null,
              church_website_url: null,
            },
          ],
          error: null,
        })
      );

      const originalTitle = component.appTitle;
      await component.loadSettings();
      expect(component.appTitle).toBe(originalTitle);
      expect(component.loading).toBe(false);
    });

    it('should handle error when loading settings fails', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({
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
      mockSupabaseService.client.rpc = vi.fn(() => Promise.resolve({ error: null }));
      component.saving = false;
      const promise = component.save();
      expect(component.saving).toBe(true);
      await promise;
    });

    it('should save settings successfully', async () => {
      mockSupabaseService.client.rpc = vi.fn(() => Promise.resolve({ error: null }));

      component.appTitle = 'New Title';
      component.useLogo = true;
      const emitSpy = vi.spyOn(component.onSave, 'emit');

      await component.save();

      expect(mockSupabaseService.client.rpc).toHaveBeenCalledWith(
        'update_tenant_branding_settings',
        expect.objectContaining({
          p_tenant_id: 'tenant-a',
          p_app_title: 'New Title',
          p_use_logo: true,
          p_email: 'admin@example.com',
        })
      );
      expect(component.success).toBe(true);
      expect(component.saving).toBe(false);
      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
