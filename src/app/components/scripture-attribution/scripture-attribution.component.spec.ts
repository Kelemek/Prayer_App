import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScriptureAttributionComponent } from './scripture-attribution.component';

describe('ScriptureAttributionComponent', () => {
  let fixture: ComponentFixture<ScriptureAttributionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScriptureAttributionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ScriptureAttributionComponent);
  });

  it('renders ESV attribution with esv.org link', () => {
    fixture.componentRef.setInput('translation', 'esv');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const block = root.querySelector('[data-testid="scripture-attribution"]');
    expect(block).toBeTruthy();
    expect(block?.textContent).toContain('ESV® Bible');
    expect(block?.textContent).toContain('Crossway');

    const link = block?.querySelector('a[href="https://www.esv.org"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders KJV public-domain attribution without links', () => {
    fixture.componentRef.setInput('translation', 'kjv');
    fixture.detectChanges();

    const block = fixture.nativeElement.querySelector('[data-testid="scripture-attribution"]');
    expect(block?.textContent).toContain('King James Version (KJV)');
    expect(block?.textContent).toContain('public domain');
    expect(block?.querySelector('a')).toBeNull();
  });

  it('renders NASB attribution with lockman.org link', () => {
    fixture.componentRef.setInput('translation', 'nasb');
    fixture.detectChanges();

    const block = fixture.nativeElement.querySelector('[data-testid="scripture-attribution"]');
    expect(block?.textContent).toContain('New American Standard Bible®');
    expect(block?.querySelector('a[href="https://www.lockman.org"]')).toBeTruthy();
  });
});
