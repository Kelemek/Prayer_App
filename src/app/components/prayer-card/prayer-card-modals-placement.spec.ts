import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardModalsRenderOutsideShell } from '../../lib/card-shell-chrome';

const prayerCardHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'prayer-card.component.html'),
  'utf8'
);

describe('card modal placement (stacking regression)', () => {
  it('keeps prayer card modals outside the bg-card-shell-fill shell', () => {
    expect(
      cardModalsRenderOutsideShell(
        prayerCardHtml,
        '[class]="shellClasses()"',
        'app-prayer-card-modals-stack',
        'app-prayer-card-updates-section'
      )
    ).toBe(true);
  });
});
