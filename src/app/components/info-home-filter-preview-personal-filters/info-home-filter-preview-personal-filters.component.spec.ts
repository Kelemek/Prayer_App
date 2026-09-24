import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InfoHomeFilterPreviewPersonalFiltersComponent } from './info-home-filter-preview-personal-filters.component';
import { setupInfoPreviewComponentResources } from '../info-preview-component-resources.spec-helper';

describe('InfoHomeFilterPreviewPersonalFiltersComponent', () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoHomeFilterPreviewPersonalFiltersComponent;
  let fixture: ComponentFixture<InfoHomeFilterPreviewPersonalFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoHomeFilterPreviewPersonalFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoHomeFilterPreviewPersonalFiltersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('renders chip class tokens and emits openPersonalCategories', () => {
    const emitted: void[] = [];
    component.openPersonalCategories.subscribe(() => emitted.push(undefined));
    fixture.detectChanges();
    expect(component.subFilterChipBaseClass).toBeTruthy();
    expect(component.personalSubFilterGroupClass).toBeTruthy();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(emitted).toHaveLength(1);
  });
});
