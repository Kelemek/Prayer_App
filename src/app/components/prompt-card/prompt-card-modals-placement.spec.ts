import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardModalsRenderOutsideShell } from '../../lib/card-shell-chrome';

const promptCardHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'prompt-card.component.html'),
  'utf8'
);

describe('prompt card modal placement (stacking regression)', () => {
  it('keeps prompt card modals outside the bg-card-shell-fill shell', () => {
    expect(
      cardModalsRenderOutsideShell(
        promptCardHtml,
        '[class]="shellClasses()"',
        'app-confirmation-dialog',
        'app-card-meta-header-band'
      )
    ).toBe(true);
  });
});
