import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AdminCollapsibleSectionComponent } from './admin-collapsible-section.component';

describe('AdminCollapsibleSectionComponent', () => {
  it('should render title and collapsed trigger by default', async () => {
    await render(
      `<app-admin-collapsible-section
        title="Test Section"
        triggerId="test-trigger"
        panelId="test-panel"
        [expanded]="false"
      ></app-admin-collapsible-section>`,
      {
        imports: [AdminCollapsibleSectionComponent],
      }
    );

    const trigger = screen.getByRole('button', { name: /Test Section/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe('test-panel');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('should show panel when expanded', async () => {
    await render(
      `<app-admin-collapsible-section
        title="Test Section"
        triggerId="test-trigger"
        panelId="test-panel"
        [expanded]="true"
      >
        <p>Panel content</p>
      </app-admin-collapsible-section>`,
      {
        imports: [AdminCollapsibleSectionComponent],
      }
    );

    expect(screen.getByRole('region')).toBeTruthy();
    expect(screen.getByText('Panel content')).toBeTruthy();
  });

  it('should emit expandedChange when trigger is clicked', async () => {
    const expandedChange = vi.fn();

    const { fixture } = await render(AdminCollapsibleSectionComponent, {
      componentInputs: {
        title: 'Test Section',
        triggerId: 'test-trigger',
        panelId: 'test-panel',
        expanded: false,
      },
    });

    fixture.componentInstance.expandedChange.subscribe(expandedChange);

    await userEvent.click(screen.getByRole('button', { name: /Test Section/i }));

    expect(expandedChange).toHaveBeenCalledWith(true);
  });
});
