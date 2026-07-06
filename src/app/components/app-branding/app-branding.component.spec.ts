import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppBrandingComponent } from './app-branding.component';

const TENANT_ID = 'branding-tenant-id';
const mockTenant = { id: TENANT_ID, name: 'T', slug: 't' };

describe('AppBrandingComponent', () => {
  let component: AppBrandingComponent;
  let mockSupabaseService: any;
  let mockChangeDetectorRef: any;
  let mockImageOptimization: any;

  const mockOptimizedResult = (base64: string) => ({
    original: { size: 1000, format: 'image/png' },
    compressed: { size: 500, format: 'png', base64, blob: new Blob() },
    savings: { bytes: 500, percent: 50 },
  });

  beforeEach(() => {
    mockChangeDetectorRef = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn()
    };

    const mockBrandingService = {
      applySavedBranding: vi.fn(),
      refreshBranding: vi.fn().mockResolvedValue(undefined)
    };

    mockImageOptimization = {
      compressImage: vi.fn().mockResolvedValue(
        mockOptimizedResult('data:image/png;base64,compressed')
      ),
    };

    mockSupabaseService = {
      client: {
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
        auth: {
          getSession: vi.fn(() =>
            Promise.resolve({
              data: { session: { user: { email: 'admin@test.com' } } },
            })
          ),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          })),
          upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }
    };

    const mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue(mockTenant),
      activeTenant$: new BehaviorSubject(mockTenant)
    };

    component = new AppBrandingComponent(
      mockSupabaseService,
      mockBrandingService as any,
      mockImageOptimization,
      mockChangeDetectorRef as ChangeDetectorRef,
      mockTenantContext as any
    );

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('default property values', () => {
    it('should have default appTitle', () => {
      expect(component.appTitle).toBe('Church Prayer Manager');
    });

    it('should have useLogo default to false', () => {
      expect(component.useLogo).toBe(false);
    });

    it('should have lightModeLogoUrl default to empty string', () => {
      expect(component.lightModeLogoUrl).toBe('');
    });

    it('should have darkModeLogoUrl default to empty string', () => {
      expect(component.darkModeLogoUrl).toBe('');
    });

    it('should have isLoading default to false', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should have saving default to false', () => {
      expect(component.saving).toBe(false);
    });

    it('should have uploading default to false', () => {
      expect(component.uploading).toBe(false);
    });

    it('should have error default to null', () => {
      expect(component.error).toBe(null);
    });

    it('should have success default to false', () => {
      expect(component.success).toBe(false);
    });
  });

  describe('ngOnInit', () => {
    it('should not call loadSettings on initialization before section expand', () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings');
      component.ngOnInit();
      expect(loadSettingsSpy).not.toHaveBeenCalled();
      loadSettingsSpy.mockRestore();
    });

    it('should call loadSettings when section is expanded', async () => {
      const loadSettingsSpy = vi.spyOn(component, 'loadSettings');
      component.onExpandedChange(true);
      expect(loadSettingsSpy).toHaveBeenCalled();
      loadSettingsSpy.mockRestore();
    });
  });

  describe('loadSettings', () => {
    it('should set isLoading to true initially', async () => {
      component.isLoading = false;
      const promise = component.loadSettings();
      expect(component.isLoading).toBe(true);
      await promise;
    });

    it('should load settings successfully', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({
          data: [
            {
              app_title: 'Test Church',
              use_logo: true,
              light_mode_logo_blob: 'data:image/png;base64,light',
              dark_mode_logo_blob: 'data:image/png;base64,dark',
            },
          ],
          error: null,
        })
      );

      await component.loadSettings();

      expect(component.appTitle).toBe('Test Church');
      expect(component.useLogo).toBe(true);
      expect(component.lightModeLogoUrl).toBe('data:image/png;base64,light');
      expect(component.darkModeLogoUrl).toBe('data:image/png;base64,dark');
      expect(component.isLoading).toBe(false);
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
            },
          ],
          error: null,
        })
      );

      const originalTitle = component.appTitle;

      await component.loadSettings();

      expect(component.appTitle).toBe(originalTitle);
      expect(component.isLoading).toBe(false);
    });

    it('should handle error when loading settings fails', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: { message: 'Database error' } })
      );

      await component.loadSettings();

      expect(component.error).toBe('Failed to load branding settings');
      expect(component.isLoading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle exception when loading settings', async () => {
      mockSupabaseService.client.rpc = vi.fn(() => {
        throw new Error('Network error');
      });

      await component.loadSettings();

      expect(component.error).toBe('Failed to load branding settings');
      expect(component.isLoading).toBe(false);
    });
  });

  describe('onLogoUpload', () => {
    function mockImageLoad(width: number, height: number) {
      const OriginalImage = globalThis.Image;
      vi.spyOn(globalThis, 'Image').mockImplementation(function (this: HTMLImageElement) {
        const img = new OriginalImage();
        setTimeout(() => {
          Object.defineProperty(img, 'width', { value: width });
          Object.defineProperty(img, 'height', { value: height });
          img.onload?.(new Event('load'));
        }, 0);
        return img;
      } as unknown as typeof Image);
    }

    it('should set uploading to true and call compressImage for PNG', async () => {
      mockImageLoad(200, 50);
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const mockInput = { files: [mockFile], value: 'test.png' };
      const mockEvent = { target: mockInput } as any;

      const uploadPromise = component.onLogoUpload(mockEvent, 'light');
      expect(component.uploading).toBe(true);
      expect(component.error).toBe(null);

      await uploadPromise;

      expect(mockImageOptimization.compressImage).toHaveBeenCalledWith(mockFile, {
        maxWidth: 320,
        maxHeight: 64,
        format: 'png',
        quality: 0.9,
      });
      expect(component.uploading).toBe(false);
      expect(mockInput.value).toBe('');
    });

    it('should update lightModeLogoUrl on successful light mode upload', async () => {
      mockImageLoad(200, 50);
      const base64String = 'data:image/png;base64,test';
      mockImageOptimization.compressImage.mockResolvedValue(mockOptimizedResult(base64String));
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const mockEvent = { target: { files: [mockFile], value: '' } } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(component.lightModeLogoUrl).toBe(base64String);
      expect(component.uploading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should update darkModeLogoUrl on successful dark mode upload', async () => {
      mockImageLoad(200, 50);
      const base64String = 'data:image/webp;base64,test';
      mockImageOptimization.compressImage.mockResolvedValue(mockOptimizedResult(base64String));
      const mockFile = new File(['test'], 'test.webp', { type: 'image/webp' });
      const mockEvent = { target: { files: [mockFile], value: '' } } as any;

      await component.onLogoUpload(mockEvent, 'dark');

      expect(component.darkModeLogoUrl).toBe(base64String);
      expect(component.uploading).toBe(false);
    });

    it('should accept JPEG uploads', async () => {
      mockImageLoad(200, 50);
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockEvent = { target: { files: [mockFile], value: '' } } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(mockImageOptimization.compressImage).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({ format: 'jpeg' })
      );
    });

    it('should reject unsupported file types', async () => {
      const mockFile = new File(['test'], 'test.gif', { type: 'image/gif' });
      const mockInput = { files: [mockFile], value: 'test.gif' };
      const mockEvent = { target: mockInput } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(component.error).toBe('Logo must be a PNG, WebP, or JPEG image.');
      expect(mockImageOptimization.compressImage).not.toHaveBeenCalled();
      expect(mockInput.value).toBe('');
    });

    it('should reject files larger than 2 MB', async () => {
      const largeContent = new Uint8Array(2 * 1024 * 1024 + 1);
      const mockFile = new File([largeContent], 'big.png', { type: 'image/png' });
      const mockInput = { files: [mockFile], value: 'big.png' };
      const mockEvent = { target: mockInput } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(component.error).toBe('Logo file must be 2 MB or smaller.');
      expect(mockImageOptimization.compressImage).not.toHaveBeenCalled();
    });

    it('should set uploadInfo when image exceeds header dimensions', async () => {
      mockImageLoad(800, 200);
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const mockEvent = { target: { files: [mockFile], value: '' } } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(component.uploadInfo).toBe('Image was resized to fit the header.');
    });

    it('should handle compressImage error', async () => {
      mockImageLoad(200, 50);
      mockImageOptimization.compressImage.mockRejectedValue(new Error('compress failed'));
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });
      const mockEvent = { target: { files: [mockFile], value: '' } } as any;

      await component.onLogoUpload(mockEvent, 'light');

      expect(component.error).toBe('Failed to process image file');
      expect(component.uploading).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should do nothing if no file is selected', async () => {
      const mockEvent = {
        target: {
          files: []
        }
      } as any;

      const initialUploading = component.uploading;
      await component.onLogoUpload(mockEvent, 'light');

      expect(component.uploading).toBe(initialUploading);
      expect(mockImageOptimization.compressImage).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('should set saving to true initially', async () => {
      component.saving = false;
      const promise = component.save();
      expect(component.saving).toBe(true);
      await promise;
    });

    it('should save settings successfully', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      component.appTitle = 'New Title';
      component.useLogo = true;
      component.lightModeLogoUrl = 'light-url';
      component.darkModeLogoUrl = 'dark-url';

      const emitSpy = vi.spyOn(component.onSave, 'emit');

      await component.save();

      expect(mockSupabaseService.client.rpc).toHaveBeenCalledWith(
        'update_tenant_branding_settings',
        expect.objectContaining({
          p_tenant_id: TENANT_ID,
          p_app_title: 'New Title',
        })
      );
      expect(component.success).toBe(true);
      expect(component.error).toBe(null);
      expect(component.saving).toBe(false);
      expect(emitSpy).toHaveBeenCalled();
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle empty logo URLs by setting them to null', async () => {
      mockSupabaseService.client.rpc = vi.fn((name: string, args: Record<string, unknown>) => {
        expect(args['p_light_mode_logo_blob']).toBe(null);
        expect(args['p_dark_mode_logo_blob']).toBe(null);
        return Promise.resolve({ data: null, error: null });
      });

      component.lightModeLogoUrl = '';
      component.darkModeLogoUrl = '';

      await component.save();
    });

    it('should clear success message after 3 seconds', async () => {
      vi.useFakeTimers();
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: null })
      );

      await component.save();

      expect(component.success).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(component.success).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle error when saving fails', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: { message: 'Update failed' } })
      );

      await component.save();

      expect(component.error).toBe('Update failed');
      expect(component.success).toBe(false);
      expect(component.saving).toBe(false);
      expect(mockChangeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should handle error without message', async () => {
      mockSupabaseService.client.rpc = vi.fn(() =>
        Promise.resolve({ data: null, error: {} })
      );

      await component.save();

      expect(component.error).toBe('Failed to save settings. Please try again.');
      expect(component.saving).toBe(false);
    });

    it('should handle exception when saving', async () => {
      mockSupabaseService.client.rpc = vi.fn(() => {
        throw new Error('Network error');
      });

      await component.save();

      expect(component.error).toBe('Network error');
      expect(component.saving).toBe(false);
    });
  });
});
