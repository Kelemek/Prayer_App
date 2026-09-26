import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { appTopChromeOverlayPaddingTop } from '../lib/measure-app-top-chrome-inset';

/**
 * Portals a `fixed inset-0` overlay to `document.body` and applies
 * `safe-area-overlay` so notches and home indicators are respected on iOS.
 */
@Directive({
  selector: '[appTopChromeOverlay]',
  standalone: true,
})
export class AppTopChromeOverlayDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private movedToBody = false;

  private readonly onResize = (): void => {
    this.applyPadding();
  };

  ngAfterViewInit(): void {
    const overlay = this.host.nativeElement;
    overlay.classList.add('safe-area-overlay');
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
      this.movedToBody = true;
    }
    this.applyPadding();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (!this.movedToBody) {
      return;
    }
    const overlay = this.host.nativeElement;
    if (overlay.parentElement === document.body) {
      overlay.remove();
    }
    this.movedToBody = false;
  }

  private applyPadding(): void {
    const overlay = this.host.nativeElement;
    const padding = appTopChromeOverlayPaddingTop();
    if (padding) {
      overlay.style.paddingTop = padding;
      return;
    }
    overlay.style.removeProperty('padding-top');
  }
}
