import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MemorizeListenSpeedButtonComponent } from './memorize-listen-speed-button.component';

describe('MemorizeListenSpeedButtonComponent', () => {
  let fixture: ComponentFixture<MemorizeListenSpeedButtonComponent>;
  let component: MemorizeListenSpeedButtonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemorizeListenSpeedButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MemorizeListenSpeedButtonComponent);
    component = fixture.componentInstance;
    component.value = 1;
    fixture.detectChanges();
  });

  it('shows current speed label', () => {
    expect(fixture.nativeElement.textContent).toContain('1x');
    expect(component.ariaLabel).toContain('1x');
  });

  it('opens menu and emits selected speed', () => {
    const valueChange = vi.fn();
    component.valueChange.subscribe(valueChange);

    component.toggleMenu();
    expect(component.menuOpen).toBe(true);

    component.choose(1.5);
    expect(valueChange).toHaveBeenCalledWith(1.5);
    expect(component.menuOpen).toBe(false);
  });

  it('closes menu on outside mousedown', () => {
    component.toggleMenu();
    component.onDocumentMouseDown(new MouseEvent('mousedown', { bubbles: true }));
    expect(component.menuOpen).toBe(false);
  });

  it('closes menu on Escape', () => {
    component.toggleMenu();
    component.onDocumentKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.menuOpen).toBe(false);
  });
});
