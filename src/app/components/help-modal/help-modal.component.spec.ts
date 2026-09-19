import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { HelpModalComponent } from './help-modal.component';
import { HelpContentService } from '../../services/help-content.service';
import type { HelpSection } from '../../types/help-content';

function section(
  id: string,
  title: string,
  order: number,
  text: string,
  examples: string[] = []
): HelpSection {
  return {
    id,
    title,
    description: `${title} description`,
    icon: '<svg></svg>',
    content: [{ subtitle: `${title} basics`, text, examples }],
    order,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
  };
}

const SECTIONS: HelpSection[] = [
  section('help_first_week', 'Your first week', 1, 'Sign in with your email and a code.'),
  section('help_prayers', 'Creating Prayers', 2, 'Tap Request in the header.', [
    'Example: Prayer For: "Jane"',
  ]),
  section('help_groups', 'Groups', 3, 'Small-group prayer lists.'),
  section(
    'help_prayer_encouragement',
    'Prayer Encouragement (Pray For)',
    4,
    'A cooldown applies before you can tap again.'
  ),
];

async function renderOpenHelp() {
  const result = await render(HelpModalComponent, {
    componentInputs: { isOpen: true },
    providers: [
      {
        provide: HelpContentService,
        useValue: {
          getSections: () => of(SECTIONS),
          isLoading$: of(false),
          error$: of(null),
        },
      },
    ],
  });
  return result;
}

describe('HelpModalComponent', () => {
  it('lists every help section when open and nothing when closed', async () => {
    const { fixture } = await renderOpenHelp();

    expect(screen.getByRole('heading', { name: 'Help & Guidance' })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim())
    ).toEqual([
      'Your first week',
      'Creating Prayers',
      'Groups',
      'Prayer Encouragement (Pray For)',
    ]);

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('search narrows the list by content text, case-insensitively, and clearing restores it', async () => {
    await renderOpenHelp();
    const search = screen.getByRole('textbox', { name: 'Search help topics' });

    await userEvent.type(search, 'COOLDOWN');
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim())
    ).toEqual(['Prayer Encouragement (Pray For)']);

    await userEvent.clear(search);
    await userEvent.type(search, 'zzz-no-match');
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
    expect(screen.getByText('No help topics match your search.')).toBeTruthy();

    await userEvent.clear(search);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('search matches example lines too', async () => {
    await renderOpenHelp();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search help topics' }), 'jane');
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim())
    ).toEqual(['Creating Prayers']);
  });

  it('expanding a section with a Home tour offers Show me, which emits that section', async () => {
    const { fixture } = await renderOpenHelp();
    const started: HelpSection[] = [];
    fixture.componentInstance.startSectionTour.subscribe((s) => started.push(s));

    await userEvent.click(screen.getByRole('button', { name: /Creating Prayers/ }));
    expect(screen.getByText('Tap Request in the header.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(started.map((s) => s.id)).toEqual(['help_prayers']);
  });

  it('expanding a section without a Home tour shows its content but no Show me', async () => {
    await renderOpenHelp();

    await userEvent.click(screen.getByRole('button', { name: /^Groups/ }));
    expect(screen.getByText('Small-group prayer lists.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  });

  it('Take the guided tour emits every section, even after a search', async () => {
    const { fixture } = await renderOpenHelp();
    const requested: HelpSection[][] = [];
    fixture.componentInstance.fullGuidedTourRequested.subscribe((s) => requested.push(s));

    await userEvent.click(screen.getByRole('button', { name: 'Take the guided tour' }));
    expect(requested[0].map((s) => s.id)).toEqual([
      'help_first_week',
      'help_prayers',
      'help_groups',
      'help_prayer_encouragement',
    ]);

    await userEvent.type(screen.getByRole('textbox', { name: 'Search help topics' }), 'group');
    await userEvent.click(screen.getByRole('button', { name: 'Take the guided tour' }));
    expect(requested[1].map((s) => s.id)).toEqual([
      'help_first_week',
      'help_prayers',
      'help_groups',
      'help_prayer_encouragement',
    ]);
  });

  it('close control emits closeModal', async () => {
    const { fixture } = await renderOpenHelp();
    const closed = vi.fn();
    fixture.componentInstance.closeModal.subscribe(closed);

    await userEvent.click(screen.getByRole('button', { name: 'Close help modal' }));
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
