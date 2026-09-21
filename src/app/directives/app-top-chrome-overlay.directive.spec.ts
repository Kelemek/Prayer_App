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

function appendTenantBar(height: number): HTMLElement {
  const bar = document.createElement('app-tenant-switcher-bar');
  bar.getBoundingClientRect = () =>
    ({
      height,
      width: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(bar);
  return bar;
}

describe('AppTopChromeOverlayDirective', () => {
  afterEach(() => {
    document.querySelector('app-tenant-switcher-bar')?.remove();
    document.querySelector('.overlay')?.remove();
  });

  it('portals the overlay to body and pads below the tenant switcher bar', () => {
    const bar = appendTenantBar(49.2);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const overlay = document.body.querySelector('.overlay') as HTMLElement;
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay.style.paddingTop).toContain('50px');

    fixture.destroy();
    expect(document.body.contains(overlay)).toBe(false);
    bar.remove();
  });

  it('does not set padding-top when the tenant bar is absent', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const overlay = document.body.querySelector('.overlay') as HTMLElement;
    expect(overlay.style.paddingTop).toBe('');

    fixture.destroy();
  });
});
