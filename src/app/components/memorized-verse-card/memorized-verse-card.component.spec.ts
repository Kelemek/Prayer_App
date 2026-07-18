import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { MemorizedVerseCardComponent } from './memorized-verse-card.component';
import type { MemorizedItem } from '../../types/memorization';

@Component({
  selector: 'app-scripture-hover-preview',
  standalone: true,
  template: '<ng-content />',
})
class ScriptureHoverPreviewStubComponent {
  @Input() reference = '';
  @Input() translation = '';
  @Input() disabled = false;
}

describe('MemorizedVerseCardComponent', () => {
  let fixture: ComponentFixture<MemorizedVerseCardComponent>;
  let component: MemorizedVerseCardComponent;

  const verseItem: MemorizedItem = {
    id: 'item-1',
    reference: 'John 3:16',
    text: 'For God so loved the world',
    translation: 'esv',
    dateAdded: Date.now(),
    lastPracticedAt: new Date('2026-01-15').getTime(),
    practiceSessions: [
      { date: 1, wrongAttempts: 0, correctKeystrokes: 10, completed: true },
      { date: 2, wrongAttempts: 1, correctKeystrokes: 5, completed: false },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemorizedVerseCardComponent],
    })
      .overrideComponent(MemorizedVerseCardComponent, {
        set: { imports: [ScriptureHoverPreviewStubComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MemorizedVerseCardComponent);
    component = fixture.componentInstance;
    component.item = verseItem;
    fixture.detectChanges();
  });

  it('renders reference and completed session count', () => {
    expect(fixture.nativeElement.textContent).toContain('John 3:16');
    expect(fixture.nativeElement.textContent).toContain('1 completed');
    expect(component.completedCount).toBe(1);
  });

  it('emits practice and remove events', () => {
    const practice = vi.fn();
    const remove = vi.fn();
    component.practice.subscribe(practice);
    component.remove.subscribe(remove);

    fixture.nativeElement.querySelector('button[title="Remove"]').click();
    expect(remove).toHaveBeenCalledWith(verseItem);

    fixture.nativeElement.querySelector('button:not([title="Remove"])').click();
    expect(practice).toHaveBeenCalledWith(verseItem);
  });

  it('formats dates for display', () => {
    expect(component.formatDate(verseItem.lastPracticedAt!)).toMatch(/Jan/);
  });
});
