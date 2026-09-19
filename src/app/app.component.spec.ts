import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { AppComponent } from './app.component';
import { ClientVersionGateService } from './services/client-version-gate.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  template: '<div data-testid="app-shell-stub">shell</div>',
})
class AppShellStubComponent {}

@Component({
  selector: 'app-force-upgrade',
  standalone: true,
  template: '<div data-testid="force-upgrade-gate">wall</div>',
})
class ForceUpgradeStubComponent {}

describe('AppComponent', () => {
  async function renderHost(blocked: boolean): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: ClientVersionGateService,
          useValue: { isBlocked: () => blocked },
        },
      ],
    })
      .overrideComponent(AppComponent, {
        set: { imports: [AppShellStubComponent, ForceUpgradeStubComponent] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the app shell when the gate is open', async () => {
    const root = await renderHost(false);
    expect(root.querySelector('[data-testid="app-shell-stub"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="force-upgrade-gate"]')).toBeNull();
  });

  it('does not construct the app shell when the gate is blocked', async () => {
    const root = await renderHost(true);
    expect(root.querySelector('[data-testid="force-upgrade-gate"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="app-shell-stub"]')).toBeNull();
  });
});
