import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrayerCardPrayForModalComponent } from './prayer-card-pray-for-modal.component';
import { PrayerEncouragementService } from '../../services/prayer-encouragement.service';

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8');
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe('PrayerCardPrayForModalComponent', () => {
  let fixture: ComponentFixture<PrayerCardPrayForModalComponent>;
  let component: PrayerCardPrayForModalComponent;

  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrayerCardPrayForModalComponent],
      providers: [{ provide: PrayerEncouragementService, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(PrayerCardPrayForModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    component.isPersonal = false;
    component.usesPersonalCooldown = false;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('emits cancel and clears do-not-show checkbox', () => {
    const cancel = vi.fn();
    component.cancel.subscribe(cancel);
    component.prayForDoNotShowAgain = true;
    component.onCancel();
    expect(cancel).toHaveBeenCalled();
    expect(component.prayForDoNotShowAgain).toBe(false);
  });

  it('emits confirm with do-not-show preference', () => {
    const confirm = vi.fn();
    component.confirm.subscribe(confirm);
    component.prayForDoNotShowAgain = true;
    component.onConfirm();
    expect(confirm).toHaveBeenCalledWith(true);
    expect(component.prayForDoNotShowAgain).toBe(false);
  });
});
