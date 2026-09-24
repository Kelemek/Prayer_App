import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfoHomeFilterPreviewPersonalCardComponent } from './info-home-filter-preview-personal-card.component';
import { setupInfoPreviewComponentResources } from '../info-preview-component-resources.spec-helper';

describe('InfoHomeFilterPreviewPersonalCardComponent', () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoHomeFilterPreviewPersonalCardComponent;
  let fixture: ComponentFixture<InfoHomeFilterPreviewPersonalCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoHomeFilterPreviewPersonalCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoHomeFilterPreviewPersonalCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('exposes shell and header date getters', () => {
    fixture.detectChanges();
    expect(component.shellClasses.length).toBeGreaterThan(0);
    expect(component.headerDateParts.date).toBeTruthy();
  });

  it('emits personal actions from overflow menu handlers', () => {
    const emitted: string[] = [];
    component.openPersonalAction.subscribe((action) => emitted.push(action));
    component.overflowItems[0]?.onSelect?.();
    component.overflowItems[1]?.onSelect?.();
    component.overflowItems[2]?.onSelect?.();
    expect(emitted).toEqual(['answered', 'edit', 'delete']);
  });
});
