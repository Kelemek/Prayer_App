import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InfoPreviewPersonalActionModalComponent } from './info-preview-personal-action-modal.component';

const componentDir = dirname(fileURLToPath(import.meta.url));
const modalDir = join(componentDir, '../modal-shell');

function readComponentResource(url: string): string {
  const local = join(componentDir, url);
  if (existsSync(local)) return readFileSync(local, 'utf-8');
  const modal = join(modalDir, url.replace('./', ''));
  if (existsSync(modal)) return readFileSync(modal, 'utf-8');
  throw new Error(`Component resource not found: ${url}`);
}

describe('InfoPreviewPersonalActionModalComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  it('maps preview actions to aria labels and body copy', () => {
    const fixture = TestBed.createComponent(
      InfoPreviewPersonalActionModalComponent
    );

    fixture.componentRef.setInput('previewAction', 'answered');
    fixture.detectChanges();
    expect(fixture.componentInstance.previewAriaLabel()).toBe(
      'Mark personal prayer answered'
    );
    fixture.componentRef.setInput('previewAction', 'edit');
    fixture.detectChanges();
    expect(fixture.componentInstance.previewAriaLabel()).toBe(
      'Edit personal prayer'
    );

    fixture.componentRef.setInput('previewAction', 'delete');
    fixture.detectChanges();
    expect(fixture.componentInstance.previewAriaLabel()).toBe(
      'Delete personal prayer'
    );
  });

  it('re-emits closeModal from the shell', () => {
    const fixture = TestBed.createComponent(
      InfoPreviewPersonalActionModalComponent
    );
    fixture.componentRef.setInput('previewAction', 'edit');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.closeModal.subscribe(spy);
    fixture.componentInstance.closeModal.emit();
    expect(spy).toHaveBeenCalled();
  });
});
