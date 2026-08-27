import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CardActionsOverflowMenuComponent } from './card-actions-overflow-menu.component';

describe('CardActionsOverflowMenuComponent', () => {
  let component: CardActionsOverflowMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardActionsOverflowMenuComponent],
    }).compileComponents();

    component = TestBed.createComponent(CardActionsOverflowMenuComponent).componentInstance;
    component.items = [
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash',
        tone: 'red',
        onSelect: vi.fn(),
      },
    ];
    component.menuOpen = true;
    component.triggerRef = {
      nativeElement: document.createElement('button'),
    };
  });

  it('swallows outside clicks so they do not activate controls underneath', () => {
    const underlying = document.createElement('button');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: underlying });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    component.onDocumentClick(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(component.menuOpen).toBe(false);
  });

  it('ignores clicks on the menu trigger while open', () => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', {
      value: component.triggerRef!.nativeElement,
    });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    component.onDocumentClick(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(component.menuOpen).toBe(true);
  });
});
