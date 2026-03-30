import { vi } from 'vitest';
import { PullToRefreshDirective } from './pull-to-refresh.directive';

// Simple mock for NgZone.run so we don't need real Zone.js
const createMockZone = () =>
  ({
    run: (fn: () => unknown) => fn()
  } as unknown);

describe('PullToRefreshDirective', () => {
  let directive: PullToRefreshDirective;
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement('div');
    // Ensure scrollTop is defined
    Object.defineProperty(element, 'scrollTop', {
      value: 0,
      writable: true
    });

    const mockZone = createMockZone() as any;
    directive = new PullToRefreshDirective({ nativeElement: element } as any, mockZone);
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  it('should emit refresh when pulled down beyond threshold at top', () => {
    return new Promise<void>((resolve) => {
      directive.refresh.subscribe(() => {
        resolve();
      });

      // Simulate touch start at y=0
      directive.onTouchStart({
        touches: [{ clientY: 0 }] as any
      } as TouchEvent);

      // Simulate touch move well beyond threshold (currently 140px)
      directive.onTouchMove({
        touches: [{ clientY: 220 }] as any
      } as TouchEvent);
    });
  });

  it('should not emit refresh when disabled', () => {
    const spy = vi.fn();
    directive.refresh.subscribe(spy);
    directive.appPullToRefreshDisabled = true;

    directive.onTouchStart({
      touches: [{ clientY: 0 }] as any
    } as TouchEvent);

    directive.onTouchMove({
      touches: [{ clientY: 220 }] as any
    } as TouchEvent);

    expect(spy).not.toHaveBeenCalled();
  });
});

