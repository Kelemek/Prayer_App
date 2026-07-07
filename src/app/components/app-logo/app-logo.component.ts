import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, Inject, Optional, InjectionToken } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '../../services/branding.service';
import { Subject, takeUntil } from 'rxjs';

export const BRANDING_SERVICE_TOKEN = new InjectionToken<BrandingService>('BrandingService');

/** Default app icon shown beside the title when no custom tenant logo is configured. */
const DEFAULT_APP_ICON_SRC = '/icons/icon-96.webp';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (useLogo && imageUrl) {
      <div class="min-w-0 flex-1">
        <img 
          [src]="imageUrl" 
          alt="Church Logo" 
          class="h-16 w-auto max-w-xs object-contain"
          width="256"
          height="64"
        />
      </div>
    }
    @if (!useLogo && appTitle) {
      <div class="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
        <img
          [src]="defaultAppIconSrc"
          alt=""
          aria-hidden="true"
          class="h-8 w-8 sm:h-11 sm:w-11 shrink-0 rounded-lg object-contain"
          width="44"
          height="44"
        />
        <h1 class="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 min-w-0">
          {{ appTitle }}
        </h1>
      </div>
    }
  `,
  styles: []
})
export class AppLogoComponent implements OnInit, OnDestroy {
  imageUrl: string = '';
  useLogo = false;
  appTitle: string = 'Church Prayer Manager';
  readonly defaultAppIconSrc = DEFAULT_APP_ICON_SRC;
  @Output() logoStatusChange = new EventEmitter<boolean>();
  
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(BRANDING_SERVICE_TOKEN) private brandingService: BrandingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeBranding();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeBranding() {
    await this.brandingService.initialize();
    
    this.brandingService.branding$
      .pipe(takeUntil(this.destroy$))
      .subscribe(branding => {
        this.useLogo = branding.useLogo;
        this.appTitle = branding.appTitle;
        this.updateImageUrl(branding);
        this.cdr?.markForCheck();
      });
  }

  private updateImageUrl(branding: any) {
    if (!this.useLogo) {
      this.imageUrl = '';
      this.logoStatusChange.emit(false);
      this.cdr?.markForCheck();
      return;
    }

    this.imageUrl = this.brandingService.getImageUrl(branding);
    const hasLogo = this.useLogo && !!this.imageUrl;
    this.logoStatusChange.emit(hasLogo);
    this.cdr?.markForCheck();
  }
}
