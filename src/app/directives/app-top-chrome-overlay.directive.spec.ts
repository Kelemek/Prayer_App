import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AppTopChromeOverlayDirective } from './app-top-chrome-overlay.directive';

@Component({
  standalone: true,
  imports: [AppTopChromeOverlayDirective],
  template: `<div appTopChromeOverlay class="overlay"></div>`,
})
class HostComponent {}

describe('AppTopChromeOverlayDirective', () => {
  afterEach(() => {
    document.querySelector('.overlay')?.remove();
  });

  it('portals the overlay to body with safe-area class', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const overlay = document.body.querySelector('.overlay') as HTMLElement;
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay.classList.contains('safe-area-overlay')).toBe(true);
    expect(overlay.style.paddingTop).toBe('');

    fixture.destroy();
    expect(document.body.contains(overlay)).toBe(false);
  });
});
