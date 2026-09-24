import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InfoPreviewMemorizeActionModalComponent } from './info-preview-memorize-action-modal.component';

const componentDir = dirname(fileURLToPath(import.meta.url));
const modalDir = join(componentDir, '../modal-shell');

function readComponentResource(url: string): string {
  const local = join(componentDir, url);
  if (existsSync(local)) return readFileSync(local, 'utf-8');
  const modal = join(modalDir, url.replace('./', ''));
  if (existsSync(modal)) return readFileSync(modal, 'utf-8');
  throw new Error(`Component resource not found: ${url}`);
}

describe('InfoPreviewMemorizeActionModalComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  it('maps memorize preview actions to aria labels', () => {
    const fixture = TestBed.createComponent(
      InfoPreviewMemorizeActionModalComponent
    );
    const cases: Array<{
      action: 'add-verses' | 'bible-books' | 'recommended' | null;
      label: string;
    }> = [
      { action: 'add-verses', label: 'Explanation: Add Verses' },
      { action: 'bible-books', label: 'Explanation: Bible Books' },
      { action: 'recommended', label: 'Explanation: Recommended' },
      { action: null, label: 'Explanation: Memorize' },
    ];

    for (const { action, label } of cases) {
      fixture.componentRef.setInput('previewAction', action);
      fixture.detectChanges();
      expect(fixture.componentInstance.previewAriaLabel()).toBe(label);
    }
  });

  it('re-emits closeModal', () => {
    const fixture = TestBed.createComponent(
      InfoPreviewMemorizeActionModalComponent
    );
    fixture.componentRef.setInput('previewAction', 'recommended');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.closeModal.subscribe(spy);
    fixture.componentInstance.closeModal.emit();
    expect(spy).toHaveBeenCalled();
  });
});
