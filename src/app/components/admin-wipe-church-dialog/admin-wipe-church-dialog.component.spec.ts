import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminWipeChurchDialogComponent } from './admin-wipe-church-dialog.component';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { vi } from 'vitest';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('AdminWipeChurchDialogComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(readComponentResource(url)));
  });

  it('requires matching slug before canSubmit', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
      response: new Response(null, { status: 200 }),
    });

    await TestBed.configureTestingModule({
      imports: [AdminWipeChurchDialogComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
        { provide: TenantContextService, useValue: { refresh: vi.fn().mockResolvedValue(undefined) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminWipeChurchDialogComponent);
    const component = fixture.componentInstance;
    component.tenantId = 't-1';
    component.tenantName = 'Church';
    component.tenantSlug = 'my-slug';
    component.open = true;
    fixture.detectChanges();

    expect(component.canSubmit).toBe(false);
    component.confirmSlugInput = 'wrong';
    expect(component.canSubmit).toBe(false);
    component.confirmSlugInput = 'my-slug';
    expect(component.canSubmit).toBe(true);

    await component.confirmWipe();
    expect(invoke).toHaveBeenCalledWith('wipe-church-tenant', {
      body: { tenant_id: 't-1', confirm_slug: 'my-slug' },
    });
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('template requires typing slug to confirm', () => {
    const html = readFileSync(join(componentDir, 'admin-wipe-church-dialog.component.html'), 'utf-8');
    expect(html).toContain('confirmSlugInput');
    expect(html).toContain('Delete church');
    expect(html).toContain('/privacy');
  });
});
