import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  afterEach(() => {
    fixture?.destroy();
  });

  it('renders listen controls when open', () => {
    expect(document.body.textContent).toContain('Listen');
    expect(document.body.textContent).toContain('Pause');
  });

  it('emits close when backdrop is clicked', () => {
    const close = vi.fn();
    component.close.subscribe(close);
    const backdrop = document.body.querySelector('[role="presentation"]') as HTMLElement;
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

    document.body.querySelector('[data-testid="memorize-listen-passage"]').click();
    document.body.querySelector('[data-testid="memorize-listen-repeat"]').click();
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
