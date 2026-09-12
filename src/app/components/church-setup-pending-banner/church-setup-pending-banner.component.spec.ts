import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChurchSetupPendingBannerComponent } from './church-setup-pending-banner.component';

describe('ChurchSetupPendingBannerComponent', () => {
  let fixture: ComponentFixture<ChurchSetupPendingBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchSetupPendingBannerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ChurchSetupPendingBannerComponent);
  });

  it('is hidden until visible', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain("You're paid");
  });

  it('shows finish-on-web copy and emits CTAs', () => {
    const open: number[] = [];
    const copy: number[] = [];
    fixture.componentInstance.openWeb.subscribe(() => open.push(1));
    fixture.componentInstance.copyLink.subscribe(() => copy.push(1));
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "You're paid — finish church setup on the web"
    );
    const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find((el) => el.textContent?.includes('Open setup'))?.click();
    buttons.find((el) => el.textContent?.includes('Copy link'))?.click();
    expect(open).toEqual([1]);
    expect(copy).toEqual([1]);
  });
});
