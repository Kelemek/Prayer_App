import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { MemorizationWordChoicesFooterComponent } from './memorization-word-choices-footer.component';

const eightLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('MemorizationWordChoicesFooterComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits guess when a choice is clicked', async () => {
    const guess = vi.fn();
    const { fixture } = await render(MemorizationWordChoicesFooterComponent, {
      componentInputs: {
        labels: ['faith', 'hope', 'love'],
        targetKind: 'word',
      },
    });
    fixture.componentInstance.guess.subscribe(guess);
    await fixture.whenStable();
    screen.getByRole('button', { name: 'hope' }).click();
    expect(guess).toHaveBeenCalledWith('hope');
  });

  it('renders three rows on narrow viewports', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as typeof window.matchMedia;

    const { fixture } = await render(MemorizationWordChoicesFooterComponent, {
      componentInputs: {
        labels: eightLabels,
        targetKind: 'word',
      },
    });
    await fixture.whenStable();
    expect(screen.getAllByTestId('memorize-word-choice-row')).toHaveLength(3);
  });

  it('renders two rows on comfortable viewports', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as typeof window.matchMedia;

    const { fixture } = await render(MemorizationWordChoicesFooterComponent, {
      componentInputs: {
        labels: eightLabels,
        targetKind: 'word',
      },
    });
    await fixture.whenStable();
    expect(screen.getAllByTestId('memorize-word-choice-row')).toHaveLength(2);
  });

  it('updates row count when the viewport media query changes', async () => {
    const listeners: Record<string, (event: MediaQueryListEvent) => void> = {};
    const mql = {
      matches: false,
      addEventListener: vi.fn((event: string, fn: (event: MediaQueryListEvent) => void) => {
        listeners[event] = fn;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql) as typeof window.matchMedia;

    const { fixture } = await render(MemorizationWordChoicesFooterComponent, {
      componentInputs: {
        labels: eightLabels,
        targetKind: 'word',
      },
    });
    await fixture.whenStable();
    expect(screen.getAllByTestId('memorize-word-choice-row')).toHaveLength(3);

    mql.matches = true;
    listeners.change?.({ matches: true } as MediaQueryListEvent);
    fixture.detectChanges();
    expect(screen.getAllByTestId('memorize-word-choice-row')).toHaveLength(2);
  });
});
