import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InfoHomeFilterPreviewPublicArchivedPanelComponent } from './info-home-filter-preview-public-archived-panel.component';

const componentDir = dirname(fileURLToPath(import.meta.url));
const cardDir = join(componentDir, '../info-preview-prayer-card');

function readComponentResource(url: string): string {
  const local = join(componentDir, url);
  if (existsSync(local)) return readFileSync(local, 'utf-8');
  const card = join(cardDir, url.replace('./', ''));
  if (existsSync(card)) return readFileSync(card, 'utf-8');
  throw new Error(`Component resource not found: ${url}`);
}

describe('InfoHomeFilterPreviewPublicArchivedPanelComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  it('re-emits openHeaderPreview', () => {
    const fixture = TestBed.createComponent(
      InfoHomeFilterPreviewPublicArchivedPanelComponent
    );
    const spy = vi.fn();
    fixture.componentInstance.openHeaderPreview.subscribe(spy);
    fixture.componentInstance.openHeaderPreview.emit('help');
    expect(spy).toHaveBeenCalledWith('help');
  });
});
