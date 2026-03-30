import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresentationToolbarComponent } from './presentation-toolbar.component';
import { ChangeDetectorRef } from '@angular/core';

describe('PresentationToolbarComponent', () => {
  let component: PresentationToolbarComponent;
  let mockChangeDetectorRef: any;

  beforeEach(() => {
    mockChangeDetectorRef = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn()
    };
    component = new PresentationToolbarComponent(mockChangeDetectorRef);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.visible).toBe(true);
    expect(component.isPlaying).toBe(false);
    expect(component.showTimer).toBe(true);
    expect(component.countdownRemaining).toBe(0);
    expect(component.currentDuration).toBe(10);
  });

  it('should have all output event emitters defined', () => {
    expect(component.previous).toBeDefined();
    expect(component.next).toBeDefined();
    expect(component.togglePlay).toBeDefined();
    expect(component.settingsToggle).toBeDefined();
    expect(component.exit).toBeDefined();
  });

  it('should emit previous event', () => {
    const emitSpy = vi.spyOn(component.previous, 'emit');
    component.previous.emit();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit next event', () => {
    const emitSpy = vi.spyOn(component.next, 'emit');
    component.next.emit();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit togglePlay event', () => {
    const emitSpy = vi.spyOn(component.togglePlay, 'emit');
    component.togglePlay.emit();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit settingsToggle event', () => {
    const emitSpy = vi.spyOn(component.settingsToggle, 'emit');
    component.settingsToggle.emit();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit exit event', () => {
    const emitSpy = vi.spyOn(component.exit, 'emit');
    component.exit.emit();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should call detectChanges when countdownRemaining changes', () => {
    component.ngOnChanges({
      countdownRemaining: {
        previousValue: 10,
        currentValue: 9,
        firstChange: false,
        isFirstChange: () => false
      }
    });

    expect(mockChangeDetectorRef.detectChanges).toHaveBeenCalled();
  });

  it('should not call detectChanges when other properties change', () => {
    component.ngOnChanges({
      visible: {
        previousValue: false,
        currentValue: true,
        firstChange: false,
        isFirstChange: () => false
      }
    });

    expect(mockChangeDetectorRef.detectChanges).not.toHaveBeenCalled();
  });

  it('should not call detectChanges when changes object is empty', () => {
    component.ngOnChanges({});

    expect(mockChangeDetectorRef.detectChanges).not.toHaveBeenCalled();
  });

  it('should accept visible input', () => {
    component.visible = false;
    expect(component.visible).toBe(false);
    
    component.visible = true;
    expect(component.visible).toBe(true);
  });

  it('should accept isPlaying input', () => {
    component.isPlaying = true;
    expect(component.isPlaying).toBe(true);
    
    component.isPlaying = false;
    expect(component.isPlaying).toBe(false);
  });

  it('should accept showTimer input', () => {
    component.showTimer = false;
    expect(component.showTimer).toBe(false);
    
    component.showTimer = true;
    expect(component.showTimer).toBe(true);
  });

  it('should accept countdownRemaining input', () => {
    component.countdownRemaining = 5;
    expect(component.countdownRemaining).toBe(5);
    
    component.countdownRemaining = 15;
    expect(component.countdownRemaining).toBe(15);
  });

  it('should accept currentDuration input', () => {
    component.currentDuration = 20;
    expect(component.currentDuration).toBe(20);
    
    component.currentDuration = 30;
    expect(component.currentDuration).toBe(30);
  });

  it('should handle ngOnChanges with multiple changes', () => {
    component.ngOnChanges({
      countdownRemaining: {
        previousValue: 10,
        currentValue: 9,
        firstChange: false,
        isFirstChange: () => false
      },
      visible: {
        previousValue: false,
        currentValue: true,
        firstChange: false,
        isFirstChange: () => false
      }
    });

    // Should still call detectChanges if countdownRemaining is present
    expect(mockChangeDetectorRef.detectChanges).toHaveBeenCalled();
  });

  it('should call detectChanges exactly once per ngOnChanges call with countdownRemaining', () => {
    const detectChangesSpy = mockChangeDetectorRef.detectChanges;
    detectChangesSpy.mockClear();

    component.ngOnChanges({
      countdownRemaining: {
        previousValue: 10,
        currentValue: 9,
        firstChange: false,
        isFirstChange: () => false
      }
    });

    expect(detectChangesSpy).toHaveBeenCalledTimes(1);
  });
});

