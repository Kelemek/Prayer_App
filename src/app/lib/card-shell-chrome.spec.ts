import { describe, expect, it } from 'vitest';
import { cardModalsRenderOutsideShell, joinCardShellClassParts } from './card-shell-chrome';

describe('joinCardShellClassParts', () => {
  it('joins defined padding tokens and extra classes', () => {
    expect(
      joinCardShellClassParts(
        'rounded-lg border',
        {
          shellPaddingClasses: 'px-4',
          shellTopPadding: 'pt-2',
          shellBottomPadding: 'pb-4',
        },
        'shadow-sm'
      )
    ).toBe('rounded-lg border px-4 pt-2 pb-4 shadow-sm');
  });
});

describe('cardModalsRenderOutsideShell', () => {
  const prayerTemplate = `
    <div [class]="shellClasses()">
      <app-prayer-card-updates-section />
    </div>
    <!-- Outside bg-card-shell-fill (isolation: isolate) so fixed modals stack above filter tabs and later cards. -->
    <app-prayer-card-modals-stack />
  `;

  it('returns true when modals stack is outside the shell subtree', () => {
    expect(
      cardModalsRenderOutsideShell(
        prayerTemplate,
        '[class]="shellClasses()"',
        'app-prayer-card-modals-stack',
        'app-prayer-card-updates-section'
      )
    ).toBe(true);
  });

  it('returns false when modals stack is inside the shell subtree', () => {
    const broken = `
      <div [class]="shellClasses()">
        <app-prayer-card-updates-section />
        <app-prayer-card-modals-stack />
      </div>
      <!-- Outside bg-card-shell-fill (isolation: isolate) -->
    `;
    expect(
      cardModalsRenderOutsideShell(
        broken,
        '[class]="shellClasses()"',
        'app-prayer-card-modals-stack',
        'app-prayer-card-updates-section'
      )
    ).toBe(false);
  });
});
