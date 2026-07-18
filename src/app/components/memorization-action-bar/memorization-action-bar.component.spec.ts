import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { MemorizationActionBarComponent } from './memorization-action-bar.component';

describe('MemorizationActionBarComponent', () => {
  it('renders add buttons', async () => {
    await render(MemorizationActionBarComponent);
    expect(screen.getByRole('button', { name: /Add Verses/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bible Books/i })).toBeTruthy();
  });

  it('hides Recommended by default', async () => {
    await render(MemorizationActionBarComponent);
    expect(screen.queryByRole('button', { name: /Recommended/i })).toBeNull();
  });

  it('shows Recommended when showRecommended is true', async () => {
    await render(MemorizationActionBarComponent, {
      componentInputs: { showRecommended: true },
    });
    expect(screen.getByRole('button', { name: /Recommended/i })).toBeTruthy();
  });

  it('emits openRecommended when Recommended is clicked', async () => {
    const user = userEvent.setup();
    const openRecommended = vi.fn();
    const { fixture } = await render(MemorizationActionBarComponent, {
      componentInputs: { showRecommended: true },
    });
    fixture.componentInstance.openRecommended.subscribe(openRecommended);

    await user.click(screen.getByRole('button', { name: /Recommended/i }));
    expect(openRecommended).toHaveBeenCalledOnce();
  });
});
