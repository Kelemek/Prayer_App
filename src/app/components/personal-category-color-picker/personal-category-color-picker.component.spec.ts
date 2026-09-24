import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { PersonalCategoryColorPickerComponent } from './personal-category-color-picker.component';

describe('PersonalCategoryColorPickerComponent', () => {
  it('applies stack layout classes to the Custom label', async () => {
    const { container } = await render(PersonalCategoryColorPickerComponent, {
      componentInputs: { layout: 'stack', categoryLabel: 'Family' },
    });
    const customLabel = screen.getByLabelText('Choose custom color');
    expect(customLabel.className).toContain('mt-1');
    expect(container.textContent).toContain('Family');
  });

  it('applies inline layout classes to the Custom label', async () => {
    await render(PersonalCategoryColorPickerComponent, {
      componentInputs: { layout: 'inline', categoryLabel: 'Family' },
    });
    const customLabel = screen.getByLabelText('Choose custom color');
    expect(customLabel.className).not.toContain('mt-1');
  });

  it('defaults display label to Category when label is blank', async () => {
    const { fixture } = await render(PersonalCategoryColorPickerComponent, {
      componentInputs: { categoryLabel: '   ' },
    });
    expect(fixture.componentInstance.displayLabel).toBe('Category');
  });

  it('emits normalized color when a preset is selected', async () => {
    const onColor = vi.fn();
    const { fixture } = await render(PersonalCategoryColorPickerComponent, {
      componentInputs: { color: '#2563EB', categoryLabel: 'Work' },
      on: { colorChange: onColor },
    });
    const preset = fixture.componentInstance.presets[1];
    screen.getByLabelText(`Use color ${preset}`).click();
    expect(onColor).toHaveBeenCalledWith(preset);
  });

  it('renders pill display mode and emits from native color input', async () => {
    const onColor = vi.fn();
    await render(PersonalCategoryColorPickerComponent, {
      componentInputs: {
        layout: 'inline',
        colorDisplay: 'pill',
        categoryLabel: 'Health',
      },
      on: { colorChange: onColor },
    });
    const input = document.querySelector(
      'input[type="color"]'
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: '#ff0000' } });
    expect(onColor).toHaveBeenCalledWith('#FF0000');
  });
});
