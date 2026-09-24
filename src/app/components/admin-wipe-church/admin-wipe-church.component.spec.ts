import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminWipeChurchComponent } from './admin-wipe-church.component';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { vi } from 'vitest';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const candidates = [
    join(componentDir, url),
    join(componentDir, '..', 'admin-wipe-church-dialog', url.replace('./', '')),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf-8');
    }
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('AdminWipeChurchComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) => Promise.resolve(readComponentResource(url)));
  });

  let fixture: ComponentFixture<AdminWipeChurchComponent>;
  let component: AdminWipeChurchComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminWipeChurchComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: { client: { functions: { invoke: vi.fn() } } } },
        { provide: TenantContextService, useValue: { refresh: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminWipeChurchComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('hides danger zone for default tenant', () => {
    component.tenant = {
      id: 't1',
      name: 'Default',
      slug: 'default-tenant',
      plan_tier: 'churches',
      plan_status: 'active',
    };
    component.canWipe = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Delete church');
  });

  it('opens wipe dialog for eligible tenant', () => {
    component.tenant = {
      id: 't2',
      name: 'My Church',
      slug: 'my-church',
      plan_tier: 'churches',
      plan_status: 'active',
    };
    component.canWipe = true;
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(component.showDialog).toBe(true);
  });
});
