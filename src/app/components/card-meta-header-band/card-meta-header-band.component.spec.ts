import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { CardMetaHeaderBandComponent } from './card-meta-header-band.component';

@Component({
  standalone: true,
  imports: [CdkDropList, CdkDrag, CardMetaHeaderBandComponent],
  template: `
    <div cdkDropList>
      <div cdkDrag>
        <app-card-meta-header-band
          [centerDate]="centerDate"
          [centerTime]="centerTime"
          [centerDragHandle]="centerDragHandle"
        />
      </div>
    </div>
  `,
})
class CardMetaHeaderBandHostComponent {
  centerDate = 'Apr 18, 2026';
  centerTime = '08:48 AM';
  centerDragHandle = false;
}

describe('CardMetaHeaderBandComponent', () => {
  it('uses symmetric flanking columns so presentation date/time stay centered', () => {
    const component = new CardMetaHeaderBandComponent();
    component.bandSize = 'sm';
    component.centerDate = 'Apr 18, 2026';
    component.centerTime = '08:48 AM';

    expect(component.centerClass).toContain('text-center');
    expect(component.centerClass).not.toContain('max-w-');
  });

  it('stacks home date/time below sm', () => {
    const component = new CardMetaHeaderBandComponent();
    component.bandSize = 'sm';
    component.centerDate = 'Apr 18, 2026';
    component.centerTime = '08:48 AM';

    expect(component.centerClass).not.toContain('whitespace-nowrap');
  });

  it('uses the inner shell radius instead of rounded-t-lg', () => {
    const component = new CardMetaHeaderBandComponent();
    expect(component.roundedClasses).toBe('rounded-t-shell-inner shell-radius-lg shell-border-w-2');
    expect(component.roundedClasses).not.toContain('rounded-t-lg');
  });

  it('shows a drag grip after the date and time when reorder is available', async () => {
    const { fixture } = await render(CardMetaHeaderBandHostComponent, {
      componentProperties: { centerDragHandle: true },
    });

    expect(screen.getByLabelText('Drag to reorder')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-prayer-card-drag-handle] svg')
    ).toBeTruthy();
  });

  it('hides the drag grip when reorder is not available', async () => {
    const { fixture } = await render(CardMetaHeaderBandHostComponent);

    expect(screen.queryByLabelText('Drag to reorder')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-prayer-card-drag-handle]')
    ).toBeNull();
  });
});
