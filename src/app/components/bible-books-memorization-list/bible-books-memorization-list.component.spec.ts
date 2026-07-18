import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BibleBooksMemorizationListComponent } from './bible-books-memorization-list.component';

describe('BibleBooksMemorizationListComponent', () => {
  let fixture: ComponentFixture<BibleBooksMemorizationListComponent>;
  let component: BibleBooksMemorizationListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BibleBooksMemorizationListComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BibleBooksMemorizationListComponent);
    component = fixture.componentInstance;
    component.scope = 'all';
    fixture.detectChanges();
  });

  it('shows testament tabs for the full canon', () => {
    expect(component.showTabs).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Old Testament');
    expect(component.filteredBooks.length).toBe(39);
  });

  it('filters to old testament books when tab changes', () => {
    component.setTestament('ot');
    expect(component.filteredBooks.every((book) => book.testament === 'ot')).toBe(true);
  });

  it('hides tabs and lists only NT books for nt scope', () => {
    component.scope = 'nt';
    component.ngOnChanges({ scope: { currentValue: 'nt', previousValue: 'all', firstChange: false, isFirstChange: () => false } });
    fixture.detectChanges();
    expect(component.showTabs).toBe(false);
    expect(component.testament).toBe('nt');
    expect(component.filteredBooks.every((book) => book.testament === 'nt')).toBe(true);
  });
});
