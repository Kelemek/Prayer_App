import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RichTextViewComponent } from './rich-text-view.component';

describe('RichTextViewComponent', () => {
  let fixture: ComponentFixture<RichTextViewComponent>;
  let component: RichTextViewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichTextViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RichTextViewComponent);
    component = fixture.componentInstance;
  });

  it('renders markdown as sanitized HTML', () => {
    fixture.componentRef.setInput('text', '**hello** [world](https://example.com)');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.innerHTML).toContain('<strong>hello</strong>');
    const link = host.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders nothing for empty/null text', () => {
    fixture.componentRef.setInput('text', null);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.app-rich-text-view')?.innerHTML.trim()).toBe('');
  });

  it('strips disallowed HTML tags', () => {
    fixture.componentRef.setInput('text', '<script>bad()</script>Safe content');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.innerHTML).not.toContain('<script');
    expect(host.textContent).toContain('Safe content');
  });
});
