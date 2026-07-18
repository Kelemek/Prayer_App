import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MemorizeListenControlsDialogComponent } from './memorize-listen-controls-dialog.component';

describe('MemorizeListenControlsDialogComponent', () => {
  let fixture: ComponentFixture<MemorizeListenControlsDialogComponent>;
  let component: MemorizeListenControlsDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemorizeListenControlsDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MemorizeListenControlsDialogComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.primaryLabel = 'Pause';
    fixture.detectChanges();
  });

  it('renders listen controls when open', () => {
    expect(fixture.nativeElement.textContent).toContain('Listen');
    expect(fixture.nativeElement.textContent).toContain('Pause');
  });

  it('emits close when backdrop is clicked', () => {
    const close = vi.fn();
    component.close.subscribe(close);
    const backdrop = fixture.nativeElement.querySelector('[role="presentation"]') as HTMLElement;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(close).toHaveBeenCalled();
  });

  it('emits primary, repeat, and speed events', () => {
    const primaryClick = vi.fn();
    const repeatToggle = vi.fn();
    const speedSelect = vi.fn();
    component.primaryClick.subscribe(primaryClick);
    component.repeatToggle.subscribe(repeatToggle);
    component.speedSelect.subscribe(speedSelect);

    fixture.nativeElement.querySelector('[data-testid="memorize-listen-passage"]').click();
    fixture.nativeElement.querySelector('[data-testid="memorize-listen-repeat"]').click();
    component.speedSelect.emit(1.25);

    expect(primaryClick).toHaveBeenCalled();
    expect(repeatToggle).toHaveBeenCalled();
    expect(speedSelect).toHaveBeenCalledWith(1.25);
  });

  it('closes on backdrop touchstart and detaches on destroy', () => {
    const close = vi.fn();
    component.close.subscribe(close);
    component.ngAfterViewInit();

    const backdrop = component.backdropRef?.nativeElement;
    expect(backdrop).toBeTruthy();
    backdrop!.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    expect(close).toHaveBeenCalled();

    component.ngOnDestroy();
    close.mockClear();
    backdrop!.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    expect(close).not.toHaveBeenCalled();
  });
});
