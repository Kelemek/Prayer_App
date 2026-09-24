import { describe, it, expect, vi } from 'vitest';
import { PresentationSlideCardComponent } from './presentation-slide-card.component';

describe('PresentationSlideCardComponent', () => {
  it('opens personal edit modal from card output', () => {
    const cardActions = {
      isAdmin: false,
    } as any;
    const cdr = { markForCheck: vi.fn() } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      cdr
    );

    component.openEditPersonalPrayer({ id: 'p1', prayer_for: 'Test' } as any);

    expect(component.showEditPersonalPrayer).toBe(true);
    expect(component.editingPrayer?.id).toBe('p1');
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  it('emits itemRemoved only when deleteCardForCard succeeds', async () => {
    const cardActions = {
      deleteCardForCard: vi.fn().mockResolvedValue(true),
    } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      { markForCheck: vi.fn() } as any
    );
    component.prayer = { id: 'p1', user_email: 'a@b.com' } as any;
    const removed: string[] = [];
    component.itemRemoved.subscribe((id) => removed.push(id));

    component.onDeletePrayer();
    await Promise.resolve();

    expect(cardActions.deleteCardForCard).toHaveBeenCalledWith(component.prayer);
    expect(removed).toEqual(['p1']);
  });

  it('does not emit itemRemoved when deleteCardForCard fails', async () => {
    const cardActions = {
      deleteCardForCard: vi.fn().mockResolvedValue(false),
    } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      { markForCheck: vi.fn() } as any
    );
    component.prayer = { id: 'p1' } as any;
    const removed: string[] = [];
    component.itemRemoved.subscribe((id) => removed.push(id));

    component.onDeletePrayer();
    await Promise.resolve();

    expect(removed).toEqual([]);
  });

  it('emits itemRemoved when deletePrompt succeeds', async () => {
    const cardActions = {
      deletePrompt: vi.fn().mockResolvedValue(true),
    } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      { markForCheck: vi.fn() } as any
    );
    const removed: string[] = [];
    component.itemRemoved.subscribe((id) => removed.push(id));

    await component.onDeletePrompt('prompt-1');

    expect(removed).toEqual(['prompt-1']);
  });

  it('emits itemMutated when updates are added or edited', async () => {
    const cardActions = {
      addUpdateForCard: vi.fn().mockResolvedValue(true),
      deleteUpdateForCard: vi.fn().mockResolvedValue(true),
    } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      { markForCheck: vi.fn() } as any
    );
    component.prayer = { id: 'p1' } as any;
    const mutated: string[] = [];
    component.itemMutated.subscribe((id) => mutated.push(id));

    await component.onAddUpdate({ text: 'Update' } as any);
    await component.onDeleteUpdate({ updateId: 'u1' } as any);
    expect(mutated).toEqual(['p1', 'p1']);
  });

  it('opens personal edit modals and emits mutation on save', () => {
    const cdr = { markForCheck: vi.fn() };
    const component = new PresentationSlideCardComponent(
      { isAdmin: false } as any,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      cdr as any
    );
    const mutated: string[] = [];
    component.itemMutated.subscribe((id) => mutated.push(id));

    component.openEditPersonalUpdate({
      update: { id: 'u1', text: 'x' } as any,
      prayerId: 'p1',
    });
    expect(component.showEditPersonalUpdate).toBe(true);
    component.onPersonalUpdateSaved();
    expect(mutated).toEqual(['p1']);

    component.openEditPersonalPrayer({ id: 'p2' } as any);
    component.onPersonalPrayerSaved();
    expect(mutated).toEqual(['p1', 'p2']);
  });

  it('no-ops delete prayer when slide has no prayer', async () => {
    const cardActions = { deleteCardForCard: vi.fn() } as any;
    const component = new PresentationSlideCardComponent(
      cardActions,
      { deletionsAllowed: 'everyone', updatesAllowed: 'everyone' } as any,
      { markForCheck: vi.fn() } as any
    );
    component.onDeletePrayer();
    await Promise.resolve();
    expect(cardActions.deleteCardForCard).not.toHaveBeenCalled();
  });
});
